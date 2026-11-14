# build_single_file.py — reads presets.json, builds js/generated-presets.js, and combines index.html + style.css + js/*.js
# into ONE self-contained page (earth-jukebox.html). Run:  python3 build_single_file.py
# Needs: Python 3, Pillow, numpy, and ffmpeg (only for videos with "reencode": true or for the frame check). See PRESETS.md.
import re, json, base64, hashlib, subprocess, sys
from pathlib import Path
import numpy as np
from PIL import Image

ROOT = Path(__file__).parent
CACHE = ROOT / '.cache'; CACHE.mkdir(exist_ok=True)
C, R = 64, 14

# ---------- legend image -> colour table (same method as the in-page "Upload legend image" button) ----------
def colorfulness(a):
    a = a.astype(float); mx = a[..., :3].max(-1); mn = a[..., :3].min(-1)
    s = np.where(mx > 0, (mx - mn) / np.maximum(mx, 1), 0)
    return np.where(a[..., 3] < 200, 0, s * mx / 255)

def sample_legend(e):
    L = e['legend']; im = np.array(Image.open(ROOT / L['image']).convert('RGBA'))
    bar = L.get('bar') or {}
    row = bar.get('row')
    if row is None:   # middle of the tallest band of rows that are nearly as colourful as the best one (avoids the bar's outline rows)
        sc = colorfulness(im[:, ::2]).sum(1); band = np.where(sc >= 0.8 * sc.max())[0]
        runs = np.split(band, np.where(np.diff(band) > 1)[0] + 1); best = max(runs, key=len); row = int(best[len(best) // 2])
    cf = colorfulness(im[row])
    x0, x1 = bar.get('x0'), bar.get('x1')
    if x0 is None or x1 is None:   # trim to the colourful stretch (white or black bar ends: set bar.x0 / bar.x1 by hand)
        idx = np.where(cf >= 0.1)[0]
        if len(idx) < 10: sys.exit(f"[{e['id']}] could not find a colour bar; set legend.bar.row / x0 / x1")
        x0, x1 = int(idx[0]), int(idx[-1])
    px = lambda x: [int(v) for v in im[row, int(round(x))][:3]]
    s = [px(x0 + (x1 - x0) * k / 159) for k in range(160)]
    jumps = sum(1 for a, b in zip(s, s[1:]) if sum(abs(p - q) for p, q in zip(a, b)) > 40)
    kind = L.get('type', 'auto')
    flat = np.mean([sum(abs(p - q) for p, q in zip(a, b)) <= 6 for a, b in zip(s, s[1:])])   # steps have flat plateaus, gradients do not
    discrete = bool(0 < jumps <= 14 and flat >= 0.7) if kind == 'auto' else kind == 'steps'
    lo, hi = L.get('lo', 0), L.get('hi', 1); cols = []
    if discrete:
        n = max(2, jumps + 1)
        for k in range(n): cols.append([round(lo + (hi - lo) * (k + .5) / n, 4)] + px(x0 + (x1 - x0) * (k + .5) / n))
    else:
        n = L.get('samples', 41)
        for k in range(n): cols.append([round(lo + (hi - lo) * k / (n - 1), 4)] + px(x0 + (x1 - x0) * k / (n - 1)))
    print(f"  legend {L['image']}: row {row}, x {x0}-{x1}, {'steps' if discrete else 'gradient'}, {len(cols)} colours")
    return {'lo': lo, 'hi': hi, 'discrete': discrete, 'tol': L.get('tol', 50), 'colors': cols}

def builtin_legend(name):   # read a legend that already lives in js/legend.js (used only for the frame check)
    t = (ROOT / 'js/legend.js').read_text(encoding='utf-8')
    m = re.search(name + r': \{ lo: [-\d.]+, hi: [-\d.]+, discrete: \w+,(?: tol: (\d+),)? colors: \[(.*?)\] \}', t, re.S)
    if not m: return None
    return {'tol': int(m.group(1) or 50), 'colors': [[float(x) for x in c.split(',')] for c in re.findall(r'\[(-?[\d.]+,\d+,\d+,\d+)\]', m.group(2))]}

# ---------- video -> small mp4 -> base64 ----------
def prepare_video(e):
    o = e.get('video_options', {}); src = ROOT / e['video']
    if not o.get('reencode', True): return src
    key = hashlib.sha1(src.read_bytes()).hexdigest()[:10]
    out = CACHE / f"{e['id']}-{key}-{o.get('width', 768)}-{o.get('crf', 26)}.mp4"
    if not out.exists():
        print(f"  encoding {src.name} ...")
        subprocess.run(['ffmpeg', '-v', 'error', '-y', '-i', str(src), '-an', '-vf', f"scale={o.get('width', 768)}:-2:flags=area",
                        '-c:v', 'libx264', '-preset', 'slow', '-crf', str(o.get('crf', 26)), '-pix_fmt', 'yuv420p', '-movflags', '+faststart', str(out)], check=True)
    return out

def check_frame(vid, leg, t):   # what share of the 64x14 grid lands on the legend? (the rest stays silent)
    png = CACHE / 'check.png'
    subprocess.run(['ffmpeg', '-v', 'error', '-y', '-ss', str(t), '-i', str(vid), '-frames:v', '1', str(png)], check=True)
    g = np.array(Image.open(png).convert('RGB').resize((C, R), Image.BOX)).reshape(-1, 3).astype(int)
    c = np.array(leg['colors'])[:, 1:4].astype(int); tol = leg.get('tol', 50)
    d = ((g[:, None, :] - c[None]) ** 2).sum(2).min(1)
    print(f"  frame check: {(d <= tol * tol).mean():.0%} of grid cells match the legend")

SUP = str.maketrans('-0123456789', '⁻⁰¹²³⁴⁵⁶⁷⁸⁹')
def auto_ticks(L, log10, units):
    t = []
    for v in np.linspace(L['lo'], L['hi'], 5):
        t.append(('10' + str(int(round(v))).translate(SUP)) if log10 and abs(v - round(v)) < 1e-6 else ('10^%.1f' % v) if log10 else '%g' % round(v, 2))
    if units: t[-1] += ' ' + units
    return t

# ---------- build js/generated-presets.js ----------
JS = r"""// generated-presets.js — GENERATED by build_single_file.py from presets.json. Do not edit by hand.
(function () {
  var cl = EJ.clamp01;
  function curve(x, c) { x = cl(x); return c === 'sqrt' ? Math.sqrt(x) : c === 'square' ? x * x : c === 'pow1.5' ? Math.pow(x, 1.5) : x; }
  function num(x) { var a = Math.abs(x); return a >= 100 ? String(Math.round(x)) : a >= 1 ? x.toFixed(1) : x.toPrecision(2); }
  EJ.PRESETS = EJ.PRESETS || [];
  var D = __DATA__;
  D.forEach(function (d) {
    if (d.legend) { // a new map type with its own legend
      var L = d.legend, span = L.hi - L.lo, p = d.pad, q = d.drops;
      EJ.LEGENDS[d.map] = L;
      EJ.MAPS[d.map] = {
        name: d.name, legend: d.map, coverage: d.coverage, blurb: d.blurb, ticks: d.ticks, labels: d.labels, avg: 'Average', graph: d.graph || undefined,
        fmt: function (v) { return num(d.log10 ? Math.pow(10, v) : v) + (d.units ? ' ' + d.units : ''); },
        levels: function (v, o) { var u = (v - L.lo) / span; o[0] = curve((u - p[0]) / (p[1] - p[0]), p[2]); o[1] = curve((u - q[0]) / (q[1] - q[0]), q[2]); },
        voice: Object.assign({}, EJ.MAPS[d.like].voice, d.voice)
      };
      EJ.MAP_ORDER.push(d.map);
    }
    if (d.video) EJ.PRESETS.push({ id: d.id, map: d.map, name: d.preset_name, blurb: d.preset_blurb, file: d.file, sweep: d.sweep, video: d.video });
  });
})();
"""
data = []
for e in json.loads((ROOT / 'presets.json').read_text(encoding='utf-8')):
    if e.get('enabled', True) is False: continue
    print('preset', e['id'])
    o = e.get('video_options', {}); d = {'id': e['id'], 'map': e.get('map', e['id'])}
    leg = None
    if 'legend' in e:
        leg = sample_legend(e); lg = e['legend']; log = bool(lg.get('log10'))
        d.update(legend=leg, log10=log, units=lg.get('units', ''), name=e['name'].replace(' video', '') if 'name' in e else e['id'],
                 blurb=e.get('blurb', ''), ticks=e.get('ticks') or auto_ticks(leg, log, lg.get('units', '')),
                 labels=e.get('labels', ['High', 'Low']), pad=e.get('pad', [0.5, 1, 'sqrt']), drops=e.get('drops', [0.5, 0, 'sqrt']),
                 like=e.get('like', 'temp'), voice=e.get('voice', {}), graph=e.get('graph'),
                 coverage=e.get('coverage') or ('sparse' if leg['discrete'] else 'full'))
        d['name'] = e.get('map_name', d['name'])
    else:
        leg = builtin_legend(d['map'])
    if e.get('video'):
        vid = prepare_video(e)
        if leg: check_frame(vid, leg, o.get('check_time', 5))
        d.update(video=base64.b64encode(vid.read_bytes()).decode(), file=Path(e['video']).name, sweep=o.get('sweep', 24),
                 preset_name=e['name'], preset_blurb=e.get('blurb') or 'Press a card and it plays.')
        print(f"  video {vid.stat().st_size / 1e6:.1f} MB")
    data.append(d)
(ROOT / 'js/generated-presets.js').write_text(JS.replace('__DATA__', json.dumps(data, ensure_ascii=False)), encoding='utf-8')

# ---------- combine everything into one page ----------
html = (ROOT / 'index.html').read_text(encoding='utf-8')
css = (ROOT / 'style.css').read_text(encoding='utf-8')
m = re.search(r'@media \(prefers-color-scheme:dark\)\{:root\{(.*?)\}\}', css)   # dark theme follows the device unless the host forces a theme
vars_ = m.group(1)
css = css.replace(m.group(0), '@media (prefers-color-scheme:dark){:root:not([data-theme="light"]){' + vars_ + '}}\n:root[data-theme="dark"]{' + vars_ + '}')
css = css.replace('html{background:var(--bg)}', 'html{background:var(--bg);scroll-padding-top:env(safe-area-inset-top,0px)}')
html = html.replace('<link rel="stylesheet" href="style.css">', '<style>\n' + css + '\n</style>')
def inline(mo):
    js = (ROOT / mo.group(1)).read_text(encoding='utf-8')
    assert '</script' not in js
    return '<script>\n' + js + '\n</script>'
html = re.sub(r'<script src="(js/[^"]+)"></script>', inline, html)
(ROOT / 'earth-jukebox.html').write_text(html, encoding='utf-8')
mb = len(html.encode()) / 1e6
print(f'built earth-jukebox.html {mb:.1f} MB' + ('   WARNING: over 16 MB, too big to host as an artifact; lower video width or raise crf' if mb > 16 else ''))
