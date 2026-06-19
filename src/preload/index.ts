import { contextBridge, ipcRenderer } from "electron";
import {
  LIBRARY_IPC_CHANNELS,
  type ExcalidrawDesktopBridge,
  type LibraryPersistedData
} from "../shared/library";

const bridge: ExcalidrawDesktopBridge = {
  libraries: {
    load: () => ipcRenderer.invoke(LIBRARY_IPC_CHANNELS.load),
    save: (data: LibraryPersistedData) =>
      ipcRenderer.invoke(LIBRARY_IPC_CHANNELS.save, data),
    onInstall: (callback: (hash: string) => void) => {
      const listener = (_event: Electron.IpcRendererEvent, hash: unknown) => {
        if (typeof hash === "string") {
          callback(hash);
        }
      };

      ipcRenderer.on(LIBRARY_IPC_CHANNELS.install, listener);
      return () => {
        ipcRenderer.removeListener(LIBRARY_IPC_CHANNELS.install, listener);
      };
    }
  }
};

contextBridge.exposeInMainWorld("excalidrawDesktop", bridge);
