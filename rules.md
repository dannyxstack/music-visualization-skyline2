# UI Rules

- The main control bar should keep only always-needed controls visible: title, audio picker, city image picker, play/pause, and the settings collapse button.
- The settings collapse button controls `#advancedControls` and must update `aria-expanded`, `aria-label`, and `title`.
- The Vizzy mode toggle, all range sliders, and all radio/checkbox groups belong inside `#advancedControls`.
- When the panel is collapsed, `#advancedControls` should be hidden with the `.controls.is-collapsed` state.
- New visualizer settings should be added to `#advancedControls` by default unless they are required for basic playback.
