// analysis.js — turns pixels into numbers. For every cell of the 64×14 grid it works out two amounts:
//   HH = the "pad" amount (heat / warmth / thunder / hush)      WW = the "drops" amount (rain / cold / snow)
// Same code for built-in scenes and for your own images and videos.
(function () {
  var C = EJ.C, R = EJ.R;

  EJ.HH = new Float32Array(C * R);  // pad amount for every cell (0..1)
  EJ.WW = new Float32Array(C * R);  // drops amount for every cell (0..1)
  EJ.rowHeat = new Float32Array(R); // pad amount per ROW at the spot being listened to
  EJ.rowRain = new Float32Array(R); // drops amount per ROW at the spot being listened to
  EJ.meanHeat = 0;                  // overall pad amount (0..1) → filter, buzz and (for some maps) tempo
  EJ.meanRain = 0;                  // overall drops amount (0..1) → wind / rain hiss and (for some maps) tempo
  EJ.meanValue = null;              // average legend value (°C, or 0..1 intensity); null if nothing matched

  // Original rule for 'heatrain' maps: look at the hue of one pixel. Results go into o as [heat, rain].
  EJ.classify = function (r, g, b, o) {
    var mx = Math.max(r, g, b), mn = Math.min(r, g, b);
    var v = mx / 255, s = mx ? (mx - mn) / mx : 0; // brightness and saturation
    var k = (s * v - 0.2) / 0.8;                   // strength: dull or dark colours count as 0
    o[0] = 0; o[1] = 0;
    if (k <= 0) return;
    var dd = mx - mn, h;
    if (mx === r) h = ((g - b) / dd + 6) % 6; else if (mx === g) h = (b - r) / dd + 2; else h = (r - g) / dd + 4;
    h *= 60;                                       // hue angle 0–360°
    if (h < 65 || h >= 335) o[0] = k;              // red, orange, yellow → heat
    else if (h >= 170 && h <= 265) o[1] = k;       // cyan to blue → rain
  };

  // Legend maps: match the pixel to the nearest legend colour (legend.js) to get a value, then let the
  // map type (maps.js) turn the value into [pad, drops]. o[2] receives the value itself.
  EJ.classifyMap = function (r, g, b, o, m) {
    var v = EJ.legendMatch(m.legend, r, g, b);
    o[2] = v;
    if (v === null) { o[0] = 0; o[1] = 0; return; } // not on the legend → no sound
    m.levels(v, o);
  };

  // Classify every cell of the small grid image and work out the overall levels.
  EJ.analyzeGrid = function (d) {
    var m = EJ.map(), o = [0, 0, null], sh = 0, sw = 0, sv = 0, valid = 0;
    for (var i = 0; i < C * R; i++) {
      o[2] = null;
      if (m.legend) EJ.classifyMap(d[i * 4], d[i * 4 + 1], d[i * 4 + 2], o, m);
      else EJ.classify(d[i * 4], d[i * 4 + 1], d[i * 4 + 2], o);
      EJ.HH[i] = o[0]; EJ.WW[i] = o[1];
      sh += o[0]; sw += o[1];
      if (o[2] !== null) { sv += o[2]; valid++; }
    }
    // 'full' maps colour every cell, so average over the cells that matched. 'sparse' maps are mostly empty,
    // so average over ALL cells and multiply by 3. Both are capped at 1.
    var div = m.coverage === 'full' ? Math.max(1, valid) : C * R, mul = m.coverage === 'full' ? 1.5 : 3;
    EJ.meanHeat = Math.min(1, sh / div * mul);
    EJ.meanRain = Math.min(1, sw / div * mul);
    EJ.meanValue = valid ? sv / valid : null;
  };

  // Pick the pad and drops amounts for each ROW (= each note).
  //  area mode  → use the whole grid (which already holds only the chosen area)
  //  sweep mode → use just the 3 columns under the sweep line (col-1, col, col+1)
  EJ.columnLevels = function (area, col) {
    for (var r = 0; r < R; r++) {
      var a = 0, b = 0, n = 0, c;
      if (area) {
        var ma = 0, mb = 0;
        for (c = 0; c < C; c++) {
          var x1 = EJ.HH[r * C + c], x2 = EJ.WW[r * C + c];
          a += x1; b += x2;
          if (x1 > ma) ma = x1;
          if (x2 > mb) mb = x2;
        }
        // Blend of the average and the strongest cell, so small hot spots still get heard.
        EJ.rowHeat[r] = 0.5 * (a / C + ma);
        EJ.rowRain[r] = 0.5 * (b / C + mb);
      } else {
        for (c = Math.max(0, col - 1); c <= Math.min(C - 1, col + 1); c++) { a += EJ.HH[r * C + c]; b += EJ.WW[r * C + c]; n++; }
        EJ.rowHeat[r] = a / n;
        EJ.rowRain[r] = b / n;
      }
    }
  };
})();
