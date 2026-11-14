# build_single_file.py — OPTIONAL. Joins index.html, style.css, presets.js and app.js into earth-jukebox.html.
# The page already works as it is (through a web server, see presets.js). The background picture is embedded.
# Videos and legend pictures are still read from media/, so keep media/ next to the single file.
# Run:  python3 build_single_file.py
import base64
import re
from pathlib import Path

ROOT = Path(__file__).parent

html = (ROOT / 'index.html').read_text(encoding='utf-8')
css = (ROOT / 'style.css').read_text(encoding='utf-8')

bg = base64.b64encode((ROOT / 'assets' / 'earth.png').read_bytes()).decode()
css = css.replace('url(assets/earth.png)', 'url(data:image/png;base64,' + bg + ')')
html = html.replace('<link rel="stylesheet" href="style.css">', '<style>\n' + css + '\n</style>')


def inline(match):
    js = (ROOT / match.group(1)).read_text(encoding='utf-8')
    assert '</script' not in js
    return '<script>\n' + js + '\n</script>'


html = re.sub(r'<script src="([^"]+\.js)"></script>', inline, html)
(ROOT / 'earth-jukebox.html').write_text(html, encoding='utf-8')

mb = len(html.encode()) / 1e6
print(f'built earth-jukebox.html {mb:.1f} MB' + ('   WARNING: over 16 MB, too big to host as an artifact' if mb > 16 else ''))
