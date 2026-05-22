# CyberPlayer Design System

## Aesthetic
Retro CRT terminal / cyberpunk — dark scanline background, glowing neon text, monospace fonts.
Matches the "Cyber Protocol" music player screenshot.

## Typography
- **Primary font**: "Share Tech Mono" (Google Fonts) — monospace, retro terminal feel
- **Fallback**: "Courier New", monospace
- **All text uppercase** for that terminal/arcade vibe
- **Font sizes**: Track list ~14px, Now Playing title ~24px, timer ~32px

## Color Palette
- **Background**: #0a0a0f (near-black with slight blue)
- **Cyan/Teal (primary accent)**: #00fff0 — waveform, active track highlight, visualizer glow
- **Magenta/Red (secondary accent)**: #ff0040 — controls (play/pause/stop), progress bar, bottom line
- **Dark panel**: #0d1117 — card/panel backgrounds
- **Muted text**: #334455 — inactive/secondary text
- **Track list text**: #00ccaa (dimmer cyan)
- **Active track**: #00fff0 (bright cyan, with glow)

## Layout (matching screenshot)
- Full-screen dark background with CRT scanline overlay
- **Left side (~40%)**: Scrollable track list — track name + duration
- **Right side (~60%)**: Now playing panel with:
  - Track title at top
  - Audio waveform/visualizer in center (cyan bars)
  - Countdown timer (negative time remaining)
  - Progress bar (red/magenta)
  - Play / Pause / Stop buttons (red squares/icons)
- **Bottom bar**: Status line with hints
- **Top bar** (for admin): Upload button when logged in

## Effects
- CRT scanline overlay (CSS pseudo-element with repeating gradient)
- Glow effect on active elements (text-shadow / box-shadow with cyan/red)
- Subtle flicker animation on title
- No rounded corners — sharp edges only (border-radius: 0)

## Anti-download measures
- Audio streamed via server endpoint, no direct R2 URLs
- `controlsList="nodownload"` on any audio elements
- Right-click disabled on player area
- Blob URLs for audio source
- No Content-Disposition: attachment headers
