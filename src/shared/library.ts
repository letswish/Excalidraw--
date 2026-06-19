import type { LibraryItems } from "@excalidraw/excalidraw/types";

export const APP_CONFIG_DIRECTORY_NAME = "excalidraw--";
export const LIBRARY_DATA_FILENAME = "libraries.json";
export const LIBRARY_BROWSER_ORIGIN = "https://libraries.excalidraw.com";
export const LIBRARY_RETURN_URL = "https://excalidraw.localhost/library";
export const LIBRARY_WINDOW_NAME = "excalidraw--";

export const LIBRARY_IPC_CHANNELS = {
  load: "libraries:load",
  save: "libraries:save",
  install: "libraries:install"
} as const;

export type LibraryPersistedData = {
  libraryItems: LibraryItems;
};

export type ExcalidrawDesktopBridge = {
  libraries: {
    load: () => Promise<LibraryPersistedData | null>;
    save: (data: LibraryPersistedData) => Promise<void>;
    onInstall: (callback: (hash: string) => void) => () => void;
  };
};
