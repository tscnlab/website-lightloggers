"""Build the literature directory and exports from the versioned local inventory."""
import csv
import html
import json
import re
from datetime import date
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]


def validate_library(library):
    studies, devices = library["studies"], library["devices"]
    assert len({s["id"] for s in studies}) == len(studies), "Duplicate study IDs"
    assert len({s["doi"].lower() for s in studies}) == len(studies), "Duplicate DOIs"
    assert len({d["id"] for d in devices}) == len(devices), "Duplicate device IDs"
    names = {d["name"] for d in devices}
    assert len(names) == len(devices), "Duplicate device names"
    for s in studies:
        assert s["status"] in {"Peer reviewed", "Preprint", "Conference paper"}
        assert s["setting"] in {"Laboratory", "Field", "Laboratory + field"}
        assert re.fullmatch(r"10\.\d{4,9}/\S+", s["doi"]), s["id"]
        assert s["url"].startswith("https://"), s["id"]
        assert s["venue"] in library["venues"], s["id"]
        if s.get("pubmedUrl"):
            assert re.fullmatch(r"https://pubmed\.ncbi\.nlm\.nih\.gov/\d+/", s["pubmedUrl"]), s["id"]
        assert set(s["devices"]) <= names, s["id"]
        assert set(s["deviceMetrics"]) == set(s["devices"]), s["id"]
        assert set(s["developerRelationship"]) == set(s["devices"]), s["id"]
        for relationship in s["developerRelationship"].values():
            assert relationship["category"] in {"Developer involved", "Independent", "Unclear"}
            assert relationship["reason"] and relationship["sourceLocator"]
        assert set(s["metrics"]) == {m for ms in s["deviceMetrics"].values() for m in ms}, s["id"]
        for field in ("title", "authors", "reference", "protocol", "finding", "limitations", "access", "sourceLocator"):
            assert s.get(field), f'{s["id"]}: missing {field}'
    assert names == {name for s in studies for name in s["devices"]}, "Unlinked device"
    for venue in library["venues"].values():
        assert venue["url"].startswith("https://")
        if venue.get("logo"):
            assert (ROOT / venue["logo"]).is_file(), venue["name"]


def build_site():
    library = json.loads((ROOT / "data/library.json").read_text(encoding="utf-8"))
    library["evidence"] = json.loads((ROOT / "data/source-evidence.json").read_text(encoding="utf-8"))
    config = json.loads((ROOT / "site-config.json").read_text(encoding="utf-8"))
    validate_library(library)
    studies, devices = library["studies"], library["devices"]
    fields = ["id", "title", "authors", "year", "doi", "url", "pubmedUrl", "fullTextUrl", "venue", "status", "evidenceType", "devices", "metrics", "deviceMetrics", "developerRelationship", "setting", "reference", "protocol", "finding", "limitations", "access", "sourceLocator", "notes"]
    with (ROOT / "data/validations.csv").open("w", encoding="utf-8-sig", newline="") as f:
        writer = csv.DictWriter(f, fieldnames=fields, extrasaction="ignore")
        writer.writeheader()
        for study in studies:
            row = {k: "; ".join(v) if isinstance(v, list) and all(isinstance(item, str) for item in v) else json.dumps(v, ensure_ascii=False) if isinstance(v, (dict, list)) else v for k, v in study.items()}
            writer.writerow(row)
    bib = ["% Citation metadata from the curated inventory. Consult each DOI for complete author/journal metadata.\n"]
    for s in studies:
        clean = lambda x: str(x).replace("&", r"\&").replace("{", "").replace("}", "")
        bib.append(f'@misc{{{s["id"]},\n  title = {{{clean(s["title"])}}},\n  year = {{{s["year"]}}},\n  doi = {{{s["doi"]}}},\n  url = {{{s["url"]}}},\n  note = {{{clean(s["authors"])}; {s["status"]}. Citation metadata; consult DOI for full authors and publication dates.}}\n}}\n')
    (ROOT / "data/references.bib").write_text("\n".join(bib), encoding="utf-8")
    metrics = sorted({m for s in studies for m in s["metrics"]})
    js_json = lambda value: json.dumps(value, ensure_ascii=False).replace("<", r"\u003c").replace(">", r"\u003e").replace("&", r"\u0026")
    replacements = {
        "DEVICE_COUNT": len(devices), "STUDY_COUNT": len(studies), "METRIC_COUNT": len(metrics),
        "UPDATED": date.fromisoformat(library["updated"]).strftime("%d %b %Y"),
        "METRIC_OPTIONS": "".join(f'<option value="{html.escape(m)}">{label}</option>' for m, label in [("Illuminance", "Photopic illuminance"), ("Melanopic EDI", "Melanopic EDI"), ("Angular response", "Angle dependence")]),
        "SUBMISSION_EMAIL": html.escape(config["submissionEmail"]),
        "LIBRARY_JSON": js_json(library), "CONFIG_JSON": js_json(config),
    }
    fragment = (ROOT / "assets/page.html").read_text(encoding="utf-8")
    for key, value in replacements.items():
        fragment = fragment.replace(f"@@{key}@@", str(value))
    assert not re.search(r"@@[A-Z_]+@@", fragment), "Unresolved template token"
    return fragment


if __name__ == "__main__":
    build_site()
    print("Validated literature inventory and rebuilt CSV/BibTeX exports.")
