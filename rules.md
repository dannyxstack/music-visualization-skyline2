# UI Rules

- The main control bar should keep only always-needed controls visible: title, audio picker, city image picker, play/pause, and the settings collapse button.
- The settings collapse button controls `#advancedControls` and must update `aria-expanded`, `aria-label`, and `title`.
- The Vizzy mode toggle, all range sliders, and all radio/checkbox groups belong inside `#advancedControls`.
- Beat detection controls, including per-track beat building names, BPM, and offset inputs, belong inside `#advancedControls`.
- Beat tracks only render when their building name input is filled. Empty building name inputs must not affect any building.
- Sky title controls belong inside `#advancedControls`. When the sky title is disabled, it should not be drawn on the canvas.
- Lightning controls belong inside `#advancedControls`. When lightning is disabled, bolts, flash overlays, and flash-driven brightening should not be drawn.
- Star controls belong inside `#advancedControls`. Stars should render only in the sky area, all stars should move slowly left-to-right with a wide speed spread, 50% should twinkle, 50% should use nebula-tinted colors, and they should respect the configured count and speed.
- Building hover labels should use configured `imageBuildings` rectangles and show the matching `name`; they should not rely on image recognition and should be disabled during playback.
- When the panel is collapsed, `#advancedControls` should be hidden with the `.controls.is-collapsed` state.
- New visualizer settings should be added to `#advancedControls` by default unless they are required for basic playback.
- Every `imageBuildings` entry should have a stable `name` string. Default numeric names are acceptable, and user labels such as `BHP` can replace them.
