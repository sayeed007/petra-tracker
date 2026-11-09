"""Merge data/raw/*.json + data/overrides.json into data/items.json and site/index.html.

    python tools/build.py

Raw files are the output of the extraction (re-runnable). Manual status changes go ONLY in data/overrides.json
({"<item id>": {"status": "...", "note": "...", "ref": "branch or commit", "date": "YYYY-MM-DD"}}), so a re-extraction never
loses a decision.
"""
import json, pathlib, collections, datetime

ROOT = pathlib.Path(__file__).resolve().parent.parent
RAW, SITE = ROOT / "data" / "raw", ROOT / "site"
STATUSES = ["open", "in-progress", "fixed-per-log", "fixed", "still-bug", "decision", "wontfix", "unknown"]
SEVS = ["high", "medium", "low", "unrated"]


def load():
    items, seen = [], set()
    for p in sorted(RAW.glob("*.json")):
        for it in json.loads(p.read_text(encoding="utf8")):
            if it["id"] in seen:
                it["id"] += "#" + p.stem
            seen.add(it["id"])
            it.setdefault("size", "")
            it.setdefault("theme", "")
            it["set"] = p.stem
            items.append(it)
    ov_path = ROOT / "data" / "overrides.json"
    ov = json.loads(ov_path.read_text(encoding="utf8")) if ov_path.exists() else {}
    for it in items:
        o = ov.get(it["id"])
        if o:
            it["status"] = o.get("status", it["status"])
            it["status_evidence"] = o.get("note", it["status_evidence"])
            it["checked"] = {"ref": o.get("ref", ""), "date": o.get("date", "")}
        if it["status"] not in STATUSES:
            it["status"] = "unknown"
        if it["severity"] not in SEVS:
            it["severity"] = "unrated"
    order = {s: i for i, s in enumerate(SEVS)}
    items.sort(key=lambda i: (i["module"], order[i["severity"]], i["id"]))
    return items


def main():
    items = load()
    (ROOT / "data" / "items.json").write_text(json.dumps(items, indent=1, ensure_ascii=False), encoding="utf8")
    BUILD = ROOT / "build"  # plain page, git-ignored, never published: tools/publish.sh encrypts it into site/
    BUILD.mkdir(exist_ok=True)
    tpl = (ROOT / "tools" / "template.html").read_text(encoding="utf8")
    html = tpl.replace("/*DATA*/[]", json.dumps(items, ensure_ascii=False)).replace("__BUILT__", datetime.date.today().isoformat())
    (BUILD / "index.html").write_text(html, encoding="utf8")
    by = collections.Counter((i["module"], i["status"]) for i in items)
    print(len(items), "items")
    for m in sorted({i["module"] for i in items}):
        print(f"  {m:18}", {s: by[(m, s)] for s in STATUSES if by[(m, s)]})


main()
