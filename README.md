# Light Logger Evidence

A TSCN Lab literature directory for validation studies of wearable light loggers. The website is static, works on GitHub Pages, and is generated from reproducible Quarto notebooks. The evidence inventory is curated from research publications; manufacturer claims are not treated as validation.

The design follows the existing [TSCN Join website](https://join.tscnlab.org/), using the original unit logo, colour palette, serif headings and system fonts. Asset origins and checksums are recorded in [assets/PROVENANCE.md](assets/PROVENANCE.md).

## Open and rebuild

The rendered website is `_site/index.html`; the evidence and methods notebook is `_site/evidence.html`. Serve `_site` with any static server, or open the HTML locally. All site assets and records are local; source-paper links require internet access.

Requirements: Quarto 1.6.43 or newer, Python 3.12 or newer, and the Jupyter runtime.

```sh
python -m venv .venv
. .venv/bin/activate
python -m pip install -r requirements.txt
quarto render
quarto preview
```

If Quarto selects a different system Python despite the virtual environment, use
`QUARTO_PYTHON=.venv/bin/python quarto render`. The delivered HTML was generated
by executing both Quarto notebooks, with Quarto 1.6.43.

`index.qmd` runs `scripts/build.py` to create the interface and data downloads. `evidence.qmd` independently regenerates the human-readable audit inventory from `data/library.json`. Rendering uses the checked-in records and does not fetch or silently update research evidence.

## Deploy to GitHub Pages

1. Put the contents of this standalone directory, including `.github`, at the root of the chosen GitHub repository. The supplied workflow expects this layout and the `main` branch.
2. In **Settings → Pages → Build and deployment**, choose **GitHub Actions** as the source.
3. Push the source files to `main`, or run **Render and deploy the literature directory** from the Actions tab. The workflow renders both notebooks and publishes only `_site`.
4. Configure `lightloggers.tscnlab.org` in **Settings → Pages → Custom domain**. Then add a DNS `CNAME` named `lightloggers` at the `tscnlab.org` DNS provider, pointing to the GitHub owner or organisation's `<owner>.github.io` hostname, with no repository path. Enable **Enforce HTTPS** when available.

The target address is **https://lightloggers.tscnlab.org**; a GitHub owner and repository still need to be selected. The bundle does not create the repository or alter DNS. For an Actions deployment, the custom domain lives in GitHub's Pages settings; GitHub does not require a source `CNAME` file. Site links are relative so the site also works under a repository subpath. See [GitHub's custom-domain instructions](https://docs.github.com/en/pages/configuring-a-custom-domain-for-your-github-pages-site/managing-a-custom-domain-for-your-github-pages-site) and [Quarto's GitHub Pages guide](https://quarto.org/docs/publishing/github-pages.html).

For branch-based hosting instead, publish the contents of `_site` on the selected Pages branch, and follow GitHub's branch-specific custom-domain instructions.

## Update the literature inventory

Edit `data/library.json`, preserving its schema. Each study must have a unique ID and DOI, exact tested device names, review status, source URL, measurement categories, setting, reference, protocol, findings, and limitations. `deviceMetrics` maps each device to its tested endpoints; the study's `metrics` must be their union. `sourceLocator` points to the supporting section, table or figure. Keep claims within the tested model and conditions. Use `access` to distinguish full-text from abstract-only inspection. Record the date the literature was checked in `updated` and preserve the explicit `yearPolicy` and source-specific publication-date notes.

Do not interpret the absence of a paper as proof that a device has never been validated. Do not count a preprint and its later journal publication as independent studies. Researcher or manufacturer involvement does not by itself invalidate a paper, but conclusions should remain tied to its reported tests. Re-render both notebooks after editing records.

The site includes a submission form for suggesting a source paper. Its email destination is **manuel.spitschan@tum.de**, configured in `site-config.json`. The publication should be reviewed before entering the canonical inventory. The static site does not automatically insert public submissions into the reviewed dataset.

The collection includes instrument validation, sensor characterisation, developer-led measurement tests, wearing-position studies, and indoor/outdoor classification studies, with their endpoints kept distinct. Sleep, activity or physiological-outcome studies alone do not establish light-sensor accuracy.

## Data and citation exports

`data/validations.csv` is regenerated from the inventory, including model-specific endpoint mappings, provenance locators and limitations. It has one row per study; list-valued fields use semicolon separators and `deviceMetrics` is a JSON object within its CSV cell.

`data/references.bib` provides partial citation metadata: title, DOI, URL and the indexed publication year. The short author display string appears in `note`; it is not a complete BibTeX `author` field. Resolve each DOI for complete author lists, journal details and publication dates before preparing manuscript citations. Online-first and issue years may differ; the source notes identify these cases.

The notebooks, local assets, canonical JSON, source research fragments, configuration and build scripts are included so the outputs can be regenerated offline after the software dependencies have been installed. The build does not fetch the literature or silently revise records.

## Project layout

- `index.qmd`: executable website source.
- `evidence.qmd`: executable methods and evidence audit notebook.
- `data/library.json`: canonical device and study inventory.
- `data/validations.csv`: generated study-table download.
- `data/references.bib`: generated citation download.
- `assets/`: local styles and browser code.
- `scripts/build.py`: reproducible interface and export generation.
- `.github/workflows/pages.yml`: render and GitHub Pages deployment.
- `_site/`: rendered HTML and deployable assets.

The literature directory is an expanded, documented collection, not an exhaustive systematic review or a certification system. It does not pool accuracy measurements across different protocols or recommend a device solely by its publication count.

## Verification and packaging

`node --test tests/filtering.test.cjs` checks model-specific endpoint attribution,
filter intersections and submission formatting. The GitHub Pages workflow runs
these checks before deployment. `node tests/browser.cjs` checks the rendered
desktop/mobile interface, direct links, expandable text records, source downloads, PubMed
links and email-draft payload without sending email. It needs Playwright and
Chrome; set `PLAYWRIGHT_MODULE` and `CHROME_PATH` for a non-default installation.
The report and screenshots are in `preview/`.

After rendering, `python scripts/package.py` creates `../lightloggers-quarto.zip`
with the sources, rendered site, data and verification artifacts. Local virtual
environments and caches are excluded.

The narrowed directory includes 33 papers covering photopic illuminance, melanopic EDI or angle dependence. Classification-only papers are excluded. All have DOI/source links; PubMed links are
included when a verified record was found. Twelve summaries rely on abstracts;
one uses a verified partial full-text passage. Exact search accounting, unresolved
candidates and scope decisions appear on the About page.

The interface uses a white background, two simple views, and local journal/server
logos or covers. A publisher mark or linked journal title is used when a journal
asset was unavailable. Device images are not shown. LYS and LYS Button share one
entry; old `?device=lys` links open that merged entry.

## Repeat the search audit

`python scripts/audit_search.py` reproduces search counts, title triage and source
decision exports from the saved responses. It also runs from `evidence.qmd`.
The three final queries yielded 751 records / 733 unique database accessions;
361 titles passed the documented prefilter. This is not exhaustive screening of
all 733 abstracts. Broad, capped pilot responses are retained only for provenance.

`python scripts/fetch_search.py --output data/search/NEW-DATE` repeats all final
queries with pagination into a new folder, preserving the original snapshot.
The date cutoff remains as written in the queries until explicitly updated.
New search results do not automatically modify the reviewed library.

## PDF snapshot

After rendering, run `node scripts/export-pdf.cjs` to create `output/pdf/lightlogger-evidence.pdf`. It uses Playwright and Chrome (the same environment overrides as the browser checks).
