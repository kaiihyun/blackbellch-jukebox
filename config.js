/* ============================================================
   EARTH JUKEBOX CONFIG. Change things here, not in app.js.
   ============================================================ */
window.CONFIG = {

  /* --- GRID: how coarsely we look at each frame (columns x rows) --- */
  grid: { cols: 18, rows: 9 },

  /* --- BANDS: only used for the written description and the table now.
     Rows count from the top (north) to the bottom (south). --- */
  bands: [
    { name: "Northern latitudes", rowStart: 0, rowEnd: 3 },
    { name: "Tropics",            rowStart: 3, rowEnd: 6 },
    { name: "Southern latitudes", rowStart: 6, rowEnd: 9 }
  ],

  /* --- MUSIC: each frame is played as a west-to-east sweep --- */
  sweepMs: 4000,            // how long one sweep takes (one frame per sweep)
  maxNotesPerColumn: 2,     // strongest notes kept per map column (keeps it clear)
  scale: [0, 2, 4, 7, 9],   // pentatonic: sounds pleasant in any combination
  octaves: 3,               // pitch range from south (low) to north (high)
  lowMidi: 48,              // note for the southernmost row (60 = middle C)
  volume: 0.7,
  // legend "type" -> sound. "pluck" = soft plucked, "bell" = glassy bell.
  timbres: { liquid: "pluck", frozen: "bell", temperature: "pluck", default: "pluck" },

  /* --- LISTENING: the artistic choices.
     Fixed in app.js: east-west = left-right ear (the sweep), latitude = pitch, intensity = loudness. --- */
  listen: {
    mode: "cycle",          // "cycle" = one latitude band per sweep, "all", or a band number 0, 1, 2
    invertPitch: false,     // false: north = high notes. true: north = low notes
    panWidth: 0.9,          // 0 = mono, 1 = hard left and right
    loudness: [0.1, 0.45],  // quietest and loudest note
    reverb: 0.12            // 0 = dry, 0.3 = roomy
  },

  /* --- ANALYSIS: how pixels become values --- */
  analysis: {
    width: 720,
    samplesPerTile: 6,
    maxColorDistance: 40,   // raise to 60 if too few tiles light up
    minCoverage: 0.15,
    wetMin: 0.1,
    dryColor: null,
    dryTolerance: 30,
    noDataColor: null
  },

  /* --- ACCESSIBILITY --- */
  announceEveryBeats: 4,    // screen reader summary every N sweeps

  /* --- PROXY --- */
  proxyPath: "/proxy?url=",

  /* --- PRESETS --- KEEP YOUR OWN PATHS HERE if you already set them.
     Put the downloaded files in an assets folder next to index.html. */
  presets: [
    {
      name: "IMERG precipitation",
      videoUrl: "assets/precip.mp4",
      mapCrop: { x: 0, y: 0, w: 1, h: 1 },
      legends: [
        { label: "Liquid precipitation", type: "liquid", url: "assets/rainlegend.png", min: 0.1, max: 50, scale: "log",
          orientation: "horizontal-lowleft", crop: { x: 0, y: 0, w: 1, h: 1 } },
        { label: "Frozen precipitation", type: "frozen", url: "assets/snowlegend.png", min: 0.1, max: 50, scale: "log",
          orientation: "horizontal-lowleft", crop: { x: 0, y: 0, w: 1, h: 1 } }
      ]
    },
    {
      name: "Near-Surface Temperature",
      videoUrl: "assets/lst.mp4",
      mapCrop: { x: 0, y: 0, w: 1, h: 1 },
      wetMin: -1000,   // temperature has no "dry": every colored pixel makes sound
      legends: [
        { label: "Temperature in Celsius", type: "temperature", url: "assets/lstlegend.png", min: -40, max: 40, scale: "linear",
          orientation: "horizontal-lowleft", crop: { x: 0, y: 0, w: 1, h: 1 } }
      ]
    }
  ]
};
