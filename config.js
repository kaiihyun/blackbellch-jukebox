/* ============================================================
   EARTH JUKEBOX CONFIG. Change things here, not in app.js.
   ============================================================ */
window.CONFIG = {

  /* --- GRID: how coarsely we look at each frame (columns x rows) --- */
  grid: { cols: 18, rows: 9 },

  /* --- BANDS: used by the whole-map sweep, the description and the table.
     Rows count from the top (north) to the bottom (south). --- */
  bands: [
    { name: "Northern latitudes", rowStart: 0, rowEnd: 3 },
    { name: "Tropics",            rowStart: 3, rowEnd: 6 },
    { name: "Southern latitudes", rowStart: 6, rowEnd: 9 }
  ],

  /* --- PLACES: named spots for "One place" listening. lat: north is +, lon: east is +.
     Assumes the video is a whole flat world map (-180 to 180, 90 to -90). --- */
  places: [
    { name: "Equatorial Pacific (El Niño)", lat: 0,  lon: -145 },
    { name: "Philippines",                  lat: 10, lon: 123 },
    { name: "Amazon rainforest",            lat: -5, lon: -62 },
    { name: "Sahara desert",                lat: 23, lon: 12 },
    { name: "Congo basin",                  lat: 0,  lon: 22 },
    { name: "India",                        lat: 22, lon: 78 },
    { name: "Bay of Bengal",                lat: 15, lon: 88 },
    { name: "Gulf Stream",                  lat: 38, lon: -60 },
    { name: "Southern Ocean",               lat: -55, lon: 20 },
    { name: "Arctic Ocean",                 lat: 80, lon: 0 }
  ],
  spotMs: 250,              // one note every N ms while the video plays (one place)
  spotDeg: 12,              // size of the listening spot in degrees
  spotStep: 5,              // arrow keys move the spot by this many degrees

  /* --- MUSIC --- */
  sweepMs: 4000,            // whole-map mode: how long one west-to-east sweep takes
  maxNotesPerColumn: 2,     // whole-map mode: strongest notes kept per column
  scale: [0, 2, 4, 7, 9],   // pentatonic: sounds pleasant in any combination
  octaves: 3,               // pitch range
  lowMidi: 48,              // lowest note (60 = middle C)
  volume: 1.2,
  timbres: { liquid: "pluck", frozen: "bell", temperature: "bell", default: "pluck" },

  /* --- LISTENING ---
     view "spot": one place, one note every spotMs, pitch = value, for as long as the video plays.
     view "map": the whole map, swept west to east live, pitch = latitude. */
  listen: {
    view: "spot",
    mode: "cycle",          // map view only: "cycle", "all", or a band number 0, 1, 2
    invertPitch: false,     // false: higher value (or further north) = higher note
    panWidth: 0.9,          // 0 = mono, 1 = hard left and right
    loudness: [0.1, 0.45],  // quietest and loudest note
    reverb: 0.12
  },

  /* --- ANALYSIS: how pixels become values --- */
  analysis: {
    width: 720,
    samplesPerTile: 6,
    maxColorDistance: 70,
    minCoverage: 0.06,
    wetMin: 0.1,
    dryColor: null,
    dryTolerance: 30,
    noDataColor: null
  },

  /* --- ACCESSIBILITY --- */
  announceEveryBeats: 4,    // map view: screen reader summary every N sweeps

  /* --- DETAILS PANEL --- */
  info: { now: true, stats: true, bands: true, legends: true },

  /* --- LAST CARD: the upload slot (the form opens when you press Play on it) --- */
  upload: { name: "Upload your own", description: "Bring a video and a picture of its color bar. Hear any map move.",
            theme: { colors: ["#e5e5e5", "#737373", "#404040"], fixed: false }, videoUrl: "", legends: [] },

  proxyPath: "/proxy?url=",

  /* --- PRESETS. "place" = the named place chosen by default. --- */
  presets: [
    {
      name: "IMERG rain",
      description: "Rain across the planet, every 30 minutes. Louder and higher means heavier rain.",
      theme: { colors: ["#38bdf8", "#6366f1", "#a855f7"], fixed: false },
      videoUrl: "assets/precip.mp4",
      mapCrop: { x: 0, y: 0, w: 1, h: 1 },
      place: "Philippines",
      legends: [
        { label: "Liquid precipitation", type: "liquid", url: "assets/rainlegend.png", min: 0.1, max: 50, scale: "log",
          orientation: "horizontal-lowleft", crop: { x: 0, y: 0, w: 1, h: 1 } }
      ]
    },
    {
      name: "Near-Surface Temperature",
      description: "Temperature near the ground, from polar cold to desert heat. Higher notes mean hotter.",
      theme: { colors: ["#fb923c", "#ef4444", "#a855f7"], fixed: false },
      videoUrl: "assets/lst.mp4",
      mapCrop: { x: 0, y: 0, w: 1, h: 1 },
      wetMin: -1000,
      place: "Sahara desert",
      legends: [
        { label: "Temperature in Celsius", type: "temperature", url: "assets/lstlegend.png", min: -40, max: 40, scale: "linear",
          orientation: "horizontal-lowleft", crop: { x: 0, y: 0, w: 1, h: 1 } }
      ]
    },
    {
      name: "Sea Surface Temperature (SST)",
      description: "The temperature of the oceans over the past two and a half years. Higher notes mean warmer water.",
      theme: { colors: ["#fb923c", "#ef4444", "#2f42e8"], fixed: false },
      videoUrl: "assets/sst.mp4",
      mapCrop: { x: 0, y: 0, w: 1, h: 1 },
      wetMin: -1000,
      place: "Equatorial Pacific (El Niño)",
      legends: [
        { label: "Temperature in Celsius", type: "temperature", url: "assets/seatemplegend.png", min: -5, max: 35, scale: "linear",
          orientation: "horizontal-lowleft", crop: { x: 0, y: 0, w: 1, h: 1 } }
      ]
    }
  ]
};
