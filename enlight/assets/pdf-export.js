/* ENLIGHT browser-local export. Official source pages are retained; response
 * notes and overflowing fields are recorded in a separately labelled appendix.
 * PDF-lib 1.17.1, @pdf-lib/fontkit 1.1.1 and Liberation Sans are vendored. */
(function (root, factory) {
  const api = factory(root);
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.ENLIGHT_PDF = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function (root) {
  'use strict';
  const STATUS = { reported: 'Reported', notAvailable: 'Not available', notApplicable: 'Not applicable', '': 'Unanswered' };
  const FONT_PATH = 'assets/fonts/LiberationSans-Regular.ttf';
  const BOLD_PATH = 'assets/fonts/LiberationSans-Bold.ttf';
  const clean = value => String(value ?? '').replace(/\r\n?/g, '\n').replace(/\t/g, '    ');
  const list = value => Array.isArray(value) ? value : value ? [value] : [];

  function validate(data, state, draft) {
    if (!data || !Array.isArray(data.items) || data.items.length !== 24) throw new Error('The ENLIGHT checklist data could not be loaded. Reload this page and try again.');
    if (state.checklistVersion && state.checklistVersion !== data.meta.version) throw new Error('This draft belongs to a different checklist version.');
    const responses = state.responses || {};
    for (const item of data.items) {
      const answer = responses[item.id] || {};
      const status = answer.status || '';
      if (!Object.hasOwn(STATUS, status)) throw new Error('Invalid status for ' + item.id + '.');
      if (status === 'notApplicable' && !item.pdf.notApplicable) throw new Error(item.id + ' applies to all studies. Choose Reported or Not available.');
      if (!draft && (!status || (status === 'reported' && !clean(answer.location).trim()))) throw new Error('Complete the response for ' + item.id + ' before exporting a completed checklist.');
    }
    const light = state.lightSource || {};
    const types = list(light.types), spectra = list(light.spectrum);
    if (types.some(id => !data.lightSourceTypes.some(type => type.id === id)) || spectra.some(id => !data.spectrumTypes.some(type => type.id === id))) throw new Error('The draft contains an unrecognised light source selection.');
    if (!draft && (!types.length || !spectra.length || (types.includes('other') && !clean(light.other).trim()))) throw new Error('Complete the light source and spectral type selections before exporting.');
    if (!draft && (!clean(state.study?.title).trim() || !clean(state.study?.authors).trim() || !clean(state.study?.date).trim())) throw new Error('Enter the manuscript title, author names and date before exporting.');
    if (JSON.stringify(state).length > 500000) throw new Error('This draft is too large to export. Please shorten the notes or split it into separate checklists.');
  }

  async function exportPdf(data, state, options = {}) {
    const draft = options.draft === true;
    validate(data, state, draft);
    const lib = root.PDFLib, kit = root.fontkit;
    if (!lib || !kit) throw new Error('The PDF exporter has not loaded. Reload the page and try again.');
    const load = options.loadAsset || (async path => {
      const response = await fetch(new URL(path, options.baseURL || root.document.baseURI));
      if (!response.ok) throw new Error('A PDF export asset could not be loaded (' + response.status + '). Please retry.');
      return new Uint8Array(await response.arrayBuffer());
    });
    const [source, fontData, boldData] = await Promise.all([load(data.meta.checklistPath), load(FONT_PATH), load(BOLD_PATH)]);
    const document = await lib.PDFDocument.load(source);
    document.registerFontkit(kit);
    const [regular, bold] = await Promise.all([document.embedFont(fontData), document.embedFont(boldData)]);
    const characterSet = new Set(regular.getCharacterSet());
    function supported(value) {
      const text = clean(value);
      const missing = [...new Set([...text].filter(c => c !== '\n' && !characterSet.has(c.codePointAt(0))))];
      if (missing.length) throw new Error('The PDF font cannot display ' + missing.slice(0, 5).map(c => '“' + c + '” (U+' + c.codePointAt(0).toString(16).toUpperCase() + ')').join(', ') + '. Replace these characters before exporting; your draft has been kept.');
      return text;
    }
    // Validate all entered strings, including inactive notes, before creating output.
    (function check(value) {
      if (typeof value === 'string') supported(value);
      else if (value && typeof value === 'object') Object.values(value).forEach(check);
    })(state);
    const form = document.getForm();
    const study = state.study || {}, light = state.lightSource || {}, responses = state.responses || {};
    const types = list(light.types), spectra = list(light.spectrum);
    const overflow = [];
    const completed = data.items.filter(item => {
      const answer = responses[item.id] || {};
      return answer.status && (answer.status !== 'reported' || clean(answer.location).trim());
    }).length + (types.length && spectra.length && (!types.includes('other') || clean(light.other).trim()) ? 1 : 0);

    function fillText(fieldName, value, label, size = 8.5) {
      const field = form.getTextField(fieldName);
      const text = supported(value).trim();
      const rectangles = field.acroField.getWidgets().map(widget => widget.getRectangle());
      const available = Math.min(...rectangles.map(rect => rect.width - 8));
      let display = text;
      if (text.includes('\n') || regular.widthOfTextAtSize(text, size) > available) {
        display = 'See appendix: ' + label;
        overflow.push(label);
        if (regular.widthOfTextAtSize(display, size) > available) display = 'See appendix';
      }
      field.disableMultiline();
      field.setAlignment(lib.TextAlignment.Left);
      field.setFontSize(size);
      field.setText(display);
      field.updateAppearances(regular);
    }
    for (const [key, fieldName] of Object.entries(data.generalFields)) fillText(fieldName, study[key], key === 'title' ? 'title' : key, 10);
    fillText(data.lightSources.otherField, types.includes('other') ? light.other : '', 'B1.1');
    function checkbox(name, checked) {
      if (!name) return;
      const field = form.getCheckBox(name);
      if (checked) field.check(); else field.uncheck();
      // The official widget appearance includes its checkbox outline. Preserve
      // those original On/Off streams; only /V and /AS change on selection.
    }
    data.lightSourceTypes.forEach(type => checkbox(type.pdfField, types.includes(type.id)));
    data.spectrumTypes.forEach(type => checkbox(type.pdfField, spectra.includes(type.id)));
    for (const item of data.items) {
      const answer = responses[item.id] || {};
      fillText(item.pdf.location, answer.status === 'reported' ? answer.location : '', item.id);
      checkbox(item.pdf.notAvailable, answer.status === 'notAvailable');
      checkbox(item.pdf.notApplicable, answer.status === 'notApplicable');
    }
    // Make the status visible on both source pages without obscuring their contents.
    const ink = lib.rgb(7 / 255, 59 / 255, 75 / 255), muted = lib.rgb(.32, .40, .43), line = lib.rgb(.84, .88, .87);
    const exportLabel = draft ? 'DRAFT - incomplete checklist' : 'Completed checklist';
    document.getPages().forEach(page => page.drawText(exportLabel + ' | Full responses and notes follow in the appendix.', {x:22, y:65, size:8, font:regular, color:ink}));

    // Appendix uses flowing text, never fixed-height cells, so long content wraps
    // and continues onto new pages instead of clipping or shrinking unreadably.
    const width = 595.28, height = 841.89, left = 48, right = width - 48;
    let page, y, appendixNumber = 0;
    const appendixPages = [];
    function newPage() {
      page = document.addPage([width, height]); appendixNumber++; appendixPages.push(page);
      page.drawText('ENLIGHT | Response appendix', {x:left, y:height-40, size:10, font:bold, color:ink});
      page.drawText(draft ? 'DRAFT' : 'COMPLETED', {x:right-62, y:height-40, size:8, font:bold, color:muted});
      page.drawLine({start:{x:left,y:height-51}, end:{x:right,y:height-51},color:line,thickness:.6});
      y = height-78;
    }
    function reserve(amount) { if (!page || y - amount < 62) newPage(); }
    function wrapped(value, font, size, maxWidth) {
      const text = supported(value);
      const lines = [];
      for (const paragraph of text.split('\n')) {
        if (!paragraph) { lines.push(''); continue; }
        let current = '';
        for (const word of paragraph.split(/\s+/)) {
          const proposed = current ? current + ' ' + word : word;
          if (font.widthOfTextAtSize(proposed, size) <= maxWidth) { current = proposed; continue; }
          if (current) { lines.push(current); current = ''; }
          // Split long unbroken URLs or tokens at code-point boundaries.
          for (const char of word) {
            if (current && font.widthOfTextAtSize(current + char, size) > maxWidth) { lines.push(current); current = ''; }
            current += char;
          }
        }
        lines.push(current);
      }
      return lines;
    }
    function paragraph(value, settings = {}) {
      const font = settings.bold ? bold : regular, size = settings.size || 10, leading = settings.leading || size * 1.42;
      const lines = wrapped(value, font, size, right-left);
      reserve(Math.min(lines.length, 2)*leading + (settings.after ?? 7));
      for (const text of lines) { reserve(leading); if (text) page.drawText(text,{x:left,y,size,font,color:settings.muted?muted:ink}); y-=leading; }
      y -= settings.after ?? 7;
    }
    function heading(value) { reserve(122); paragraph(value,{bold:true,size:12,after:9}); }
    newPage();
    paragraph(draft ? 'Draft response record' : 'Completed response record', {bold:true,size:19,after:12});
    paragraph('ENLIGHT Checklist v' + data.meta.version + ' | ' + completed + ' of 25 items addressed', {muted:true,size:9});
    paragraph('This appendix records the information entered in the ENLIGHT wizard. The preceding two pages retain the official checklist. Item-level identifiers below are wizard identifiers; the official checklist numbers sections only.', {muted:true,size:9,after:13});
    heading('Manuscript');
    paragraph('Title: ' + (clean(study.title).trim() || 'Not provided'));
    paragraph('Authors: ' + (clean(study.authors).trim() || 'Not provided'));
    paragraph('Date: ' + (clean(study.date).trim() || 'Not provided'));
    if (clean(study.reference).trim()) paragraph('Reference / DOI: ' + clean(study.reference));
    if (clean(study.notes).trim()) paragraph('Study notes: ' + clean(study.notes));
    heading('B1.1  Light source type(s)');
    paragraph('Source types: ' + (data.lightSourceTypes.filter(type=>types.includes(type.id)).map(type=>type.title).join('; ') || 'Unanswered'));
    if (types.includes('other') && clean(light.other).trim()) paragraph('Other source: ' + clean(light.other));
    paragraph('Spectral types: ' + (data.spectrumTypes.filter(type=>spectra.includes(type.id)).map(type=>type.title).join('; ') || 'Unanswered'));
    if (clean(light.spectrumOther).trim()) paragraph('Spectral notes: ' + clean(light.spectrumOther));
    for (const section of data.sections) {
      heading(section.label + ' ' + section.title);
      for (const item of data.items.filter(item=>item.section===section.id)) {
        const answer = responses[item.id] || {};
        reserve(78);
        paragraph(item.id + '  ' + item.title, {bold:true,size:10,after:4});
        paragraph('Status: ' + STATUS[answer.status || ''], {size:9,muted:true,after:4});
        if (answer.status === 'reported' && clean(answer.location).trim()) paragraph('Location: ' + clean(answer.location), {size:10,after:4});
        if (clean(answer.notes).trim()) paragraph('Notes: ' + clean(answer.notes), {size:10,after:5});
        y -= 7;
      }
    }
    reserve(200);
    heading('Guideline source');
    paragraph(data.meta.citation, {size:9});
    paragraph('https://doi.org/' + data.meta.doi + '\n' + data.meta.website, {size:9});
    paragraph('The official checklist and Explanation & Elaboration documents state a CC-BY-NC-ND licence. Original authorship, wording and licence notice remain on the source pages. The appended responses were supplied by the person completing this wizard.', {size:9,muted:true});
    paragraph('Generated at https://resources.tscnlab.org/enlight/ . Completion indicates that checklist items have been addressed, not that a study has passed a quality assessment.',{size:9,muted:true});
    for (let i=0;i<appendixPages.length;i++) {
      const p=appendixPages[i];
      p.drawLine({start:{x:left,y:45},end:{x:right,y:45},color:line,thickness:.6});
      p.drawText('ENLIGHT v'+data.meta.version+' | '+exportLabel,{x:left,y:31,size:8,font:regular,color:muted});
      p.drawText('Appendix '+(i+1)+' / '+appendixPages.length,{x:right-81,y:31,size:8,font:regular,color:muted});
    }
    document.setTitle('ENLIGHT checklist - ' + (clean(study.title).trim() || 'Untitled draft'));
    document.setAuthor(clean(study.authors));
    document.setSubject('ENLIGHT v' + data.meta.version + ' reporting checklist with response appendix');
    document.setCreator('TSCN ENLIGHT wizard');
    document.setProducer('pdf-lib 1.17.1');
    return document.save({updateFieldAppearances:false});
  }
  return {exportPdf, validate};
});
