import {
  app,
  BrowserWindow,
  ipcMain,
  Menu,
  type IpcMainInvokeEvent,
  type WebContents
} from "electron";
import { join } from "node:path";
import {
  APP_CONFIG_DIRECTORY_NAME,
  LIBRARY_BROWSER_ORIGIN,
  LIBRARY_IPC_CHANNELS,
  LIBRARY_RETURN_URL,
  type LibraryPersistedData
} from "../shared/library";
import { DOCUMENT_IPC_CHANNELS } from "../shared/documents";
import { WINDOW_LIFECYCLE_IPC_CHANNELS } from "../shared/windowLifecycle";
import { loadLibraryData, saveLibraryData } from "./libraryStore";
import { registerDocumentIpc, resetDocumentSession } from "./documents";
import { getExcalidrawPathFromArguments } from "./openFileRequest";
import {
  createWindowCloseGuard,
  type WindowCloseGuard
} from "./windowCloseGuard";

app.setName("Excalidraw--");

app.setPath(
  "userData",
  join(app.getPath("appData"), APP_CONFIG_DIRECTORY_NAME)
);

let mainWindow: BrowserWindow | null = null;
let mainWindowCloseGuard: WindowCloseGuard | null = null;
let pendingExternalOpenPath = getExcalidrawPathFromArguments(
  process.argv,
  process.cwd()
);

const takeExternalOpenPath = (): string | null => {
  const filePath = pendingExternalOpenPath;
  pendingExternalOpenPath = null;
  return filePath;
};

registerDocumentIpc(() => mainWindow, takeExternalOpenPath);

const libraryReturnUrl = new URL(LIBRARY_RETURN_URL);

const isLibraryBrowserUrl = (url: string): boolean => {
  try {
    return new URL(url).origin === LIBRARY_BROWSER_ORIGIN;
  } catch {
    return false;
  }
};

const isLibraryReturnUrl = (url: string): boolean => {
  try {
    const candidate = new URL(url);
    return (
      candidate.origin === libraryReturnUrl.origin &&
      candidate.pathname === libraryReturnUrl.pathname
    );
  } catch {
    return false;
  }
};

const getLibraryInstallHash = (url: string): string | null => {
  try {
    const candidate = new URL(url);
    if (!isLibraryReturnUrl(url)) {
      return null;
    }

    const hash = new URLSearchParams(candidate.hash.slice(1));
    return hash.has("addLibrary") ? candidate.hash : null;
  } catch {
    return null;
  }
};

const forwardLibraryInstall = (url: string): boolean => {
  const hash = getLibraryInstallHash(url);
  if (!hash || !mainWindow || mainWindow.isDestroyed()) {
    return false;
  }

  mainWindow.webContents.send(LIBRARY_IPC_CHANNELS.install, hash);
  if (mainWindow.isMinimized()) {
    mainWindow.restore();
  }
  mainWindow.show();
  mainWindow.focus();
  return true;
};

const focusMainWindow = (): void => {
  if (!mainWindow || mainWindow.isDestroyed()) {
    return;
  }
  if (mainWindow.isMinimized()) {
    mainWindow.restore();
  }
  mainWindow.show();
  mainWindow.focus();
};

const queueExternalOpen = (
  commandLine: readonly string[],
  workingDirectory: string
): boolean => {
  const filePath = getExcalidrawPathFromArguments(
    commandLine,
    workingDirectory
  );
  if (!filePath) {
    return false;
  }

  pendingExternalOpenPath = filePath;
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send(DOCUMENT_IPC_CHANNELS.externalOpenRequested);
  }
  return true;
};

const interceptLibraryNavigation = (webContents: WebContents): void => {
  webContents.on("will-navigate", (event, url) => {
    if (isLibraryReturnUrl(url)) {
      event.preventDefault();
      forwardLibraryInstall(url);
    }
  });

  webContents.setWindowOpenHandler(({ url }) => {
    if (isLibraryReturnUrl(url)) {
      forwardLibraryInstall(url);
      return { action: "deny" };
    }

    if (isLibraryBrowserUrl(url)) {
      return {
        action: "allow",
        overrideBrowserWindowOptions: {
          width: 1180,
          height: 820,
          webPreferences: {
            nodeIntegration: false,
            contextIsolation: true,
            sandbox: true
          }
        }
      };
    }

    return { action: "allow" };
  });
};

const assertMainRenderer = (event: IpcMainInvokeEvent): void => {
  if (!mainWindow || event.sender !== mainWindow.webContents) {
    throw new Error("Library storage is only available to the main renderer");
  }
};

ipcMain.handle(LIBRARY_IPC_CHANNELS.load, (event) => {
  assertMainRenderer(event);
  return loadLibraryData();
});

ipcMain.handle(
  LIBRARY_IPC_CHANNELS.save,
  (event, data: LibraryPersistedData) => {
    assertMainRenderer(event);
    return saveLibraryData(data);
  }
);

ipcMain.on(WINDOW_LIFECYCLE_IPC_CHANNELS.confirmClose, (event) => {
  if (!mainWindow || event.sender !== mainWindow.webContents) {
    return;
  }
  mainWindowCloseGuard?.approveClose();
});

const createWindow = (): void => {
  const createdWindow = new BrowserWindow({
    width: 1280,
    height: 900,
    minWidth: 900,
    minHeight: 600,
    show: false,
    webPreferences: {
      preload: join(__dirname, "../preload/index.cjs"),
      nodeIntegration: false,
      contextIsolation: true
    }
  });
  mainWindow = createdWindow;

  const closeGuard = createWindowCloseGuard({
    requestCloseConfirmation: () => {
      if (!createdWindow.isDestroyed()) {
        createdWindow.webContents.send(
          WINDOW_LIFECYCLE_IPC_CHANNELS.closeRequested
        );
      }
    },
    closeWindow: () => {
      if (!createdWindow.isDestroyed()) {
        createdWindow.close();
      }
    }
  });
  mainWindowCloseGuard = closeGuard;
  createdWindow.on("close", closeGuard.handleClose);

  interceptLibraryNavigation(createdWindow.webContents);

  createdWindow.webContents.on("did-create-window", (libraryWindow, details) => {
    if (isLibraryBrowserUrl(details.url)) {
      interceptLibraryNavigation(libraryWindow.webContents);
    }
  });

  createdWindow.once("ready-to-show", () => {
    createdWindow.show();
  });

  if (process.env.ELECTRON_RENDERER_URL) {
    void createdWindow.loadURL(process.env.ELECTRON_RENDERER_URL);
  } else {
    void createdWindow.loadFile(join(__dirname, "../renderer/index.html"));
  }

  createdWindow.on("closed", () => {
    if (mainWindow === createdWindow) {
      mainWindow = null;
      mainWindowCloseGuard = null;
    }
    resetDocumentSession();
  });
};

const hasSingleInstanceLock = app.requestSingleInstanceLock();

if (!hasSingleInstanceLock) {
  app.quit();
} else {
  app.on("second-instance", (_event, commandLine, workingDirectory) => {
    queueExternalOpen(commandLine, workingDirectory);
    focusMainWindow();
  });

  app.whenReady().then(() => {
    Menu.setApplicationMenu(null);
    createWindow();

    app.on("activate", () => {
      if (BrowserWindow.getAllWindows().length === 0) {
        createWindow();
      }
    });
  });
}

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
});
