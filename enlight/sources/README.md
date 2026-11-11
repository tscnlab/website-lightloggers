# Official ENLIGHT source documents

The two PDFs in this directory are byte-for-byte downloads from the links on [enlight-statement.org](https://enlight-statement.org/), verified on 11 November 2026. The website links release **1.0.2, 16 October 2023**, at repository commit `06ee653046cffe833753028c2b4bc71cdb6a711b`.

- [Checklist source](https://github.com/ENLIGHT-Project/ENLIGHT-Checklist/blob/06ee653046cffe833753028c2b4bc71cdb6a711b/1.0.2/ENLIGHT_Checklist_Release_1.0.2_20231016.pdf)
- [Explanation & Elaboration source](https://github.com/ENLIGHT-Project/ENLIGHT-Checklist/blob/06ee653046cffe833753028c2b4bc71cdb6a711b/1.0.2/ENLIGHT_E%26E_Release_1.0.2_20231016.pdf)
- [Publication](https://doi.org/10.1016/j.ebiom.2023.104889)

Citation: Spitschan M, Kervezee L, Lok R, McGlashan E, Najjar RP; ENLIGHT Consortium. ENLIGHT: A consensus checklist for reporting laboratory-based studies on the non-visual effects of light in humans. *EBioMedicine*. 2023;98:104889.

Both PDFs state that the checklist and E&E document are released under **CC-BY-NC-ND**, without specifying a version. The repository-level `LICENSE` is GNU GPL v3 and is retained separately as `LICENSE`; it does not replace the more specific notices inside the PDFs. This project preserves the original source PDFs and attribution. Completing the intended form fields does not replace the published checklist with a new guideline.

The `.txt` files are extracted text for source verification; the PNGs are QA renders. The PDFs are authoritative. SHA-256 checksums are recorded in `../data/checklist.json` and independently reproducible with `../data/build-checklist.py`.

## Item counting and form mapping

The checklist contains **24 rows with manuscript-location fields** and **one light-source-selection item**, giving the published total of 25 items. Nine of the 24 location rows lack a “Not applicable” checkbox; the wizard respects those restrictions. The source selection has separate source-type and spectral-type checkboxes.

The article reports nine universally essential items but marks ten rows in Table 2 if the separate “Light source type(s)” item is counted. The data therefore records nine location rows that prohibit “Not applicable” and handles source selection independently, avoiding a misleading essential-item denominator.

The official checklist numbers sections, but not individual items. Item IDs such as `A1.1` and `B1.2` are stable application identifiers, not official ENLIGHT numbering. Titles match the checklist with typographic normalisation; concise guidance is original wording based on the E&E document, with page references in the data.

`../data/pdf-form-map.json` records all 76 AcroForm widgets and positions. Of these, 74 are data fields; `Reset` and `Button3` are pushbuttons and are not report data. The build script verifies all 24 location/status mappings using field type and geometric row alignment as well as exact field names. Some official PDF tooltip strings are inaccurate; the mapping uses visible row position rather than trusting tooltips.
