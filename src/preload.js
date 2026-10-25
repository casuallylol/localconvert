const { contextBridge, ipcRenderer, webUtils } = require("electron");

contextBridge.exposeInMainWorld("localConvert", {
  pickFiles: () => ipcRenderer.invoke("pick-files"),

  pickOutput: () => ipcRenderer.invoke("pick-output"),

  openPath: filePath => ipcRenderer.invoke("open-path", filePath),

  previewFile: filePath => ipcRenderer.invoke("preview-file", filePath),

  convertBatch: payload => ipcRenderer.invoke("convert-batch", payload),

  getDocumentEngineStatus: () =>
    ipcRenderer.invoke("get-document-engine-status"),

  getPathForFile: file => webUtils.getPathForFile(file)
});
