"""Repeat the documented Europe PMC queries into a NEW dated directory.

Usage: python scripts/fetch_search.py --output data/search/YYYY-MM-DD
This does not modify the curated inventory or its original search snapshot.
"""
import argparse
import json
import urllib.parse
import urllib.request
from pathlib import Path

root = Path(__file__).resolve().parents[1]
parser = argparse.ArgumentParser(description=__doc__)
parser.add_argument("--output", required=True, type=Path)
args = parser.parse_args()
assert not args.output.exists(), "Choose a new directory; preserve previous search snapshots."
args.output.mkdir(parents=True)
audit = json.loads((root / "data/search-audit.json").read_text())
for query in audit["queries"]:
    cursor, records = "*", []
    while True:
        params = urllib.parse.urlencode({"query": query["query"], "format": "json", "resultType": "lite", "pageSize": 1000, "cursorMark": cursor})
        url = "https://www.ebi.ac.uk/europepmc/webservices/rest/search?" + params
        with urllib.request.urlopen(url, timeout=60) as response:
            result = json.load(response)
        batch = result["resultList"]["result"]
        records.extend(batch)
        if len(records) >= result["hitCount"] or not batch:
            break
        cursor = result["nextCursorMark"]
    result["resultList"]["result"] = records
    result["retrievalNote"] = "All result pages combined; query date cutoff is unchanged."
    (args.output / Path(query["file"]).name).write_text(json.dumps(result, ensure_ascii=False, indent=2) + "\n")
    print(Path(query["file"]).name, len(records), "records")
