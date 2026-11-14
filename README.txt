EARTH JUKEBOX
=============
Turns NASA-style Earth data pictures and videos into sound.

Quick start
  Open earth-jukebox.html (single file, works anywhere, also on a phone).
  The menu has preset cards (a video with its legend, plays on click) and map cards (load your own picture or video).

Add your own video or legend
  Edit presets.json, then run  python3 build_single_file.py   (see PRESETS.md).

Project layout
  earth-jukebox.html        ready-to-use single page (built from the files below)
  index.html                the page, loads style.css and js/*.js
  style.css                 look and accessibility styles
  presets.json              YOUR LIST of presets, videos and legends (edit this)
  build_single_file.py      reads presets.json, writes js/generated-presets.js and earth-jukebox.html
  PRESETS.md                how to fill in presets.json
  media/                    source videos and legend pictures
  js/config.js              shared settings and layer toggles
  js/legend.js              built-in NASA colour legends as numbers
  js/maps.js                built-in map types: sound voice, scale, tempo, graph colours
  js/generated-presets.js   GENERATED from presets.json (maps, legends and embedded videos). Do not edit.
  js/legend-upload.js       turn an uploaded colour-bar image into a new map type (in the page)
  js/analysis.js            pixels to numbers, plus the text scene description
  js/sweeping.js            the sweep listening mode: moving line, columns, pan
  js/audio.js               Web Audio sound engine
  js/spectrum.js            live spectrum bar + mute button for each playing layer
  js/app.js                 menu, presets, controls, uploads, keyboard shortcuts, main loop
  js/scenes.js              demo scenes (not loaded by index.html)

Keys: D describes the scene, P plays/stops, arrow keys move the listening box
(Shift + arrows resizes it).
