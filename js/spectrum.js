// spectrum.js — the "Sounds playing now" panel under the big picture: one live spectrum bar per
// instrument layer (Pad, Drops, Noise bed, Drone), each with its name and a Mute button.
// The bars are the real sound of each layer (audio.js taps each one with an analyser).
// Mute flips the same flag as the Instruments toggle buttons, so the two always agree.
(function () {
  var N = 32, box = document.getElementById('specRows'), rows = [];
  var LAYERS = [
    { key: 'pad', name: 'Pad', color: 'rgb(255,106,69)', note: function (v) { return v.pad + ', ' + v.scale; } },
    { key: 'drops', name: 'Drops', color: 'rgb(74,168,255)', note: function (v) { return (v.chime === 'ice' ? 'ice chime' : 'drip') + ', ' + v.scale; } },
    { key: 'noise', name: 'Noise bed', color: 'rgb(110,190,160)', note: function () { return 'rain, wind or hush'; } },
    { key: 'drone', name: 'Drone', color: 'rgb(169,155,255)', note: function () { return 'A + E'; } }
  ];
  LAYERS.forEach(function (L) {
    var row = document.createElement('div'); row.className = 'srow';
    var label = document.createElement('div'); label.className = 'slabel';
    label.innerHTML = '<b>' + L.name + '</b><small></small>';
    var cv = document.createElement('canvas'); cv.width = 256; cv.height = 32; cv.setAttribute('aria-hidden', 'true');
    var btn = document.createElement('button'); btn.className = 'smute'; btn.setAttribute('aria-label', 'Mute ' + L.name);
    btn.onclick = function () { EJ.layers[L.key] = !EJ.layers[L.key]; EJ.ui.syncToggles(); };
    row.appendChild(label); row.appendChild(cv); row.appendChild(btn); box.appendChild(row);
    rows.push({ L: L, row: row, ctx: cv.getContext('2d'), cv: cv, btn: btn, small: label.querySelector('small'), data: new Float32Array(N), muted: null, txt: '' });
  });

  // Called every frame by app.js.
  EJ.spectrum = {
    draw: function (playing) {
      var v = EJ.map().voice;
      document.getElementById('specHint').style.display = playing ? 'none' : '';
      rows.forEach(function (r) {
        var on = EJ.layers[r.L.key], txt = r.L.note(v);
        if (r.muted !== !on) { // only touch the page when something changed
          r.muted = !on; r.btn.textContent = on ? 'Mute' : 'Muted';
          r.btn.setAttribute('aria-pressed', on ? 'false' : 'true'); r.row.classList.toggle('off', !on);
        }
        if (r.txt !== txt) { r.txt = txt; r.small.textContent = txt; }
        EJ.audio.spectrum(r.L.key, r.data);
        var w = r.cv.width, h = r.cv.height, bw = w / N, c = r.ctx;
        c.clearRect(0, 0, w, h);
        c.fillStyle = on ? EJ.gcol[r.L.key] : 'rgb(128,134,160)'; c.globalAlpha = on ? 1 : 0.35;
        for (var i = 0; i < N; i++) { var bh = Math.max(2, r.data[i] * h); c.fillRect(i * bw + 1, h - bh, bw - 2, bh); }
        c.globalAlpha = 1;
      });
    }
  };
})();
