# Music Wave Vision Under Thunder

A browser-based music visualizer that maps audio energy onto a city skyline. Building windows light up like spectrum bars, clouds drift across the sky, and lightning flashes in response to the selected rhythm band.

## Features

- Local audio file playback through the Web Audio API.
- Canvas-rendered skyline, clouds, lightning, water glow, and idle waveform.
- City image backdrop with configurable building window regions.
- Bass, Mid, and Treble meters.
- Two audio analysis modes:
  - `Classic`: simple Bass/Mid/Treble frequency bands.
  - `Vizzy-like`: log-spaced multi-band analysis with spectral-flux style hit detection.
- Adjustable lightning brightness and frequency.
- Offline beat detection for a named building.
- Adjustable background brightness and cloud visibility.
- Selectable lightning rhythm source: Bass, Mid, or Treble.
- Collapsible advanced settings panel.
- Spacebar playback toggle after an audio file is selected.

## Run

This project has no build step and no package dependencies.

```powershell
python -m http.server 4173 --bind 127.0.0.1
```

Then open:

```text
http://127.0.0.1:4173/index.html
```

You can also open `index.html` directly, but using a local server is more reliable across browsers.

## Basic Use

1. Click the music-note icon to choose a local audio file.
2. After the file is chosen, focus automatically moves to the play button.
3. Press Enter, click the play icon, or press Space to play/pause.
4. Click the image icon to choose another city skyline image.
5. Use the settings chevron to expand or collapse advanced controls.

## Controls

- `Classic / Vizzy-like`: switches between the original simple frequency mode and the more transient-aware mode.
- `Lightning Brightness`: controls bolt glow and flash intensity.
- `Lightning Frequency`: controls how often lightning appears. The center is `1x`; each step left halves the frequency, and each step right doubles it.
- `Base Background Brightness`: controls the non-lightning brightness of the skyline and sky.
- `Cloud Visibility`: fades clouds from hidden to visible.
- `Vizzy Sensitivity`: controls how strongly Vizzy-like mode responds to sudden audio changes.
- `Vizzy Bands`: controls the number of log-spaced analysis bands used by Vizzy-like mode.
- `Sky Title`: shows or hides the animated title in the sky.
- `Sky Title Text`: changes the sky title text. The default is `Music Wave Visualization With Skyline`.
- `Sky Title Rhythm`: chooses which beat track controls title color speed and subtle brightness.
- `Beat Buildings`: maps several detected beat tracks to buildings by `imageBuildings` `name`. Leave a building name empty to disable that track.
- `Detect Beats`: estimates BPM and beat offset for Main, Kick, Backbeat, and Hats tracks from the chosen audio file.
- Beat track `BPM` and `Offset`: allow manual correction after detection.
- `Lightning Rhythm`: chooses whether Bass, Mid, or Treble drives lightning.

## Audio Analysis

### Classic Mode

Classic mode keeps the original approach:

- Bass: `35-250Hz`
- Mid: `250-2600Hz`
- Treble: `2600-12000Hz`

Each range is averaged and smoothed. This is simple and stable, but it can blur rhythm because sustained notes, reverb, and percussion are mixed together inside broad frequency bands.

### Vizzy-like Mode

Vizzy-like mode keeps the existing UI model but analyzes audio with more detail:

- Creates log-spaced bands from `35Hz` to `12000Hz`.
- Measures energy per band.
- Compares the current frame against the previous frame.
- Uses a moving baseline to detect sudden increases.
- Produces hit values that are used for building lights and lightning triggers.

This does not isolate instruments directly, but it reacts more like musical transients: kicks, snares, hi-hats, plucks, and other attacks.

## Sky Title

The sky title is drawn on the canvas, above the skyline. Its white stroke and shadow stay fixed, while the inner fill uses a 720px repeating hue pattern: every 2px advances one hue step, so all 360 hue values complete one cycle.

The fill pattern moves from right to left. Its speed is scaled from `1` to `8` by the selected beat track pulse, and its brightness changes subtly with the same pulse.

## City Building Mapping

The city image is drawn from `city-skyline.png` by default. The `imageBuildings` array in `app.js` defines where building windows should be drawn.

Each object uses image-relative coordinates:

```js
{ name: "7", x: 0.348, y: 0.818, width: 0.099, height: 0.34, cols: 8, rows: 16 }
```

Meaning:

- `name`: stable building identifier used by `Beat Buildings`.
- `x`: left edge of the building, as a fraction of image width.
- `y`: bottom edge of the building, as a fraction of image height.
- `width`: building width, as a fraction of image width.
- `height`: building height, as a fraction of image height.
- `cols`: number of window columns.
- `rows`: number of window rows.

Internally, the top edge is calculated as:

```js
topY = y - height
```

You can replace numeric names with your own labels, for example:

```js
{ name: "BHP", x: 0.348, y: 0.818, width: 0.099, height: 0.34, cols: 8, rows: 16 }
```

Then enter `BHP` in one of the `Beat Buildings` name fields and click `Detect Beats`.

## Beat Detection

The beat detector runs after an audio file is selected and `Detect Beats` is clicked. It:

- decodes the selected audio file locally in the browser,
- renders several filtered versions offline,
- builds onset-style energy envelopes,
- estimates BPM with autocorrelation,
- estimates an initial beat offset from the strongest early beat grid,
- fills four editable beat tracks:
  - `Main`: low-frequency and mid-frequency combined pulse.
  - `Kick`: low-frequency drum pulse.
  - `Backbeat`: mid-frequency attack pulse for snare, claps, or rhythmic instruments.
  - `Hats`: high-frequency pulse for hi-hats, shakers, and bright percussion.

The detected BPM and offset can be manually adjusted per track. A track only renders when its building name is filled in. Matching buildings receive a pulse on that track while playback runs.

## Files

- `index.html`: page structure and controls.
- `styles.css`: layout, controls, responsive behavior, and icon styling.
- `app.js`: audio analysis, animation, skyline mapping, lightning, clouds, and playback.
- `city-skyline.png`: default city skyline image.
- `rules.md`: UI maintenance rules for the collapsible controls.

## UI Rules

The main control bar should only keep always-needed controls visible:

- title
- audio picker
- city image picker
- play/pause
- settings collapse button

Advanced settings belong inside `#advancedControls`, including mode toggles, range sliders, radio groups, and future checkboxes. See `rules.md` for the maintained rule list.

## Notes

- The app runs fully in the browser.
- Audio files remain local to the user’s machine.
- Some visual timing depends on browser rendering performance.
- Vizzy-like mode is inspired by multi-band music visualizer behavior, not by source-separated instrument detection.
