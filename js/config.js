// config.js — settings shared by every file.
// All the files hang their data off ONE global object called EJ ("Earth Jukebox"),
// so they can talk to each other without a build tool. Open index.html and it just works.
var EJ = {
  C: 64,  R: 14,    // analysis grid: 64 columns × 14 rows. Each ROW becomes one musical note.
  VW: 640, VH: 320, // size of the main picture canvas (2:1, like a flat world map)
  SW: 128, SH: 64   // low-res buffer used to draw the built-in scenes (scaled up to VW×VH)
};

// Which kind of map we are reading:
// one of the ids in maps.js: 'temp', 'sst', 'rain', 'snow' or 'heatrain'
EJ.dataType = 'temp';

// Keep a number between 0 and 1 (used by almost every file).
EJ.clamp01 = function (v) { return v < 0 ? 0 : v > 1 ? 1 : v; };
