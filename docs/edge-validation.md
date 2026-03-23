# Edge Validation Checklist

## Build

- [ ] Run `bun run build`
- [ ] Load `.output/chrome-mv3` in Edge via `edge://extensions`

## Core Flows

- [ ] Side panel opens from toolbar action
- [ ] Shortcut `Alt+Shift+S` toggles side panel
- [ ] Embed tabs switch correctly
- [ ] API chat streams response tokens

## Feature Flows

- [ ] Page summarization works on a standard article page
- [ ] YouTube summarizer works on a video with captions
- [ ] PDF upload parses and adds context to chat
- [ ] OCR context menu appears on images and returns text to panel

## Settings / Theme / A11y

- [ ] Theme toggle (system/light/dark) works and persists
- [ ] API key save/clear works (encrypted storage)
- [ ] Test connection buttons show clear success/failure state
- [ ] Keyboard navigation works across tabs and controls

## Notes

Record any Edge-specific differences here before release.
