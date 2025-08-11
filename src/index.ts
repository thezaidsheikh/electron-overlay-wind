import { EventEmitter } from "node:events";
import { join } from "node:path";
import { throttle } from "throttle-debounce";
import { screen } from "electron";
import { BrowserWindow, Rectangle, BrowserWindowConstructorOptions } from "electron";
const lib: AddonExports = require("node-gyp-build")(join(__dirname, ".."));

interface AddonExports {
  start(overlayWindowId: Buffer | undefined, targetWindowTitle: string, cb: (e: any) => void): void;
  stop(): void;
  activateOverlay(): void;
  focusTarget(): void;
  screenshot(): Buffer;
}

enum EventType {
  EVENT_ATTACH = 1,
  EVENT_FOCUS = 2,
  EVENT_BLUR = 3,
  EVENT_DETACH = 4,
  EVENT_FULLSCREEN = 5,
  EVENT_MOVERESIZE = 6,
}

export interface AttachEvent {
  hasAccess: boolean | undefined;
  isFullscreen: boolean | undefined;
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface FullscreenEvent {
  isFullscreen: boolean;
}

export interface MoveresizeEvent {
  x: number;
  y: number;
  width: number;
  height: number;
  windowLevel?: number;
}

export interface AttachOptions {
  // Whether the Window has a title bar. We adjust the overlay to not cover it
  hasTitleBarOnMac?: boolean;
}

const isMac = process.platform === "darwin";
const isLinux = process.platform === "linux";

export const OVERLAY_WINDOW_OPTS: BrowserWindowConstructorOptions = {
  fullscreenable: true,
  skipTaskbar: !isLinux,
  frame: false,
  show: false,
  transparent: true,
  // let Chromium to accept any size changes from OS
  resizable: true,
  // disable shadow for Mac OS
  hasShadow: !isMac,
  // float above all windows on Mac OS
  alwaysOnTop: isMac,
};

class OverlayControllerGlobal {
  private static _instance: OverlayControllerGlobal;
  private isInitialized = false;
  private electronWindow?: BrowserWindow;

  private onBlurListener?: () => void;
  private onFocusListener?: () => void;

  // Exposed so that apps can get the current bounds of the target
  // NOTE: stores screen physical rect on Windows
  targetBounds: Rectangle = { x: 0, y: 0, width: 0, height: 0 };
  targetHasFocus = false;
  private focusNext: "overlay" | "target" | undefined;
  // The height of a title bar on a standard window. Only measured on Mac
  private macTitleBarHeight = 0;
  private attachOptions: AttachOptions = {};

  readonly events = new EventEmitter();

  constructor() {
    this.events.on("attach", (e: AttachEvent) => {
      this.targetHasFocus = true;
      if (this.electronWindow) {
        this.electronWindow.setIgnoreMouseEvents(true);
        this.updateWindowVisibility();
      }
      console.log("attach", e);
      if (e.isFullscreen !== undefined) {
        this.handleFullscreen(e.isFullscreen);
      }
      this.targetBounds = e;
      this.updateOverlayBounds();
    });

    this.events.on("fullscreen", (e: FullscreenEvent) => {
      this.handleFullscreen(e.isFullscreen);
    });

    this.events.on("detach", () => {
      this.targetHasFocus = false;
      this.electronWindow?.hide();
    });

    const dispatchMoveresize = throttle(34 /* 30fps */, this.updateOverlayBounds.bind(this));

    this.events.on("moveresize", (e: MoveresizeEvent) => {
      this.targetBounds = e;
      dispatchMoveresize();
    });

    this.events.on("blur", () => {
      this.targetHasFocus = false;
      this.updateWindowVisibility();
    });

    this.events.on("focus", () => {
      this.focusNext = undefined;
      this.targetHasFocus = true;
      this.updateWindowVisibility();
    });
  }

  private async handleFullscreen(isFullscreen: boolean) {
    if (!this.electronWindow) return;

    if (isMac) {
      // On Mac, only a single app can be fullscreen, so we can't go
      // fullscreen. We get around it by making it display on all workspaces,
      // based on code from:
      // https://github.com/electron/electron/issues/10078#issuecomment-754105005
      this.electronWindow.setVisibleOnAllWorkspaces(isFullscreen, { visibleOnFullScreen: true });
      if (isFullscreen) {
        const display = screen.getPrimaryDisplay();
        this.electronWindow.setBounds(display.bounds);
      } else {
        // Set it back to `lastBounds` as set before fullscreen
        this.updateOverlayBounds();
      }
    } else {
      this.electronWindow.setFullScreen(isFullscreen);
    }
  }

  private updateWindowVisibility() {
    if (!this.electronWindow) return;

    if (this.targetBounds.width > 0 && this.targetBounds.height > 0) {
      if (this.targetHasFocus) {
        // When target has focus, show overlay on top
        this.electronWindow.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true });
        this.electronWindow.setAlwaysOnTop(true, "screen-saver", 1);
        this.electronWindow.setIgnoreMouseEvents(true);
        this.electronWindow.showInactive();
      } else {
        // When target loses focus, move overlay behind
        this.electronWindow.setAlwaysOnTop(false);
        this.electronWindow.setVisibleOnAllWorkspaces(false);
        this.electronWindow.setIgnoreMouseEvents(true);

        // On macOS, we need to force the window to the back
        if (process.platform === "darwin") {
          // Create a new window to steal focus
          const tempWindow = new BrowserWindow({
            show: false,
            width: 1,
            height: 1,
          });
          tempWindow.showInactive();
          tempWindow.close();
        }
      }
    } else {
      this.electronWindow.hide();
    }
  }

  private updateOverlayBounds() {
    if (!this.electronWindow) return;

    let { x, y, width, height } = this.targetBounds;

    if (this.attachOptions.hasTitleBarOnMac && process.platform === "darwin") {
      // Adjust for title bar if needed
      y += this.macTitleBarHeight;
      height -= this.macTitleBarHeight;
    }

    // Only update bounds if they've changed
    const [currentX, currentY] = this.electronWindow.getPosition();
    const [currentWidth, currentHeight] = this.electronWindow.getSize();

    if (currentX !== x || currentY !== y || currentWidth !== width || currentHeight !== height) {
      this.electronWindow.setBounds(
        {
          x: Math.round(x),
          y: Math.round(y),
          width: Math.max(1, Math.round(width)),
          height: Math.max(1, Math.round(height)),
        },
        false
      );
    }

    this.updateWindowVisibility();
  }

  private handler(e: unknown) {
    switch ((e as { type: EventType }).type) {
      case EventType.EVENT_ATTACH:
        this.events.emit("attach", e);
        break;
      case EventType.EVENT_FOCUS:
        this.events.emit("focus", e);
        break;
      case EventType.EVENT_BLUR:
        this.events.emit("blur", e);
        break;
      case EventType.EVENT_DETACH:
        this.events.emit("detach", e);
        break;
      case EventType.EVENT_FULLSCREEN:
        this.events.emit("fullscreen", e);
        break;
      case EventType.EVENT_MOVERESIZE:
        this.events.emit("moveresize", e);
        break;
    }
  }

  /**
   * Create a dummy window to calculate the title bar height on Mac. We use
   * the title bar height to adjust the size of the overlay to not overlap
   * the title bar. This helps Mac match the behaviour on Windows/Linux.
   */
  private calculateMacTitleBarHeight() {
    const testWindow = new BrowserWindow({
      width: 400,
      height: 300,
      webPreferences: {
        nodeIntegration: true,
      },
      show: false,
    });
    const fullHeight = testWindow.getSize()[1];
    const contentHeight = testWindow.getContentSize()[1];
    this.macTitleBarHeight = fullHeight - contentHeight;
    testWindow.close();
  }

  /** If we're on a Mac, adjust the bounds to not overlap the title bar */
  private adjustBoundsForMacTitleBar(bounds: Rectangle) {
    if (!isMac || !this.attachOptions.hasTitleBarOnMac) {
      return bounds;
    }

    const newBounds: Rectangle = {
      ...bounds,
      y: bounds.y + this.macTitleBarHeight,
      height: bounds.height - this.macTitleBarHeight,
    };
    return newBounds;
  }

  activateOverlay() {
    if (!this.electronWindow) {
      throw new Error("You are using the library in tracking mode");
    }
    this.focusNext = "overlay";
    this.electronWindow.setIgnoreMouseEvents(false);
    this.electronWindow.focus();
  }

  focusTarget() {
    this.focusNext = "target";
    this.electronWindow?.setIgnoreMouseEvents(true);
    lib.focusTarget();
  }

  attachByTitle(electronWindow: BrowserWindow | undefined, targetWindowTitle: string, options: AttachOptions = {}) {
    if (this.isInitialized) {
      this.stop();
    }
    this.isInitialized = true;
    this.electronWindow = electronWindow;
    this.attachOptions = options;

    this.onBlurListener = () => {
      if (!this.targetHasFocus && this.focusNext !== "target") {
        this.electronWindow!.hide();
      }
    };
    this.onFocusListener = () => {
      this.focusNext = undefined;
    };

    this.electronWindow?.on("blur", this.onBlurListener);
    this.electronWindow?.on("focus", this.onFocusListener);

    if (isMac) {
      this.calculateMacTitleBarHeight();
    }

    lib.start(this.electronWindow?.getNativeWindowHandle(), targetWindowTitle, this.handler.bind(this));
  }

  // buffer suitable for use in `nativeImage.createFromBitmap`
  screenshot(): Buffer {
    if (process.platform !== "win32") {
      throw new Error("Not implemented on your platform.");
    }
    return lib.screenshot();
  }

  // Add stop method
  stop() {
    try {
      if (this.isInitialized) {
        try {
          // Clean up native resources
          lib.stop();
          if (this.electronWindow) {
            if (this.onBlurListener) {
              this.electronWindow.removeListener("blur", this.onBlurListener);
            }
            if (this.onFocusListener) {
              this.electronWindow.removeListener("focus", this.onFocusListener);
            }
            // Hide overlay window
            this.electronWindow.hide();
          }
          // Reset state
          this.isInitialized = false;
          this.electronWindow = undefined;
          this.onBlurListener = undefined;
          this.onFocusListener = undefined;
          this.targetHasFocus = false;
          this.targetBounds = { x: 0, y: 0, width: 0, height: 0 };
        } catch (error) {
          console.error("Error stopping overlay:", error);
        }
      }
    } catch (error) {
      console.error("Error stopping overlay catch:", error);
    }
  }
}

export const OverlayController = new OverlayControllerGlobal();
