# Takes the yellow "TAP HERE to choose your lines" button (and its link) off every stocklot PDF. Safe to re-run.
import glob, io, re
from pypdf import PdfReader, PdfWriter
from pypdf.generic import ArrayObject, NameObject
from reportlab.pdfgen import canvas
for p in sorted(glob.glob('SL*.pdf')):
    r = PdfReader(p)
    if (r.metadata or {}).get('/HipcoPick') != '2': print('skip', p); continue
    buf = io.BytesIO(); c = canvas.Canvas(buf, pagesize=(595, 842)); c.setFillColorRGB(1, 1, 1); c.rect(0, 790, 233, 52, fill=1, stroke=0); c.save(); buf.seek(0)
    w = PdfWriter(clone_from=r); pg = w.pages[0]; pg.merge_page(PdfReader(buf).pages[0])
    keep = ArrayObject()
    for a in pg['/Annots']:
        o = a.get_object(); u = str(o.get('/A', {}).get('/URI', '')) if o.get('/A') else ''
        if '/pick.html' not in u: keep.append(a)
    pg[NameObject('/Annots')] = keep; w.add_metadata({'/HipcoPick': '3'})
    with open(p, 'wb') as f: w.write(f)
    print('ok', p)
