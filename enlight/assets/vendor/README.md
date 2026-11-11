# Browser PDF dependencies

The PDF exporter runs entirely in the browser. No PDF or draft contents are sent to a server.

- `pdf-lib.min.js`: pdf-lib 1.17.1, MIT licence, copied from the installed runtime's official npm distribution. Source: https://github.com/Hopding/pdf-lib. Notice: `pdf-lib-LICENSE.md`.
- `fontkit.umd.min.js`: @pdf-lib/fontkit 1.1.1, MIT licence, from the official npm registry tarball `@pdf-lib/fontkit@1.1.1`. Source: https://github.com/Hopding/fontkit (fork of fontkit). The fork's npm package identifies the MIT licence; `fontkit-LICENSE` retains the upstream copyright and permission notice.
- `../fonts/LiberationSans-Regular.ttf` and `LiberationSans-Bold.ttf`: browser-distributable Liberation Sans fonts from Mozilla PDF.js's `standard_fonts` distribution. See `../fonts/LICENSE_LIBERATION`. Liberation Sans is metrically compatible with Arial. The original ENLIGHT page typography is retained; added field appearances and the appendix embed Liberation Sans so export does not depend on installed fonts.

The original source PDFs are retained unchanged in `sources/`; their provenance and licence are recorded there. Generated output fills the original form and adds a clearly identified response appendix. The output keeps its form fields editable.

Re-run `node --test tests/pdf-export.test.cjs` to generate example/blank exports and verify original field values, checkbox mappings, long responses, supported scientific Unicode, and invalid input handling. `loadAsset` is an optional dependency-injection hook used only by the Node tests; the web application fetches the same files relative to its own page.
