# Builds data/lines.json: the numbered lines of every stocklot PDF (read from the tickable form fields), for the tap-to-select page pick.html
import glob, json, re, sys
from pypdf import PdfReader
out = {}
for p in sorted(glob.glob('SL*.pdf')):
    m = re.match(r'(SL)-?(\d+)', p)
    if not m: continue
    ref = 'SL' + m.group(2)
    r = PdfReader(p); fl = r.get_fields() or {}
    rows = []; head = None
    for k, v in fl.items():
        tu = str(v.get('/TU') or '')
        mm = re.match(r'^' + ref + r'_([hr])(\d+)$', k)
        if not mm: continue
        if mm.group(1) == 'h': rows.append({'h': tu})
        else:
            n = re.match(r'^(\d+)\s+(.*)$', tu)
            if n: rows.append({'n': int(n.group(1)), 't': n.group(2)})
    # keep PDF order (field index)
    def idx(x): return 0
    out[ref] = {'file': p, 'rows': rows}
json.dump(out, open('data/lines.json', 'w'), ensure_ascii=False, separators=(',', ':'))
print({k: len([x for x in v['rows'] if 'n' in x]) for k, v in out.items()})
