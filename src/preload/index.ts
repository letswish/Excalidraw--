import { contextBridge, ipcRenderer } from "electron";
import {
  LIBRARY_IPC_CHANNELS,
  type ExcalidrawDesktopBridge,
  type LibraryPersistedData
} from "../shared/library";
import {
  DOCUMENT_IPC_CHANNELS,
  type DocumentLanguage,
  type SaveDocumentRequest
} from "../shared/documents";
import { WINDOW_LIFECYCLE_IPC_CHANNELS } from "../shared/windowLifecycle";

const bridge: ExcalidrawDesktopBridge = {
  documents: {
    listRecent: () => ipcRenderer.invoke(DOCUMENT_IPC_CHANNELS.listRecent),
    chooseOpen: (language: DocumentLanguage) =>
      ipcRenderer.invoke(DOCUMENT_IPC_CHANNELS.chooseOpen, language),
    readRecent: (path: string) =>
      ipcRenderer.invoke(DOCUMENT_IPC_CHANNELS.readRecent, path),
    consumeExternalOpen: () =>
      ipcRenderer.invoke(DOCUMENT_IPC_CHANNELS.consumeExternalOpen),
    onExternalOpenRequested: (callback: () => void) => {
      const listener = () => callback();
      ipcRenderer.on(DOCUMENT_IPC_CHANNELS.externalOpenRequested, listener);
      return () => {
        ipcRenderer.removeListener(
          DOCUMENT_IPC_CHANNELS.externalOpenRequested,
          listener
        );
      };
    },
    commitOpen: (candidateId: string) =>
      ipcRenderer.invoke(DOCUMENT_IPC_CHANNELS.commitOpen, candidateId),
    save: (request: SaveDocumentRequest) =>
      ipcRenderer.invoke(DOCUMENT_IPC_CHANNELS.save, request)
  },
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
  },
  windowLifecycle: {
    onCloseRequested: (callback: () => void) => {
      const listener = () => callback();
      ipcRenderer.on(WINDOW_LIFECYCLE_IPC_CHANNELS.closeRequested, listener);
      return () => {
        ipcRenderer.removeListener(
          WINDOW_LIFECYCLE_IPC_CHANNELS.closeRequested,
          listener
        );
      };
    },
    confirmClose: () => {
      ipcRenderer.send(WINDOW_LIFECYCLE_IPC_CHANNELS.confirmClose);
    }
  }
};

contextBridge.exposeInMainWorld("excalidrawDesktop", bridge);
