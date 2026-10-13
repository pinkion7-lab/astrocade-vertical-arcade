# Aurora Vault

A polished vertical arcade game inspired by the feel of Astrocade-style compact play loops: short runs, satisfying pickups, repeatable upgrades, touch and keyboard support, local save, daily rewards, and mission loops.

## Play locally

Open `index.html` in a modern browser.

For a cleaner local server, run:

```bash
python -m http.server 8000
```

Then open:

```text
http://localhost:8000
```

## Features

- Portrait gameplay optimized for mobile and desktop
- Touch controls plus keyboard/mouse support
- Local save and "continue" data using browser storage
- Daily reward claim and mission tracking
- Upgrade progression and replayable run loop
- Performance-oriented canvas rendering for lower-end phones
- English-only UI and text

## Design intent

The game focuses on a short-session, high-loop, low-friction arcade rhythm:

- quick starts and instant feedback
- collectible crystal loop for score and progression
- challenge spikes via obstacle timing
- reward structures that feel rewarding without needing long sessions
- persistent progression between play sessions

## Thumbnail generation

A script is included at `generate_thumbnail.py` to create an animated GIF reference thumbnail under the requested size budget when run on a machine with Pillow installed:

```bash
python generate_thumbnail.py
```

This produces a 480x800 animated GIF suitable for a game promo card.

## Files

- `index.html` — game shell and overlays
- `style.css` — polished responsive UI and layout
- `game.js` — core arcade gameplay, save logic, missions, HUD, and controls
- `generate_thumbnail.py` — animated thumbnail generator

## Notes

This version is intentionally designed to be lightweight and self contained so it can run immediately without external dependencies or asset downloads.

If you want a more advanced follow-up version, I can extend it with:

- richer enemy patterns
- boss waves
- sound and music synthesis
- animated splash screens
- better art pass with custom sprite sheets
- PWA install support

