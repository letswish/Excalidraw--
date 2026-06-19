import { randomUUID } from "node:crypto";
import { readFile, rename, unlink, writeFile } from "node:fs/promises";
import { basename, dirname, extname, join, resolve } from "node:path";
import {
  BrowserWindow,
  dialog,
  ipcMain,
  type IpcMainInvokeEvent
} from "electron";
import {
  DOCUMENT_IPC_CHANNELS,
  type DocumentCandidate,
  type DocumentLanguage,
  type RecentDocument,
  type SaveDocumentRequest,
  type SaveDocumentResult
} from "../shared/documents";
import {
  isRecordedRecentDocument,
  loadRecentDocuments,
  recordRecentDocument
} from "./recentDocumentStore";

type PendingCandidate = {
  id: string;
  path: string;
};

let activeDocumentPath: string | null = null;
let pendingCandidate: PendingCandidate | null = null;

const getDialogLabels = (language: DocumentLanguage) => {
  return language === "zh-CN"
    ? {
        openTitle: "打开 Excalidraw 文件",
        saveTitle: "保存 Excalidraw 文件",
        filterName: "Excalidraw 文件"
      }
    : {
        openTitle: "Open Excalidraw file",
        saveTitle: "Save Excalidraw file",
        filterName: "Excalidraw file"
      };
};

const isDocumentLanguage = (value: unknown): value is DocumentLanguage =>
  value === "en" || value === "zh-CN";

const isExcalidrawPath = (filePath: string): boolean =>
  extname(filePath).toLocaleLowerCase() === ".excalidraw";

const ensureExcalidrawExtension = (filePath: string): string =>
  isExcalidrawPath(filePath) ? filePath : `${filePath}.excalidraw`;

const getRecentDocument = async (
  filePath: string
): Promise<RecentDocument> => {
  const resolvedPath = resolve(filePath);
  const recentDocuments = await recordRecentDocument(resolvedPath);
  const recentDocument = recentDocuments.find(
    (entry) => entry.path === resolvedPath
  );

  if (!recentDocument) {
    throw new Error("Could not record the document in recent files");
  }

  return recentDocument;
};

const createCandidate = async (filePath: string): Promise<DocumentCandidate> => {
  const resolvedPath = resolve(filePath);
  if (!isExcalidrawPath(resolvedPath)) {
    throw new TypeError("Only .excalidraw documents can be opened");
  }

  const contents = await readFile(resolvedPath, "utf8");
  const id = randomUUID();
  pendingCandidate = { id, path: resolvedPath };

  return {
    id,
    path: resolvedPath,
    name: basename(resolvedPath),
    contents
  };
};

const writeDocument = async (
  filePath: string,
  contents: string
): Promise<void> => {
  const temporaryPath = join(
    dirname(filePath),
    `.${basename(filePath)}.${process.pid}.${Date.now()}.tmp`
  );

  try {
    await writeFile(temporaryPath, contents, {
      encoding: "utf8",
      mode: 0o600
    });
    await rename(temporaryPath, filePath);
  } catch (error) {
    await unlink(temporaryPath).catch(() => undefined);
    throw error;
  }
};

const assertMainRenderer = (
  event: IpcMainInvokeEvent,
  getMainWindow: () => BrowserWindow | null
): BrowserWindow => {
  const mainWindow = getMainWindow();
  if (!mainWindow || event.sender !== mainWindow.webContents) {
    throw new Error("Document access is only available to the main renderer");
  }
  return mainWindow;
};

export const registerDocumentIpc = (
  getMainWindow: () => BrowserWindow | null
): void => {
  ipcMain.handle(DOCUMENT_IPC_CHANNELS.listRecent, async (event) => {
    assertMainRenderer(event, getMainWindow);
    return loadRecentDocuments();
  });

  ipcMain.handle(DOCUMENT_IPC_CHANNELS.chooseOpen, async (event, language) => {
    const mainWindow = assertMainRenderer(event, getMainWindow);
    if (!isDocumentLanguage(language)) {
      throw new TypeError("Invalid document language");
    }
    const labels = getDialogLabels(language);
    const result = await dialog.showOpenDialog(mainWindow, {
      title: labels.openTitle,
      properties: ["openFile"],
      filters: [
        {
          name: labels.filterName,
          extensions: ["excalidraw"]
        }
      ]
    });

    if (result.canceled || !result.filePaths[0]) {
      return null;
    }

    return createCandidate(result.filePaths[0]);
  });

  ipcMain.handle(
    DOCUMENT_IPC_CHANNELS.readRecent,
    async (event, filePath: unknown) => {
      assertMainRenderer(event, getMainWindow);
      if (typeof filePath !== "string") {
        throw new TypeError("Invalid recent document path");
      }
      if (!(await isRecordedRecentDocument(filePath))) {
        throw new Error("The recent document no longer exists");
      }
      return createCandidate(filePath);
    }
  );

  ipcMain.handle(
    DOCUMENT_IPC_CHANNELS.commitOpen,
    async (event, candidateId: unknown) => {
      assertMainRenderer(event, getMainWindow);
      if (
        typeof candidateId !== "string" ||
        !pendingCandidate ||
        pendingCandidate.id !== candidateId
      ) {
        throw new Error("The document candidate is no longer valid");
      }

      const { path } = pendingCandidate;
      pendingCandidate = null;
      activeDocumentPath = path;
      return getRecentDocument(path);
    }
  );

  ipcMain.handle(
    DOCUMENT_IPC_CHANNELS.save,
    async (event, request: SaveDocumentRequest): Promise<SaveDocumentResult> => {
      const mainWindow = assertMainRenderer(event, getMainWindow);
      if (
        typeof request !== "object" ||
        request === null ||
        typeof request.contents !== "string" ||
        typeof request.suggestedName !== "string" ||
        !isDocumentLanguage(request.language)
      ) {
        throw new TypeError("Invalid document save request");
      }

      let targetPath = activeDocumentPath;
      if (!targetPath) {
        const labels = getDialogLabels(request.language);
        const suggestedName = ensureExcalidrawExtension(
          basename(request.suggestedName.trim() || "Untitled")
        );
        const result = await dialog.showSaveDialog(mainWindow, {
          title: labels.saveTitle,
          defaultPath: suggestedName,
          filters: [
            {
              name: labels.filterName,
              extensions: ["excalidraw"]
            }
          ]
        });

        if (result.canceled || !result.filePath) {
          return { status: "canceled" };
        }
        targetPath = ensureExcalidrawExtension(resolve(result.filePath));
      }

      await writeDocument(targetPath, request.contents);
      activeDocumentPath = targetPath;
      const document = await getRecentDocument(targetPath);
      return { status: "saved", document };
    }
  );
};

export const resetDocumentSession = (): void => {
  activeDocumentPath = null;
  pendingCandidate = null;
};
