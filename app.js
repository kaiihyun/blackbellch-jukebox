// app.js — everything except the track list (presets.js).
// Order inside this file: 1 legends, 2 maps, 3 legend reading, 4 analysis + sweep, 5 audio, 6 spectrum, 7 page.
window.EJ = window.EJ || {};
(function () {
  'use strict';
  var C = 64, R = 14, VW = 640, VH = 320;           // 64 columns × 14 rows; each ROW is one note
  function cl(v) { return v < 0 ? 0 : v > 1 ? 1 : v; }
  function $(id) { return document.getElementById(id); }
  EJ.dataType = 'temp';

  // ================= 1. Legends: [value, r, g, b] per colour =================
  // temp = NASA T2M near-surface temperature, -40 to 40 °C, a smooth gradient (grey stays "no data").
  EJ.LEGENDS = { temp: { lo: -40, hi: 40, discrete: false, colors: [
    [-40,40,46,89],[-38,66,72,127],[-36,101,113,171],[-34,129,147,197],[-32,146,169,210],[-30,176,202,228],[-28,200,222,235],
    [-26,223,230,237],[-24,225,212,226],[-22,194,148,188],[-20,183,111,171],[-18,147,56,138],[-16,116,37,129],[-14,88,32,132],
    [-12,63,29,133],[-10,44,43,145],[-8,12,32,164],[-6,11,48,212],[-4,32,73,230],[-2,62,119,232],[0,105,179,234],[2,129,221,229],
    [4,143,236,205],[6,158,236,167],[8,185,236,120],[10,211,237,93],[12,233,230,74],[14,227,194,62],[16,221,159,53],[18,215,119,43],
    [20,209,80,41],[22,201,56,29],[24,167,43,21],[26,135,33,15],[28,103,22,9],[30,81,16,6],[32,68,12,4],[34,56,9,3],[36,51,7,2],
    [38,49,6,1],[40,49,6,1] ] } };

  // Value → [r,g,b]. Smooth legends blend neighbours; stepped ones return the step colour.
  EJ.legendColor = function (name, v) {
    var L = EJ.LEGENDS[name], c = L.colors, n = c.length, u = cl((v - L.lo) / (L.hi - L.lo)), a, b, f, i;
    if (L.discrete) { a = c[Math.min(n - 1, Math.floor(u * n))]; return [a[1], a[2], a[3]]; }
    f = u * (n - 1); i = Math.min(n - 2, Math.floor(f)); f -= i; a = c[i]; b = c[i + 1];
    return [a[1] + (b[1] - a[1]) * f, a[2] + (b[2] - a[2]) * f, a[3] + (b[3] - a[3]) * f];
  };
  // Colour → value of the closest legend colour, or null when nothing is close (borders, labels, grey bars: silent).
  EJ.legendMatch = function (name, r, g, b) {
    var L = EJ.LEGENDS[name], c = L.colors, best = 1e9, bi = 0, i, dr, dg, db, d, t = L.tol || 50;
    for (i = 0; i < c.length; i++) { dr = r - c[i][1]; dg = g - c[i][2]; db = b - c[i][3]; d = dr * dr + dg * dg + db * db; if (d < best) { best = d; bi = i; } }
    return best > t * t ? null : c[bi][0];
  };
  // CSS gradient of a legend (menu preview and the strip in the player).
  EJ.legendCss = function (name) {
    var L = EJ.LEGENDS[name], c = L.colors, n = c.length, s = [];
    function rgb(e) { return 'rgb(' + e[1] + ',' + e[2] + ',' + e[3] + ')'; }
    c.forEach(function (e, i) {
      if (L.discrete) s.push(rgb(e) + ' ' + (i / n * 100) + '%', rgb(e) + ' ' + ((i + 1) / n * 100) + '%');
      else s.push(rgb(e) + ' ' + (i / (n - 1) * 100) + '%');
    });
    return 'linear-gradient(to right,' + s.join(',') + ')';
  };

  // ================= 2. Maps: what a legend value sounds like =================
  // levels(v, o) turns a legend value into o[0] = pad amount (heat, hum) and o[1] = drops amount (cold, ticks), both 0..1.
  var HOT_SOUND = { scale: 'minor', chime: 'ice', base: 69, dropGain: 1, pad: 'sawtooth', cutoff: [200, 2800], detune: [4, 30], tempo: [64, 128], tempoFrom: 'heat', reverb: 0.45, hiss: 0.05 };
  EJ.MAPS = { temp: {
    graph: [22, 0, 8, 14], name: 'Land temperature', legend: 'temp', coverage: 'full',
    blurb: 'NASA T2M near-surface temperature, −40 to 40 °C. Heat builds a buzzing tone, cold rings as ice chimes.',
    ticks: ['−40', '−20', '0', '20', '40 °C'], labels: ['Warm', 'Cold'], avg: 'Average',
    fmt: function (v) { return Math.round(v) + ' °C'; },
    levels: function (v, o) { o[0] = Math.sqrt(cl((v - 5) / 35)); o[1] = Math.sqrt(cl((5 - v) / 45)); }, // silent at 5 °C
    voice: HOT_SOUND } };
  EJ.map = function () { return EJ.MAPS[EJ.dataType]; };

  // Colours for the spectrum bars and the readout, taken from the open map's legend and nudged to stay readable on glass.
  var DEFAULT_G = { pad: 'rgb(255,106,69)', drops: 'rgb(74,168,255)', noise: 'rgb(110,190,160)', drone: 'rgb(169,155,255)' };
  EJ.gcol = {}; for (var k0 in DEFAULT_G) EJ.gcol[k0] = DEFAULT_G[k0];
  function fit(c) {
    var l = 0.299 * c[0] + 0.587 * c[1] + 0.114 * c[2], i; c = c.slice();
    if (l < 110) { var t = (110 - l) / (255 - l); for (i = 0; i < 3; i++) c[i] += (255 - c[i]) * t; }
    else if (l > 190) { var s = 1 - (l - 190) / l; for (i = 0; i < 3; i++) c[i] *= s; }
    return 'rgb(' + Math.round(c[0]) + ',' + Math.round(c[1]) + ',' + Math.round(c[2]) + ')';
  }
  function updateGraphColors() {
    var m = EJ.map(), L = EJ.LEGENDS[m.legend], root = document.documentElement.style;
    var vals = m.graph || [0.8, 0.2, 0.45, 0.65].map(function (u) { return L.lo + u * (L.hi - L.lo); });
    ['pad', 'drops', 'noise', 'drone'].forEach(function (k, i) { EJ.gcol[k] = fit(EJ.legendColor(m.legend, vals[i])); });
    root.setProperty('--hot', EJ.gcol.pad); root.setProperty('--wet', EJ.gcol.drops);
  }

  // ================= 3. Reading a legend picture (presets and uploads) =================
  var SUP = { '-': '⁻', 0: '⁰', 1: '¹', 2: '²', 3: '³', 4: '⁴', 5: '⁵', 6: '⁶', 7: '⁷', 8: '⁸', 9: '⁹' };
  function curve(x, c) { x = cl(x); return c === 'sqrt' ? Math.sqrt(x) : c === 'square' ? x * x : c === 'pow1.5' ? Math.pow(x, 1.5) : x; }
  function num(x) { var a = Math.abs(x); return a >= 100 ? String(Math.round(x)) : a >= 1 ? x.toFixed(1) : x.toPrecision(2); }
  function cf(d, i) { // colourfulness of one pixel: 0 for white, grey or transparent
    if (d[i + 3] < 200) return 0;
    var mx = Math.max(d[i], d[i + 1], d[i + 2]), mn = Math.min(d[i], d[i + 1], d[i + 2]);
    return mx ? (mx - mn) / mx * mx / 255 : 0;
  }
  function ticks(L, log10, units) {
    var t = [], k, v;
    for (k = 0; k < 5; k++) {
      v = L.lo + (L.hi - L.lo) * k / 4;
      t.push(log10 ? (Math.abs(v - Math.round(v)) < 1e-6 ? '10' + String(Math.round(v)).split('').map(function (c) { return SUP[c]; }).join('') : '10^' + v.toFixed(1)) : String(Math.round(v * 100) / 100));
    }
    if (units) t[4] += ' ' + units;
    return t;
  }
  // Picture of a colour bar → legend. The most colourful band of rows is the bar; its colourful stretch is sampled,
  // as a smooth gradient or as distinct steps (guessed from how often the colour jumps).
  function readLegend(img, o) {
    var W = img.naturalWidth, H = img.naturalHeight, cv = document.createElement('canvas'), x, y, k;
    cv.width = W; cv.height = H;
    var cx = cv.getContext('2d', { willReadFrequently: true }); cx.drawImage(img, 0, 0);
    var d = cx.getImageData(0, 0, W, H).data, bar = o.bar || {}, row = bar.row, x0 = bar.x0, x1 = bar.x1;
    if (row == null) {
      var sc = [], mxs = 0, runS = -1, runL = 0, bs = 0, bl = 0;
      for (y = 0; y < H; y++) { var s = 0; for (x = 0; x < W; x += 2) s += cf(d, (y * W + x) * 4); sc.push(s); mxs = Math.max(mxs, s); }
      if (mxs < 4) throw new Error('no colour bar found in ' + (o.image || 'the image'));
      for (y = 0; y <= H; y++) {
        if (y < H && sc[y] >= 0.8 * mxs) { if (!runL) runS = y; runL++; }
        else { if (runL > bl) { bl = runL; bs = runS; } runL = 0; }
      }
      row = bs + Math.floor(bl / 2);
    }
    if (x0 == null || x1 == null) {
      x0 = 0; x1 = W - 1;
      while (x0 < W && cf(d, (row * W + x0) * 4) < 0.1) x0++;
      while (x1 > x0 && cf(d, (row * W + x1) * 4) < 0.1) x1--;
      if (x1 - x0 < 10) throw new Error('could not find a colour bar in ' + (o.image || 'the image') + ' (set legend.bar)');
    }
    function px(xx) { var i = (row * W + Math.round(xx)) * 4; return [d[i], d[i + 1], d[i + 2]]; }
    var s160 = [], jumps = 0, flat = 0, df;
    for (k = 0; k < 160; k++) s160.push(px(x0 + (x1 - x0) * k / 159));
    for (k = 1; k < 160; k++) {
      df = Math.abs(s160[k][0] - s160[k - 1][0]) + Math.abs(s160[k][1] - s160[k - 1][1]) + Math.abs(s160[k][2] - s160[k - 1][2]);
      if (df > 40) jumps++; if (df <= 6) flat++;
    }
    var type = o.type || 'auto', steps = type === 'auto' ? (jumps > 0 && jumps <= 14 && flat / 159 >= 0.7) : type === 'steps';
    var lo = o.lo == null ? 0 : o.lo, hi = o.hi == null ? 1 : o.hi, colors = [], n, p, u;
    if (steps) n = Math.max(2, jumps + 1); else n = o.samples || 41;
    for (k = 0; k < n; k++) {
      u = steps ? (k + 0.5) / n : k / (n - 1); p = px(x0 + (x1 - x0) * u);
      colors.push([lo + (hi - lo) * u, p[0], p[1], p[2], u]); // u (0..1) is kept so the range can be changed later
    }
    return { lo: lo, hi: hi, discrete: steps, tol: o.tol || 50, colors: colors };
  }
  // A legend becomes a normal map type. lo/hi are read at call time, so a custom legend can be re-ranged.
  function registerMap(p, L) {
    var pd = p.pad || [0.5, 1, 'sqrt'], dr = p.drops || [0.5, 0, 'sqrt'], lg = p.legend || {};
    EJ.LEGENDS[p.map] = L;
    EJ.MAPS[p.map] = {
      name: p.mapName || p.name, legend: p.map, coverage: p.coverage || (L.discrete ? 'sparse' : 'full'), blurb: p.blurb || '',
      ticks: p.ticks || ticks(L, lg.log10, lg.units), labels: p.labels || ['High', 'Low'], avg: 'Average', graph: p.graph,
      fmt: function (v) { return num(lg.log10 ? Math.pow(10, v) : v) + (lg.units ? ' ' + lg.units : ''); },
      levels: function (v, o) { var u = (v - L.lo) / (L.hi - L.lo); o[0] = curve((u - pd[0]) / (pd[1] - pd[0]), pd[2]); o[1] = curve((u - dr[0]) / (dr[1] - dr[0]), dr[2]); },
      voice: Object.assign({}, EJ.MAPS[p.like || 'temp'].voice, p.voice)
    };
  }

  // ================= 4. Analysis: pixels → numbers, and the sweep =================
  EJ.HH = new Float32Array(C * R);  // pad amount per cell
  EJ.WW = new Float32Array(C * R);  // drops amount per cell
  EJ.rowHeat = new Float32Array(R); // pad amount per ROW under the sweep line
  EJ.rowRain = new Float32Array(R); // drops amount per ROW under the sweep line
  EJ.meanHeat = 0; EJ.meanRain = 0; EJ.meanValue = null; EJ.tempo = 0;

  function analyzeGrid(d) {
    var m = EJ.map(), o = [0, 0], sh = 0, sw = 0, sv = 0, valid = 0, i, v;
    for (i = 0; i < C * R; i++) {
      v = EJ.legendMatch(m.legend, d[i * 4], d[i * 4 + 1], d[i * 4 + 2]);
      if (v === null) { o[0] = 0; o[1] = 0; } else { m.levels(v, o); sv += v; valid++; }
      EJ.HH[i] = o[0]; EJ.WW[i] = o[1]; sh += o[0]; sw += o[1];
    }
    // 'full' maps colour every cell: average over matched cells. 'sparse' maps are mostly empty: average over all cells, ×3.
    var div = m.coverage === 'full' ? Math.max(1, valid) : C * R, mul = m.coverage === 'full' ? 1.5 : 3;
    EJ.meanHeat = Math.min(1, sh / div * mul); EJ.meanRain = Math.min(1, sw / div * mul);
    EJ.meanValue = valid ? sv / valid : null;
  }
  // Sweep: one pass takes `dur` seconds, then loops. The 3 columns under the line are averaged per row.
  var t0 = 0;
  function sweepPos(ts, playing) { return playing ? (((ts - t0) / 1000 / (46 - parseFloat($('speed').value))) % 1) : 0; }
  function sweepLevels(col) {
    for (var r = 0; r < R; r++) {
      var a = 0, b = 0, n = 0;
      for (var c = Math.max(0, col - 1); c <= Math.min(C - 1, col + 1); c++) { a += EJ.HH[r * C + c]; b += EJ.WW[r * C + c]; n++; }
      EJ.rowHeat[r] = a / n; EJ.rowRain[r] = b / n;
    }
  }
  function sweepPan(pos) { return pos * 1.6 - 0.8; }

  // Plain-language description of the frame, for screen readers: names where each amount is strongest in a 3 × 3 split.
  var NS = ['north', 'middle', 'south'], WE = ['west', 'centre', 'east'];
  function where(G) {
    var best = 0, bi = -1, s = new Float32Array(9), r, c, i;
    for (r = 0; r < R; r++) for (c = 0; c < C; c++) s[Math.min(2, r * 3 / R | 0) * 3 + Math.min(2, c * 3 / C | 0)] += G[r * C + c];
    for (i = 0; i < 9; i++) if (s[i] > best) { best = s[i]; bi = i; }
    if (bi < 0 || best < 2) return '';
    var ns = bi / 3 | 0, we = bi % 3;
    if (ns === 1 && we === 1) return 'in the middle of the frame';
    return 'strongest in the ' + (ns === 1 ? '' : NS[ns] + (we === 1 ? '' : '-')) + (we === 1 && ns !== 1 ? '' : WE[we] === 'centre' ? '' : WE[we]);
  }
  function level(x) { return x < 0.03 ? 'almost none' : x < 0.25 ? 'light' : x < 0.55 ? 'moderate' : 'strong'; }
  function describe() {
    var m = EJ.map(), h = EJ.meanHeat, w = EJ.meanRain, out = [m.name + '.'];
    out.push(m.labels[0] + ': ' + level(h) + ' (' + Math.round(h * 100) + '%)' + (h >= 0.03 ? ', ' + where(EJ.HH) : '') + '.');
    out.push(m.labels[1] + ': ' + level(w) + ' (' + Math.round(w * 100) + '%)' + (w >= 0.03 ? ', ' + where(EJ.WW) : '') + '.');
    if (EJ.meanValue !== null) out.push(m.avg + ': ' + m.fmt(EJ.meanValue) + '.');
    out.push('Tempo ' + Math.round(EJ.tempo) + ' beats per minute, in a ' + m.voice.scale + ' scale (' + (m.voice.scale === 'minor' ? 'darker' : 'brighter') + '). High notes are the north, low notes the south.');
    return out.join(' ');
  }

  // ================= 5. Audio (Web Audio API) =================
  // PAD: two detuned waves per row (louder, brighter, buzzier with heat). DROPS: drips or ice chimes (cold / ticks).
  // NOISE: filtered noise bed. DRONE: quiet A + E so calm areas are never silent.
  var ac = null, master, pan, revSend, lowpass, noiseGain, dropBus, taps = {}, voices = [], drones = [], nextTime = 0;
  var A = EJ.audio = { playing: false };
  var SCALES = { major: [0, 2, 4, 7, 9], minor: [0, 3, 5, 7, 10] };
  function noteFreq(i, base, scale) { return 440 * Math.pow(2, (base + Math.floor(i / 5) * 12 + SCALES[scale || 'major'][i % 5] - 69) / 12); }
  function tap(key) { // analyser for one layer; it only listens
    if (!taps[key]) {
      var an = ac.createAnalyser(); an.fftSize = 2048; an.smoothingTimeConstant = 0.75; an.minDecibels = -90; an.maxDecibels = -20;
      taps[key] = { an: an, buf: new Uint8Array(an.frequencyBinCount) };
    }
    return taps[key].an;
  }
  function build() {
    ac = new (window.AudioContext || window.webkitAudioContext)();
    master = ac.createGain(); master.gain.value = 0.7;
    pan = ac.createStereoPanner();
    var comp = ac.createDynamicsCompressor();
    master.connect(pan); pan.connect(comp); comp.connect(ac.destination);
    var sr = ac.sampleRate, len = Math.floor(sr * 2.4), ib = ac.createBuffer(2, len, sr), c, i;
    for (c = 0; c < 2; c++) { var data = ib.getChannelData(c); for (i = 0; i < len; i++) data[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 2.6); }
    var reverb = ac.createConvolver(); reverb.buffer = ib;
    revSend = ac.createGain(); revSend.gain.value = 0.45; revSend.connect(reverb); reverb.connect(master);
    lowpass = ac.createBiquadFilter(); lowpass.type = 'lowpass'; lowpass.Q.value = 2; lowpass.frequency.value = 300;
    var padVerb = ac.createGain(); padVerb.gain.value = 0.25;
    lowpass.connect(master); lowpass.connect(padVerb); padVerb.connect(revSend); lowpass.connect(tap('pad'));
    dropBus = ac.createGain(); dropBus.connect(master); dropBus.connect(revSend); dropBus.connect(tap('drops'));
    for (var r = 0; r < R; r++) {
      var g = ac.createGain(); g.gain.value = 0; g.connect(lowpass);
      var a = ac.createOscillator(), b = ac.createOscillator(), f = noteFreq(r, 33);
      a.type = b.type = 'sawtooth'; a.frequency.value = b.frequency.value = f;
      a.connect(g); b.connect(g); a.start(); b.start();
      voices.push({ g: g, b: b, a: a });
    }
    [55, 82.41].forEach(function (f) {
      var o = ac.createOscillator(), g = ac.createGain();
      o.frequency.value = f; g.gain.value = 0; o.connect(g); g.connect(master); g.connect(tap('drone')); o.start(); drones.push(g);
    });
    var nb = ac.createBuffer(1, sr * 2, sr), nd = nb.getChannelData(0);
    for (var k = 0; k < nd.length; k++) nd[k] = Math.random() * 2 - 1;
    var ns = ac.createBufferSource(); ns.buffer = nb; ns.loop = true;
    var bp = ac.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = 3500; bp.Q.value = 0.6;
    noiseGain = ac.createGain(); noiseGain.gain.value = 0;
    ns.connect(bp); bp.connect(noiseGain); noiseGain.connect(master); noiseGain.connect(tap('noise')); ns.start();
    applyVoice();
  }
  // Wave type, scale and reverb follow the open map.
  function applyVoice() {
    if (!ac) return;
    var v = EJ.map().voice;
    voices.forEach(function (voice, r) {
      voice.a.type = voice.b.type = v.pad;
      var f = noteFreq(r, 33, v.scale);
      voice.a.frequency.setTargetAtTime(f, ac.currentTime, 0.05); voice.b.frequency.setTargetAtTime(f, ac.currentTime, 0.05);
    });
    revSend.gain.setTargetAtTime(v.reverb, ac.currentTime, 0.3);
  }
  A.applyVoice = applyVoice;
  function drop(i, when, vel) { // one drip (falls from a higher pitch) or ice chime (steady pitch plus a glassy overtone)
    var v = EJ.map().voice, ice = v.chime === 'ice', o = ac.createOscillator(), g = ac.createGain(), f = noteFreq(i, v.base, v.scale);
    o.type = 'sine';
    o.frequency.setValueAtTime(ice ? f : f * 1.35, when); o.frequency.exponentialRampToValueAtTime(f, when + 0.07);
    g.gain.setValueAtTime(0, when);
    g.gain.linearRampToValueAtTime((0.03 + 0.14 * vel) * v.dropGain, when + 0.005);
    g.gain.exponentialRampToValueAtTime(0.0008, when + 1.4);
    o.connect(g); g.connect(dropBus); o.start(when); o.stop(when + 1.5);
    if (ice) {
      var o2 = ac.createOscillator(), g2 = ac.createGain();
      o2.type = 'sine'; o2.frequency.value = f * 2.76;
      g2.gain.setValueAtTime(0, when);
      g2.gain.linearRampToValueAtTime((0.012 + 0.05 * vel) * v.dropGain, when + 0.003);
      g2.gain.exponentialRampToValueAtTime(0.0005, when + 0.7);
      o2.connect(g2); g2.connect(dropBus); o2.start(when); o2.stop(when + 0.8);
    }
  }
  setInterval(function () { // every 30 ms: schedule drops slightly ahead, one eighth note per step at EJ.tempo
    if (!A.playing || !ac) return;
    var step = 60 / EJ.tempo / 2;
    while (nextTime < ac.currentTime + 0.15) {
      var n = 0;
      for (var r = 0; r < R && n < 4; r++) {
        var amt = EJ.rowRain[r];
        if (amt > 0 && Math.random() < amt * 0.45) { drop(R - 1 - r, nextTime + Math.random() * 0.03, amt); n++; }
      }
      nextTime += step;
    }
  }, 30);
  A.start = function (volume) {
    if (!ac) build();
    if (ac.state === 'suspended') ac.resume();
    applyVoice(); master.gain.value = volume; nextTime = ac.currentTime + 0.05; A.playing = true;
  };
  A.stop = function () {
    A.playing = false;
    if (!ac) return;
    var now = ac.currentTime;
    for (var i = 0; i < R; i++) voices[i].g.gain.setTargetAtTime(0, now, 0.06);
    noiseGain.gain.setTargetAtTime(0, now, 0.1);
    drones.forEach(function (g) { g.gain.setTargetAtTime(0, now, 0.2); });
  };
  A.setVolume = function (v) { if (master) master.gain.value = v; };
  A.spectrum = function (key, out) { // 0..1 levels, low to high pitch on a log scale
    var t = taps[key], n = out.length, i;
    if (!t || !A.playing) { for (i = 0; i < n; i++) out[i] = 0; return; }
    t.an.getByteFrequencyData(t.buf);
    var lo = 40, hi = 8000, bw = ac.sampleRate / t.an.fftSize;
    for (i = 0; i < n; i++) {
      var b0 = Math.floor(lo * Math.pow(hi / lo, i / n) / bw), b1 = Math.max(b0 + 1, Math.ceil(lo * Math.pow(hi / lo, (i + 1) / n) / bw)), m = 0;
      for (var b = b0; b < b1; b++) if (t.buf[b] > m) m = t.buf[b];
      out[i] = m / 255;
    }
  };
  A.update = function (pos) { // every frame while playing; setTargetAtTime glides, so nothing clicks
    var v = EJ.map().voice, now = ac.currentTime;
    for (var r = 0; r < R; r++) {
      var voice = voices[R - 1 - r]; // top row → highest voice
      voice.g.gain.setTargetAtTime(EJ.rowHeat[r] * 0.05, now, 0.06);
      voice.b.detune.setTargetAtTime(v.detune[0] + EJ.meanHeat * (v.detune[1] - v.detune[0]), now, 0.1);
    }
    lowpass.frequency.setTargetAtTime(v.cutoff[0] + EJ.meanHeat * (v.cutoff[1] - v.cutoff[0]), now, 0.1);
    noiseGain.gain.setTargetAtTime(EJ.meanRain * v.hiss, now, 0.15);
    drones.forEach(function (g) { g.gain.setTargetAtTime(0.03, now, 0.2); });
    pan.pan.setTargetAtTime(sweepPan(pos), now, 0.05);
  };

  // ================= 6. Spectrum: one live bar per layer =================
  var SN = 32, specRows = [];
  [{ key: 'pad', name: 'Pad' }, { key: 'drops', name: 'Drops' }, { key: 'noise', name: 'Noise bed' }, { key: 'drone', name: 'Drone' }].forEach(function (L) {
    var row = document.createElement('div'); row.className = 'srow';
    var label = document.createElement('div'); label.className = 'slabel'; label.textContent = L.name;
    var cv = document.createElement('canvas'); cv.width = 256; cv.height = 24; cv.setAttribute('aria-hidden', 'true');
    row.appendChild(label); row.appendChild(cv); $('specRows').appendChild(row);
    specRows.push({ key: L.key, cv: cv, ctx: cv.getContext('2d'), data: new Float32Array(SN) });
  });
  function drawSpectrum(playing) {
    $('specHint').style.display = playing ? 'none' : '';
    specRows.forEach(function (r) {
      EJ.audio.spectrum(r.key, r.data);
      var w = r.cv.width, h = r.cv.height, bw = w / SN, c = r.ctx;
      c.clearRect(0, 0, w, h); c.fillStyle = EJ.gcol[r.key];
      for (var i = 0; i < SN; i++) { var bh = Math.max(2, r.data[i] * h); c.fillRect(i * bw + 1, h - bh, bw - 2, bh); }
    });
  }

  // ================= 7. The page: screens, playlist, player, main loop =================
  var body = document.body, about = $('about'), sets = $('settings'), lastF = null;
  var view = $('view'), vctx = view.getContext('2d'), small = $('pix');
  small.width = C; small.height = R;
  var sctx = small.getContext('2d', { willReadFrequently: true });
  vctx.imageSmoothingQuality = 'high';
  var src = null, objUrl = null, cur = 0, frameCount = 0, looping = false, customs = [], seq = 0, ranges = {};

  function tracks() { return (EJ.PRESETS || []).filter(function (p) { return EJ.MAPS[p.map]; }).concat(customs); }
  function say(t) { $('cap').textContent = t; }                                          // on-screen line, also announced (aria-live)
  function announce(t) { say(t); var s = $('sr'); s.textContent = ''; setTimeout(function () { s.textContent = t; }, 50); } // for screen readers
  function screenName() { return body.classList.contains('home') ? 'home' : body.classList.contains('playing') ? 'play' : 'menu'; }
  function screen(s) { body.classList.toggle('home', s === 'home'); body.classList.toggle('playing', s === 'play'); }

  function paint() {
    if (!src) {
      vctx.fillStyle = '#20242f'; vctx.fillRect(0, 0, VW, VH);
      vctx.fillStyle = '#9aa3bb'; vctx.font = '18px sans-serif'; vctx.textAlign = 'center';
      vctx.fillText('Load a picture or video to begin', VW / 2, VH / 2); return;
    }
    vctx.fillStyle = '#8c8c8c'; vctx.fillRect(0, 0, VW, VH); // grey bars are not on any legend, so they stay silent
    var el = src.el, iw = el.videoWidth || el.naturalWidth, ih = el.videoHeight || el.naturalHeight;
    if (!iw || !ih) return;
    var s = Math.min(VW / iw, VH / ih);
    vctx.drawImage(el, (VW - iw * s) / 2, (VH - ih * s) / 2, iw * s, ih * s);
  }
  function frame(ts) {
    paint();
    sctx.drawImage(view, 0, 0, C, R);
    analyzeGrid(sctx.getImageData(0, 0, C, R).data);
    var playing = EJ.audio.playing, pos = sweepPos(ts, playing);
    sweepLevels(Math.min(C - 1, Math.floor(pos * C)));
    var v = EJ.map().voice, drive = v.tempoFrom === 'rain' ? EJ.meanRain : EJ.meanHeat;
    EJ.tempo = v.tempo[0] + drive * (v.tempo[1] - v.tempo[0]);
    if (playing) EJ.audio.update(pos);
    $('ph').style.display = $('ph2').style.display = playing ? 'block' : 'none';
    if (playing) $('ph').style.left = $('ph2').style.left = (pos * 100) + '%';
    drawSpectrum(playing);
    if (++frameCount % 6 === 0) {
      var m = EJ.map();
      $('rh').textContent = Math.round(EJ.meanHeat * 100) + '%';
      $('rw').textContent = Math.round(EJ.meanRain * 100) + '%';
      $('rt').textContent = Math.round(EJ.tempo);
      $('ra').textContent = EJ.meanValue === null ? '–' : m.fmt(EJ.meanValue);
    }
    requestAnimationFrame(frame);
  }

  // ---------- Loading your own picture or video ----------
  function kindOf(f) {
    var t = f.type || '', n = f.name || '';
    if (t.indexOf('video') === 0 || /\.(mp4|m4v|mov|webm|ogv|3gp)$/i.test(n)) return 'video';
    if (t.indexOf('image') === 0 || /\.(png|jpe?g|gif|webp|bmp|avif|heic|heif)$/i.test(n)) return 'image';
    return null;
  }
  function loadFile(f) {
    if (!f) return;
    var kind = kindOf(f);
    if (!kind) { announce('That file is not an image or video. Try a PNG, JPG, MP4, MOV or WebM.'); return; }
    if (src && src.kind === 'video') src.el.pause();
    if (objUrl) URL.revokeObjectURL(objUrl);
    objUrl = URL.createObjectURL(f);
    say('Loading ' + f.name + '…');
    function use(k, el) { src = { kind: k, el: el, name: f.name }; announce('Source: ' + f.name + '. Colors are matched to the ' + EJ.map().name.toLowerCase() + ' legend.'); }
    if (kind === 'video') {
      var v = document.createElement('video'), shown = false;
      v.muted = true; v.loop = true; v.playsInline = true;
      v.setAttribute('playsinline', ''); v.setAttribute('muted', '');
      v.onerror = function () { announce('This browser could not play that video. Try an MP4 (H.264) or a still image.'); };
      v.onloadeddata = function () {
        if (shown) return; shown = true; use('video', v);
        var p = v.play(); if (p && p.catch) p.catch(function () { say('Tap the picture to start the video.'); });
      };
      v.src = objUrl; v.load();
    } else {
      var im = new Image();
      im.onload = function () { use('image', im); };
      im.onerror = function () { announce('Could not open that image. Try a JPG or PNG.'); };
      im.src = objUrl;
    }
  }
  $('pick').onclick = function () { $('file').click(); };
  $('cam').onclick = function () { $('camFile').click(); };
  $('file').onchange = function (e) { loadFile(e.target.files[0]); e.target.value = ''; };
  $('camFile').onchange = function (e) { loadFile(e.target.files[0]); e.target.value = ''; };
  var vb = $('viewBox');
  vb.addEventListener('click', function () { if (!src) $('file').click(); else if (src.kind === 'video' && src.el.paused) src.el.play(); });
  vb.addEventListener('dragover', function (e) { e.preventDefault(); vb.classList.add('drop'); });
  vb.addEventListener('dragleave', function () { vb.classList.remove('drop'); });
  vb.addEventListener('drop', function (e) { e.preventDefault(); vb.classList.remove('drop'); loadFile(e.dataTransfer.files[0]); });

  // ---------- Your own legend ----------
  $('legendPick').onclick = function () { $('legendFile').click(); };
  $('legendFile').onchange = function (e) {
    var f = e.target.files[0]; e.target.value = ''; if (!f) return;
    say('Reading ' + f.name + '…');
    var url = URL.createObjectURL(f), img = new Image();
    img.onload = function () {
      URL.revokeObjectURL(url);
      try {
        var L = readLegend(img, { image: f.name }), id = 'custom' + (++seq), name = f.name.replace(/\.[^.]+$/, '');
        registerMap({ id: id, map: id, mapName: 'Custom: ' + name, blurb: 'Your own legend, ' + L.colors.length + (L.discrete ? ' steps' : ' colors') + '. Above the middle value buzzes, below it chimes.',
          voice: { scale: 'major', reverb: 0.5, hiss: 0.04 } }, L);
        ranges[id] = function (lo, hi) {
          L.lo = lo; L.hi = hi; L.colors.forEach(function (c) { c[0] = lo + c[4] * (hi - lo); });
          EJ.MAPS[id].ticks = ticks(L, false, '');
        };
        customs.push({ id: id, map: id, name: 'Custom: ' + name, blurb: '' });
        $('legendMin').value = 0; $('legendMax').value = 1;
        startTrack(tracks().length - 1);
        announce('Read ' + L.colors.length + (L.discrete ? ' steps' : ' colors') + ' from ' + f.name + '. Set what its lowest and highest values mean.');
      } catch (err) { announce('Could not read that legend: ' + err.message); }
    };
    img.onerror = function () { announce('Could not open that image file.'); };
    img.src = url;
  };
  function applyRange() {
    var p = tracks()[cur], lo = parseFloat($('legendMin').value), hi = parseFloat($('legendMax').value);
    if (!p || !ranges[p.id] || isNaN(lo) || isNaN(hi) || hi <= lo) return;
    ranges[p.id](lo, hi); applyMap(p);
  }
  $('legendMin').onchange = $('legendMax').onchange = applyRange;

  // ---------- Map and track ----------
  function applyMap(p) {
    EJ.dataType = p.map;
    var m = EJ.map();
    $('appTitle').textContent = m.name;
    $('lh').textContent = m.labels[0]; $('lw').textContent = m.labels[1]; $('avgLabel').textContent = m.avg;
    $('legendBar').style.background = EJ.legendCss(m.legend);
    $('legendTicks').innerHTML = m.ticks.map(function (s) { return '<span>' + s + '</span>'; }).join('');
    $('legendRange').hidden = !ranges[p.id];
    updateGraphColors();
    EJ.audio.applyVoice();
  }
  function setSpeed(sec) { $('speed').value = 46 - sec; $('spO').textContent = sec + ' s'; t0 = performance.now(); }
  function startTrack(i) { // switch to track i: map, sweep time, and its video if it has one
    var T = tracks(); if (!T.length) return;
    cur = (i + T.length) % T.length;
    var p = T[cur]; applyMap(p); setSpeed(p.sweep || 24);
    if (!p.video) return;
    fetch(p.video).then(function (r) { if (!r.ok) throw new Error(r.status + ' ' + r.statusText); return r.blob(); })
      .then(function (b) { loadFile(new File([b], p.video.split('/').pop(), { type: b.type || 'video/mp4' })); t0 = performance.now(); })
      .catch(function (err) { announce('Could not load ' + p.video + ' (' + err.message + '). Serve this folder with: python3 -m http.server'); });
  }
  $('speed').oninput = function () { $('spO').textContent = (46 - parseFloat(this.value)) + ' s'; t0 = performance.now(); };
  $('vol').oninput = function () { EJ.audio.setVolume(parseFloat(this.value)); };
  function trackStep(d) { startTrack(cur + d); announce(tracks()[cur].name + '. Track ' + (cur + 1) + ' of ' + tracks().length + '.'); }
  $('tPrev').onclick = function () { trackStep(-1); };
  $('tNext').onclick = function () { trackStep(1); };

  function setPlaying(on) {
    var b = $('play');
    if (on) { t0 = performance.now(); EJ.audio.start(parseFloat($('vol').value)); }
    else EJ.audio.stop();
    b.textContent = on ? 'Stop' : 'Play'; b.setAttribute('aria-pressed', on ? 'true' : 'false');
  }
  $('play').onclick = function () { setPlaying(!EJ.audio.playing); };
  function describeNow() { var s = $('sr'); s.textContent = ''; setTimeout(function () { s.textContent = describe(); }, 50); }
  $('describe').onclick = describeNow;

  // ---------- Playlist screen ----------
  function renderMenu() {
    var T = tracks(), p = T[cur];
    $('prev').hidden = $('next').hidden = T.length < 2;
    $('start').disabled = !p;
    if (!p) { $('pTitle').textContent = 'Loading'; $('pDesc').textContent = ''; $('pIdx').textContent = ''; return; }
    var m = EJ.MAPS[p.map];
    $('pTitle').textContent = p.name;
    $('pBar').style.background = EJ.legendCss(m.legend);
    $('pTicks').innerHTML = m.ticks.map(function (s) { return '<span>' + s + '</span>'; }).join('');
    $('pDesc').textContent = p.blurb || m.blurb;
    $('pIdx').textContent = 'Track ' + (cur + 1) + ' of ' + T.length;
    $('pNote').textContent = EJ.presetErrors.length ? 'Some tracks did not load: ' + EJ.presetErrors.join('; ') : '';
  }
  function menuGo(d) {
    var n = tracks().length; if (!n) return;
    var top = $('top'); top.classList.add('swap');
    setTimeout(function () { cur = (cur + d + n) % n; renderMenu(); top.classList.remove('swap'); announce($('pTitle').textContent + '. ' + $('pIdx').textContent + '.'); }, 140);
  }
  function menuJump(i) { var n = tracks().length; if (i >= 0 && i < n && i !== cur) menuGo(i - cur); }
  $('prev').onclick = function () { menuGo(-1); };
  $('next').onclick = function () { menuGo(1); };
  ['prev', 'next'].forEach(function (id) { $(id).addEventListener('mousedown', function (e) { e.preventDefault(); }); });

  // ---------- Moving between screens ----------
  function leaveHome() { screen('menu'); $('start').focus(); announce($('pTitle').textContent + '. Press Enter to play. Use the left and right arrow keys to change track.'); }
  function goHome() { if (EJ.audio.playing) setPlaying(false); screen('home'); $('homeStart').focus(); announce('Earth Jukebox. NASA Earth data, played as sound. Press Enter to start.'); }
  function enterPlayer() { // the click or key press is the user gesture browsers need before audio can start
    if (!tracks().length) return;
    screen('play'); startTrack(cur);
    if (!EJ.audio.playing) setPlaying(true);
    if (!looping) { looping = true; requestAnimationFrame(frame); }
    $('play').focus(); announce('Playing ' + tracks()[cur].name + '. Press Space to stop, Escape to go back.');
  }
  function leavePlayer() { if (EJ.audio.playing) setPlaying(false); screen('menu'); renderMenu(); $('start').focus(); announce('Playlist. ' + $('pTitle').textContent + '.'); }
  $('homeStart').onclick = leaveHome;
  $('start').onclick = enterPlayer;
  $('exitMenu').onclick = goHome;
  $('back').onclick = leavePlayer;

  // ---------- About and Setting sheets ----------
  function openDlg(d) {
    var o = d === about ? sets : about;
    if (o.open) o.close();
    if (!d.open) { lastF = document.activeElement; d.showModal(); }
  }
  [about, sets].forEach(function (d) {
    d.addEventListener('close', function () { if (lastF && document.contains(lastF)) lastF.focus(); });
    d.addEventListener('click', function (e) { if (e.target === d) d.close(); }); // click the dimmed area to close
  });
  document.querySelectorAll('[data-close]').forEach(function (b) { b.addEventListener('click', function () { b.closest('dialog').close(); }); });
  $('aboutBtn').onclick = function () { openDlg(about); };
  $('helpBtn').onclick = function () { openDlg(sets); };

  // Text size: scales the whole page (all sizes are in rem) and is remembered
  var SIZES = [['Normal', 100], ['Large', 115], ['Extra large', 130], ['Largest', 150]], si = 0;
  var radios = [].slice.call(document.querySelectorAll('#sizes [role=radio]'));
  function applySize(i, quiet) {
    si = i; document.documentElement.style.setProperty('--fs', SIZES[i][1] + '%');
    radios.forEach(function (b, j) { b.setAttribute('aria-checked', j === i); b.tabIndex = j === i ? 0 : -1; });
    try { localStorage.setItem('ejSize', i); } catch (e) {}
    if (!quiet) announce('Text size: ' + SIZES[i][0] + '.');
  }
  radios.forEach(function (b, j) { b.onclick = function () { applySize(j); }; });
  function moveSize(d) { var j = (si + d + SIZES.length) % SIZES.length; applySize(j); radios[j].focus(); }
  try { applySize(Math.max(0, Math.min(3, +localStorage.getItem('ejSize') || 0)), true); } catch (e) { applySize(0, true); }

  // Keyboard shortcut pages (they match the keys wired below)
  function K() { return [].slice.call(arguments).map(function (k) { return '<kbd>' + k + '</kbd>'; }).join(' '); }
  var PAGES = [
    ['Playlist', [[K('&larr;', '&rarr;'), 'Previous or next track'], [K('1') + ' to ' + K('9'), 'Jump to a track'],
      [K('Enter') + ' or ' + K('Space'), 'Play the track'], [K('A'), 'About'], [K('?'), 'Setting and shortcuts'],
      [K('T'), 'Change text size'], [K('Esc'), 'Back one screen']]],
    ['Player', [[K('Space') + ' or ' + K('P'), 'Play or stop'], [K('S'), 'Stop the sound'], [K('R'), 'Restart the sweep from the west'],
      [K('&larr;', '&rarr;'), 'Previous or next track'], [K('1') + ' to ' + K('9'), 'Jump to a track'],
      [K('D'), 'Describe this moment'], [K('Esc'), 'Back to the playlist']]],
    ['Player, sound and media', [[K('[') + ' ' + K(']'), 'Slower or faster sweep'], [K('-') + ' ' + K('='), 'Volume down or up'],
      [K(',') + ' ' + K('.'), 'Video back or forward 5 seconds'], [K('O'), 'Load an image or video'], [K('L'), 'Upload a legend'],
      [K('T'), 'Change text size'], [K('?'), 'Open or close this list']]]
  ], kp = 0;
  function drawKeys() {
    var p = PAGES[kp], tb = $('kRows');
    $('kTitle').textContent = p[0]; tb.textContent = '';
    p[1].forEach(function (r) {
      var tr = document.createElement('tr'), a = document.createElement('td'), b = document.createElement('td');
      a.innerHTML = r[0]; b.textContent = r[1]; tr.appendChild(a); tr.appendChild(b); tb.appendChild(tr);
    });
    $('kPage').textContent = (kp + 1) + ' of ' + PAGES.length;
    $('kBack').disabled = kp === 0; $('kNext').disabled = kp === PAGES.length - 1;
  }
  $('kBack').onclick = function () { if (kp > 0) { kp--; drawKeys(); } };
  $('kNext').onclick = function () { if (kp < PAGES.length - 1) { kp++; drawKeys(); } };
  drawKeys();

  // ---------- Keyboard ----------
  function nudgeSpeed(d) { // d > 0 = faster = shorter sweep. The slider holds 46 minus the sweep time.
    var s = $('speed'), v = Math.max(+s.min, Math.min(+s.max, +s.value + d));
    if (v === +s.value) { announce(d > 0 ? 'Already at the fastest sweep.' : 'Already at the slowest sweep.'); return; }
    s.value = v; s.dispatchEvent(new Event('input')); announce('Sweep time ' + (46 - v) + ' seconds per pass.');
  }
  function nudgeVolume(d) {
    var v = $('vol'); v.value = Math.max(0, Math.min(1, +v.value + d)); v.dispatchEvent(new Event('input'));
    announce('Volume ' + Math.round(v.value * 100) + ' percent.');
  }
  function seek(d) {
    if (!src || src.kind !== 'video') { announce('No video loaded.'); return; }
    var el = src.el, t = Math.max(0, el.currentTime + d); if (el.duration) t = Math.min(el.duration, t);
    el.currentTime = t; announce('Video at ' + Math.round(t) + ' seconds.');
  }
  document.addEventListener('keydown', function (e) {
    var k = e.key, tg = e.target, tag = tg.tagName;
    if (about.open || sets.open) { // a sheet owns the keyboard while it is open (Esc closes it natively)
      if (k === '?') { e.preventDefault(); (about.open ? about : sets).close(); }
      else if (sets.open && (k === 'ArrowLeft' || k === 'ArrowRight') && tg.getAttribute('role') === 'radio') { e.preventDefault(); moveSize(k === 'ArrowRight' ? 1 : -1); }
      return;
    }
    if (e.ctrlKey || e.metaKey || e.altKey) return;
    var isRange = tag === 'INPUT' && tg.type === 'range';
    if (tag === 'SELECT' || tag === 'TEXTAREA' || (tag === 'INPUT' && !isRange && tg.type !== 'file')) return; // typing
    var lk = k.toLowerCase(), scr = screenName(), onBtn = tag === 'BUTTON' || tag === 'A';
    if (k === '?') { e.preventDefault(); openDlg(sets); return; }
    if (lk === 'a') { e.preventDefault(); openDlg(about); return; }
    if (lk === 't') { applySize((si + 1) % SIZES.length); return; }

    if (scr === 'home') { // landing: only Start is live
      if ((k === 'Enter' || k === ' ') && !onBtn) { e.preventDefault(); leaveHome(); }
      return;
    }
    var n = parseInt(k, 10);
    if (scr === 'menu') {
      if (k === 'Escape') goHome();
      else if (k === 'ArrowLeft') { e.preventDefault(); menuGo(-1); }
      else if (k === 'ArrowRight') { e.preventDefault(); menuGo(1); }
      else if (n >= 1 && n <= 9) menuJump(n - 1);
      else if ((k === 'Enter' || k === ' ') && !onBtn) { e.preventDefault(); enterPlayer(); }
      return;
    }
    // player
    if (k === 'Escape') { leavePlayer(); return; }
    if (isRange && /^(Arrow|Home$|End$|Page)/.test(k)) return; // sliders keep their own arrow keys
    if (k === 'ArrowLeft') { e.preventDefault(); trackStep(-1); }
    else if (k === 'ArrowRight') { e.preventDefault(); trackStep(1); }
    else if (n >= 1 && n <= 9) { if (n - 1 < tracks().length && n - 1 !== cur) { startTrack(n - 1); announce(tracks()[cur].name + '. Track ' + (cur + 1) + ' of ' + tracks().length + '.'); } }
    else if (lk === 'p' || (k === ' ' && !onBtn)) { e.preventDefault(); $('play').click(); announce(EJ.audio.playing ? 'Playing.' : 'Stopped.'); }
    else if (lk === 's') { if (EJ.audio.playing) { $('play').click(); announce('Stopped.'); } else announce('Already silent.'); }
    else if (lk === 'r') { t0 = performance.now(); announce('Back at the west edge.'); }
    else if (lk === 'd') describeNow();
    else if (k === '[') nudgeSpeed(-2);
    else if (k === ']') nudgeSpeed(2);
    else if (k === '-') nudgeVolume(-0.1);
    else if (k === '=' || k === '+') nudgeVolume(0.1);
    else if (k === ',') seek(-5);
    else if (k === '.') seek(5);
    else if (lk === 'o') { e.preventDefault(); $('pick').click(); }
    else if (lk === 'l') { e.preventDefault(); $('legendPick').click(); }
  });

  // ---------- Legend pictures of presets are read first, then the playlist is complete ----------
  EJ.presetErrors = [];
  (EJ.PRESETS || []).forEach(function (p) {
    if (!p.legend) { p.map = p.map || p.id; return; }
    p.map = p.id;
    var img = new Image();
    img.onload = function () {
      try { registerMap(p, readLegend(img, p.legend)); } catch (e) { EJ.presetErrors.push(p.id + ': ' + e.message); console.error(p.id, e); }
      renderMenu();
    };
    img.onerror = function () { EJ.presetErrors.push(p.id + ': could not load ' + p.legend.image); renderMenu(); };
    img.src = p.legend.image;
  });
  renderMenu();
  $('homeStart').focus();
  announce('Earth Jukebox. NASA Earth data, played as sound. Press Enter to start.');
})();
