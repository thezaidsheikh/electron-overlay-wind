import { app, BrowserWindow, desktopCapturer, globalShortcut, ipcMain } from "electron";
import { OverlayController, OVERLAY_WINDOW_OPTS } from "../";
import path = require("path");
import url = require("url");

// https://github.com/electron/electron/issues/25153
app.disableHardwareAcceleration();

let mainWindow: BrowserWindow;
let overlayWindow: BrowserWindow;
const global: { sourceId: string; sourceName: string } = { sourceId: "", sourceName: "" };

const toggleMouseKey = "CmdOrCtrl + J";
const toggleShowKey = "CmdOrCtrl + K";

// Create the main window
const createWindow = () => {
  // Create the browser window.
  mainWindow = new BrowserWindow({
    width: 1000,
    height: 600,
    skipTaskbar: true,
    resizable: false,
    // movable: false,
    acceptFirstMouse: false,
    disableAutoHideCursor: true,
    minimizable: false,
    maximizable: false,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, "preload.js"), // use a preload script
    },
  });

  // and load the miniWindow.html of the app.
  mainWindow.loadURL(
    url.format({
      pathname: path.join(__dirname, "index.html"),
      protocol: "file:",
      slashes: true,
    })
  );

  // Open DevTools in development for debugging
  // miniWindow.webContents.openDevTools({ mode: "detach", activate: false });

  mainWindow.setContentProtection(true);
  // Emitted when the window is closed.
  mainWindow.on("closed", function () {
    // Dereference the window object, usually you would store windows
    // in an array if your app supports multi windows, this is the time
    // when you should delete the corresponding element.
    mainWindow.destroy();
  });
};

function createOverlayWindow() {
  overlayWindow = new BrowserWindow({
    width: 400,
    height: 300,
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false,
    },
    ...OVERLAY_WINDOW_OPTS,
  });

  overlayWindow.loadURL(`data:text/html;charset=utf-8,
    <head>
      <title>overlay-demo</title>
    </head>
    <body style="padding: 0; margin: 0;">
      <div style="position: absolute; width: 100%; height: 100%; border: 4px solid red; background: rgba(255,255,255,0.1); box-sizing: border-box; pointer-events: none;"></div>
      <div style="padding-top: 50vh; text-align: center;">
        <div style="padding: 16px; border-radius: 8px; background: rgb(255,255,255); border: 4px solid red; display: inline-block;">
          <span>Overlay Window</span>
          <span id="text1"></span>
          <br><span><b>${toggleMouseKey}</b> to toggle setIgnoreMouseEvents</span>
          <br><span><b>${toggleShowKey}</b> to "hide" overlay using CSS</span>
        </div>
      </div>
      <script>
        const electron = require('electron');

        electron.ipcRenderer.on('focus-change', (e, state) => {
          document.getElementById('text1').textContent = (state) ? ' (overlay is clickable) ' : 'clicks go through overlay'
        });

        electron.ipcRenderer.on('visibility-change', (e, state) => {
          if (document.body.style.display) {
            document.body.style.display = null
          } else {
            document.body.style.display = 'none'
          }
        });
      </script>
    </body>
  `);

  // NOTE: if you close Dev Tools overlay window will lose transparency
  // window.webContents.openDevTools({ mode: 'detach', activate: false })

  makeDemoInteractive();

  OverlayController.attachByTitle(overlayWindow, process.platform === "darwin" ? global.sourceName : "Notepad", { hasTitleBarOnMac: false });
  // setTimeout(() => {
  //   OverlayController.stop();
  //   setTimeout(() => {
  //     OverlayController.attachByTitle(window, process.platform === "darwin" ? "Activity Monitor" : "Notepad", { hasTitleBarOnMac: false });
  //   }, 2000);
  // }, 3000);
}

function makeDemoInteractive() {
  let isInteractable = false;

  function toggleOverlayState() {
    if (isInteractable) {
      isInteractable = false;
      OverlayController.focusTarget();
      overlayWindow.webContents.send("focus-change", false);
    } else {
      isInteractable = true;
      OverlayController.activateOverlay();
      overlayWindow.webContents.send("focus-change", true);
    }
  }

  overlayWindow.on("blur", () => {
    isInteractable = false;
    overlayWindow.webContents.send("focus-change", false);
  });

  globalShortcut.register(toggleMouseKey, toggleOverlayState);

  globalShortcut.register(toggleShowKey, () => {
    overlayWindow.webContents.send("visibility-change", false);
  });
}

app.on("ready", () => {
  setTimeout(
    createWindow,
    process.platform === "linux" ? 1000 : 0 // https://github.com/electron/electron/issues/16809
  );
});

ipcMain.on("CREATE_OVERLAY_WINDOW", async (event, data) => {
  global.sourceId = data.sourceId;
  global.sourceName = data.sourceName;
  createOverlayWindow();
  if (mainWindow) mainWindow.minimize();
});

ipcMain.on("STOP", () => {
  OverlayController.stop();
  if (mainWindow) mainWindow.show();
});

// Handle desktop capturer sources request
ipcMain.handle("DESKTOP_CAPTURER_GET_SOURCES", async (event, options) => {
  try {
    const sources = await desktopCapturer.getSources(options);
    return sources;
  } catch (error) {
    console.error("Error getting desktop sources:", error);
    throw error;
  }
});
