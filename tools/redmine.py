"""Write export/redmine.csv: one row per tracker item, ready for Redmine's Issues > Import (CSV, UTF-8).

    python tools/redmine.py

Redmine maps the columns in the import dialog. Subject/Description/Tracker/Priority/Status/Category are standard;
"Side", "Item ID", "Tests", "Found" are meant for custom fields (create them first or skip the mapping).
The description is Markdown (set Administration > Settings > General > Text formatting to Markdown, or CommonMark).
export/ is not served by Vercel (only site/ is), but keep the file out of public places: it lists unfixed security gaps.
"""
import csv, json, pathlib

ROOT = pathlib.Path(__file__).resolve().parent.parent
items = json.loads((ROOT / "data" / "items.json").read_text(encoding="utf8"))
PRIO = {"high": "High", "medium": "Normal", "low": "Low", "unrated": "Normal"}
STATUS = {"open": "New", "in-progress": "In Progress", "fixed-per-log": "Resolved", "fixed": "Closed", "still-bug": "New",
          "decision": "Feedback", "wontfix": "Rejected", "unknown": "New"}


def body(i):
    out = [i.get("summary") or i["title"]]
    if i.get("steps"):
        out += ["", "**Steps to reproduce**"] + [f"{n}. {x}" for n, x in enumerate(i["steps"], 1)]
    for key, label in (("expected", "Expected"), ("actual", "Actual"), ("where", "Where in code"), ("verify", "How to verify the fix")):
        if i.get(key):
            out += ["", f"**{label}**", i[key]]
    if i.get("tests"):
        out += ["", "**e2e tests**", ", ".join(i["tests"])]
    ev = i.get("status_evidence")
    if ev:
        out += ["", "**Status evidence**", ev + (f" (checked {i['checked']['date']} {i['checked']['ref']})" if i.get("checked", {}).get("date") else "")]
    if i.get("refs"):
        out += ["", "**Refs**", ", ".join(i["refs"])]
    out += ["", f"Source: {i['source']} | Item ID: {i['id']} | Evidence level: {i['evidence_level']}"]
    return "\n".join(out)


def main():
    (ROOT / "export").mkdir(exist_ok=True)
    with open(ROOT / "export" / "redmine.csv", "w", newline="", encoding="utf-8-sig") as f:
        w = csv.writer(f)
        w.writerow(["Subject", "Description", "Tracker", "Priority", "Status", "Category", "Side", "Item ID", "Tests", "Found"])
        for i in items:
            tracker = "Bug" if i["status"] in ("still-bug", "open", "in-progress", "fixed", "fixed-per-log") else "Support"
            w.writerow([i["title"], body(i), tracker, PRIO[i["severity"]], STATUS[i["status"]], i["module"], i["side"], i["id"],
                        ", ".join(i.get("tests", [])), i.get("found", "")])
    print(len(items), "rows -> export/redmine.csv")


main()
