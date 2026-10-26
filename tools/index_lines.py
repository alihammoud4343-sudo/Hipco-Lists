# Builds data/lines_index.json: every numbered line of every stocklot PDF for the app's GSM / size / type filter.
# row = {n, q: quality, g: gsm, t: 'R' reel | 'S' sheet, w: width cm, l: length cm (sheets), tn: tons}
import glob, json, re, subprocess
NUM = r'\d+(?:[.,]\d+)?'
def f(x): return float(x.replace(',', '.'))
KEYS = [('QUALITY','Q'),('BRAND','B'),('REMARK','R'),('GSM','G'),('THICKNESS','TH'),('TYPE','T'),('DIMENSIONS','S'),('SIZE','S'),('REEL WIDTH','W'),('DIA','D'),('REELS','N'),('PALLETS','P'),('TONS','TN')]
def cols_from(header, prev):
    items = []; both = (prev or '') + ' ' + header
    for line in ([prev, header] if prev and 'THICKNESS' in prev.upper() else [header]):
        up = line.upper()
        for key, name in KEYS:
            if key == 'SIZE' and 'DIMENSIONS' in both.upper(): continue
            i = up.find(key)
            if key == 'REELS':
                i = up.find('REELS')
                if i >= 0 and up[i-6:i] == 'REEL W': i = -1
                j = up.find('REELS', i + 5) if i >= 0 else -1
            if i >= 0: items.append((i, name))
    items.sort()
    seen = []; 
    for _, n in items:
        if n not in seen: seen.append(n)
    return seen, ('(MM)' in both.upper())
out = {}; report = {}
for p in sorted(glob.glob('SL*.pdf')):
    m = re.match(r'(SL)-?(\d+)', p)
    if not m: continue
    ref = 'SL' + m.group(2)
    lines = subprocess.run(['pdftotext', '-layout', p, '-'], capture_output=True, text=True).stdout.splitlines()
    cols = None; mm = False; sect = ''; rows = []; unparsed = 0
    for i, ln in enumerate(lines):
        s = ln.strip()
        if re.match(r'^#\s+[A-Z]', s):
            cols, mm = cols_from(lines[i], next((x for x in (lines[i-1], lines[i-2]) if x.strip()), '') if i > 1 else ''); continue
        if re.fullmatch(r'(REELS|ROLLS|SHEETS|SHEETS \(PALLETS\)|REELS \(.*\)|ROLLS \(.*\))', s.upper()): sect = 'R' if s.upper().startswith(('REEL','ROLL')) else 'S'
        r = re.match(r'^(\d{1,3})\s{2,}(\S.*?)\s*$', ln.strip() if False else ln)
        r = re.match(r'^\s*(\d{1,3})\s{2,}(\S.*?)\s*$', ln)
        if not r or not cols: continue
        toks = re.split(r'\s{2,}', r.group(2).strip())
        if len(toks) < 3: unparsed += 1; continue
        q = toks[0]; rest = toks[1:]
        tons = None
        if re.fullmatch(NUM, rest[-1]): tons = f(rest[-1]); rest = rest[:-1]
        spec = None; typ = None; nums = []
        for t in rest:
            tl = t.lower()
            sm = re.fullmatch(r'(' + NUM + r')\s*[xX×]\s*(' + NUM + r')(?:\s*\(?sheets?\)?)?', t)
            rm = re.fullmatch(r'(' + NUM + r')\s*\(reel\)', t, re.I)
            if sm and spec is None: spec = ('S', f(sm.group(1)), f(sm.group(2)))
            elif rm and spec is None: spec = ('R', f(rm.group(1)), None)
            elif tl in ('roll', 'rolls', 'reel', 'reels'): typ = 'R'
            elif tl in ('sheet', 'sheets'): typ = 'S'
            elif re.fullmatch(NUM, t): nums.append(f(t))
        numcols = [c for c in cols if c in ('G','TH','S','W','D','N','P') and not (c == 'S' and spec)]
        # drop TONS (already taken); map numbers to numeric columns in order
        mp = {}
        for c, v in zip(numcols, nums): mp[c] = v
        g = mp.get('G'); w = l = None; t = typ or sect or None
        if spec:
            t = spec[0]; w = spec[1]; l = spec[2]
            if mm: w = w / 10; l = l / 10 if l else l
        else:
            wv = mp.get('W') if 'W' in mp else mp.get('S')
            if wv is not None:
                w = wv / 10 if mm else wv
                if t is None: t = 'R' if 'W' in cols else None
        if g is None:
            unparsed += 1; continue
        rows.append({'n': int(r.group(1)), 'q': q, 'g': g, 't': t, 'w': w, 'l': l, 'tn': tons})
    out[ref] = {'file': p, 'rows': rows}
    report[ref] = (len(rows), unparsed, round(sum(x['tn'] or 0 for x in rows), 2))
json.dump(out, open('data/lines_index.json', 'w'), ensure_ascii=False, separators=(',', ':'))
v = json.load(open('data/vault.json'))['docs']
q = {re.match(r'(SL)-?(\d+)', d['reference']).group(0).replace('-', ''): d.get('qty_mt') for d in v}
for k, (n, u, t) in report.items(): print(k, 'rows', n, 'unparsed', u, 'tons', t, 'list', q.get(k))
