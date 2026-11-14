// sweeping.js — everything for the "Sweep across the frame" listening mode, in one place.
// A line travels west to east and loops. The sound comes from the 3 grid columns under it, panned
// left to right. (The other mode, "Listen to a chosen area", lives in app.js and analysis.js.)
//   EJ.sweep.restart()       start the sweep again from the left (Play, mode change, slider change)
//   EJ.sweep.position(ts,on) where the line is, 0..1 (0 when not playing). ts = frame time in ms
//   EJ.sweep.column(pos)     which grid column that position is over
//   EJ.sweep.levels(col)     pad and drops amount for each ROW from the 3 columns under the line
//   EJ.sweep.pan(pos)        stereo pan for that position, -0.8 (left) to +0.8 (right)
//   EJ.sweep.showLine(on,p)  show/move the white line on the picture and on the pixel grid
(function () {
  var C = EJ.C, R = EJ.R;
  function $(id) { return document.getElementById(id); }
  var t0 = 0; // time when the sweep last started

  EJ.sweep = {
    restart: function () { t0 = performance.now(); },

    // One full pass takes the "Sweep time" slider's number of seconds, then it loops.
    position: function (ts, playing) {
      return playing ? (((ts - t0) / 1000 / parseFloat($('dur').value)) % 1) : 0;
    },

    column: function (pos) { return Math.min(C - 1, Math.floor(pos * C)); },

    // Average the 3 columns under the line (col-1, col, col+1) for every row.
    levels: function (col) {
      for (var r = 0; r < R; r++) {
        var a = 0, b = 0, n = 0;
        for (var c = Math.max(0, col - 1); c <= Math.min(C - 1, col + 1); c++) {
          a += EJ.HH[r * C + c]; b += EJ.WW[r * C + c]; n++;
        }
        EJ.rowHeat[r] = a / n;
        EJ.rowRain[r] = b / n;
      }
    },

    pan: function (pos) { return pos * 1.6 - 0.8; },

    showLine: function (on, pos) {
      $('ph').style.display = on ? 'block' : 'none';
      $('ph2').style.display = on ? 'block' : 'none';
      if (on) $('ph').style.left = $('ph2').style.left = (pos * 100) + '%';
    }
  };

  // Sweep-time slider: update its label and restart the sweep. It does nothing in area mode.
  $('dur').addEventListener('input', function () {
    $('durO').textContent = $('dur').value + ' s';
    EJ.sweep.restart();
  });
  $('mode').addEventListener('change', function () {
    $('dur').disabled = $('mode').value === 'area';
    EJ.sweep.restart();
  });
})();
