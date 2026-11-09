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
    mg_path = ROOT / "data" / "merges.json"
    merges = json.loads(mg_path.read_text(encoding="utf8")) if mg_path.exists() else {}
    byid = {it["id"]: it for it in items}
    drop = set()
    for pid, dups in merges.items():
        prim = byid[pid]
        for d in dups:
            dup = byid[d]
            if dup["status"] != prim["status"] or dup["module"] != prim["module"] or dup["side"] != prim["side"]:
                raise SystemExit(f"merge {d} -> {pid}: status/module/side differ, fix merges.json")
            prim["refs"] = list(dict.fromkeys(prim["refs"] + [d] + dup["refs"]))
            drop.add(d)
        prim["merged"] = dups
    items = [it for it in items if it["id"] not in drop]
    order = {s: i for i, s in enumerate(SEVS)}
    items.sort(key=lambda i: (i["module"], order[i["severity"]], i["id"]))
    return items


def main():
    items = load()
    (ROOT / "data" / "items.json").write_text(json.dumps(items, indent=1, ensure_ascii=False), encoding="utf8")
    SITE.mkdir(exist_ok=True)
    tpl = (ROOT / "tools" / "template.html").read_text(encoding="utf8")
    asd = json.loads((ROOT / "data" / "assessed.json").read_text(encoding="utf8"))
    box = "".join(f'<div><b>{k}</b> {v["branch"]} @<code>{v["sha"]}</code> (head {v["head_time"]}) &middot; assessed {v["assessed"]} &middot; {v["scope"]}</div>' for k, v in asd.items())
    html = tpl.replace("__ASSESSED__", box).replace("/*DATA*/[]", json.dumps(items, ensure_ascii=False)).replace("__BUILT__", datetime.date.today().isoformat())
    (SITE / "index.html").write_text(html, encoding="utf8")
    by = collections.Counter((i["module"], i["status"]) for i in items)
    print(len(items), "items")
    for m in sorted({i["module"] for i in items}):
        print(f"  {m:18}", {s: by[(m, s)] for s in STATUSES if by[(m, s)]})


main()
