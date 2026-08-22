#!/usr/bin/env python3
"""Pick concrete sample files for Music Jungle from local zips + catalog trees.
Emits: /tmp/mjmanifest.tsv  (out_id <TAB> source <TAB> max_secs)
       src/content/samples.json ({id: {note, dyn}}) for runtime pitch math."""
import json, os, re, urllib.parse

TREE_PH = open('/tmp/philly_tree.txt').read().splitlines()
TREE_SSO = open('/tmp/sso_tree.txt').read().splitlines()
LOCAL = '/tmp/mjassets'
MIRROR = 'https://raw.githubusercontent.com/skratchdot/philharmonia-samples/gh-pages/'
SSO = 'https://raw.githubusercontent.com/peastman/sso/master/Sonatina%20Symphonic%20Orchestra/'

NOTE_SEMI = {'C':0,'Cs':1,'D':2,'Ds':3,'E':4,'F':5,'Fs':6,'G':7,'Gs':8,'A':9,'As':10,'B':11}
def parse_note(n):
    m = re.match(r'([A-G]s?)(\d)$', n)
    return NOTE_SEMI[m.group(1)] + 12*(int(m.group(2))+1) if m else None

def ph_local(relpath):
    """Return local path if the philharmonia file came from our downloaded zips."""
    p = os.path.join(LOCAL, relpath)
    return p if os.path.exists(p) else None

def dur_rank(d):
    order = ['very-long','long','15','1','05','025']
    try: return order.index(d)
    except ValueError: return 99

def dyn_rank(d):
    order = ['forte','mezzo-forte','fortissimo','mezzo-piano','piano','pianissimo']
    try: return order.index(d)
    except ValueError: return 99

def ph_candidates(prefix, inst_prefix):
    """Candidate dicts from local zip dirs (Strings/, Brass/) or the mirror tree."""
    out = []
    if prefix.startswith(('Strings/', 'Brass/')):
        d = os.path.join(LOCAL, prefix)
        names = [prefix + '/' + f for f in os.listdir(d)] if os.path.isdir(d) else []
    else:
        p = 'audio/' + prefix + '/'
        names = [l for l in TREE_PH if l.startswith(p)]
    for line in names:
        fn = os.path.basename(line)
        if not fn.startswith(inst_prefix + '_') or not fn.endswith('.mp3'):
            continue
        body = fn[len(inst_prefix)+1:-4]
        parts = body.split('_')
        if len(parts) < 4: continue
        note, dur, dyn = parts[0], parts[1], parts[2]
        art = '_'.join(parts[3:]) or 'normal'
        semi = parse_note(note)
        if semi is None: continue
        out.append(dict(line=line, note=note, dur=dur, dyn=dyn, art=art,
                        semi=semi, is_phrase=('phrase' in dur)))
    return out

def pick_ph(dir_, inst_prefix, want_note=None):
    cands = ph_candidates(dir_, inst_prefix)
    if not cands: return None
    notes = []
    if want_note == 'auto':
        target = {'doublebass':36,'cello':48,'bassoon':55,'tuba':41,'trombone':50,
                  'frenchhorn':55,'trumpet':58,'clarinet':64,'saxophone':61,
                  'flute':72,'guitar':55,'violin':67}.get(inst_prefix, 60)
        notes = sorted({c['semi'] for c in cands}, key=lambda s: abs(s-target))[:4]
    main = soft = phrase = None
    def sel(preds):
        for pred in preds:
            got = [c for c in cands if pred(c)]
            if got:
                got.sort(key=lambda c:(dur_rank(c['dur']), dyn_rank(c['dyn']), c['art']!='normal', abs(c['semi']-target)))
                return got[0]
        return None
    if want_note == 'auto':
        main = sel([lambda c: not c['is_phrase'] and c['semi']==target and c['dyn'] in ('forte','mezzo-forte') and c['art']=='normal',
                    lambda c: not c['is_phrase'] and c['semi']==target and c['dyn']=='forte',
                    lambda c: not c['is_phrase'] and c['dyn']=='forte' and c['art']=='normal',
                    lambda c: not c['is_phrase'] and c['dyn']=='forte'])
        same = [c for c in cands if main and not c['is_phrase'] and c['semi']==main['semi'] and c['dyn'] in ('piano','pianissimo','mezzo-piano')]
        soft = min(same, key=lambda c:dur_rank(c['dur'])) if same else None
        phrase = sel([lambda c: c['is_phrase'] and c['dyn'] in ('forte','mezzo-forte'),
                      lambda c: c['is_phrase']])
    return dict(main=main, soft=soft, phrase=phrase)

def src_for(line):
    """Map a philharmonia candidate to local path or mirror URL."""
    if line.startswith(('Strings/', 'Brass/')):
        lp = os.path.join(LOCAL, line)
        return ('file:' + lp) if os.path.exists(lp) else ('url:' + MIRROR + urllib.parse.quote('audio/' + line))
    lp = ph_local(line)
    return ('file:' + lp) if lp else ('url:' + MIRROR + urllib.parse.quote(line))

rows = []   # (out_id, source, secs, note_or_None)
meta = {}

PH_SPECS = {
  'violin':     ('Strings/violin',      'violin'),
  'guitar':     ('Strings/guitar',      'guitar'),
  'cello':      ('Strings/cello',       'cello'),
  'doublebass': ('Strings/double bass', 'double-bass'),
  'flute':      ('flute',               'flute'),
  'clarinet':   ('clarinet',            'clarinet'),
  'saxophone':  ('saxophone',           'saxophone'),
  'bassoon':    ('bassoon',             'bassoon'),
  'trumpet':    ('Brass/trumpet',       'trumpet'),
  'trombone':   ('Brass/trombone',      'trombone'),
  'frenchhorn': ('Brass/french horn',   'french-horn'),
  'tuba':       ('Brass/tuba',          'tuba'),
}
PERC = {
  'snaredrum': 'percussion/snare drum/snare-drum__025_forte_with-snares.mp3',
  'tomtom':    'percussion/tom-toms/tom-toms__05_mezzo-forte_struck-singly.mp3',
  'triangle':  'percussion/triangle/triangle__long_piano_struck-singly.mp3',
  'woodblock': 'percussion/woodblock/woodblock__025_mezzo-forte_struck-singly.mp3',
  'bassdrum':  'percussion/bass drum/bass-drum__025_forte_bass-drum-mallet.mp3',
  'shaker':    'percussion/banana shaker/banana-shaker__phrase_mezzo-forte_rhythm.mp3',
}

for out_id,(dir_,prefix) in PH_SPECS.items():
    r = pick_ph(dir_, prefix, 'auto')
    if not r or not r['main']:
        print(f'MISS {out_id}', flush=True); continue
    rows.append((out_id, src_for(r['main']['line']), 4, r['main']['note']))
    meta[out_id] = {'note': r['main']['note'], 'dyn': r['main']['dyn']}
    if r['phrase']:
        rows.append((out_id+'.phrase', src_for(r['phrase']['line']), 4, r['phrase'].get('note')))
    if r['soft']:
        rows.append((out_id+'.soft', src_for(r['soft']['line']), 4, r['soft']['note']))

for out_id, rel in PERC.items():
    full = 'audio/percussion/' + rel.split('percussion/',1)[1]
    if full not in TREE_PH:
        print(f'MISS perc {out_id}'); continue
    rows.append((out_id, src_for(full), 2.5, None))
    meta[out_id] = {'note': None, 'dyn': 'hit'}

SSO_PICKS = {
  'harp':      ('Samples/Harp/harp-c4.wav', 'C4', 4),
  'harp.phrase':('Samples/Harp/harp-a5.wav', 'A5', 4),
  'timpani':   ('Samples/Percussion/timpani-f-lh-c2.wav', 'C2', 3),
  'xylophone': ('Samples/Percussion/xylophone-c%234.wav', 'Cs4', 2.5),
}
for out_id,(rel,note,secs) in SSO_PICKS.items():
    rows.append((out_id, 'url:'+SSO+rel, secs, note))
    meta[out_id] = {'note': note, 'dyn':'forte'}

with open('/tmp/mjmanifest.tsv','w') as f:
    for out_id, src, secs, note in rows:
        f.write(f'{out_id}\t{src}\t{secs}\n')
with open(os.path.join(os.path.dirname(__file__),'..','src','content','samples.json'),'w') as f:
    json.dump(meta, f, indent=1, sort_keys=True)
print(f'{len(rows)} samples selected -> /tmp/mjmanifest.tsv')
