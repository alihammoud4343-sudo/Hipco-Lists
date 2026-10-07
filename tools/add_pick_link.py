# Top of every tickable stocklot PDF: removes the old instruction text, puts ONE yellow button "TAP HERE to choose your lines"
# (link to pick.html) and removes the tick boxes next to quality headings (only the numbered lines keep a box). Safe to re-run.
import glob, io, re
from pypdf import PdfReader, PdfWriter
from pypdf.generic import DictionaryObject, NameObject, ArrayObject, FloatObject, TextStringObject, NumberObject
from reportlab.pdfgen import canvas
SITE = 'https://alihammoud4343-sudo.github.io/Hipco-Lists/pick.html?ref='
BX0, BY0, BX1, BY1 = 10, 798, 232, 828
VERSION = '2'
for p in sorted(glob.glob('SL*.pdf')):
    m = re.match(r'SL-?(\d+)', p); r = PdfReader(p)
    if not m or not r.get_fields(): continue
    if (r.metadata or {}).get('/HipcoPick') == VERSION: print('skip', p); continue
    ref = 'SL' + m.group(1)
    buf = io.BytesIO(); c = canvas.Canvas(buf, pagesize=(595, 842))
    c.setFillColorRGB(1, 1, 1)                       # white-out the old instruction text and old button
    c.rect(0, 806, 362, 36, fill=1, stroke=0); c.rect(0, 774, 233, 33, fill=1, stroke=0)
    c.setFillColorRGB(1, 0.88, 0.2); c.roundRect(BX0, BY0, BX1 - BX0, BY1 - BY0, 7, fill=1, stroke=0)
    c.setFillColorRGB(0.07, 0.15, 0.36); c.setFont('Helvetica-Bold', 12); c.drawCentredString((BX0 + BX1) / 2, BY0 + 10, 'TAP HERE to choose your lines'); c.save(); buf.seek(0)
    w = PdfWriter(clone_from=r); pg = w.pages[0]; pg.merge_page(PdfReader(buf).pages[0])
    keep = ArrayObject(); drop = set()
    for a in pg['/Annots']:
        o = a.get_object(); t = str(o.get('/T', '')); u = str(o.get('/A', {}).get('/URI', '')) if o.get('/A') else ''
        if re.match(r'^SL\d+_h\d+$', t): drop.add(a.idnum); continue     # tick box next to a quality heading
        if '/pick.html' in u: continue                                    # old link
        keep.append(a)
    link = DictionaryObject({NameObject('/Type'): NameObject('/Annot'), NameObject('/Subtype'): NameObject('/Link'),
        NameObject('/Rect'): ArrayObject([FloatObject(BX0), FloatObject(BY0), FloatObject(BX1), FloatObject(BY1)]),
        NameObject('/Border'): ArrayObject([NumberObject(0), NumberObject(0), NumberObject(0)]),
        NameObject('/A'): DictionaryObject({NameObject('/S'): NameObject('/URI'), NameObject('/URI'): TextStringObject(SITE + ref)})})
    keep.append(w._add_object(link)); pg[NameObject('/Annots')] = keep
    af = w._root_object['/AcroForm']; af[NameObject('/Fields')] = ArrayObject([f for f in af['/Fields'] if f.idnum not in drop])
    w.add_metadata({'/HipcoPick': VERSION})
    with open(p, 'wb') as f: w.write(f)
    print('ok', p, 'headings removed:', len(drop))
