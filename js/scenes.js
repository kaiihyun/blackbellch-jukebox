// scenes.js — the built-in demo scenes (stylized stand-ins for NASA frames), grouped by map type.
// A scene is a function f(x, y, t): (x, y) is a point on a 0..1 map and t is time in seconds.
//   legend maps return ONE value in the legend's units (°C for temperatures, 0..1 for rain and snow)
//   'heatrain' scenes return [heat, rain], each 0..1
// The value is painted with the real legend colours, so a scene goes through exactly the same analysis as a real frame.
(function () {
  var cl = EJ.clamp01;
  // A soft round "blob" centred at (cx, cy) with radius r. y is doubled because the map is 2:1.
  function blob(x, y, cx, cy, r) { var dx = x - cx, dy = (y - cy) * 2; return Math.exp(-(dx * dx + dy * dy) / (r * r)); }
  function lat(y) { return Math.abs(y - 0.5) * 2; } // 0 at the equator, 1 at the poles

  EJ.SCENESETS = {
    temp: [
      { n: 'Heat dome', d: 'Stylized scene: a heat dome of 35 °C and more builds over two mild continents.',
        f: function (x, y, t) {
          var h = blob(x, y, 0.3 + 0.08 * Math.sin(t * 0.15), 0.4, 0.17 + 0.04 * Math.sin(t * 0.2)) + 0.8 * blob(x, y, 0.7, 0.55 + 0.05 * Math.sin(t * 0.3), 0.12);
          return 6 + 4 * Math.sin(x * 5 + t * 0.2) + 30 * cl(h * 1.2);
        } },
      { n: 'Polar plunge', d: 'Stylized scene: a pool of very cold air spills south from the pole.',
        f: function (x, y, t) {
          var c = blob(x, y, 0.5 + 0.12 * Math.sin(t * 0.2), 0.0, 0.4 + 0.05 * Math.sin(t * 0.3)) + 0.5 * blob(x, y, 0.15, 0.1, 0.2);
          return 14 - 58 * cl(c * 1.2) + 4 * Math.sin(x * 7 + t * 0.3);
        } },
      { n: 'Seasons', d: 'Stylized scene: warm equator, freezing poles, and a slow wave moving through.',
        f: function (x, y, t) { return 34 - 70 * Math.pow(lat(y), 1.2) + 5 * Math.sin(x * 9 + t * 0.4); } },
      { n: 'Quiet planet', d: 'Stylized scene: mild temperatures everywhere. Mostly drone, very little else.',
        f: function (x, y, t) { return 6 + 8 * Math.sin(x * 4 + t * 0.15) * Math.cos(y * 3 + t * 0.1); } }
    ],
    sst: [
      { n: 'Warm pool', d: 'Stylized scene: a pool of 35 °C water swells along the equator.',
        f: function (x, y, t) { return 29 - 31 * Math.pow(lat(y), 1.4) + 6 * blob(x, y, 0.62 + 0.05 * Math.sin(t * 0.2), 0.5, 0.2); } },
      { n: 'Gulf stream', d: 'Stylized scene: a warm current snakes through cold northern water.',
        f: function (x, y, t) { var d = (y - (0.62 - 0.35 * x + 0.03 * Math.sin(x * 12 + t * 0.5))) * 6; return 2 + 22 * y + 10 * Math.exp(-d * d); } },
      { n: 'Polar seas', d: 'Stylized scene: warm tropics, near-freezing poles, a gentle swell.',
        f: function (x, y, t) { return 30 - 33 * Math.pow(lat(y), 1.1) + 2 * Math.sin(x * 8 + t * 0.3); } }
    ],
    rain: [
      { n: 'Monsoon bands', d: 'Stylized scene: bands of heavy rain roll across a landmass.',
        f: function (x, y, t) { var b = 0.5 + 0.5 * Math.sin(x * 9 - y * 4 + t * 0.6), m = blob(x, y, 0.6, 0.5, 0.4) + 0.4 * blob(x, y, 0.2, 0.6, 0.15); return cl(b * b * m * 1.3); } },
      { n: 'Storm cell', d: 'Stylized scene: a storm with a violent core drifts across the map.',
        f: function (x, y, t) { var cx = 0.5 + 0.22 * Math.sin(t * 0.2), cy = 0.5 + 0.1 * Math.sin(t * 0.3); return cl(1.1 * blob(x, y, cx, cy, 0.13) + 0.6 * blob(x, y, cx, cy, 0.3)); } },
      { n: 'Light drizzle', d: 'Stylized scene: scattered light rain. A few gentle drips.',
        f: function (x, y, t) { return 0.3 * cl(0.5 + 0.5 * Math.sin(x * 11 + t * 0.3) * Math.cos(y * 7 - t * 0.2)) * blob(x, y, 0.5, 0.5, 0.5); } }
    ],
    snow: [
      { n: 'Blizzard', d: 'Stylized scene: heavy snow sweeps in from the north.',
        f: function (x, y, t) { return cl(1.2 * blob(x, y, 0.45 + 0.1 * Math.sin(t * 0.2), 0.22, 0.3) + 0.5 * blob(x, y, 0.8, 0.3, 0.15)); } },
      { n: 'Light flurries', d: 'Stylized scene: a few light flurries. Quiet and sparse.',
        f: function (x, y, t) { return 0.4 * cl(0.5 + 0.5 * Math.sin(x * 10 + t * 0.3) * Math.cos(y * 8 - t * 0.2)) * blob(x, y, 0.5, 0.35, 0.6); } },
      { n: 'Mountain snow', d: 'Stylized scene: snow clings to a mountain ridge and comes and goes.',
        f: function (x, y, t) { var d = (y - (0.45 + 0.12 * Math.sin(x * 6))) * 6; return 0.9 * Math.exp(-d * d) * (0.6 + 0.4 * Math.sin(t * 0.3 + x * 3)); } }
    ],
    heatrain: [
      { n: 'Heat dome', d: 'Stylized scene: a heat anomaly swells and drifts over two continents.',
        f: function (x, y, t) {
          var h = blob(x, y, 0.3 + 0.08 * Math.sin(t * 0.15), 0.4, 0.17 + 0.04 * Math.sin(t * 0.2)) + 0.8 * blob(x, y, 0.7, 0.55 + 0.05 * Math.sin(t * 0.3), 0.12) + 0.3 * blob(x, y, 0.5, 0.3, 0.1);
          return [cl(h * 1.2), 0];
        } },
      { n: 'Monsoon', d: 'Stylized scene: bands of heavy rain roll across a warm landmass.',
        f: function (x, y, t) {
          var b = 0.5 + 0.5 * Math.sin(x * 9 - y * 4 + t * 0.6), m = blob(x, y, 0.6, 0.5, 0.4) + 0.4 * blob(x, y, 0.2, 0.6, 0.15);
          return [0.25 * blob(x, y, 0.25, 0.35, 0.15), cl(b * b * m * 1.7)];
        } },
      { n: 'Drought and flood', d: 'Stylized scene: scorched ground in the west, storms gathering in the east.',
        f: function (x, y, t) {
          var dry = cl((0.5 - x) * 3 + 0.4 * Math.sin(y * 6 + t * 0.3)), wet = cl((x - 0.45) * 3) * (0.5 + 0.5 * Math.sin(x * 7 + y * 5 - t * 0.8));
          return [dry * 0.9, wet * 0.9];
        } },
      { n: 'Quiet planet', d: 'Stylized scene: mild, scattered patches. Mostly drone and a few drops.',
        f: function (x, y, t) { return [0.3 * blob(x, y, 0.35 + 0.1 * Math.sin(t * 0.2), 0.4, 0.12), 0.3 * blob(x, y, 0.7, 0.6 + 0.1 * Math.cos(t * 0.25), 0.14)]; } }
    ]
  };
  EJ.scenes = function () { return EJ.SCENESETS[EJ.dataType]; }; // scenes for the map type selected right now

  // Colour ramps for 'heatrain' scenes: [strength, [r, g, b]] stops. Strength 0 is the dark ocean colour.
  var DARK = [12, 16, 28];
  var HOT = [[0, DARK], [0.3, [110, 30, 35]], [0.65, [255, 80, 20]], [1, [255, 200, 40]]];
  var WET = [[0, DARK], [0.3, [18, 60, 150]], [0.65, [30, 130, 255]], [1, [110, 200, 255]]];
  function ramp(stops, v, d, i) { // write the colour for strength v into pixel data d at index i
    for (var k = 1; k < stops.length; k++) {
      if (v <= stops[k][0]) {
        var a = stops[k - 1], b = stops[k], u = (v - a[0]) / (b[0] - a[0]);
        for (var c = 0; c < 3; c++) d[i + c] = a[1][c] + (b[1][c] - a[1][c]) * u;
        return;
      }
    }
    for (var c2 = 0; c2 < 3; c2++) d[i + c2] = stops[stops.length - 1][1][c2];
  }

  // Draw scene number `index` at time t onto ctx. We draw a small 128×64 image, then stretch it (soft, smooth look).
  var off = document.createElement('canvas');
  off.width = EJ.SW; off.height = EJ.SH;
  var octx = off.getContext('2d'), img = octx.createImageData(EJ.SW, EJ.SH);

  EJ.paintScene = function (ctx, index, t) {
    var m = EJ.map(), f = EJ.scenes()[index].f, d = img.data, SW = EJ.SW, SH = EJ.SH;
    for (var y = 0; y < SH; y++) {
      for (var x = 0; x < SW; x++) {
        var v = f(x / SW, y / SH, t), i = (y * SW + x) * 4;
        if (m.legend) {
          // Rain and snow maps are empty where nothing falls: dark background (not on the legend, so silent).
          var c = (m.coverage === 'sparse' && v < 0.08) ? DARK : EJ.legendColor(m.legend, v);
          d[i] = c[0]; d[i + 1] = c[1]; d[i + 2] = c[2];
        } else {
          ramp(v[0] >= v[1] ? HOT : WET, Math.max(v[0], v[1]), d, i); // the stronger of heat or rain decides the colour
        }
        d[i + 3] = 255;
      }
    }
    octx.putImageData(img, 0, 0);
    ctx.imageSmoothingEnabled = true;
    ctx.drawImage(off, 0, 0, EJ.VW, EJ.VH);
  };
})();
