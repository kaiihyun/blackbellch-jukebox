# build_single_file.py — combines index.html + style.css + js/*.js into ONE self-contained page
# (../earth-jukebox.html) so it can be hosted or opened anywhere. Run:  python3 build_single_file.py
import re
html = open('index.html', encoding='utf-8').read()
css = open('style.css', encoding='utf-8').read()

# Dark theme follows the device unless the host forces a theme.
m = re.search(r'@media \(prefers-color-scheme:dark\)\{:root\{(.*?)\}\}', css)
vars_ = m.group(1)
css = css.replace(m.group(0),
  '@media (prefers-color-scheme:dark){:root:not([data-theme="light"]){' + vars_ + '}}\n'
  ':root[data-theme="dark"]{' + vars_ + '}')
css = css.replace('html{background:var(--bg)}',
  'html{background:var(--bg);scroll-padding-top:env(safe-area-inset-top,0px)}')

html = html.replace('<link rel="stylesheet" href="style.css">', '<style>\n' + css + '\n</style>')
def inline(mo):
    js = open(mo.group(1), encoding='utf-8').read()
    assert '</script' not in js
    return '<script>\n' + js + '\n</script>'
html = re.sub(r'<script src="(js/[^"]+)"></script>', inline, html)
open('../earth-jukebox.html', 'w', encoding='utf-8').write(html)
print('built ../earth-jukebox.html', len(html), 'bytes')
