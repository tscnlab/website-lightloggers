"""Attach exact-PDF coordinates to a selected source passage.

Usage: python scripts/index-source-pdf.py STUDY PASSAGE /path/to/paper.pdf PAGE
Requires PyMuPDF. The passage's short quotation must occur on the chosen page.
Inspect the rendered highlight before publishing. No PDF is modified or copied.
"""
import hashlib
import json
import sys
from pathlib import Path
import pymupdf

root = Path(__file__).resolve().parents[1]
study_id, passage_id, filename, page_number = sys.argv[1:]
target = root / "data/source-evidence.json"
data = json.loads(target.read_text())
source = data["studies"][study_id]
passage = next(p for p in source["passages"] if p["id"] == passage_id)
raw = Path(filename).read_bytes()
document = pymupdf.open(stream=raw, filetype="pdf")
page = document[int(page_number)-1]
matches = page.search_for(passage["quote"])
assert matches, "Quotation not found on the selected page"
rects = []
for match in matches:
    for block in page.get_text("blocks"):
        if block[6] != 0:
            continue
        rect = pymupdf.Rect(block[:4])
        if not rect.intersects(match):
            continue
        if rect.height > page.rect.height * .32:
            rect = match
        box = [round(rect.x0/page.rect.width, 6), round(rect.y0/page.rect.height, 6),
               round(rect.width/page.rect.width, 6), round(rect.height/page.rect.height, 6)]
        if box not in rects:
            rects.append(box)
assert rects
digest = hashlib.sha256(raw).hexdigest()
old_digest = source["document"].get("sha256")
assert old_digest in (None, digest), "Different PDF edition: re-index all its passages together"
source["document"].update(sha256=digest, pages=len(document))
passage["pdf"] = {"page": int(page_number), "rects": rects}
target.write_text(json.dumps(data, ensure_ascii=False, indent=2) + "\n")
print(f"Indexed {study_id}/{passage_id}, PDF page {page_number}; inspect the highlight in source.html")
