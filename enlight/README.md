# ENLIGHT Checklist Wizard 🪄

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

The citation callout is open by default and can be collapsed with its heading. It links to the DOI and [PubMed record (PMID 38043137)](https://pubmed.ncbi.nlm.nih.gov/38043137/) side by side, with local RIS and BibTeX downloads in `assets/references/`. Both formats retain the five named authors and ENLIGHT Consortium collective author, using the December 2023 issue date. These files are included in the rendered site and source archive.

The same callout references [CIE TN 016:2026](https://doi.org/10.25039/TN.016.2026), *A comprehensive checklist for reporting light characteristics in laboratory-based human studies using light as an intervention*, with the official free PDF and RIS/BibTeX reference downloads. The note describes ENLIGHT and links to the same v1.0.2 checklist used here. Bibliographic metadata and source links are recorded in `data/context.json`, verified against the [CIE publication page](https://cie.co.at/publications/comprehensive-checklist-reporting-light-characteristics-laboratory-based-human-studies) and its [announcement](https://cie.co.at/news/new-cie-technical-note-published-comprehensive-checklist-reporting-light-characteristics).

The endorsing-organisations section reproduces the seven organisations listed under [Endorsing organisations on the ENLIGHT statement website](https://enlight-statement.org/#endorsing-organisations), verified on 11 November 2026: SRBR, SRS, SLTBR, ACS, CET, CMHN, and VELUX Stiftung. Their full names and official links are stored in `data/context.json`. The section explicitly concerns endorsement of the ENLIGHT checklist. NetIAS CAT is separately identified by the source as project support and is not included in this endorsement list.

The official PDFs are unchanged and retain their specific CC-BY-NC-ND notice. See `sources/README.md` for provenance and the paper's item-count discrepancy. Helper descriptions are concise application guidance; the original E&E document remains linked for detail. PDF-lib and fontkit licences are in `assets/vendor/`; font attribution is in `assets/fonts/`. The official ENLIGHT logo heads the page, with a smaller TSCN Unit logo and an AI disclosure in the footer. The TSCN logo is reused unchanged from the Lightloggers site. The browser and touch icons use the ENLIGHT lightbulb. Asset sources and checksums are in `assets/PROVENANCE.md`.

## Verification

### AI development disclosure

Recorded on 11 November 2026:

- Provider and tool: OpenAI Codex.
- Model identifier recorded in the development session: `gpt-6-astra`; reasoning effort: `ultra`. A dated model snapshot was not recorded, so none is inferred.
- Codex desktop version: `26.1029.61003`, build `24614`, verified from the installed app.
- Codex agent version: `0.166.0-alpha.6`, recorded in the development session metadata.
- AI assistance: interface design, implementation of the published ENLIGHT checklist, PDF export, reference downloads, and testing.

These are the versions observed during development, not automatically updated deployment metadata. The deployed wizard fills the PDF directly from entered responses, using local JavaScript and vendored PDF libraries. It does not invoke an AI model. This disclosure concerns the website implementation and does not attribute the original ENLIGHT paper or checklist to AI.

### Checks

```sh
node --test tests/*.test.*
```

PDF tests generate a clearly labelled fictional completed example and blank draft under `output/pdf/`, plus a long Unicode stress case under `tmp/pdfs/`. Tests inspect the canonical AcroForm values and widget appearances, all status branches, unsupported glyph errors, long text, and draft validation. The downloadable example JSON can be imported in the wizard. Browser QA covers desktop/mobile, form navigation, draft import/export, cancellation, and completed PDF download. Source PDFs are independently mapped by `data/build-checklist.py` (requires PyMuPDF).

## Social preview

The page supplies Open Graph metadata for LinkedIn and other link-sharing services, plus a large-image Twitter/X card. The social title is **ENLIGHT Checklist Wizard**, with an absolute canonical URL and a 1200 × 630 PNG at `assets/social-preview.png`.

The preview uses only the lightbulb symbol from the official ENLIGHT logo, with the smaller TSCN Unit logo in the footer. The document illustration is schematic. The deterministic vector layout is in `assets/social-preview.svg`; both original logos remain unchanged. To regenerate the PNG:

```sh
npm install --no-save sharp@0.35.5
node scripts/render-social-preview.cjs
```

Use Georgia and Arial fonts to reproduce the checked-in typography; Liberation Serif and Liberation Sans are fallbacks. `SHARP_MODULE` can point to a preinstalled Sharp module. Ordinary Quarto builds use the checked-in PNG and require no additional image dependencies. The source archive includes the layout and rendering script.

The image follows [LinkedIn's website-sharing requirements](https://www.linkedin.com/help/linkedin/answer/a521928/make-your-website-shareable-on-linkedin). Existing cached shares can be refreshed with LinkedIn's [Post Inspector](https://www.linkedin.com/post-inspector/).

Regenerate the lightbulb browser and touch icons with `node scripts/render-favicons.cjs` (the same Sharp dependency). The browser uses `assets/favicon-lightbulb.png`; its distinct filename avoids reusing the previous favicon from cache.
