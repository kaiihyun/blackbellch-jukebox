// (voice.scale: 'major' or 'minor' pentatonic. Minor sounds tense, major sounds open.)
// maps.js — one entry per map type. This is where "what does this legend sound like?" is decided.
// Each entry says:
//   legend    which colour legend to match pixels against (legend.js), or null for the red/blue hue rule
//   coverage  'full' = the map is coloured everywhere (temperature); 'sparse' = mostly empty (rain, snow)
//   levels    turns a legend value into two amounts [pad, drops], each 0..1:
//               pad   = the sustained tone (heat, thunder, snow hush)
//               drops = the scattered notes (ice chimes, raindrops)
//   voice     how those two sound: chime style, pad wave, filter, buzz, tempo range, reverb, wind/rain hiss
(function () {
  var cl = EJ.clamp01;
  var HOT_SOUND = { scale: 'minor', chime: 'ice', base: 69, dropGain: 1, pad: 'sawtooth', cutoff: [200, 2800], detune: [4, 30], tempo: [64, 128], tempoFrom: 'heat', reverb: 0.45, hiss: 0.05 };

  EJ.MAP_ORDER = ['temp', 'nox']; // menu cards and Map type list. sst, rain, snow and heatrain are still defined below; add their ids back here to show them
  EJ.MAPS = {
    temp: {
      graph: [22, 0, 8, 14], // legend values whose colours paint the Pad, Drops, Noise and Drone graphs
      name: 'Land temperature', legend: 'temp', coverage: 'full',
      blurb: 'NASA T2M near-surface temperature, −40 to 40 °C. Heat builds a buzzing tone, cold rings as ice chimes.',
      ticks: ['−40', '−20', '0', '20', '40 °C'], labels: ['Warm', 'Cold'], avg: 'Average',
      fmt: function (v) { return Math.round(v) + ' °C'; },
      // Silent at 5 °C. sqrt() lifts the low end so mild warmth or cold is still audible.
      levels: function (v, o) { o[0] = Math.sqrt(cl((v - 5) / 35)); o[1] = Math.sqrt(cl((5 - v) / 45)); },
      voice: HOT_SOUND
    },
    sst: {
      graph: [27, 8, 14, 21], // legend values whose colours paint the Pad, Drops, Noise and Drone graphs
      name: 'Sea surface temperature', legend: 'sst', coverage: 'full',
      blurb: 'Ocean temperature, −5 to 35 °C. Warm water is a soft, deep swell. Cold water is sparse, shimmering chimes.',
      ticks: ['−5', '5', '15', '25', '35 °C'], labels: ['Warm', 'Cold'], avg: 'Average',
      fmt: function (v) { return Math.round(v) + ' °C'; },
      // The legend turns from blue to cream at 15 °C, so that is the quiet point.
      levels: function (v, o) { o[0] = Math.sqrt(cl((v - 15) / 20)); o[1] = Math.sqrt(cl((15 - v) / 20)); },
      // Triangle waves (softer than saws), longer reverb and a slower tempo give an oceanic feel.
      voice: { scale: 'major', chime: 'ice', base: 69, dropGain: 1, pad: 'triangle', cutoff: [150, 1800], detune: [3, 14], tempo: [52, 96], tempoFrom: 'heat', reverb: 0.7, hiss: 0.04 }
    },
    nox: {
      graph: [0.2, -1.4, -2.2, -0.6], // legend values whose colours paint the Pad, Drops, Noise and Drone graphs
      name: 'Nitrogen oxides (NOx)', legend: 'nox', coverage: 'full',
      blurb: 'NOx pollution, 0.001 to 10 ppbv on a log scale. Clean air is near silent, busy cities and shipping lanes hum and tick.',
      ticks: ['10⁻³', '10⁻²', '10⁻¹', '10⁰', '10¹ ppbv'], labels: ['Hum', 'Ticks'], avg: 'Average',
      fmt: function (v) { var x = Math.pow(10, v); return (x >= 1 ? x.toFixed(1) : x.toPrecision(2)) + ' ppbv'; },
      // v is log10(ppbv). u = 0..1 across the legend. Below u 0.3 there is no hum, so clean regions stay quiet.
      levels: function (v, o) { var u = cl((v + 3) / 4); o[0] = Math.sqrt(cl((u - 0.3) / 0.7)); o[1] = Math.pow(cl((u - 0.1) / 0.9), 1.5); },
      voice: { scale: 'minor', chime: 'drip', base: 57, dropGain: 0.9, pad: 'sawtooth', cutoff: [120, 2200], detune: [6, 40], tempo: [60, 132], tempoFrom: 'heat', reverb: 0.3, hiss: 0.05 }
    },
    rain: {
      graph: [0.65, 0.15, 0.35, 0.5], // legend values whose colours paint the Pad, Drops, Noise and Drone graphs
      name: 'Rainfall', legend: 'rain', coverage: 'sparse',
      blurb: 'Ten steps from light green to dark red. Light rain is a few drips, heavy rain is a downpour with thunder.',
      ticks: ['Light', 'Heavy'], labels: ['Thunder', 'Rain'], avg: 'Intensity',
      fmt: function (v) { return Math.round(v * 100) + '%'; },
      // Every step is rain. The heaviest steps (above 0.6) also add a low rumble.
      levels: function (v, o) { o[0] = cl((v - 0.6) / 0.4); o[1] = v; },
      voice: { scale: 'minor', chime: 'drip', base: 57, dropGain: 1, pad: 'sawtooth', cutoff: [90, 350], detune: [2, 6], tempo: [66, 120], tempoFrom: 'rain', reverb: 0.45, hiss: 0.07 }
    },
    snow: {
      graph: [0.7, 0.15, 0.35, 0.5], // legend values whose colours paint the Pad, Drops, Noise and Drone graphs
      name: 'Snowfall', legend: 'snow', coverage: 'sparse',
      blurb: 'Ten steps from cyan to purple. Light snow is a few soft chimes. Heavy snow is a thick, muffled hush.',
      ticks: ['Light', 'Heavy'], labels: ['Hush', 'Snow'], avg: 'Intensity',
      fmt: function (v) { return Math.round(v * 100) + '%'; },
      levels: function (v, o) { o[0] = 0.7 * v; o[1] = v; },
      // Quiet, slow, very reverberant: snow muffles sound.
      voice: { scale: 'major', chime: 'ice', base: 69, dropGain: 0.6, pad: 'triangle', cutoff: [100, 500], detune: [2, 6], tempo: [48, 84], tempoFrom: 'rain', reverb: 0.8, hiss: 0.03 }
    },
    heatrain: {
      name: 'Heat and rain (red and blue)', legend: null, coverage: 'sparse',
      blurb: 'The original rule for any map: red to yellow is heat, blue is rain. No legend needed.',
      stripCss: 'linear-gradient(to right,#ffc828,#ff5014,#6e1e23 38%,#12203a 50%,#1e3c96 62%,#1e82ff,#6ec8ff)',
      labels: ['Heat', 'Rain'], avg: '', fmt: null,
      voice: { scale: 'major', chime: 'drip', base: 57, dropGain: 1, pad: 'sawtooth', cutoff: [200, 2800], detune: [4, 30], tempo: [64, 128], tempoFrom: 'heat', reverb: 0.45, hiss: 0.05 }
    }
  };
  // Colours for the spectrum bars, the row meter and the Warm/Cold readout, taken from the open map's legend.
  // A map lists legend values in `graph`; custom legends use fractions of their range. Colours are nudged
  // so they stay readable on both light and dark backgrounds (not too dark, not too pale).
  var DEFAULT_G = { pad: 'rgb(255,106,69)', drops: 'rgb(74,168,255)', noise: 'rgb(110,190,160)', drone: 'rgb(169,155,255)' };
  EJ.gcol = {}; for (var k0 in DEFAULT_G) EJ.gcol[k0] = DEFAULT_G[k0];
  function fit(c) {
    var l = 0.299 * c[0] + 0.587 * c[1] + 0.114 * c[2], i;
    c = c.slice();
    if (l < 110) { var t = (110 - l) / (255 - l); for (i = 0; i < 3; i++) c[i] += (255 - c[i]) * t; }
    else if (l > 190) { var s = 1 - (l - 190) / l; for (i = 0; i < 3; i++) c[i] *= s; }
    return 'rgb(' + Math.round(c[0]) + ',' + Math.round(c[1]) + ',' + Math.round(c[2]) + ')';
  }
  EJ.updateGraphColors = function () {
    var m = EJ.map(), root = document.documentElement.style, L = m.legend && EJ.LEGENDS[m.legend], keys = ['pad', 'drops', 'noise', 'drone'];
    if (!L) { keys.forEach(function (k) { EJ.gcol[k] = DEFAULT_G[k]; }); root.removeProperty('--hot'); root.removeProperty('--wet'); return; }
    var vals = m.graph || [0.8, 0.2, 0.45, 0.65].map(function (u) { return L.lo + u * (L.hi - L.lo); });
    keys.forEach(function (k, i) { EJ.gcol[k] = fit(EJ.legendColor(m.legend, vals[i])); });
    root.setProperty('--hot', EJ.gcol.pad); root.setProperty('--wet', EJ.gcol.drops); // Warm/Cold text readout
  };
  EJ.map = function () { return EJ.MAPS[EJ.dataType]; }; // the map type selected right now
})();
