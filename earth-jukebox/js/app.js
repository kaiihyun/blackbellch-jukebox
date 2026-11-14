// app.js — the "glue": the main menu, page controls, drawing the picture, and the main loop.
// Every frame (about 60×/second) the loop does:
//   1. draw the picture   2. shrink it to a 64×14 grid   3. measure it (analysis.js)
//   4. pick the row levels to listen to   5. hand them to the audio engine   6. update the display
(function () {
  var C = EJ.C, R = EJ.R, VW = EJ.VW, VH = EJ.VH;
  function $(id) { return document.getElementById(id); }

  // ---------- Canvases ----------
  var view = $('view'), vctx = view.getContext('2d');   // the big picture
  var meter = $('meter'), mctx = meter.getContext('2d'); // the bar meter on the right
  var small = $('pix');                                  // the small 64×14 canvas. It is shown on screen AND is exactly what the analysis reads
  small.width = C; small.height = R;
  var sctx = small.getContext('2d', { willReadFrequently: true });
  vctx.imageSmoothingQuality = 'high';

  // ---------- State ----------
  var src = { kind: 'scene', i: 0 };            // what we're showing: a built-in scene, or a loaded image/video
  var objUrl = null;                            // temporary URL of a loaded file
  var region = { x: 0.3, y: 0.25, w: 0.4, h: 0.5 }; // chosen area as fractions (0..1) of the picture
  var t0 = 0;                                   // time when Play was pressed (for the sweep position)
  var frameCount = 0;
  var vb = $('viewBox');
  function isArea() { return $('mode').value === 'area'; }

  // ---------- Draw the picture ----------
  function paint(t) {
    if (src.kind === 'scene') { EJ.paintScene(vctx, src.i, t); return; }
    // A loaded image or video: fit it inside the canvas without stretching it.
    vctx.fillStyle = '#8c8c8c'; vctx.fillRect(0, 0, VW, VH); // neutral grey bars: not on any legend, so they stay silent
    var el = src.el, iw = el.videoWidth || el.naturalWidth, ih = el.videoHeight || el.naturalHeight;
    if (!iw || !ih) return;
    var s = Math.min(VW / iw, VH / ih);
    vctx.drawImage(el, (VW - iw * s) / 2, (VH - ih * s) / 2, iw * s, ih * s);
  }

  // ---------- Main loop ----------
  function frame(ts) {
    var t = ts / 1000, r;
    paint(t);

    // Shrink the picture (or just the chosen area) onto the 64×14 grid, then measure it.
    if (isArea()) sctx.drawImage(view, region.x * VW, region.y * VH, region.w * VW, region.h * VH, 0, 0, C, R);
    else sctx.drawImage(view, 0, 0, C, R);
    EJ.analyzeGrid(sctx.getImageData(0, 0, C, R).data);

    // Where are we listening? Area mode: the box centre. Sweep mode: a position moving 0→1 and looping.
    var area = isArea(), playing = EJ.audio.playing;
    var pos = area ? region.x + region.w / 2
                   : (playing ? (((ts - t0) / 1000 / parseFloat($('dur').value)) % 1) : 0);
    EJ.columnLevels(area, Math.min(C - 1, Math.floor(pos * C)));

    // Tempo range and source (heat or rain) come from the selected map type (maps.js).
    var v = EJ.map().voice, drive = v.tempoFrom === 'rain' ? EJ.meanRain : EJ.meanHeat;
    EJ.tempo = v.tempo[0] + drive * (v.tempo[1] - v.tempo[0]);
    if (playing) EJ.audio.update(pos);

    // Show the sweep line (sweep mode only), on both the source picture and the pixel grid.
    var on = playing && !area;
    $('ph').style.display = on ? 'block' : 'none';
    $('ph2').style.display = on ? 'block' : 'none';
    if (on) { $('ph').style.left = $('ph2').style.left = (pos * 100) + '%'; }

    // Bar meter: warm bar = pad amount in that row, blue bar = drops amount in that row.
    mctx.clearRect(0, 0, 56, VH);
    if (playing) {
      var rh = VH / R;
      for (r = 0; r < R; r++) {
        mctx.fillStyle = 'rgb(255,106,69)'; mctx.fillRect(1, r * rh + 1, EJ.rowHeat[r] * 26, rh - 2);
        mctx.fillStyle = 'rgb(74,168,255)'; mctx.fillRect(29, r * rh + 1, EJ.rowRain[r] * 26, rh - 2);
      }
    }

    // Update the text readout every 6th frame (no need to do it more often).
    if (++frameCount % 6 === 0) {
      var m = EJ.map();
      $('rh').textContent = Math.round(EJ.meanHeat * 100) + '%';
      $('rw').textContent = Math.round(EJ.meanRain * 100) + '%';
      $('rt').textContent = Math.round(EJ.tempo);
      $('ra').textContent = (EJ.meanValue === null || !m.fmt) ? '–' : m.fmt(EJ.meanValue);
    }
    requestAnimationFrame(frame);
  }

  // ---------- Scene buttons ----------
  var box = $('scenes');
  function showScene(i) { // switch to built-in scene number i of the current map type
    src = { kind: 'scene', i: i };
    Array.prototype.forEach.call(box.children, function (x, j) { x.setAttribute('aria-pressed', j === i ? 'true' : 'false'); });
    $('cap').textContent = EJ.scenes()[i].d;
  }
  function buildSceneButtons(show) { // (re)create one button per scene of the current map type
    box.innerHTML = '';
    EJ.scenes().forEach(function (s, i) {
      var b = document.createElement('button');
      b.textContent = s.n;
      b.setAttribute('aria-pressed', 'false');
      b.onclick = function () { showScene(i); };
      box.appendChild(b);
    });
    if (show) showScene(0);
  }

  // ---------- Loading your own image or video ----------
  function loadFile(f) {
    if (!f) return;
    if (objUrl) URL.revokeObjectURL(objUrl);
    objUrl = URL.createObjectURL(f);
    function use(kind, el) { // switch the picture to the loaded file
      src = { kind: kind, el: el };
      Array.prototype.forEach.call(box.children, function (x) { x.setAttribute('aria-pressed', 'false'); });
      var m = EJ.map();
      $('cap').textContent = 'Your frame: ' + f.name + (m.legend
        ? '. Colors are matched to the ' + m.name.toLowerCase() + ' legend.'
        : '. Warm colors play as heat, blue as rain.');
    }
    if (f.type.indexOf('video') === 0) {
      var v = document.createElement('video');
      v.muted = true; v.loop = true; v.playsInline = true; v.src = objUrl;
      v.onloadeddata = function () { v.play(); use('video', v); };
    } else if (f.type.indexOf('image') === 0) {
      var im = new Image();
      im.onload = function () { use('image', im); };
      im.src = objUrl;
    } else {
      $('cap').textContent = 'That file is not an image or video. Try a PNG, JPG, MP4 or WebM.';
    }
  }
  $('pick').onclick = function () { $('file').click(); };
  $('file').onchange = function (e) { loadFile(e.target.files[0]); e.target.value = ''; };
  // Drag and drop a file onto the picture.
  vb.addEventListener('dragover', function (e) { e.preventDefault(); vb.classList.add('drop'); });
  vb.addEventListener('dragleave', function () { vb.classList.remove('drop'); });
  vb.addEventListener('drop', function (e) { e.preventDefault(); vb.classList.remove('drop'); loadFile(e.dataTransfer.files[0]); });

  // ---------- Choosing an area (area mode) ----------
  // Keep the box inside the picture.
  function clampRegion() {
    region.w = Math.min(1, region.w); region.h = Math.min(1, region.h);
    region.x = Math.max(0, Math.min(1 - region.w, region.x));
    region.y = Math.max(0, Math.min(1 - region.h, region.y));
  }
  // Move the white box on screen to match `region` (as percentages).
  function showSel() {
    var s = $('sel').style;
    s.left = region.x * 100 + '%'; s.top = region.y * 100 + '%';
    s.width = region.w * 100 + '%'; s.height = region.h * 100 + '%';
  }
  // Mouse/finger position as fractions 0..1 of the picture.
  function np(e) {
    var b = vb.getBoundingClientRect();
    return [EJ.clamp01((e.clientX - b.left) / b.width), EJ.clamp01((e.clientY - b.top) / b.height)];
  }
  var drag = null; // set while the pointer is held down
  vb.addEventListener('pointerdown', function (e) {
    if (!isArea()) return;
    var p = np(e);
    drag = { x: p[0], y: p[1], moved: false };
    try { vb.setPointerCapture(e.pointerId); } catch (err) {}
  });
  vb.addEventListener('pointermove', function (e) {
    if (!drag) return;
    var p = np(e);
    if (Math.abs(p[0] - drag.x) > 0.02 || Math.abs(p[1] - drag.y) > 0.02) drag.moved = true;
    if (drag.moved) { // dragging draws a new box from the start point to here
      region = { x: Math.min(drag.x, p[0]), y: Math.min(drag.y, p[1]),
                 w: Math.max(0.04, Math.abs(p[0] - drag.x)), h: Math.max(0.06, Math.abs(p[1] - drag.y)) };
      clampRegion(); showSel();
    }
  });
  vb.addEventListener('pointerup', function () {
    if (!drag) return;
    if (!drag.moved) { // a simple click/tap moves the existing box so it is centred there
      region.x = drag.x - region.w / 2; region.y = drag.y - region.h / 2;
      clampRegion(); showSel();
    }
    drag = null;
  });
  vb.addEventListener('pointercancel', function () { drag = null; });

  // ---------- Controls ----------
  $('mode').onchange = function () {
    var a = isArea();
    vb.classList.toggle('area', a);      // shows the box and the crosshair cursor
    $('dur').disabled = a;               // sweep time doesn't apply to area mode
    t0 = performance.now();
    $('pixCap').textContent = a ? 'What the app hears: only the chosen area, stretched onto a 64 × 14 grid. Each row is a note.'
                                : 'What the app hears: the whole frame shrunk to a 64 × 14 grid. Each row is a note.';
    $('hint').textContent = a ? 'Drag on the picture to choose an area, or click to move the box. Only that area is played, and it keeps playing while the picture changes.' : '';
  };
  $('play').onclick = function () {
    var b = $('play');
    if (!EJ.audio.playing) {
      t0 = performance.now();
      EJ.audio.start(parseFloat($('vol').value)); // must happen inside a click, or browsers block audio
      b.textContent = 'Stop'; b.setAttribute('aria-pressed', 'true');
    } else {
      EJ.audio.stop();
      b.textContent = 'Play'; b.setAttribute('aria-pressed', 'false');
    }
  };
  $('vol').oninput = function () { EJ.audio.setVolume(parseFloat($('vol').value)); };
  $('dur').oninput = function () { $('durO').textContent = $('dur').value + ' s'; t0 = performance.now(); };

  // ---------- Map type: applies one entry from EJ.MAPS (maps.js) to the whole page ----------
  function applyMapType(id, resetScene) {
    EJ.dataType = id;
    var m = EJ.map();
    $('dtype').value = id;
    $('lh').textContent = m.labels[0];
    $('lw').textContent = m.labels[1];
    $('avgLabel').textContent = m.avg;
    $('avgWrap').style.display = m.avg ? '' : 'none';
    $('legendBox').style.display = m.legend ? '' : 'none';
    if (m.legend) {
      $('legendBar').style.background = EJ.legendCss(m.legend);
      $('legendTicks').innerHTML = m.ticks.map(function (s) { return '<span>' + s + '</span>'; }).join('');
    }
    EJ.audio.applyVoice(); // switch the pad wave and reverb to match, even if already playing
    // Built-in scenes belong to one map type, so go back to that type's first scene.
    // A loaded image or video stays as it is.
    buildSceneButtons(resetScene);
  }
  $('dtype').onchange = function () { applyMapType(this.value, true); };

  // ---------- Main menu: a card per map type, built from EJ.MAPS so it stays in sync ----------
  var menu = $('menu'), menuCards = $('menuCards'), appEl = $('app');
  function buildMenu() {
    // Fill the "Map type" dropdown inside the app too, so it always lists exactly the same maps.
    $('dtype').innerHTML = EJ.MAP_ORDER.map(function (id) {
      return '<option value="' + id + '">' + EJ.MAPS[id].name + '</option>';
    }).join('');
    menuCards.innerHTML = '';
    EJ.MAP_ORDER.forEach(function (id) {
      var m = EJ.MAPS[id], card = document.createElement('button');
      card.className = 'card';
      card.innerHTML = '<span class="cardbar" style="background:' + (m.legend ? EJ.legendCss(m.legend) : m.stripCss) + '"></span>' +
        '<span class="cardname">' + m.name + '</span><span class="cardblurb">' + m.blurb + '</span>';
      card.onclick = function () { openApp(id); };
      menuCards.appendChild(card);
    });
  }
  function openApp(id) {
    applyMapType(id, true);
    $('appTitle').textContent = EJ.map().name;
    menu.style.display = 'none';
    appEl.style.display = '';
    if (!frame.started) { frame.started = true; requestAnimationFrame(frame); } // start the loop only once
  }
  $('menuBtn').onclick = function () { // "Menu" button inside the app: stop sound, go back to the cards
    if (EJ.audio.playing) { EJ.audio.stop(); $('play').textContent = 'Play'; $('play').setAttribute('aria-pressed', 'false'); }
    appEl.style.display = 'none';
    menu.style.display = '';
  };

  buildMenu();
  showSel();
})();
