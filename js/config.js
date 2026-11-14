// config.js — settings shared by every file.
// All the files hang their data off ONE global object called EJ ("Earth Jukebox"),
// so they can talk to each other without a build tool. Open index.html and it just works.
var EJ = {
  C: 64, R: 14,    // analysis grid: 64 columns × 14 rows. Each ROW becomes one musical note.
  VW: 640, VH: 320 // size of the main picture canvas (2:1, like a flat world map)
};

// Which map type we are reading right now: one of the ids in maps.js ('temp', 'sst', 'rain',
// 'snow', 'heatrain'), or a custom one added by legend-upload.js after the user uploads a legend.
EJ.dataType = 'temp';

// Keep a number between 0 and 1 (used by almost every file).
EJ.clamp01 = function (v) { return v < 0 ? 0 : v > 1 ? 1 : v; };

// ---------- Layer toggles ----------
// Three kinds of "layer" make up the sound, and each can be switched on or off independently
// from the toggle buttons in app.js:
//   notesWarm / notesCold   NOTE layers   — the row-by-row pitched data read from the picture
//   pad / drops / noise / drone  INSTRUMENT layers — the actual voices in audio.js
//   scene                   SCENE layer   — the picture-to-sound pipeline as a whole; turning
//                            this off mutes everything the picture drives, leaving only the drone
EJ.layers = { notesWarm: true, notesCold: true, pad: true, drops: true, noise: true, drone: true, scene: true };
