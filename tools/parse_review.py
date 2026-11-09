"""Turns the code-review work plans (BACKEND-BY-MODULE / FRONTEND-BY-MODULE) into tracker items.

Each '### title [SEV] [EVIDENCE] (source IDs: ...)' heading becomes one item. Frontend items are marked fixed when
their source IDs or heading number appear in the matching FIX-LOG 'Fixed' text (status 'fixed-per-log': the log says so,
nobody has checked the branch yet).
"""
import json, re, pathlib, sys

ROOT = pathlib.Path(r"D:\petra_erp\code-review-2026-11")
OUT = pathlib.Path(r"D:\petra_erp\petra-tracker\data\raw")

BE_FILES = {
    "01-accounting.md": "accounting", "02-purchase.md": "purchase", "03-sales.md": "sales",
    "04-inventory.md": "inventory", "05-reports-dashboard.md": "reports", "06-platform.md": "settings-platform",
}
FE_FILES = {
    "01-accounting.md": "accounting", "02-purchase.md": "purchase", "03-sales.md": "sales",
    "04-inventory.md": "inventory", "05-reports-dashboard.md": "reports", "06-settings-platform.md": "settings-platform",
    "07-shared.md": "shared", "08-moved-in.md": "other",
}
HEAD = re.compile(r"^###\s+(?P<title>.*?)\s*(?P<tags>(?:\[[^\]]+\]\s*)*)(?:\(source IDs?:\s*(?P<ids>[^)]*)\))?\s*$")


def parse(path, module, side, prefix):
    items, section, theme = [], "", ""
    for line in path.read_text(encoding="utf8").splitlines():
        if line.startswith("## "):
            section = line[3:].strip().lower()
            continue
        if not line.startswith("### "):
            continue
        m = HEAD.match(line)
        if not m:
            continue
        title, tags = m.group("title").strip(), m.group("tags") or ""
        tag_list = re.findall(r"\[([^\]]+)\]", tags)
        sev = next((t.lower() for t in tag_list if t.upper() in ("HIGH", "MEDIUM", "LOW")), None)
        ev = next((t.lower().split()[0] for t in tag_list if t.split()[0].upper() in ("VERIFIED", "LIKELY", "SUSPECT")), "unknown")
        size = next((t.split()[1] for t in tag_list if t.lower().startswith("size")), "")
        if sev is None and not ("decision" in section or "answer" in section):
            theme = title  # a theme heading, not a work item
            continue
        num = re.match(r"^(\d+(?:\.\d+)?)\s+(.*)$", title)
        ids = [i.strip() for i in (m.group("ids") or "").split(",") if i.strip()]
        items.append({
            "id": f"{prefix}:{module}:{num.group(1) if num else len(items) + 1}",
            "module": module, "side": side,
            "severity": sev or "unrated",
            "title": (num.group(2) if num else title)[:140],
            "summary": "", "status": "decision" if sev is None else "open",
            "status_evidence": "listed in the review work plan; not re-checked",
            "evidence_level": ev, "found": "2026-11-02",
            "source": f"{path.parent.name}/{path.name}", "refs": ids, "size": size, "theme": theme,
        })
    return items


def fixlog_text(module):
    names = {"accounting": ["accounting", "r3-accounting"], "purchase": ["purchase", "purchase-2", "r3-purchase"],
             "sales": ["sales", "r3-sales"], "inventory": ["inventory", "inventory-2"],
             "reports": ["reports-dashboard"], "settings-platform": ["settings-platform"], "shared": ["shared"],
             "other": ["followups"]}.get(module, [])
    text = ""
    for n in names:
        p = ROOT / "FRONTEND-BY-MODULE" / f"FIX-LOG-{n}.md"
        if p.exists():
            text += "\n" + p.read_text(encoding="utf8")
    return text


def fixed_part(text):
    """Everything before a 'Not fixed' / 'Stopped at' / 'Skipped' style heading counts as fixed."""
    cut = re.search(r"^##+\s*(not fixed|stopped at|skipped|left|open|deferred|remaining)", text, re.I | re.M)
    return text[: cut.start()] if cut else text


def main():
    be = []
    for f, mod in BE_FILES.items():
        be += parse(ROOT / "BACKEND-BY-MODULE" / f, mod, "backend", "rv-be")
    fe = []
    for f, mod in FE_FILES.items():
        items = parse(ROOT / "FRONTEND-BY-MODULE" / f, mod, "frontend", "rv-fe")
        log = fixlog_text(mod)
        fixed = fixed_part(log)
        for it in items:
            num = it["id"].rsplit(":", 1)[1]
            hit_ids = [i for i in it["refs"] if re.search(rf"(?<![\w-]){re.escape(i)}(?![\w-])", fixed)]
            hit_num = re.search(rf"(?<![\d.]){re.escape(num)}(?![\d.])\b", fixed) if "." in num else None
            if hit_ids:
                it["status"], it["status_evidence"] = "fixed-per-log", f"fix log names {hit_ids[0]}"
            elif hit_num:
                it["status"], it["status_evidence"] = "fixed-per-log", f"fix log mentions item {num}"
        fe += items
    (OUT / "review-be.json").write_text(json.dumps(be, indent=1, ensure_ascii=False), encoding="utf8")
    (OUT / "review-fe.json").write_text(json.dumps(fe, indent=1, ensure_ascii=False), encoding="utf8")
    from collections import Counter
    for name, arr in (("BE", be), ("FE", fe)):
        print(name, len(arr), dict(Counter(i["module"] for i in arr)), dict(Counter(i["status"] for i in arr)))


main()
