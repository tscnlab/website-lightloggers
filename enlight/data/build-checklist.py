"""Rebuild the canonical ENLIGHT v1.0.2 checklist data and verify its PDF map.
Requires pypdf; does not modify the official source PDFs.
"""
from pathlib import Path
import hashlib, json
from pypdf import PdfReader
ROOT = Path(__file__).resolve().parents[1]
CHECKLIST = 'ENLIGHT_Checklist_Release_1.0.2_20231016.pdf'
EE = 'ENLIGHT_EE_Release_1.0.2_20231016.pdf'
REV = '06ee653046cffe833753028c2b4bc71cdb6a711b'
BASE = f'https://github.com/ENLIGHT-Project/ENLIGHT-Checklist/blob/{REV}/1.0.2/'
sections = [
 ('A1', 'A.1.', 'Protocol-level characteristics', 'Study characteristics', 'Describe the setting, timing, and light exposure before the experiment.'),
 ('A2', 'A.2.', 'Measurement-level characteristics', 'Study characteristics', 'Identify where and how light was measured.'),
 ('A3', 'A.3.', 'Participant-level characteristics', 'Study characteristics', 'Report relevant participant characteristics and timing.'),
 ('B1', 'B.1.', 'Light source type(s)', 'Light characteristics', 'Include background illumination and every experimental light source.'),
 ('B2', 'B.2.', 'Light level characteristics', 'Light characteristics', 'Identify where the light measurements are reported in your manuscript.'),
 ('B3', 'B.3.', 'Colour characteristics', 'Light characteristics', 'Report the spectral and colour quantities relevant to your sources.'),
 ('B4', 'B.4.', 'Temporal and spatial characteristics', 'Light characteristics', 'Describe stimulus position, timing, and size.')
]
# The official PDF does not assign item-level IDs. These stable IDs belong to the wizard.
# Exact checklist labels and exact AcroForm field names are preserved.
rows = [
 ('A1.1','Description of experimental setting','Include room geometry, windows, participant position, and relevant environmental conditions.',[1],'Description of experimental setting',1,None),
 ('A1.2','Timeline of experiment (including timing and duration of light)','Include key study events and the timing and duration of light exposure.',[1],'Timeline of experiment including timing and duration of light',2,None),
 ('A1.3','Pre-laboratory sleep-wake/rest-activity behaviour','Include instructions, inclusion criteria, measurements, and observation periods before participants entered the laboratory.',[2],'Prelaboratory sleepwakerestactivity behaviour',3,6),
 ('A1.4','Pre-laboratory light exposure','Include light exposure instructions, controls, and any measurements before laboratory admission.',[2],'Prelaboratory light exposure',4,7),
 ('A1.5','Immediate prior light exposure (in laboratory)','Describe laboratory lighting before the experimental exposure, including dim-light or dark-adaptation conditions.',[2],'Immediate prior light exposure in laboratory',5,8),
 ('A2.1','Measurement plane (e.g., horizontal or vertical)','Specify the measurement plane for the light quantities you report.',[2],'Measurement plane eg horizontal or vertical',9,None),
 ('A2.2','Measurement viewpoint and location','Specify sensor position and direction for each relevant measurement or light condition.',[2],'Measurement viewpoint and location',10,None),
 ('A2.3','Type, make and manufacturer of the measurement instrument','Identify each instrument, its model, and manufacturer.',[2],'Type make and manufacturer of the measurement instrument',11,None),
 ('A2.4','Calibration status of the instrument','Include calibration timing, type, and provider when available.',[3],'Calibration status of the instrument',12,13),
 ('A3.1','Ocular health and functioning','Include relevant ocular criteria, assessments, and use of glasses or contact lenses.',[3],'Ocular health and functioning',14,None),
 ('A3.2','Pupil size and/or dilation','Report pupil measurements or control, including any pharmacological dilation.',[3],'Pupil size andor dilation',15,17),
 ('A3.3','Relative time (e.g. to circadian phase or sleep)','Describe exposure timing relative to participants’ sleep or circadian phase.',[3],'Relative time eg to circadian phase or sleep',16,18),
 ('B1.2','Type, make and manufacturer of the light source','Identify each source, its model, and manufacturer.',[4],'Type make and manufacturer of the light source',26,None),
 ('B1.3','Use of wearable filtering apparatus (e.g., blue-blocking glasses)','Describe wearable filters and their effects on light amount or spectrum.',[4],'Use of wearable filtering apparatus eg blueblocking glasses',27,28),
 ('B2.1','Illuminance (lux) and/or luminance (cd/m²)','Report photometric light levels for the experimental conditions.',[5],'Illuminance',29,None),
 ('B2.2','Spectral irradiance and/or radiance distribution','Identify the reported wavelength-resolved light measurements.',[5],'Spectral irradiance andor radiance distribution',30,33),
 ('B2.3','α−opic irradiance and/or radiance (including melanopic)','Report photoreceptor-weighted irradiance or radiance, including melanopic quantities.',[5],'fill_20',31,34),
 ('B2.4','α−opic equivalent daylight illuminance and/or luminance (EDI/EDL, including melanopic)','Report equivalent D65 daylight quantities, including melanopic values.',[5],'fill_23',32,35),
 ('B3.1','Peak wavelength and bandwidth','Primarily relevant to monochromatic or narrowband sources; identify peak wavelength and spectral width.',[5],'Peak wavelength',36,39),
 ('B3.2','Colour appearance quantities (any)','Examples include chromaticity coordinates and correlated colour temperature.',[5],'Colour quantities any',37,40),
 ('B3.3','Colour rendering metrics (any)','Identify colour-rendering metrics reported for the source, such as the Colour Fidelity Index.',[5],'Colour rendition metrics any',38,41),
 ('B4.1','Location of stimulus and viewing distance','Specify stimulus position and distance relative to the participant.',[6],'Location of stimulus',42,None),
 ('B4.2','Temporal pattern (including flash frequency and waveform)','Include recurring timing, flash frequency, waveform, or dynamic dimming and tuning.',[6],'Temporal pattern including flash frequency and waveform',43,45),
 ('B4.3','Relative or absolute size of the stimulus','Report stimulus size or shape, including size relative to the visual field.',[6],'Relative or absolute size of the stimulus',44,46)
]
items=[]
for item_id,title,description,pages,location,unavailable,inapplicable in rows:
 items.append(dict(id=item_id, section=item_id.split('.')[0], title=title, description=description, essential=inapplicable is None, eePages=pages, pdf=dict(location=location, notAvailable=f'Check Box{unavailable}', notApplicable=f'Check Box{inapplicable}' if inapplicable is not None else None)))
sourceTypes=[
 dict(id='room',title='Room illumination (overhead or other)',pdfField='Check Box23'),
 dict(id='emissive',title='Emissive surfaces including displays (incl. light therapy devices)',pdfField='Check Box22'),
 dict(id='wearable',title='Wearable light emitting glasses',pdfField='Check Box19'),
 dict(id='ganzfeld',title='Ganzfeld exposure',pdfField='Check Box20'),
 dict(id='other',title='Other',pdfField='Check Box21')
]
spectrumTypes=[dict(id='polychromatic',title='Polychromatic light',pdfField='Check Box24'),dict(id='narrowband',title='Monochromatic or narrowband light',pdfField='Check Box25')]
data=dict(
 schemaVersion=1,
 meta=dict(name='ENLIGHT Checklist',version='1.0.2',releaseDate='2023-10-16',verifiedDate='2026-11-11',website='https://enlight-statement.org/',doi='10.1016/j.ebiom.2023.104889',citation='Spitschan M, Kervezee L, Lok R, McGlashan E, Najjar RP; ENLIGHT Consortium. ENLIGHT: A consensus checklist for reporting laboratory-based studies on the non-visual effects of light in humans. EBioMedicine. 2023;98:104889.',checklistPath='sources/'+CHECKLIST,explanationPath='sources/'+EE,checklistUrl=BASE+CHECKLIST,explanationUrl=BASE+'ENLIGHT_E%26E_Release_1.0.2_20231016.pdf',sourceCommit=REV,license='CC-BY-NC-ND',licenseNote='Both official PDFs state CC-BY-NC-ND without a version. The repository also has a GNU GPL v3 root LICENSE. The specific notice in the PDFs is preserved.',itemCount=25,locationRowCount=24,locationRowsWithoutNotApplicable=9,idsNote='Item-level IDs are stable wizard identifiers; the official checklist numbers sections only.',essentialCountNote='The paper says nine essential items but marks ten in Table 2 when the separate light-source selection is included. This wizard preserves the nine location rows without a Not applicable checkbox and treats light-source selection separately.'),
 instructions=dict(location='Enter the page, figure, or table number where the information appears in your manuscript.',notAvailable='Use Not available when the information was not collected, measured, or cannot be provided.',notApplicable='Use Not applicable only when the item is irrelevant to your study after consulting the Explanation & Elaboration document.',essential='This item applies to all studies; Not applicable is not offered in the official checklist.',scope='A reporting checklist for human laboratory studies of non-visual responses to light. It does not assess study quality.'),
 sections=[dict(id=i,label=l,title=t,group=g,description=d) for i,l,t,g,d in sections],
 items=items,
 lightSources=dict(id='B1.1',title='Light source type(s)',description='Select all relevant sources, including background room illumination alongside an experimental device.',eePages=[3,4],selectionRequired=True,otherField='Other',spectrumMultiple=True,spectrumNote='Select every spectral type used across the study’s sources or conditions.'),
 lightSourceTypes=sourceTypes,spectrumTypes=spectrumTypes,
 generalFields=dict(authors='Author names',title='Manuscript title',date='Date'),
 notes=dict(lightLevel='Luminance and radiance metrics are mainly relevant for emissive surfaces.',colour='Peak wavelength and bandwidth are most relevant for monochromatic or narrowband light sources.')
)
r=PdfReader(ROOT/'sources'/CHECKLIST)
fields=r.get_fields()
assert len(items)==24
assert sum(i['essential'] for i in items)==9
used=list(data['generalFields'].values())+[data['lightSources']['otherField']]
used += [x['pdfField'] for x in sourceTypes+spectrumTypes]
for i in items:
 used += [v for v in i['pdf'].values() if v is not None]
assert len(used)==len(set(used))==74
assert all(name in fields for name in used)
widgets=[]
for page_index,page in enumerate(r.pages):
 for annot in page['/Annots']:
  obj=annot.get_object()
  if obj.get('/Subtype')=='/Widget':
   widgets.append(dict(page=page_index+1,name=str(obj.get('/T')),type=str(obj.get('/FT')),rect=[float(v) for v in obj.get('/Rect',[])],flags=int(obj.get('/Ff',0))))
# Verify checkbox status mapping against row positions, independently of field order.
by_name={w['name']:w for w in widgets}
for item in items:
 loc=by_name[item['pdf']['location']]
 for key in ['notAvailable','notApplicable']:
  field=item['pdf'][key]
  if field:
   box=by_name[field]
   assert loc['page']==box['page']
   assert abs(sum(loc['rect'][1::2])/2-sum(box['rect'][1::2])/2)<2, (item['id'],key)
   assert (450 < box['rect'][0] < 480) if key=='notAvailable' else (530 < box['rect'][0] < 560)
source_hashes={name:hashlib.sha256((ROOT/'sources'/name).read_bytes()).hexdigest() for name in [CHECKLIST,EE]}
data['meta']['sha256']=source_hashes
(ROOT/'data'/'checklist.json').write_text(json.dumps(data,ensure_ascii=False,indent=2)+'\n')
(ROOT/'data'/'pdf-form-map.json').write_text(json.dumps(dict(source=CHECKLIST,sha256=source_hashes[CHECKLIST],fieldCount=len(fields),mappedFields=used,excludedPushButtons=['Reset','Button3'],widgets=widgets),indent=2)+'\n')
print('Verified 24 location rows, 9 without N/A, 25 total items including source selection, 74 mapped form fields.')
