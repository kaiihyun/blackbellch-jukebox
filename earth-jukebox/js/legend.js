// legend.js — the NASA colour legends, as numbers. One entry per colour: [value, red, green, blue].
// Sampled from the PNGs in assets/. To add a legend, sample a new colour bar the same way and add it here.
//   temp  lstlegend.png      near-surface (land) temperature, -40 to 40 °C, a smooth gradient (every 2 °C)
//   sst   seatemplegend.png  sea surface temperature, -5 to 35 °C, a smooth gradient (every 1 °C)
//   rain  rainlegend.png     10 steps, green (light rain) to dark red (heaviest). Value = 0..1 intensity.
//   snow  snowlegend.png     10 steps, cyan (light snow) to purple (heaviest). Value = 0..1 intensity.
// (The temp PNG fades to grey at its very end; we hold the last dark brown so grey stays "no data".)
(function () {
  var cl = EJ.clamp01;
  EJ.LEGENDS = {
    temp: { lo: -40, hi: 40, discrete: false, colors: [
      [-40,40,46,89],
      [-38,66,72,127],
      [-36,101,113,171],
      [-34,129,147,197],
      [-32,146,169,210],
      [-30,176,202,228],
      [-28,200,222,235],
      [-26,223,230,237],
      [-24,225,212,226],
      [-22,194,148,188],
      [-20,183,111,171],
      [-18,147,56,138],
      [-16,116,37,129],
      [-14,88,32,132],
      [-12,63,29,133],
      [-10,44,43,145],
      [-8,12,32,164],
      [-6,11,48,212],
      [-4,32,73,230],
      [-2,62,119,232],
      [0,105,179,234],
      [2,129,221,229],
      [4,143,236,205],
      [6,158,236,167],
      [8,185,236,120],
      [10,211,237,93],
      [12,233,230,74],
      [14,227,194,62],
      [16,221,159,53],
      [18,215,119,43],
      [20,209,80,41],
      [22,201,56,29],
      [24,167,43,21],
      [26,135,33,15],
      [28,103,22,9],
      [30,81,16,6],
      [32,68,12,4],
      [34,56,9,3],
      [36,51,7,2],
      [38,49,6,1],
      [40,49,6,1]
    ] },
    sst: { lo: -5, hi: 35, discrete: false, colors: [
      [-5,0,35,62],
      [-4,0,41,75],
      [-3,0,49,90],
      [-2,0,58,106],
      [-1,0,69,123],
      [0,0,83,143],
      [1,0,98,165],
      [2,0,111,183],
      [3,11,123,197],
      [4,0,132,205],
      [5,0,139,209],
      [6,0,148,214],
      [7,38,158,219],
      [8,68,168,224],
      [9,99,180,230],
      [10,125,191,234],
      [11,143,199,238],
      [12,159,207,242],
      [13,176,215,245],
      [14,191,220,246],
      [15,235,227,220],
      [16,255,229,190],
      [17,253,219,173],
      [18,247,209,157],
      [19,241,195,141],
      [20,234,183,128],
      [21,225,171,118],
      [22,216,156,107],
      [23,207,143,96],
      [24,200,128,87],
      [25,193,112,80],
      [26,184,91,68],
      [27,173,72,56],
      [28,162,61,50],
      [29,148,52,47],
      [30,135,45,46],
      [31,123,43,46],
      [32,108,37,42],
      [33,93,32,36],
      [34,80,28,31],
      [35,72,25,27]
    ] },
    rain: { lo: 0, hi: 1, discrete: true, colors: [
      [0.05,0,179,48],
      [0.15,96,211,0],
      [0.25,180,231,0],
      [0.35,255,251,0],
      [0.45,255,196,0],
      [0.55,255,147,0],
      [0.65,255,73,0],
      [0.75,255,0,0],
      [0.85,200,0,0],
      [0.95,145,0,0]
    ] },
    snow: { lo: 0, hi: 1, discrete: true, colors: [
      [0.05,69,255,255],
      [0.15,73,221,255],
      [0.25,77,187,255],
      [0.35,79,154,255],
      [0.45,81,122,255],
      [0.55,82,93,255],
      [0.65,83,70,255],
      [0.75,90,47,217],
      [0.85,115,33,187],
      [0.95,140,20,156]
    ] }
  };

  // Value → [r, g, b]. Smooth legends blend between neighbours; stepped legends return the step's colour.
  EJ.legendColor = function (name, v) {
    var L = EJ.LEGENDS[name], c = L.colors, n = c.length, u = cl((v - L.lo) / (L.hi - L.lo)), a, b, f, i;
    if (L.discrete) { a = c[Math.min(n - 1, Math.floor(u * n))]; return [a[1], a[2], a[3]]; }
    f = u * (n - 1); i = Math.min(n - 2, Math.floor(f)); f -= i; a = c[i]; b = c[i + 1];
    return [a[1] + (b[1] - a[1]) * f, a[2] + (b[2] - a[2]) * f, a[3] + (b[3] - a[3]) * f];
  };

  // Colour → value. Finds the closest legend colour; returns null if the colour is not on the legend at all
  // (grey borders, labels, grey picture bars, background), so those pixels make no sound.
  EJ.legendMatch = function (name, r, g, b) {
    var c = EJ.LEGENDS[name].colors, best = 1e9, bi = 0;
    for (var i = 0; i < c.length; i++) {
      var dr = r - c[i][1], dg = g - c[i][2], db = b - c[i][3], d = dr * dr + dg * dg + db * db;
      if (d < best) { best = d; bi = i; }
    }
    return best > 50 * 50 ? null : c[bi][0];
  };

  // A CSS gradient showing the legend (used for the strip under the picture and on the menu cards).
  EJ.legendCss = function (name) {
    var L = EJ.LEGENDS[name], c = L.colors, n = c.length, s = [];
    function rgb(e) { return 'rgb(' + e[1] + ',' + e[2] + ',' + e[3] + ')'; }
    c.forEach(function (e, i) {
      if (L.discrete) s.push(rgb(e) + ' ' + (i / n * 100) + '%', rgb(e) + ' ' + ((i + 1) / n * 100) + '%');
      else s.push(rgb(e) + ' ' + (i / (n - 1) * 100) + '%');
    });
    return 'linear-gradient(to right,' + s.join(',') + ')';
  };
})();
