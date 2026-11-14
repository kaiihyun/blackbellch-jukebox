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

  EJ.MAP_ORDER = ['temp', 'sst', 'rain', 'snow', 'heatrain'];
  EJ.MAPS = {
    temp: {
      name: 'Land temperature', legend: 'temp', coverage: 'full',
      blurb: 'NASA T2M near-surface temperature, −40 to 40 °C. Heat builds a buzzing tone, cold rings as ice chimes.',
      ticks: ['−40', '−20', '0', '20', '40 °C'], labels: ['Warm', 'Cold'], avg: 'Average',
      fmt: function (v) { return Math.round(v) + ' °C'; },
      // Silent at 5 °C. sqrt() lifts the low end so mild warmth or cold is still audible.
      levels: function (v, o) { o[0] = Math.sqrt(cl((v - 5) / 35)); o[1] = Math.sqrt(cl((5 - v) / 45)); },
      voice: HOT_SOUND
    },
    sst: {
      name: 'Sea surface temperature', legend: 'sst', coverage: 'full',
      blurb: 'Ocean temperature, −5 to 35 °C. Warm water is a soft, deep swell. Cold water is sparse, shimmering chimes.',
      ticks: ['−5', '5', '15', '25', '35 °C'], labels: ['Warm', 'Cold'], avg: 'Average',
      fmt: function (v) { return Math.round(v) + ' °C'; },
      // The legend turns from blue to cream at 15 °C, so that is the quiet point.
      levels: function (v, o) { o[0] = Math.sqrt(cl((v - 15) / 20)); o[1] = Math.sqrt(cl((15 - v) / 20)); },
      // Triangle waves (softer than saws), longer reverb and a slower tempo give an oceanic feel.
      voice: { scale: 'major', chime: 'ice', base: 69, dropGain: 1, pad: 'triangle', cutoff: [150, 1800], detune: [3, 14], tempo: [52, 96], tempoFrom: 'heat', reverb: 0.7, hiss: 0.04 }
    },
    rain: {
      name: 'Rainfall', legend: 'rain', coverage: 'sparse',
      blurb: 'Ten steps from light green to dark red. Light rain is a few drips, heavy rain is a downpour with thunder.',
      ticks: ['Light', 'Heavy'], labels: ['Thunder', 'Rain'], avg: 'Intensity',
      fmt: function (v) { return Math.round(v * 100) + '%'; },
      // Every step is rain. The heaviest steps (above 0.6) also add a low rumble.
      levels: function (v, o) { o[0] = cl((v - 0.6) / 0.4); o[1] = v; },
      voice: { scale: 'minor', chime: 'drip', base: 57, dropGain: 1, pad: 'sawtooth', cutoff: [90, 350], detune: [2, 6], tempo: [66, 120], tempoFrom: 'rain', reverb: 0.45, hiss: 0.07 }
    },
    snow: {
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
  EJ.map = function () { return EJ.MAPS[EJ.dataType]; }; // the map type selected right now
})();
