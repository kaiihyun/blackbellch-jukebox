# Adding videos and legends

Everything you add lives in **presets.json**. Then run:

    python3 build_single_file.py

(Needs Python 3, `pip install pillow numpy`, and ffmpeg. The build re-encodes each video once and caches it in `.cache/`.)
It writes `js/generated-presets.js` and the one-file page `earth-jukebox.html`. Never edit `generated-presets.js` by hand.

## 1. New video on a map that already exists (temp, sst, nox, rain, snow, heatrain)

    { "id": "lst2", "name": "Temperature, July", "map": "temp",
      "video": "media/july.mp4", "video_options": { "width": 768, "crf": 26, "sweep": 24 } }

## 2. New legend + new video (a brand-new map type)

Put the video and the legend picture in `media/`, then copy the disabled "example" entry in presets.json and fill it in:

| key | meaning |
|---|---|
| id, name | `id` is a short code; `name` is the card title |
| video | path to the video (optional: leave out for a map with no preset) |
| video_options | `width` (768 default), `crf` (quality, 22 sharp to 30 small, 26 default), `sweep` seconds, `reencode` false = use the file as is, `check_time` second used for the frame check |
| legend.image | picture of the colour bar |
| legend.lo / hi | what the left and right ends mean. For a log scale (10⁻³ to 10¹) use `-3`, `1` and `"log10": true` |
| legend.units | shown in the readout, e.g. "ppbv" |
| legend.type | `auto` (default), `gradient` or `steps` |
| legend.tol | colour match tolerance, default 50. Use ~30 if black or grey no-data areas sound like the darkest legend colour |
| legend.bar | `{row, x0, x1}` pixel positions of the bar. Set it when the bar has white or black ends (auto-detect trims them) |
| labels | the two readout names: [pad, drops], e.g. ["Hum", "Ticks"] |
| pad, drops | `[from, to, curve]`: how loud each sound is across the legend. 0 = low end, 1 = high end. `from` > `to` makes it louder toward the low end. curve is `linear`, `sqrt`, `square` or `pow1.5` |
| like, voice | start from an existing map's sound (`like`) and override fields (`scale`, `chime`, `pad`, `cutoff`, `tempo`, `reverb`, `hiss` ...) |
| graph | optional: four legend values whose colours paint the Pad, Drops, Noise and Drone graphs |
| ticks, blurb, coverage | optional overrides: legend tick labels, menu text, `full` or `sparse` |

Set `"enabled": false` on any entry to skip it without deleting it.

## What the build tells you

For each video it prints "frame check: N% of grid cells match the legend". Cells that do not match stay silent (grey borders, labels, no-data).
Below ~60%, check `legend.lo/hi`, `legend.bar` or `legend.tol`, or that the video really uses that legend.
The page must stay under 16 MB to be hosted as an artifact. The build warns you. Lower `width` or raise `crf` if it does.
