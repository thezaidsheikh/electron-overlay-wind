# 🪟 electron-overlay-wind

[![](https://img.shields.io/npm/v/electron-overlay-wind/latest?color=CC3534&label=electron-overlay-wind&logo=npm&labelColor=212121)](https://www.npmjs.com/package/electron-overlay-wind)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](https://opensource.org/licenses/MIT)

## 📋 Overview

A powerful library for creating transparent overlay windows that stay synchronized with target application windows. Designed specifically to complement Electron applications, this library enables you to create overlays for games, productivity tools, or any application where you need to display content on top of another window.

## ✨ Features

- 🔍 **Target Window Detection**: Find target windows by title
- 🔄 **Automatic Synchronization**: Keep position and size of overlay window in sync with target
- 📢 **Event System**: Rich lifecycle events for overlay management
- 🖥️ **Multi-Platform**: Support for Windows, Linux (X11), and macOS
- 🎮 **Game Overlay**: Perfect for creating game overlays, streaming tools, and more

![Demo](https://i.imgur.com/Ej190zc.gif)

## 📋 Special Thanks

Alexander Drozdov

## 📦 Installation

```bash
npm install electron-overlay-wind
# or
yarn add electron-overlay-wind
# or
pnpm add electron-overlay-wind
```

## 🚀 Quick Start

```javascript
const { app, BrowserWindow } = require("electron");
const { OverlayController, OVERLAY_WINDOW_OPTS } = require("electron-overlay-wind");

app.whenReady().then(() => {
  // Create an overlay window with recommended options
  const overlay = new BrowserWindow({
    ...OVERLAY_WINDOW_OPTS,
    width: 800,
    height: 600,
    webPreferences: {
      nodeIntegration: true,
    },
  });

  // Load your overlay content
  overlay.loadFile("index.html");

  // Attach to a target window by title
  OverlayController.attachByTitle(
    overlay,
    "Target Window Title", // e.g., 'Notepad' on Windows or 'Activity Monitor' on macOS
    { hasTitleBarOnMac: true } // Options
  );
});
```

## 📝 Important Notes

- ⚠️ You can have only one overlay window at a time
- ✅ Found target window remains "valid" even if its title changes after initial detection
- ✅ Correct behavior is guaranteed only for top-level windows
- ℹ️ On X11 (Linux), the library relies on EWHM, specifically `_NET_ACTIVE_WINDOW`, `_NET_WM_STATE_FULLSCREEN`, `_NET_WM_NAME`

## 🔧 API Reference

### `OverlayController`

The main controller object (singleton) for managing the overlay window.

#### Methods

##### `attachByTitle(electronWindow, targetWindowTitle, options)`

Attaches the overlay to a target window identified by its title.

- `electronWindow`: The Electron BrowserWindow to use as overlay (can be undefined for tracking-only mode)
- `targetWindowTitle`: The title of the window to attach to
- `options`: Optional configuration
  - `hasTitleBarOnMac`: Whether the target window has a title bar on macOS (default: false)

##### `activateOverlay()`

Makes the overlay window interactive (clickable).

##### `focusTarget()`

Restores focus to the target window and makes the overlay click-through.

##### `screenshot()` (Windows only)

##### `stop()`

Stops the overlay and detaches it from the target window.

Captures a screenshot of the target window. Returns a Buffer suitable for use with `nativeImage.createFromBitmap`.

#### Events

Access events via `OverlayController.events`:

- `attach`: Emitted when the overlay attaches to the target window
- `detach`: Emitted when the target window is closed or no longer valid
- `focus`: Emitted when the target window gains focus
- `blur`: Emitted when the target window loses focus
- `fullscreen`: Emitted when the target window enters or exits fullscreen mode
- `moveresize`: Emitted when the target window moves or resizes

### `OVERLAY_WINDOW_OPTS`

Recommended BrowserWindow options for overlay windows:

```javascript
const OVERLAY_WINDOW_OPTS = {
  fullscreenable: true,
  skipTaskbar: true, // except on Linux
  frame: false,
  show: false,
  transparent: true,
  resizable: true,
  hasShadow: false, // on macOS
  alwaysOnTop: true, // on macOS
};
```

## 💻 Supported Platforms

- ✅ Windows (7 - 11)
- ✅ Linux (X11)
- ✅ macOS

## 🛠️ Development

### Building for Release

```bash
pnpm run prebuild  # Build native modules
pnpm tsc           # Compile TypeScript
```

### Running the Demo

```bash
pnpm run demo:electron
```

This will build and run a demo app that demonstrates the overlay functionality. On Windows, it will attach to Notepad. On macOS, it will attach to Activity Monitor.

### Debugging Native Code

#### macOS

1. Create an XCode project: `node-gyp configure --debug -- -f xcode`
2. Change to debug mode: `node-gyp configure --debug`
3. Run the demo: `pnpm run demo:electron`
4. Open the project in XCode: `build/binding.xcodeproj`
5. Use "Debug > Attach to Process" to attach to the Electron process

### Recommended Dev Utils

- **Windows**: AccEvent (accevent.exe) and Inspect Object (inspect.exe) from Windows SDK
- **X11**: xwininfo, xprop, xev

## 🛠️ Tech Stack & Tools

### Core Dependencies

- **Node.js**: >= 16.0.0
- **Electron**: >= 18.0.0 (peer dependency)
- **TypeScript**: 5.x.x
- **N-API**: Native addon API

### Build Tools

- **node-gyp**: Native module build tool
- **node-gyp-build**: 4.x.x
- **prebuildify**: 6.x.x (cross-platform prebuilds)

### Development Dependencies

- **@types/node**: 18.x.x (TypeScript definitions)
- **@types/throttle-debounce**: 5.x.x (TypeScript definitions)
- **electron**: 24.x.x (development/testing)

### Runtime Dependencies

- **throttle-debounce**: 5.x.x (event optimization)

### Package Manager

- **pnpm**: Latest (recommended)
- **npm**: Compatible
- **yarn**: Compatible

### Native Build Configuration

- **binding.gyp**: Cross-platform native module configuration
- **Platform-specific compilation**:
  - Windows: Visual Studio Build Tools
  - macOS: Xcode Command Line Tools
  - Linux: GCC/G++ build essentials

## 📄 License

MIT © [Zaid Qureshi](https://github.com/thezaidsheikh)

## 🤝 Contributing

Contributions, issues, and feature requests are welcome! Feel free to check the [issues page](https://github.com/thezaidsheikh/electron-overlay/issues).

## 🙏 Acknowledgements

Special thanks to all contributors who have helped make this project better.
