// presets.js — the playlist. Edit this file to add or remove tracks; there is no build step.
// Videos and legend pictures are read from media/ when the page runs, so serve the folder:
//   python3 -m http.server   then open http://localhost:8000   (double-clicking index.html will not load them)
//
// A track on the built-in temperature map only needs a video:
//   { id: 'july', name: 'Temperature, July', map: 'temp', video: 'media/july.mp4', sweep: 24 }
// A track with its own legend picture becomes a new map type:
//   { id: 'x', name: 'Gas X', video: 'media/x.mp4', sweep: 24, legend: { image: 'media/x_legend.png', lo: 0, hi: 10, units: 'ppb' } }
// Optional keys for a new map:
//   legend.log10, legend.type ('auto' | 'gradient' | 'steps'), legend.tol (colour match tolerance, default 50),
//   legend.bar {row, x0, x1} (pixel position of the bar, needed if it has white or black ends),
//   ticks [5 labels], labels ['Hum','Ticks'], mapName, blurb,
//   pad / drops [from, to, curve] (0 = low end of the legend, 1 = high end; curve 'linear' | 'sqrt' | 'square' | 'pow1.5'),
//   voice {scale, chime, base, pad, cutoff, tempo, reverb, hiss ...} (starts from the temperature voice),
//   graph [4 legend values] (colours of the Pad, Drops, Noise and Drone bars), coverage ('full' | 'sparse').
window.EJ = window.EJ || {};
EJ.PRESETS = [
  { id: 'lst', name: 'Global temperature video (T2M)', map: 'temp', video: 'media/lst.mp4', sweep: 24,
    blurb: 'A 31-second NASA GMAO near-surface temperature clip with its real legend.' },

  { id: 'nox', name: 'Global NOx video', video: 'media/nox.mp4', sweep: 24,
    blurb: 'A 31-second NASA GMAO nitrogen oxides clip with its real legend. Clean air is near silent; busy cities and shipping lanes hum and tick.',
    mapName: 'Nitrogen oxides (NOx)',
    legend: { image: 'media/nox_legend.png', lo: -3, hi: 1, log10: true, units: 'ppbv', tol: 30, bar: { row: 50, x0: 72, x1: 462 } },
    labels: ['Hum', 'Ticks'],
    pad: [0.3, 1, 'sqrt'], drops: [0.1, 1, 'pow1.5'],
    voice: { scale: 'minor', chime: 'drip', base: 57, dropGain: 0.9, pad: 'sawtooth', cutoff: [120, 2200], detune: [6, 40], tempo: [60, 132], tempoFrom: 'heat', reverb: 0.3, hiss: 0.05 },
    graph: [0.2, -1.4, -2.2, -0.6] }
];
