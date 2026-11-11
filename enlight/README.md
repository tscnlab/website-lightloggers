# ENLIGHT Checklist Wizard

A browser-local wizard for the ENLIGHT Checklist v1.0.2 (16 October 2023), published at https://resources.tscnlab.org/enlight/ alongside the Light Logger Inventory.

## Reproduce the website

Install Quarto and Python with Jupyter, then run:

```sh
python -m venv .venv
. .venv/bin/activate
python -m pip install -r requirements.txt
QUARTO_PYTHON=.venv/bin/python quarto render
python -m http.server 8000 --directory _site
```

`index.qmd` is the executable source notebook. It checks the canonical item count and generates the HTML plus a downloadable source archive using versioned local assets. Output is `_site/index.html`; all asset paths work at `/enlight/`. A static HTTP server is required for PDF asset loading; opening the HTML as a `file://` URL is not supported.

The parent `tscnlab/website-lightloggers` repository renders this subproject after Lightloggers and copies its `_site/` into the parent `_site/enlight/`. The existing GitHub Pages workflow publishes the combined site and keeps the existing custom domain.

## Behaviour

- Seven steps cover manuscript metadata, the 24 manuscript-location rows, and light-source selection (25 items in total).
- Status choices match the original form. Nine location rows do not permit Not applicable. Missing information may be marked Not available; completion is not a study-quality judgement.
- Drafts autosave in localStorage under `tscn-enlight-draft-v1`. JSON download/import supports continuing elsewhere. No responses are transmitted to a server. Download a draft before clearing browser data.
- Completed export requires manuscript metadata and an explicit response to every item. Draft PDF export remains available with unanswered items labelled.
- Browser-local PDF export fills the original 76-field official form, preserving its interactive fields, and appends full responses and notes. Long text uses appendix references in the fixed-size form fields; it is never silently clipped. Scientific Greek characters and symbols are supported. Unsupported glyphs stop export with an actionable message.
- Original PDF pages use their existing typography. Entered responses and the appendix use redistributable Liberation Sans, an Arial-compatible font. Print review uses Arial when installed. This is a checklist, not a manuscript; no line numbering is added to the official form.
- Switching a response to Not available/Not applicable retains its old location in the editable draft but excludes that inactive location from the exported response. No tracking or remote fonts are used.

## Sources and licences

Authoritative sources: [ENLIGHT statement](https://enlight-statement.org/) and [Spitschan et al. (2023)](https://doi.org/10.1016/j.ebiom.2023.104889). `data/checklist.json` records the source commit, SHA-256 hashes, item-to-form-field mapping, and helper descriptions. Item IDs such as A1.1 are stable wizard IDs; the official PDF numbers sections only.

The official PDFs are unchanged and retain their specific CC-BY-NC-ND notice. See `sources/README.md` for provenance and the paper's item-count discrepancy. Helper descriptions are concise application guidance; the original E&E document remains linked for detail. PDF-lib and fontkit licences are in `assets/vendor/`; font attribution is in `assets/fonts/`. The official ENLIGHT logo heads the page, with a smaller TSCN Unit logo and an AI disclosure in the footer. The TSCN logo/favicon are reused unchanged from the Lightloggers site. Asset sources and checksums are in `assets/PROVENANCE.md`.

## Verification

```sh
node --test tests/*.test.*
```

PDF tests generate a clearly labelled fictional completed example and blank draft under `output/pdf/`, plus a long Unicode stress case under `tmp/pdfs/`. Tests inspect the canonical AcroForm values and widget appearances, all status branches, unsupported glyph errors, long text, and draft validation. The downloadable example JSON can be imported in the wizard. Browser QA covers desktop/mobile, form navigation, draft import/export, cancellation, and completed PDF download. Source PDFs are independently mapped by `data/build-checklist.py` (requires PyMuPDF).
