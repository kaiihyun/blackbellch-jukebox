EARTH JUKEBOX
=============
Turns NASA-style Earth data pictures and videos into sound.

Quick start
  Open earth-jukebox.html (single file, works anywhere, also on a phone).

Project layout
  earth-jukebox.html        ready-to-use single page (built from the files below)
  index.html                the page, loads style.css and js/*.js
  style.css                 look and accessibility styles
  build_single_file.py      rebuilds earth-jukebox.html: python3 build_single_file.py
  js/config.js              shared settings and layer toggles
  js/legend.js              NASA colour legends as numbers
  js/maps.js                map types: sound voice, major/minor scale, tempo
  js/legend-upload.js       turn an uploaded colour-bar image into a new map type
  js/analysis.js            pixels to numbers, plus the text scene description
  js/audio.js               Web Audio sound engine
  js/app.js                 menu, controls, uploads, keyboard shortcuts, main loop
  js/scenes.js              demo scenes (not loaded by index.html)

Keys: D describes the scene, P plays/stops, arrow keys move the listening box
(Shift + arrows resizes it).
