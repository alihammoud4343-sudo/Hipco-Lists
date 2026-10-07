# Adds a "Can't tick? TAP HERE" button (a link to pick.html) to the top of every tickable stocklot PDF. Safe to run twice.
import glob, io, re, sys
from pypdf import PdfReader, PdfWriter
from pypdf.generic import DictionaryObject, NameObject, ArrayObject, FloatObject, TextStringObject, NumberObject
from reportlab.pdfgen import canvas
SITE = 'https://alihammoud4343-sudo.github.io/Hipco-Lists/pick.html?ref='
X0, Y0, X1, Y1 = 10, 780, 215, 803
for p in sorted(glob.glob('SL*.pdf')):
    m = re.match(r'SL-?(\d+)', p); r = PdfReader(p)
    if not m or not r.get_fields(): continue
    if (r.metadata or {}).get('/HipcoPick'): print('skip', p); continue
    ref = 'SL' + m.group(1)
    buf = io.BytesIO(); c = canvas.Canvas(buf, pagesize=(595, 842))
    c.setFillColorRGB(1, 0.88, 0.2); c.roundRect(X0, Y0, X1 - X0, Y1 - Y0, 5, fill=1, stroke=0)
    c.setFillColorRGB(0.07, 0.15, 0.36); c.setFont('Helvetica-Bold', 9.5)
    c.drawString(X0 + 8, Y0 + 13, "Can't tick? TAP HERE to choose your lines"); c.setFont('Helvetica', 7.5)
    c.drawString(X0 + 8, Y0 + 4, 'Works on any phone  -  numbered lines turn yellow'); c.save(); buf.seek(0)
    w = PdfWriter(clone_from=r); ov = PdfReader(buf).pages[0]; w.pages[0].merge_page(ov)
    link = DictionaryObject({NameObject('/Type'): NameObject('/Annot'), NameObject('/Subtype'): NameObject('/Link'),
        NameObject('/Rect'): ArrayObject([FloatObject(X0), FloatObject(Y0), FloatObject(X1), FloatObject(Y1)]),
        NameObject('/Border'): ArrayObject([NumberObject(0), NumberObject(0), NumberObject(0)]),
        NameObject('/A'): DictionaryObject({NameObject('/S'): NameObject('/URI'), NameObject('/URI'): TextStringObject(SITE + ref)})})
    w.pages[0]['/Annots'].append(w._add_object(link))
    w.add_metadata({'/HipcoPick': '1'})
    with open(p, 'wb') as f: w.write(f)
    print('ok', p)
