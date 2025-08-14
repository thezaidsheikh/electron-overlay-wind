const { contextBridge, ipcRenderer } = require("electron");

const desktopCapturer = {
  getSources: (opts) => ipcRenderer.invoke("DESKTOP_CAPTURER_GET_SOURCES", opts),
};

contextBridge.exposeInMainWorld("electron", {
  getScreenSources: (opts) => desktopCapturer.getSources(opts),
});

contextBridge.exposeInMainWorld("api", {
  // Send message asynchronously to the main process - one way communication
  send: (channel, data) => {
    // Whitelist channels
    const validChannels = ["CREATE_OVERLAY_WINDOW", "STOP"];
    if (validChannels.includes(channel)) {
      ipcRenderer.send(channel, data);
    }
  },

  // Listens for messages from main process
  listen: (channel, callback) => {
    const validChannels = ["SHARING_STOPPED_MAIN", "SHARING_STARTED_MAIN"];
    if (validChannels.includes(channel)) {
      ipcRenderer.on(channel, (_event, data) => callback(data));
    }
  },

  invoke: (channel, data) => ipcRenderer.invoke(channel, data),
});
