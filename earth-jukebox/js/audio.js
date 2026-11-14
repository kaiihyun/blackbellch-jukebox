// audio.js — the sound engine (Web Audio API). Nothing here touches the picture.
// It reads EJ.map().voice (maps.js) for every setting, so each map type can sound different
// without this file needing to know which map type is selected.
//
// What you hear, for every map type:
//   • PAD    → two slightly detuned waves per row, through a shared filter.
//              Driven by EJ.rowHeat / EJ.meanHeat. Louder, brighter and buzzier as that rises.
//   • DROPS  → short notes, either a falling "drip" or a steady glassy "chime" with a bell overtone.
//              Driven by EJ.rowRain / EJ.meanRain, at a tempo that depends on the map (voice.tempoFrom).
//   • HISS   → filtered noise bed (rain, wind, or a snowy hush), loudness from EJ.meanRain.
//   • DRONE  → two quiet sines (A + E) so a calm area is never totally silent.
// Every voice can be muted independently from EJ.layers (set by the Instruments toggle buttons in
// app.js). The two NOTE layers (EJ.layers.notesWarm / notesCold) are gated earlier, in app.js, by
// zeroing the row data this file reads — so this file only ever has to care about INSTRUMENTS.
EJ.audio = (function () {
  var R = EJ.R;
  var ac = null;                       // the AudioContext (created on first Play; browsers need a click first)
  var master, pan, revSend, lowpass, noiseGain;
  var voices = [];                     // one pad voice per row
  var drones = [];                     // the quiet drone oscillators' gain nodes (toggled by EJ.layers.drone)
  var nextTime = 0;                    // when the next drop step is due
  var A = { playing: false };          // public object; A.playing is read by app.js

  var SCALE = [0, 2, 4, 7, 9];         // A major pentatonic: any combination sounds pleasant

  // Frequency of note number i (0 = lowest) starting from MIDI note `base`.
  // 5 notes per octave, so i=5 is exactly one octave above i=0.
  function noteFreq(i, base) {
    var midi = base + Math.floor(i / 5) * 12 + SCALE[i % 5];
    return 440 * Math.pow(2, (midi - 69) / 12);
  }

  // Create every audio node once, the first time the user presses Play.
  function build() {
    var AC = window.AudioContext || window.webkitAudioContext;
    ac = new AC();

    // Output chain: master volume → stereo pan → compressor (keeps peaks tame) → speakers
    master = ac.createGain();
    master.gain.value = 0.7;
    pan = ac.createStereoPanner();
    var comp = ac.createDynamicsCompressor();
    master.connect(pan); pan.connect(comp); comp.connect(ac.destination);

    // Reverb: a 2.4 s burst of noise that fades out, used as an "impulse response".
    var sr = ac.sampleRate, len = Math.floor(sr * 2.4), ib = ac.createBuffer(2, len, sr);
    for (var c = 0; c < 2; c++) {
      var data = ib.getChannelData(c);
      for (var i = 0; i < len; i++) data[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 2.6);
    }
    var reverb = ac.createConvolver(); reverb.buffer = ib;
    revSend = ac.createGain(); revSend.gain.value = 0.45; // set per map type in applyVoice()
    revSend.connect(reverb); reverb.connect(master);

    // Pad: all voices share one low-pass filter (opens up as the pad amount rises).
    lowpass = ac.createBiquadFilter();
    lowpass.type = 'lowpass'; lowpass.Q.value = 2; lowpass.frequency.value = 300;
    var padVerb = ac.createGain(); padVerb.gain.value = 0.25;
    lowpass.connect(master); lowpass.connect(padVerb); padVerb.connect(revSend);

    for (var r = 0; r < R; r++) {
      var g = ac.createGain(); g.gain.value = 0; g.connect(lowpass); // silent until the pad amount rises
      var a = ac.createOscillator(), b = ac.createOscillator(), f = noteFreq(r, 33); // A1 upward
      a.type = b.type = 'sawtooth'; // changed per map type in applyVoice()
      a.frequency.value = b.frequency.value = f;
      a.connect(g); b.connect(g); a.start(); b.start();
      voices.push({ g: g, b: b, a: a }); // keep gain (loudness), oscillator b (detune) and a (wave type)
    }

    // Drone: two quiet sines on A1 and E2. Kept at a fixed 0.03 level; EJ.layers.drone just
    // scales that in A.update() below, so toggling it fades smoothly instead of clicking.
    [55, 82.41].forEach(function (f) {
      var o = ac.createOscillator(), g = ac.createGain();
      o.frequency.value = f; g.gain.value = 0;
      o.connect(g); g.connect(master); o.start();
      drones.push(g);
    });

    // Noise bed (rain / wind / snow hush): looping white noise → band-pass filter → gain.
    var nb = ac.createBuffer(1, sr * 2, sr), nd = nb.getChannelData(0);
    for (var k = 0; k < nd.length; k++) nd[k] = Math.random() * 2 - 1;
    var ns = ac.createBufferSource(); ns.buffer = nb; ns.loop = true;
    var bp = ac.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = 3500; bp.Q.value = 0.6;
    noiseGain = ac.createGain(); noiseGain.gain.value = 0;
    ns.connect(bp); bp.connect(noiseGain); noiseGain.connect(master); ns.start();

    applyVoice(); // pick up the voice settings for the map type already selected
  }

  // Switch the wave type and reverb amount to match the currently selected map (maps.js).
  // Called when Play starts, and again whenever the map type changes while already playing.
  function applyVoice() {
    if (!ac) return;
    var v = EJ.map().voice;
    voices.forEach(function (voice) { voice.a.type = voice.b.type = v.pad; });
    revSend.gain.setTargetAtTime(v.reverb, ac.currentTime, 0.3);
  }
  A.applyVoice = applyVoice;

  // Play one "drop" (a drip or a chime) on note i at time `when`. vel (0..1) is its strength.
  function drop(i, when, vel) {
    var v = EJ.map().voice, ice = v.chime === 'ice';     // 'ice' → steady glassy chime, 'drip' → falling drip
    var o = ac.createOscillator(), g = ac.createGain(), f = noteFreq(i, v.base);
    o.type = 'sine';
    // A drip starts a bit high and falls quickly; a chime keeps one steady pitch.
    o.frequency.setValueAtTime(ice ? f : f * 1.35, when);
    o.frequency.exponentialRampToValueAtTime(f, when + 0.07);
    // Volume: instant attack, then a long fade out (1.4 s).
    g.gain.setValueAtTime(0, when);
    g.gain.linearRampToValueAtTime((0.03 + 0.14 * vel) * v.dropGain, when + 0.005);
    g.gain.exponentialRampToValueAtTime(0.0008, when + 1.4);
    o.connect(g); g.connect(master); g.connect(revSend);
    o.start(when); o.stop(when + 1.5);
    if (ice) {
      // A quiet overtone at 2.76× the pitch that fades faster. That in-between partial is what makes it ring like glass.
      var o2 = ac.createOscillator(), g2 = ac.createGain();
      o2.type = 'sine'; o2.frequency.value = f * 2.76;
      g2.gain.setValueAtTime(0, when);
      g2.gain.linearRampToValueAtTime((0.012 + 0.05 * vel) * v.dropGain, when + 0.003);
      g2.gain.exponentialRampToValueAtTime(0.0005, when + 0.7);
      o2.connect(g2); g2.connect(master); g2.connect(revSend);
      o2.start(when); o2.stop(when + 0.8);
    }
  }

  // Runs every 30 ms. Schedules drops slightly ahead of time so the rhythm stays steady.
  // Each step is an eighth note at EJ.tempo (set every frame in app.js from the map's tempo range).
  setInterval(function () {
    if (!A.playing || !ac) return;
    var step = 60 / EJ.tempo / 2;
    while (nextTime < ac.currentTime + 0.15) {
      var n = 0; // at most 4 drops per step, to avoid a wall of sound
      for (var r = 0; r < R && n < 4; r++) {
        var amt = EJ.layers.drops ? EJ.rowRain[r] : 0;
        // Chance of a drop on this row = how strong the drops amount is. Row 0 is the TOP of the
        // picture = highest note. The 'drops' instrument toggle silences this whole branch.
        if (amt > 0 && Math.random() < amt * 0.45) {
          drop(R - 1 - r, nextTime + Math.random() * 0.03, amt); // tiny random offset sounds more natural
          n++;
        }
      }
      nextTime += step;
    }
  }, 30);

  // ---- Public controls used by app.js ----
  A.start = function (volume) {
    if (!ac) build();
    if (ac.state === 'suspended') ac.resume();
    applyVoice();
    master.gain.value = volume;
    nextTime = ac.currentTime + 0.05;
    A.playing = true;
  };
  A.stop = function () {
    A.playing = false;
    if (!ac) return;
    var now = ac.currentTime;
    for (var i = 0; i < R; i++) voices[i].g.gain.setTargetAtTime(0, now, 0.06); // fade pad out
    noiseGain.gain.setTargetAtTime(0, now, 0.1);                                // fade hiss out
  };
  A.setVolume = function (v) { if (master) master.gain.value = v; };

  // Called every frame while playing. pos is 0..1 (left..right) and drives the stereo pan.
  // setTargetAtTime glides to the new value, which avoids clicks.
  A.update = function (pos) {
    var v = EJ.map().voice, now = ac.currentTime;
    for (var r = 0; r < R; r++) {
      var voice = voices[R - 1 - r];                                    // top row → highest voice
      // The 'pad' instrument toggle silences this voice outright, whatever the row's data says.
      voice.g.gain.setTargetAtTime(EJ.layers.pad ? EJ.rowHeat[r] * 0.05 : 0, now, 0.06);
      voice.b.detune.setTargetAtTime(v.detune[0] + EJ.meanHeat * (v.detune[1] - v.detune[0]), now, 0.1);
    }
    lowpass.frequency.setTargetAtTime(v.cutoff[0] + EJ.meanHeat * (v.cutoff[1] - v.cutoff[0]), now, 0.1);
    // The 'noise' instrument toggle silences the rain/wind/hush bed outright.
    noiseGain.gain.setTargetAtTime(EJ.layers.noise ? EJ.meanRain * v.hiss : 0, now, 0.15);
    // The 'drone' instrument toggle fades the two background sines in or out.
    drones.forEach(function (g) { g.gain.setTargetAtTime(EJ.layers.drone ? 0.03 : 0, now, 0.2); });
    pan.pan.setTargetAtTime(pos * 1.6 - 0.8, now, 0.05);                 // left → right
  };

  return A;
})();
