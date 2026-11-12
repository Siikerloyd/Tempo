# Tempo

A brutalist Pomodoro timer for deep work. Sharp edges, hard shadows, mechanical precision. Focus. Break. Repeat.

<p align="center">
  <img src="build/icon.png" alt="Tempo icon" width="96" height="96" />
  <br>
  <img src="https://img.shields.io/badge/version-1.0.0-orange?style=flat-square" alt="Version" />
  <img src="https://img.shields.io/badge/license-MIT-blue?style=flat-square" alt="License" />
  <img src="https://img.shields.io/badge/platform-Windows%20%7C%20macOS%20%7C%20Linux-lightgrey?style=flat-square" alt="Platform" />
  <br>
  <a href="https://github.com/Siikerloyd/Tempo/releases/latest">
    <img src="https://img.shields.io/badge/download-latest-brightgreen?style=for-the-badge&logo=github" alt="Download Latest" />
  </a>
</p>

**Tempo** is a compact desktop timer for the Pomodoro workflow, with focus and break phases, completion prompts, and an optional auto-start setting. Its neo-brutalist interface is designed to stay out of your way until you need it. No soft edges, no distractions—just a ticking clock and the discipline to sit with it.

## Download

Choose your operating system below to open the latest release, then download the matching file from its **Assets** list:

| Platform         | Release page                                                                | File to download                                          |
| ---------------- | --------------------------------------------------------------------------- | --------------------------------------------------------- |
| Windows (64-bit) | [Latest Tempo release](https://github.com/Siikerloyd/Tempo/releases/latest) | `tempo-<version>-setup.exe`                               |
| macOS            | [Latest Tempo release](https://github.com/Siikerloyd/Tempo/releases/latest) | `tempo-<version>.dmg`                                     |
| Linux (x86_64)   | [Latest Tempo release](https://github.com/Siikerloyd/Tempo/releases/latest) | `tempo-<version>.AppImage` or `tempo_<version>_amd64.deb` |

Replace `<version>` with the release version shown on the page (for example, `1.0.0`). macOS also includes an Apple Silicon ZIP build when available. After downloading, open the installer or package for your operating system and follow its installation prompts.

---

## The Workflow

Tempo follows a four-focus-session cycle. At the end of each phase it sounds an alarm and offers the next phase; you can start it or skip it. If **Auto-start next phase** is enabled, Tempo starts the suggested phase automatically.

```
FOCUS (25m) → BREAK (5m) → FOCUS (25m) → BREAK (5m) → FOCUS (25m) → BREAK (5m) → FOCUS (25m) → LONG (15m) → repeat
```

- **Focus**: Your deep work session. Orange ring, orange glow, attitude: "IN THE ZONE"
- **Break**: Short rest. Teal ring, attitude: "RECHARGE"
- **Long**: Extended rest after 4 focus sessions. Violet ring, attitude: "DEEP REST"

The four-square session cycle is saved across launches. A square fills only when a Focus timer reaches zero; resetting before it finishes does not count. Breaks do not fill squares. After four completed Focus sessions, Tempo suggests a Long Break. The cycle resets when that Long Break finishes or is skipped.

---

## Features

**Timer Engine**

- Circular progress ring with time markers that fade as time passes
- Compact tabular timer digits with hours shown only for durations of one hour or more
- Urgent animation during the final minute and a subtle pulse during the final 10 seconds
- Circular progress ring and bottom progress bar show elapsed session progress
- Energy glow intensifies as the session progresses

**Pomodoro System**

- Three modes: Focus (25m), Break (5m), Long (15m)
- Completion prompts name the phase that ended and offer the suggested next phase; auto-start is optional
- Session squares track completed and upcoming Focus rounds in the persisted 4-session cycle
- Daily stats show completed Focus sessions and focus time for today, the current consecutive-day streak, and a 7-day focus-time chart
- Daily totals roll over at local midnight; stats history is kept for the last seven local calendar days
- Mode-based color palette shifts (orange → teal → violet)

**Visual Personality**

- State microcopy for idle, paused, running, urgent, and alarm states
- Glitch effects on start, pause, and finish (chromatic aberration bursts)
- Play/pause icon morph (triangle ↔ bars) with smooth transition
- Sound wave animation when alarm is active

**Controls**

- Mode-specific presets (Focus: 15m, 25m, 45m, 1h; Break: 5m, 10m, 15m; Long: 15m, 20m, 30m)
- Custom duration: hours / minutes / seconds input
- Always-on-top pin, minimize, and close controls in the custom title bar
- Mini mode resizes the window to 200×88 and shows the timer with a progress bar; click the time to play or pause
- Fixed, non-resizable window: 450×370 in normal mode
- Remaining time and mode appear in the app/window title
- Keyboard shortcuts: Space to play/pause, R to reset, M to toggle mini mode, Esc to close Settings or Stats
- Brutalist button hover states (offset shadow lift)
- Press-into-shadow active feedback
- Custom alarm sound picker (saved to disk)
- Mute toggle with confirmation chirp
- Synthesized alarm fallback if MP3 fails
- Daily Stats can be opened from the Focus Today counter

**Technical**

- Single-instance app (second launch focuses existing window)
- Timer title updates with the remaining time and current phase
- `prefers-reduced-motion` disables decorative animations
- Cycle progress, daily stats, auto-start preference, and mini-mode preference are saved locally
- Custom alarm sound choice is saved in the app's user-data folder
- Timer mode and remaining time are not restored on relaunch; a new launch starts at the default Focus time
- Custom 512x512 desktop icon matching the timer design

---

## Automated Releases

The GitHub Actions release workflow builds Windows, macOS, and Linux packages on their respective runners. Push a version tag such as `v1.0.0` to trigger a release build; the workflow publishes the generated packages to GitHub Releases. You can also start the workflow manually from the repository's **Actions** tab.

---

## Design Philosophy

**Neo-Brutalist Aesthetic**

The interface uses hard edges, hard shadows, and high contrast as its visual foundation.

- **Borders**: Strong, high-contrast outlines
- **Shadows**: Hard offset shadows, without blur
- **Transitions**: A mix of crisp button feedback and smooth timer, progress, and theme transitions
- **Typography**: Monospace tabular numbers, uppercase labels, wide tracking
- **Colors**: Black (`#000`), White (`#FFF`), Orange (`#FF4F00`), plus mode accents

**Mode Palette**

| Mode  | Accent    | Track     | Attitude      |
| ----- | --------- | --------- | ------------- |
| Focus | `#FF4F00` | `#2A1A12` | "IN THE ZONE" |
| Break | `#00E5C7` | `#0B2A26` | "RECHARGE"    |
| Long  | `#A78BFA` | `#2E1D4D` | "DEEP REST"   |

**Typography**

- Timer: Monospace, tabular nums, `1.7rem`, tracking-tight
- Labels: Monospace, `10px`, uppercase, tracking-widest
- Buttons: Monospace, `9px`, uppercase, font-bold

**States**

| State         | Ring     | Color               | Microcopy                                       |
| ------------- | -------- | ------------------- | ----------------------------------------------- |
| Idle          | Full     | White               | "READY"                                         |
| Paused        | Dimmed   | White               | "PAUSED" / "HOLDING."                           |
| Running       | Draining | Orange/Teal/Violet  | "IN THE ZONE" / "RECHARGE" / "DEEP REST"        |
| Urgent (≤60s) | Pulsing  | Accent              | "ALMOST."                                       |
| Alarm         | Empty    | Current mode accent | Phase-specific completion and next-phase prompt |
| Edit          | Hidden   | —                   | —                                               |

---

## Tech Stack

<p align="center">
  <img src="https://img.shields.io/badge/Electron-47848F?style=for-the-badge&logo=electron&logoColor=white" alt="Electron" />
  <img src="https://img.shields.io/badge/React-20232A?style=for-the-badge&logo=react&logoColor=61DAFB" alt="React" />
  <img src="https://img.shields.io/badge/Tailwind_CSS-38B2AC?style=for-the-badge&logo=tailwind-css&logoColor=white" alt="Tailwind CSS" />
  <img src="https://img.shields.io/badge/Sharp-0288D1?style=for-the-badge&logo=sharp&logoColor=white" alt="Sharp" />
  <img src="https://img.shields.io/badge/Lucide-000000?style=for-the-badge&logo=lucide&logoColor=white" alt="Lucide" />
</p>

- **Electron**: Desktop wrapper, IPC, native dialogs
- **React**: Component state, hooks, rendering
- **Tailwind CSS**: Utility classes (extended with custom tokens)
- **Sharp**: Icon generation from SVG
- **Lucide React**: Icon set (BellRing, Flame, Play, Pause, etc.)

---

## Run Locally

<p align="center">
  <img src="https://img.shields.io/badge/Node.js-18%2B-339933?style=for-the-badge&logo=node.js&logoColor=white" alt="Node.js" />
  <img src="https://img.shields.io/badge/npm-9%2B-CB3837?style=for-the-badge&logo=npm&logoColor=white" alt="npm" />
</p>

```bash
cd Tempo
npm install
npm run dev    # Development with hot reload
npm start      # Production preview
```

---

## Package as Desktop App

Close any running dev window first.

```bash
# Windows installer
npm run build:win

# macOS
npm run build:mac

# Linux
npm run build:linux
```

Installers land in `dist/`. On Windows: `Tempo-1.0.0-setup.exe`.

Unpacked folder (no installer):

```bash
npm run build:unpack
```

---

## Project Structure

```text
src/
├── main/           Electron window, IPC, alarm file picker
├── preload/        Bridge to renderer
└── renderer/
    ├── src/
    │   ├── components/
    │   │   ├── Timer.jsx       # Main timer with modes, daily stats, effects
    │   │   ├── TopBar.jsx      # Title bar with pin/minimize/close
    │   │   └── inputField.jsx  # Time input component
    │   ├── assets/
    │   │   ├── logo.svg        # In-app timer logo
    │   │   ├── main.css        # Brutalist CSS tokens & animations
    │   │   └── audio/Alarm.mp3 # Default alarm sound
    │   ├── App.jsx             # Root component
    │   └── main.jsx            # Entry point
    └── index.html

build/              App icon (.png)
resources/          Window icon (.png)
```

---

## Acknowledgments

Built with using:

- Electron for desktop packaging
- React for component logic
- Tailwind CSS for utility styling
- Lucide for iconography

Design inspiration from the Pomodoro Technique and neo-brutalist UI movements.
