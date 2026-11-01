/* ============================================================
   EARTH JUKEBOX: app.js
   Regions: 1 state, 2 helpers, 3 legends, 4 video loading,
   5 frame analysis, 6 audio, 7 description (screen reader text),
   8 drawing, 9 playback, 10 page controls

   HOW IT SOUNDS: every video frame is played as a sweep from west
   (left ear) to east (right ear). Pitch = latitude (high = north).
   Loudness = intensity. Plucked = rain, bell = snow.
   ============================================================ */
(function () {
"use strict";
var C = window.CONFIG, A = C.analysis;
var $ = function (id) { return document.getElementById(id); };

/* Settings with safe defaults, so an older config.js still works */
var SWEEP_MS = C.sweepMs || 4000;            // time to sweep one frame, west to east
var MAX_PER_COL = C.maxNotesPerColumn || 2;  // keep it sparse so it stays readable
var LOW_MIDI = C.lowMidi || 48;              // note for the southernmost row
var OCTAVES = C.octaves || 3;
var ANNOUNCE = C.announceEveryBeats || 4;
var LI = C.listen || {};
var PAN = LI.panWidth != null ? LI.panWidth : 0.9;
var LOUD = LI.loudness || [0.1, 0.45];
var REVERB = LI.reverb != null ? LI.reverb : 0.12;

/* ===== REGION 1: STATE ===== */
var S = {
  video: $("video"), legends: [],
  crop: { x: 0, y: 0, w: 1, h: 1 },
  ac: null, ax: null, aw: 0, ah: 0,
  ctx: null, master: null, bus: null,
  timer: null, beat: 0, tiles: null, loaded: false,
  sweepTimers: [], wetMin: A.wetMin, active: null, mode: String(LI.mode || "cycle"), invert: !!LI.invertPitch
};

/* ===== REGION 2: HELPERS ===== */
function say(t) { $("live").textContent = t; }
function proxied(url) { return C.proxyPath + encodeURIComponent(url); }
function midiToHz(m) { return 440 * Math.pow(2, (m - 69) / 12); }
function dist2(r, g, b, c) { var x = r - c[0], y = g - c[1], z = b - c[2]; return x * x + y * y + z * z; }
function lonText(col) {
  var lon = -180 + (col + 0.5) / C.grid.cols * 360;   // assumes the crop is the whole flat world map
  return Math.round(Math.abs(lon)) + " degrees " + (lon < 0 ? "west" : "east");
}

/* ===== REGION 3: LEGENDS (color bar image -> list of color/value pairs) ===== */
function loadImage(url, viaProxy) {
  return new Promise(function (ok, no) {
    var im = new Image();
    im.crossOrigin = "anonymous";
    im.onload = function () { ok(im); };
    im.onerror = function () { no(new Error("Legend image failed: " + url)); };
    im.src = viaProxy ? proxied(url) : url;
  });
}
async function decodeLegend(spec) {
  var im;
  try { im = await loadImage(spec.url, false); } catch (e) { im = await loadImage(spec.url, true); }
  var cr = spec.crop || { x: 0, y: 0, w: 1, h: 1 };
  var w = Math.max(1, Math.round(cr.w * im.naturalWidth)), h = Math.max(1, Math.round(cr.h * im.naturalHeight));
  var cv = document.createElement("canvas"); cv.width = w; cv.height = h;
  var cx = cv.getContext("2d", { willReadFrequently: true });
  cx.drawImage(im, cr.x * im.naturalWidth, cr.y * im.naturalHeight, w, h, 0, 0, w, h);
  var d = cx.getImageData(0, 0, w, h).data;
  var vertical = spec.orientation.indexOf("vertical") === 0;
  var flip = /lowright|lowtop/.test(spec.orientation);
  var entries = [], N = 128;
  for (var i = 0; i < N; i++) {
    var t = i / (N - 1);
    var x, y;
    if (vertical) { x = Math.floor(w / 2); y = Math.round((flip ? t : 1 - t) * (h - 1)); }
    else { y = Math.floor(h / 2); x = Math.round((flip ? 1 - t : t) * (w - 1)); }
    var p = (y * w + x) * 4;
    if (d[p + 3] < 200) continue;
    var value = spec.scale === "log" ? spec.min * Math.pow(spec.max / spec.min, t) : spec.min + (spec.max - spec.min) * t;
    entries.push({ r: d[p], g: d[p + 1], b: d[p + 2], t: t, value: value });
  }
  if (!entries.length) throw new Error("No color found in legend: " + spec.label);
  return { spec: spec, entries: entries };
}
function showLegends() {
  var box = $("legendView"); box.innerHTML = "";
  S.legends.forEach(function (L) {
    var p = document.createElement("p");
    p.textContent = L.spec.label + " (" + L.spec.type + "): " + L.spec.min + " to " + L.spec.max + ", " + L.spec.scale + " scale.";
    var cv = document.createElement("canvas"); cv.className = "strip"; cv.width = 512; cv.height = 24;
    cv.setAttribute("role", "img"); cv.setAttribute("aria-label", "Decoded color bar for " + L.spec.label);
    var g = cv.getContext("2d");
    L.entries.forEach(function (e) { g.fillStyle = "rgb(" + e.r + "," + e.g + "," + e.b + ")"; g.fillRect(e.t * 508, 0, 6, 24); });
    box.appendChild(p); box.appendChild(cv);
  });
}

/* ===== REGION 4: VIDEO LOADING ===== */
function tryVideo(src, cors) {
  return new Promise(function (ok, no) {
    var v = S.video;
    function clean() { v.removeEventListener("loadeddata", good); v.removeEventListener("error", bad); }
    function good() { clean(); ok(); }
    function bad() { clean(); no(new Error("video failed")); }
    v.addEventListener("loadeddata", good); v.addEventListener("error", bad);
    if (cors) v.crossOrigin = "anonymous"; else v.removeAttribute("crossorigin");
    v.src = src; v.load();
  });
}
function probe() {
  var c = document.createElement("canvas"); c.width = c.height = 1;
  var x = c.getContext("2d"); x.drawImage(S.video, 0, 0, 1, 1); x.getImageData(0, 0, 1, 1);
}
async function loadVideo(url, isLocal) {
  if (isLocal) { await tryVideo(url, false); return; }
  try { await tryVideo(url, true); probe(); }
  catch (e) { await tryVideo(proxied(url), true); probe(); }
}

/* ===== REGION 5: FRAME ANALYSIS (pixels -> grid of tiles) =====
   Tile value: null = no data, 0 = dry, number = rain/snow rate from the legend. */
function matchColor(r, g, b) {
  var best = null, bd = A.maxColorDistance * A.maxColorDistance;
  S.legends.forEach(function (L) {
    L.entries.forEach(function (e) {
      var d = dist2(r, g, b, [e.r, e.g, e.b]);
      if (d <= bd) { bd = d; best = { e: e, type: L.spec.type }; }
    });
  });
  return best;
}
function prepAnalysis() {
  var v = S.video, cr = S.crop;
  S.aw = A.width;
  S.ah = Math.max(1, Math.round(A.width * (v.videoHeight * cr.h) / (v.videoWidth * cr.w)));
  S.ac = document.createElement("canvas"); S.ac.width = S.aw; S.ac.height = S.ah;
  S.ax = S.ac.getContext("2d", { willReadFrequently: true });
}
function analyze() {
  var v = S.video, cr = S.crop, cols = C.grid.cols, rows = C.grid.rows, n = A.samplesPerTile;
  S.ax.drawImage(v, cr.x * v.videoWidth, cr.y * v.videoHeight, cr.w * v.videoWidth, cr.h * v.videoHeight, 0, 0, S.aw, S.ah);
  var d = S.ax.getImageData(0, 0, S.aw, S.ah).data, tw = S.aw / cols, th = S.ah / rows, tiles = [];
  for (var r = 0; r < rows; r++) for (var c = 0; c < cols; c++) {
    var wet = 0, dry = 0, sv = 0, st = 0, sr = 0, sg = 0, sb = 0, types = {};
    for (var j = 0; j < n; j++) for (var i = 0; i < n; i++) {
      var x = Math.floor(c * tw + (i + 0.5) / n * tw), y = Math.floor(r * th + (j + 0.5) / n * th);
      var p = (y * S.aw + x) * 4, R = d[p], G = d[p + 1], B = d[p + 2];
      if (d[p + 3] < 10) continue;
      if (A.noDataColor && dist2(R, G, B, A.noDataColor) < A.dryTolerance * A.dryTolerance) continue;
      if (A.dryColor && dist2(R, G, B, A.dryColor) < A.dryTolerance * A.dryTolerance) { dry++; continue; }
      var m = matchColor(R, G, B);
      if (!m) continue;
      if (m.e.value < S.wetMin) { dry++; continue; }
      wet++; sv += m.e.value; st += m.e.t; sr += m.e.r; sg += m.e.g; sb += m.e.b;
      types[m.type] = (types[m.type] || 0) + 1;
    }
    var valid = wet + dry, tile;
    if (valid / (n * n) < A.minCoverage) tile = { value: null };
    else if (!wet) tile = { value: 0 };
    else {
      var top = Object.keys(types).sort(function (a, b) { return types[b] - types[a]; })[0];
      tile = { value: sv / wet, norm: st / wet, type: top, wetFrac: wet / valid,
               color: [Math.round(sr / wet), Math.round(sg / wet), Math.round(sb / wet)] };
    }
    tile.col = c; tile.row = r; tiles.push(tile);
  }
  return tiles;
}

/* ===== REGION 6: AUDIO ===== */
function initAudio() {
  if (S.ctx) { S.ctx.resume(); return; }
  var ctx = S.ctx = new (window.AudioContext || window.webkitAudioContext)();
  var comp = ctx.createDynamicsCompressor();
  S.master = ctx.createGain(); S.master.gain.value = parseFloat($("volume").value);
  S.master.connect(comp); comp.connect(ctx.destination);
  S.bus = ctx.createGain(); S.bus.connect(S.master);
  var conv = ctx.createConvolver(), len = ctx.sampleRate * 1.2, buf = ctx.createBuffer(2, len, ctx.sampleRate);
  for (var ch = 0; ch < 2; ch++) { var a = buf.getChannelData(ch); for (var k = 0; k < len; k++) a[k] = (Math.random() * 2 - 1) * Math.pow(1 - k / len, 3); }
  conv.buffer = buf; var wet = ctx.createGain(); wet.gain.value = REVERB;   // light echo: notes stay distinct
  S.bus.connect(conv); conv.connect(wet); wet.connect(S.master);
}
function envelope(g, t, peak, dur) {
  g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(peak, t + 0.01);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
}
function voice(freq, t, kind, vol, pan) {
  var ctx = S.ctx, g = ctx.createGain(), pn = ctx.createStereoPanner();
  pn.pan.value = pan; g.connect(pn); pn.connect(S.bus);
  if (kind === "bell") {
    [[1, 1], [2.76, 0.35], [5.4, 0.15]].forEach(function (pr) {
      var o = ctx.createOscillator(), pg = ctx.createGain();
      o.type = "sine"; o.frequency.value = freq * pr[0]; pg.gain.value = pr[1];
      o.connect(pg); pg.connect(g); o.start(t); o.stop(t + 1.2);
    });
    envelope(g, t, vol, 1.0);
  } else {
    var o = ctx.createOscillator(), f = ctx.createBiquadFilter();
    o.type = "triangle"; o.frequency.value = freq; f.type = "lowpass";
    f.frequency.setValueAtTime(freq * 6, t); f.frequency.exponentialRampToValueAtTime(freq * 1.5, t + 0.3);
    o.connect(f); f.connect(g); o.start(t); o.stop(t + 0.5);
    envelope(g, t, vol, 0.4);
  }
}
/* Row -> pitch. Top row (north) is the highest note, bottom row (south) the lowest. */
function pitchFor(row) {
  var rows = C.grid.rows, len = C.scale.length * OCTAVES;
  var k = Math.round((S.invert ? row : rows - 1 - row) / (rows - 1) * (len - 1));
  return LOW_MIDI + 12 * Math.floor(k / C.scale.length) + C.scale[k % C.scale.length];
}
function inBand(r) { var b = S.active; return !b || (r >= b.rowStart && r < b.rowEnd); }
function clearSweep() {
  S.sweepTimers.forEach(clearTimeout); S.sweepTimers = [];
}
/* Play one frame as a west-to-east sweep. */
function playSweep(tiles) {
  clearSweep();
  var cols = C.grid.cols, rows = C.grid.rows;
  var total = SWEEP_MS / S.video.playbackRate / 1000;
  var step = total * 0.92 / cols;
  var t0 = S.ctx.currentTime + 0.05;
  for (var c = 0; c < cols; c++) {
    var col = [];
    for (var r = 0; r < rows; r++) {
      var tile = tiles[r * cols + c];
      if (tile.value > 0 && inBand(r)) col.push(tile);
    }
    col.sort(function (a, b) { return b.norm - a.norm; });          // strongest first
    var pan = ((c + 0.5) / cols * 2 - 1) * PAN;
    col.slice(0, MAX_PER_COL).forEach(function (tl) {
      var kind = C.timbres[tl.type] || C.timbres["default"];
      voice(midiToHz(pitchFor(tl.row)), t0 + c * step, kind, LOUD[0] + (LOUD[1] - LOUD[0]) * tl.norm, pan);
    });
    S.sweepTimers.push(setTimeout(drawMap.bind(null, tiles, c), (0.05 + c * step) * 1000));
  }
  S.sweepTimers.push(setTimeout(function () { drawMap(tiles); }, (0.05 + total) * 1000));   // remove the yellow marker at the end
}
function soundKey() {
  initAudio();
  var t = S.ctx.currentTime + 0.05, rows = C.grid.rows;
  for (var r = rows - 1; r >= 0; r--) voice(midiToHz(pitchFor(r)), t + (rows - 1 - r) * 0.3, "pluck", 0.25, 0);   // south to north, low to high
  var t2 = t + rows * 0.3 + 0.4;
  voice(midiToHz(pitchFor(4)), t2, "pluck", 0.1, 0);                 // quiet = light rain
  voice(midiToHz(pitchFor(4)), t2 + 0.6, "pluck", 0.45, 0);          // loud = heavy rain
  voice(midiToHz(pitchFor(4)), t2 + 1.4, "bell", 0.3, 0);            // bell = snow
  say("Sound key. First, plucked notes rising from south to north, low to high. Then a quiet pluck for light rain, a loud pluck for heavy rain, and a bell for snow.");
}

/* ===== REGION 7: DESCRIPTION ===== */
function bandText(b, tiles) {
  var cols = C.grid.cols, valid = 0, wet = [], types = {};
  for (var r = b.rowStart; r < b.rowEnd; r++) for (var c = 0; c < cols; c++) {
    var t = tiles[r * cols + c];
    if (t.value === null) continue; valid++;
    if (t.value > 0) { wet.push(t); types[t.type] = (types[t.type] || 0) + 1; }
  }
  if (!valid) return "no data";
  if (!wet.length) return "dry";
  var top = wet.reduce(function (a, t) { return t.norm > a.norm ? t : a; });
  var kind = Object.keys(types).sort(function (a, b2) { return types[b2] - types[a]; })[0];
  var level = top.norm < 0.33 ? "light" : top.norm < 0.66 ? "moderate" : "heavy";
  return Math.round(wet.length / valid * 100) + " percent wet, mostly " + kind + ", strongest is " + level + " near " + lonText(top.col);
}
function describe(tiles) {
  return "At " + S.video.currentTime.toFixed(0) + " seconds. " + C.bands.map(function (b) { return b.name + ": " + bandText(b, tiles) + "."; }).join(" ");
}
function updateTable(tiles) {
  $("bandTable").innerHTML = C.bands.map(function (b) { return "<tr><th scope='row'>" + b.name + "</th><td>" + bandText(b, tiles) + "</td></tr>"; }).join("");
  var wet = 0, nodata = 0;
  tiles.forEach(function (t) { if (t.value === null) nodata++; else if (t.value > 0) wet++; });
  $("stats").textContent = "Wet tiles this frame: " + wet + " of " + tiles.length + ". No-data tiles: " + nodata + ".";
}

/* ===== REGION 8: DRAWING (the grid, colored from the legends) ===== */
function label(g, text, x, y, align) {
  g.font = "bold 16px sans-serif"; g.textAlign = align; g.textBaseline = "middle";
  var w = g.measureText(text).width;
  var bx = align === "center" ? x - w / 2 : align === "left" ? x : x - w;
  g.fillStyle = "rgba(0,0,0,0.75)"; g.fillRect(bx - 3, y - 10, w + 6, 20);
  g.fillStyle = "#fff"; g.fillText(text, x, y);
}
function drawMap(tiles, hc) {
  var cv = $("map"), cs = 32, cols = C.grid.cols, rows = C.grid.rows;
  cv.width = cols * cs; cv.height = rows * cs;
  var g = cv.getContext("2d"); g.fillStyle = "#000"; g.fillRect(0, 0, cv.width, cv.height);
  tiles.forEach(function (t) {
    var x = t.col * cs, y = t.row * cs;
    if (t.value === null) return;
    if (t.value === 0) { g.strokeStyle = "#444"; g.strokeRect(x + 0.5, y + 0.5, cs - 1, cs - 1); return; }
    g.fillStyle = "rgb(" + t.color.join(",") + ")"; g.fillRect(x, y, cs, cs);
  });
  if (S.active) {                                       // dim the bands that are not playing
    g.fillStyle = "rgba(0,0,0,0.65)"; g.fillRect(0, 0, cv.width, S.active.rowStart * cs);
    g.fillRect(0, S.active.rowEnd * cs, cv.width, cv.height - S.active.rowEnd * cs);
  }
  g.strokeStyle = "#fff"; g.lineWidth = 2;
  C.bands.forEach(function (b) { g.beginPath(); g.moveTo(0, b.rowStart * cs); g.lineTo(cv.width, b.rowStart * cs); g.stroke(); });
  if (hc !== undefined) {                               // yellow column = where the sound is right now
    g.strokeStyle = "#ff8a1f"; g.lineWidth = 3;
    g.strokeRect(hc * cs + 1.5, 1.5, cs - 3, cv.height - 3);
  }
  label(g, "NORTH (high notes)", cv.width / 2, 14, "center");
  label(g, "SOUTH (low notes)", cv.width / 2, cv.height - 14, "center");
  label(g, "WEST", 4, cv.height / 2, "left");
  label(g, "EAST", cv.width - 4, cv.height / 2, "right");
}

/* ===== REGION 9: PLAYBACK ===== */
function onBeat() {
  S.active = S.mode === "all" ? null : S.mode === "cycle" ? C.bands[S.beat % C.bands.length] : C.bands[+S.mode];
  $("now").textContent = "Listening to: " + (S.active ? S.active.name : "all bands");
  S.tiles = analyze(); drawMap(S.tiles); updateTable(S.tiles); playSweep(S.tiles);
  if (S.beat % ANNOUNCE === 0) say(describe(S.tiles));
  S.beat++;
}
function start() {
  initAudio(); S.video.playbackRate = parseFloat($("rate").value);
  S.video.play(); S.beat = 0; clearInterval(S.timer);
  onBeat();                                             // first sweep right away
  S.timer = setInterval(onBeat, SWEEP_MS / S.video.playbackRate);
  $("play").textContent = "Pause";
}
function stop(msg) {
  clearInterval(S.timer); S.timer = null; clearSweep(); S.video.pause(); $("play").textContent = "Play";
  if (S.tiles) drawMap(S.tiles);
  if (msg) say(msg);
}
S.video.addEventListener("ended", function () { stop("Finished. Press Play to hear it again."); });

/* ===== REGION 10: PAGE CONTROLS ===== */
function addLegendRow(s) {
  s = s || { label: "", type: "liquid", url: "", min: 0.1, max: 50, scale: "log", orientation: "horizontal-lowleft" };
  var d = document.createElement("div"); d.className = "legend";
  d.dataset.crop = JSON.stringify(s.crop || { x: 0, y: 0, w: 1, h: 1 });
  function field(cls, lab, html) { return "<label class='f " + cls + "'>" + lab + html + "</label>"; }
  d.innerHTML =
    field("", "Label", "<input class='l-label' type='text'>") +
    field("", "Type (liquid, frozen, ...)", "<input class='l-type' type='text'>") +
    field("wide", "Legend image link", "<input class='l-url' type='url'>") +
    field("", "Min value", "<input class='l-min' type='number' step='any'>") +
    field("", "Max value", "<input class='l-max' type='number' step='any'>") +
    field("", "Scale", "<select class='l-scale'><option>log</option><option>linear</option></select>") +
    field("", "Bar direction", "<select class='l-ori'><option value='horizontal-lowleft'>Horizontal, low at left</option><option value='horizontal-lowright'>Horizontal, low at right</option><option value='vertical-lowbottom'>Vertical, low at bottom</option><option value='vertical-lowtop'>Vertical, low at top</option></select>") +
    "<button type='button' class='l-del'>Remove this legend</button>";
  d.querySelector(".l-label").value = s.label; d.querySelector(".l-type").value = s.type;
  d.querySelector(".l-url").value = s.url; d.querySelector(".l-min").value = s.min; d.querySelector(".l-max").value = s.max;
  d.querySelector(".l-scale").value = s.scale; d.querySelector(".l-ori").value = s.orientation;
  d.querySelector(".l-del").addEventListener("click", function () { d.remove(); });
  $("legendRows").appendChild(d);
}
function readLegendRows() {
  return Array.prototype.map.call(document.querySelectorAll("#legendRows .legend"), function (d) {
    return { label: d.querySelector(".l-label").value || "Legend", type: d.querySelector(".l-type").value.trim().toLowerCase() || "default",
      url: d.querySelector(".l-url").value.trim(), min: parseFloat(d.querySelector(".l-min").value), max: parseFloat(d.querySelector(".l-max").value),
      scale: (d.querySelector(".l-scale").value === "log" && !(parseFloat(d.querySelector(".l-min").value) > 0)) ? "linear" : d.querySelector(".l-scale").value, orientation: d.querySelector(".l-ori").value, crop: JSON.parse(d.dataset.crop) };
  }).filter(function (s) { return s.url && isFinite(s.min) && isFinite(s.max); });
}
function applyPreset(i) {
  var p = C.presets[i]; S.wetMin = p.wetMin !== undefined ? p.wetMin : A.wetMin; $("videoUrl").value = p.videoUrl; S.crop = p.mapCrop || S.crop;
  $("legendRows").innerHTML = ""; p.legends.forEach(addLegendRow);
}
async function onLoad() {
  stop(); S.loaded = false; $("play").disabled = true;
  var file = $("file").files[0], url = $("videoUrl").value.trim(), specs = readLegendRows();
  if (!file && !url) return say("Add a video link or choose a file first.");
  if (!specs.length) return say("No usable legend. Each legend needs a link, a min and a max.");
  try {
    say("Loading legends.");
    S.legends = []; for (var i = 0; i < specs.length; i++) S.legends.push(await decodeLegend(specs[i]));
    showLegends();
    say("Loading video.");
    await loadVideo(file ? URL.createObjectURL(file) : url, !!file);
    prepAnalysis(); S.loaded = true; $("play").disabled = false;
    say("Ready. " + S.legends.length + " legends and the video loaded. Press Play.");
  } catch (e) {
    say("Could not load: " + e.message + ". If the host blocks reading, run server.py and open http://localhost:8000, or choose a downloaded file.");
  }
}
(function wire() {
  C.presets.forEach(function (p, i) { var o = document.createElement("option"); o.value = i; o.textContent = p.name; $("preset").appendChild(o); });
  $("preset").addEventListener("change", function () { applyPreset(this.value); });
  applyPreset(0);
  var ms = $("mode");
  ms.innerHTML = "<option value='cycle'>One band at a time (cycle)</option><option value='all'>All bands together</option>" +
    C.bands.map(function (b, i) { return "<option value='" + i + "'>" + b.name + " only</option>"; }).join("");
  ms.value = S.mode; ms.addEventListener("change", function () { S.mode = this.value; });
  $("invert").checked = S.invert; $("invert").addEventListener("change", function () { S.invert = this.checked; });
  $("notes").value = MAX_PER_COL; $("notes").addEventListener("change", function () { MAX_PER_COL = Math.max(1, +this.value || 1); });
  var sk = $("seek");
  S.video.addEventListener("timeupdate", function () { if (S.video.duration) sk.value = S.video.currentTime / S.video.duration * 1000; });
  sk.addEventListener("input", function () { if (S.loaded) S.video.currentTime = sk.value / 1000 * S.video.duration; });
  $("addLegend").addEventListener("click", function () { addLegendRow(); });
  $("load").addEventListener("click", onLoad);
  $("play").addEventListener("click", function () { if (S.timer) stop("Paused."); else start(); });
  $("key").addEventListener("click", soundKey);
  $("describe").addEventListener("click", function () { say(S.tiles ? describe(S.tiles) : "Nothing analysed yet. Press Play."); });
  $("volume").addEventListener("input", function () { if (S.master) S.master.gain.value = parseFloat(this.value); });
  $("rate").addEventListener("change", function () {
    S.video.playbackRate = parseFloat(this.value);
    if (S.timer) { clearInterval(S.timer); S.timer = setInterval(onBeat, SWEEP_MS / S.video.playbackRate); }
  });
  document.addEventListener("keydown", function (e) {
    if (!S.loaded || /INPUT|SELECT|TEXTAREA/.test(e.target.tagName)) return;
    if (e.key === "ArrowRight") S.video.currentTime = Math.min(S.video.duration, S.video.currentTime + 5);
    if (e.key === "ArrowLeft") S.video.currentTime = Math.max(0, S.video.currentTime - 5);
  });
})();
})();