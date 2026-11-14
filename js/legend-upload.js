// legend-upload.js — lets you upload a picture of a color legend (like NASA's colorbar images)
// and turns it into a new, selectable map type, sonified the same way as the built-in ones.
//
// How it reads a legend image, step by step:
//   1. Draw the image to a canvas and score every row for "how colorful" it is.
//   2. The most colorful row is assumed to be the color bar itself.
//   3. Along that row, find the contiguous stretch of colorful pixels (this trims white margins
//      and any title text above or below the bar).
//   4. Decide whether the bar is a smooth gradient or a row of distinct steps, by counting how
//      many times the color jumps sharply across that stretch.
//   5. Sample the colors (evenly for a gradient, one per step for stepped bars) into the same
//      [value, r, g, b] table format legend.js already uses — so the rest of the app (legendColor,
//      legendMatch, legendCss) needs no changes at all to use it.
// The image has no numbers attached to its colors, so after extraction you're asked for the
// minimum and maximum value the bar represents; changing them just relabels the same colors.
(function () {
  function $(id) { return document.getElementById(id); }

  // How colorful is one pixel? 0 for white/grey/transparent backgrounds, higher for vivid colors.
  function colorfulness(r, g, b, a) {
    if (a < 200) return 0;
    var mx = Math.max(r, g, b), mn = Math.min(r, g, b), v = mx / 255, s = mx ? (mx - mn) / mx : 0;
    return s * v;
  }

  // Read an uploaded image file and turn it into a legend. Calls back with an id once it is
  // registered as a map type (maps.js-style entry) and selectable from the menu and the dropdown.
  function extract(file, done) {
    var url = URL.createObjectURL(file), img = new Image();
    img.onload = function () {
      URL.revokeObjectURL(url);
      var W = Math.min(800, img.width), H = Math.round(img.height * (W / img.width));
      var cv = document.createElement('canvas'); cv.width = W; cv.height = H;
      var cx = cv.getContext('2d', { willReadFrequently: true });
      cx.drawImage(img, 0, 0, W, H);
      var data = cx.getImageData(0, 0, W, H).data;

      // ---- 1–2: find the color bar's row ----
      var bestY = 0, bestScore = -1;
      for (var y = 0; y < H; y++) {
        var score = 0;
        for (var x = 0; x < W; x += 2) {
          var i = (y * W + x) * 4;
          score += colorfulness(data[i], data[i + 1], data[i + 2], data[i + 3]);
        }
        if (score > bestScore) { bestScore = score; bestY = y; }
      }
      if (bestScore < 4) { done(null, 'Could not find a color bar in that image.'); return; }

      // ---- 3: trim to the colorful stretch of that row ----
      function px(x) { var i = (bestY * W + x) * 4; return [data[i], data[i + 1], data[i + 2], data[i + 3]]; }
      var cols = []; for (var x2 = 0; x2 < W; x2++) { var p = px(x2); cols.push(colorfulness(p[0], p[1], p[2], p[3])); }
      var thresh = 0.1, x0 = 0, x1 = W - 1;
      while (x0 < W && cols[x0] < thresh) x0++;
      while (x1 > x0 && cols[x1] < thresh) x1--;
      if (x1 - x0 < 10) { done(null, 'The color bar in that image is too narrow to read.'); return; }

      // ---- 4: gradient or stepped? sample 160 points and count sharp jumps ----
      var N = 160, samples = [];
      for (var k = 0; k < N; k++) samples.push(px(Math.round(x0 + (x1 - x0) * k / (N - 1))));
      var jumps = 0;
      for (k = 1; k < N; k++) {
        var a = samples[k - 1], b = samples[k];
        var d = Math.abs(a[0] - b[0]) + Math.abs(a[1] - b[1]) + Math.abs(a[2] - b[2]);
        if (d > 40) jumps++;
      }
      var discrete = jumps > 0 && jumps <= 14; // a handful of sharp jumps = distinct steps; many/none = a smooth gradient

      // ---- 5: sample the final colors ----
      var colors = [], n;
      if (discrete) {
        n = jumps + 1;
        for (k = 0; k < n; k++) {
          var mid = Math.round(x0 + (x1 - x0) * (k + 0.5) / n), p2 = px(mid);
          colors.push([(k + 0.5) / n, p2[0], p2[1], p2[2]]);
        }
      } else {
        n = 24;
        for (k = 0; k < n; k++) {
          var xk = Math.round(x0 + (x1 - x0) * k / (n - 1)), p3 = px(xk);
          colors.push([k / (n - 1), p3[0], p3[1], p3[2]]);
        }
      }
      done({ discrete: discrete, colors: colors, count: n }, null);
    };
    img.onerror = function () { done(null, 'Could not open that image file.'); };
    img.src = url;
  }

  var seq = 0; // lets you upload more than one custom legend in a session, each gets its own id
  function register(extracted, filename) {
    var id = 'custom' + (++seq), lo = 0, hi = 1;

    // Rescale every color's stored value from 0..1 to the current lo..hi (called on upload, and
    // again whenever the Min/Max number inputs change).
    function rescale() {
      extracted.colors.forEach(function (c, i) {
        var u = extracted.discrete ? (i + 0.5) / extracted.count : i / (extracted.count - 1);
        c[0] = lo + u * (hi - lo);
      });
    }
    rescale();
    EJ.LEGENDS[id] = { lo: lo, hi: hi, discrete: extracted.discrete, colors: extracted.colors };

    EJ.MAPS[id] = {
      name: 'Custom: ' + filename, legend: id, coverage: extracted.discrete ? 'sparse' : 'full',
      blurb: 'Your own legend (' + filename + '), ' + extracted.count + (extracted.discrete ? ' steps' : ' colors') + '. Above the middle value buzzes, below it chimes.',
      ticks: [], labels: ['High', 'Low'], avg: 'Value',
      fmt: function (v) { return v.toFixed(2); },
      // Generic split around the midpoint of lo..hi: above it drives the pad, below it drives drops.
      levels: function (v, o) { var mid = (lo + hi) / 2, span = Math.max(1e-6, hi - lo) / 2;
        o[0] = Math.sqrt(EJ.clamp01((v - mid) / span)); o[1] = Math.sqrt(EJ.clamp01((mid - v) / span)); },
      voice: { chime: 'ice', base: 69, dropGain: 1, pad: 'sawtooth', cutoff: [200, 2800], detune: [4, 30], tempo: [64, 128], tempoFrom: 'heat', reverb: 0.5, hiss: 0.04 }
    };
    function fmt2(v) { return (Math.round(v * 100) / 100).toString(); }
    function syncTicks() { EJ.MAPS[id].ticks = [fmt2(lo), fmt2((lo + hi) / 2), fmt2(hi)]; }

    EJ.MAP_ORDER.push(id);
    EJ.ui.refreshMenu();
    syncTicks();
    return {
      id: id,
      setRange: function (newLo, newHi) { lo = newLo; hi = newHi; rescale(); syncTicks(); }
    };
  }

  var current = null; // the { id, setRange, lo, hi } handle for the most recently uploaded legend

  $('legendPick').onclick = function () { $('legendFile').click(); };
  $('legendFile').onchange = function (e) {
    var f = e.target.files[0]; e.target.value = '';
    if (!f) return;
    $('legendCap').textContent = 'Reading ' + f.name + '…';
    extract(f, function (extracted, err) {
      if (err) { $('legendCap').textContent = err; return; }
      current = register(extracted, f.name.replace(/\.[^.]+$/, ''));
      $('legendCap').textContent = 'Extracted ' + extracted.count + (extracted.discrete ? ' steps' : ' colors')
        + ' from ' + f.name + '. Set what its lowest and highest values mean, then pick it from "Map type".';
      $('legendRange').style.display = '';
      $('legendMin').value = 0; $('legendMax').value = 1;
      EJ.ui.open(current.id); // jump straight to the new legend so you can hear it right away
    });
  };
  function applyRange() {
    if (!current) return;
    var lo = parseFloat($('legendMin').value), hi = parseFloat($('legendMax').value);
    if (isNaN(lo) || isNaN(hi) || hi <= lo) return;
    current.setRange(lo, hi);
    if (EJ.dataType === current.id) EJ.ui.open(current.id); // refresh the on-screen ticks if it's selected
  }
  $('legendMin').onchange = applyRange;
  $('legendMax').onchange = applyRange;
})();
