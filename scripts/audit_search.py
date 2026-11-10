"""Rebuild search accounting from saved bibliographic responses; no network required."""
import csv
import json
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
SEARCH = ROOT / "data/search/2026-11-10"
PREFILTER = r"light|illumin|dosimet|clouclip|mylyt|daysimet|spectrace|spectrawear|kronowise|actlumus|ocuwear"


def rebuild():
    audit_path = ROOT / "data/search-audit.json"
    audit = json.loads(audit_path.read_text())
    library = json.loads((ROOT / "data/library.json").read_text())
    records, queries = {}, []
    for path in sorted(SEARCH.glob("*titles.json")):
        result = json.loads(path.read_text())
        hits = result["resultList"]["result"]
        assert len(hits) == result["hitCount"], f"Incomplete result set: {path.name}"
        queries.append({"file": str(path.relative_to(ROOT)), "query": result["request"]["queryString"], "hits": result["hitCount"], "retrieved": len(hits)})
        for record in hits:
            records[(record["source"], record["id"])] = record
    included = {s["doi"].casefold(): s for s in library["studies"]}
    decisions = {r["doi"].casefold(): r for r in audit["otherCandidates"] if r.get("doi")}
    selected = [r for r in records.values() if re.search(PREFILTER, r.get("title", ""), re.I)]
    audit["queries"] = queries
    audit["accounting"] = {
        "retrievedAcrossQueries": sum(q["retrieved"] for q in queries),
        "uniqueBibliographicRecords": len(records),
        "titlePrefilterRetained": len(selected),
        "titlePrefilterOmitted": len(records) - len(selected),
        "includedPapers": len(library["studies"]),
        "deviceEntries": len(library["devices"]),
        "otherCandidateRecords": len(audit["otherCandidates"]),
    }
    audit["titlePrefilterRegex"] = PREFILTER
    audit_path.write_text(json.dumps(audit, ensure_ascii=False, indent=2) + "\n")
    with (ROOT / "data/title-triage.csv").open("w", newline="", encoding="utf-8-sig") as f:
        fields = ["source", "id", "doi", "title", "title_prefilter", "disposition"]
        writer = csv.DictWriter(f, fieldnames=fields); writer.writeheader()
        for record in sorted(records.values(), key=lambda r: (r["source"], r["id"])):
            doi = record.get("doi", "").casefold()
            keep = bool(re.search(PREFILTER, record.get("title", ""), re.I))
            disposition = "Included in directory" if doi in included else decisions[doi]["decision"] if doi in decisions else "Not prioritised after title inspection; abstract/full text not assessed" if keep else "Omitted by automated title prefilter; not manually screened"
            writer.writerow({**{k: record.get(k, "") for k in ["source", "id", "doi", "title"]}, "title_prefilter": keep, "disposition": disposition})
    with (ROOT / "data/search-decisions.csv").open("w", newline="", encoding="utf-8-sig") as f:
        writer = csv.DictWriter(f, fieldnames=["citation", "doi", "url", "decision", "reason", "sourceInspected"])
        writer.writeheader()
        for s in library["studies"]:
            writer.writerow({"citation": f'{s["authors"]} ({s["year"]}). {s["title"]}', "doi": s["doi"], "url": s["url"], "decision": "Included", "reason": s["evidenceType"], "sourceInspected": s["access"]})
        writer.writerows(audit["otherCandidates"])
    print(audit["accounting"])


if __name__ == "__main__":
    rebuild()
