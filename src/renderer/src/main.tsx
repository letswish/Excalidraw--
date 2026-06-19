import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState
} from "react";
import ReactDOM from "react-dom/client";
import {
  Excalidraw,
  MainMenu,
  MIME_TYPES,
  loadFromBlob,
  serializeAsJSON,
  useHandleLibrary
} from "@excalidraw/excalidraw";
import type {
  ExcalidrawImperativeAPI,
  ExcalidrawInitialDataState,
  ExcalidrawProps
} from "@excalidraw/excalidraw/types";
import "@excalidraw/excalidraw/index.css";
import {
  MAX_RECENT_DOCUMENTS,
  type DocumentCandidate,
  type RecentDocument
} from "../../shared/documents";
import {
  LIBRARY_RETURN_URL,
  LIBRARY_WINDOW_NAME,
  type LibraryPersistedData
} from "../../shared/library";
import {
  RecentDocumentsDialog,
  SaveChangesDialog,
  type DocumentUiLabels
} from "./documentDialogs";
import "./styles.css";

window.name = LIBRARY_WINDOW_NAME;

const libraryPersistenceAdapter = {
  load: () => window.excalidrawDesktop.libraries.load(),
  save: (data: LibraryPersistedData) =>
    window.excalidrawDesktop.libraries.save(data)
};

const validateEmbeddableUrl = (url: string): boolean => {
  try {
    const { protocol } = new URL(url);
    return protocol === "http:" || protocol === "https:";
  } catch {
    return false;
  }
};

const OpenIcon = (): React.JSX.Element => (
  <svg aria-hidden="true" viewBox="0 0 24 24">
    <path
      d="M3.75 7.75h6l2-2h8.5v12.5H3.75z"
      fill="none"
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth="1.5"
    />
  </svg>
);

const SaveIcon = (): React.JSX.Element => (
  <svg aria-hidden="true" viewBox="0 0 24 24">
    <path
      d="M5 3.75h12l2 2v14.5H5zM8 3.75v5h7v-5M8 20.25v-7h8v7"
      fill="none"
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth="1.5"
    />
  </svg>
);

const RecentIcon = (): React.JSX.Element => (
  <svg aria-hidden="true" viewBox="0 0 24 24">
    <path
      d="M4.5 7.5V3.75M4.5 3.75h3.75M4.9 4.15A8.25 8.25 0 1 1 3.75 14M12 7.75v4.75l3.25 2"
      fill="none"
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth="1.5"
    />
  </svg>
);

const promoteRecentDocument = (
  documents: RecentDocument[],
  document: RecentDocument
): RecentDocument[] => {
  return [
    document,
    ...documents.filter((entry) => entry.path !== document.path)
  ].slice(0, MAX_RECENT_DOCUMENTS);
};

type LoadedDocument = {
  candidate: DocumentCandidate;
  scene: Awaited<ReturnType<typeof loadFromBlob>>;
};

type AppLabels = DocumentUiLabels & {
  open: string;
  saveMenu: string;
  recentMenu: string;
  untitled: string;
  invalidDocument: string;
  documentError: string;
  saved: (name: string) => string;
};

const getLabels = (langCode: string): AppLabels => {
  const isChinese = langCode.toLocaleLowerCase().startsWith("zh");
  if (isChinese) {
    return {
      open: "打开",
      saveMenu: "保存",
      recentMenu: "最近打开",
      recentTitle: "最近打开",
      recentEmpty: "还没有最近打开的 Excalidraw 文件",
      close: "关闭",
      saveChangesTitle: "保存更改？",
      saveChangesDescription: (name) =>
        `“${name}”包含尚未保存的更改。是否在打开其他文件前保存？`,
      save: "保存",
      dontSave: "不保存",
      cancel: "取消",
      untitled: "未命名",
      invalidDocument: "无法打开：文件不是有效的 Excalidraw 文件。",
      documentError: "本地文件操作失败。",
      saved: (name) => `已保存到“${name}”`
    };
  }

  return {
    open: "Open",
    saveMenu: "Save",
    recentMenu: "Recent files",
    recentTitle: "Recent files",
    recentEmpty: "No recently opened Excalidraw files",
    close: "Close",
    saveChangesTitle: "Save changes?",
    saveChangesDescription: (name) =>
      `“${name}” has unsaved changes. Save before opening another file?`,
    save: "Save",
    dontSave: "Don't save",
    cancel: "Cancel",
    untitled: "Untitled",
    invalidDocument: "Could not open this invalid Excalidraw file.",
    documentError: "The local file operation failed.",
    saved: (name) => `Saved to “${name}”`
  };
};

const APP_LANGUAGE = navigator.language
  .toLocaleLowerCase()
  .startsWith("zh-cn")
  ? "zh-CN"
  : "en";

const App = (): React.JSX.Element => {
  const [excalidrawAPI, setExcalidrawAPI] =
    useState<ExcalidrawImperativeAPI | null>(null);
  const [editorKey, setEditorKey] = useState(0);
  const [initialData, setInitialData] =
    useState<ExcalidrawInitialDataState | null>(null);
  const [recentDocuments, setRecentDocuments] = useState<RecentDocument[]>([]);
  const [activeDocument, setActiveDocument] =
    useState<RecentDocument | null>(null);
  const [recentDialogOpen, setRecentDialogOpen] = useState(false);
  const [pendingDocument, setPendingDocument] =
    useState<LoadedDocument | null>(null);
  const [openingDocument, setOpeningDocument] = useState(false);
  const [confirmBusy, setConfirmBusy] = useState(false);
  const baselineRef = useRef<string | null>(null);
  const awaitingBaselineRef = useRef(true);
  const labels = useMemo(() => getLabels(APP_LANGUAGE), []);

  useHandleLibrary({
    excalidrawAPI,
    adapter: libraryPersistenceAdapter
  });

  const showError = useCallback(
    (message: string): void => {
      if (excalidrawAPI) {
        excalidrawAPI.setToast({ message, closable: true });
      } else {
        console.error(message);
      }
    },
    [excalidrawAPI]
  );

  const refreshRecentDocuments = useCallback(async (): Promise<void> => {
    try {
      const documents = await window.excalidrawDesktop.documents.listRecent();
      setRecentDocuments(documents);
    } catch (error) {
      console.error("Could not load recent documents", error);
      showError(labels.documentError);
    }
  }, [labels.documentError, showError]);

  useEffect(() => {
    void refreshRecentDocuments();
  }, [refreshRecentDocuments]);

  useEffect(() => {
    return window.excalidrawDesktop.libraries.onInstall((hash) => {
      const params = new URLSearchParams(hash.replace(/^#/, ""));
      if (params.has("addLibrary")) {
        window.location.hash = hash;
      }
    });
  }, []);

  const handleChange = useCallback<NonNullable<ExcalidrawProps["onChange"]>>(
    (elements, appState, files) => {
      if (awaitingBaselineRef.current || baselineRef.current === null) {
        baselineRef.current = serializeAsJSON(
          elements,
          appState,
          files,
          "local"
        );
        awaitingBaselineRef.current = false;
      }
    },
    []
  );

  const serializeCurrentDocument = useCallback((): string | null => {
    if (!excalidrawAPI) {
      return null;
    }
    return serializeAsJSON(
      excalidrawAPI.getSceneElementsIncludingDeleted(),
      excalidrawAPI.getAppState(),
      excalidrawAPI.getFiles(),
      "local"
    );
  }, [excalidrawAPI]);

  const saveCurrentDocument = useCallback(async (): Promise<boolean> => {
    if (!excalidrawAPI) {
      return false;
    }

    const contents = serializeCurrentDocument();
    if (contents === null) {
      return false;
    }

    try {
      const result = await window.excalidrawDesktop.documents.save({
        contents,
        suggestedName: excalidrawAPI.getName() || labels.untitled,
        language: APP_LANGUAGE
      });
      if (result.status === "canceled") {
        return false;
      }

      baselineRef.current = contents;
      setActiveDocument(result.document);
      setRecentDocuments((documents) =>
        promoteRecentDocument(documents, result.document)
      );
      excalidrawAPI.setToast({
        message: labels.saved(result.document.name),
        closable: true
      });
      return true;
    } catch (error) {
      console.error("Could not save the current document", error);
      showError(labels.documentError);
      return false;
    }
  }, [excalidrawAPI, labels, serializeCurrentDocument, showError]);

  const commitLoadedDocument = useCallback(
    async ({ candidate, scene }: LoadedDocument): Promise<void> => {
      const document = await window.excalidrawDesktop.documents.commitOpen(
        candidate.id
      );

      awaitingBaselineRef.current = true;
      baselineRef.current = null;
      setInitialData(scene);
      setEditorKey((key) => key + 1);
      setActiveDocument(document);
      setRecentDocuments((documents) =>
        promoteRecentDocument(documents, document)
      );
      setPendingDocument(null);
      setRecentDialogOpen(false);
    },
    []
  );

  const prepareCandidate = useCallback(
    async (candidate: DocumentCandidate): Promise<void> => {
      if (!excalidrawAPI) {
        return;
      }

      let scene: Awaited<ReturnType<typeof loadFromBlob>>;
      try {
        scene = await loadFromBlob(
          new File([candidate.contents], candidate.name, {
            type: MIME_TYPES.excalidraw
          }),
          excalidrawAPI.getAppState(),
          excalidrawAPI.getSceneElementsIncludingDeleted()
        );
      } catch (error) {
        console.error("Could not parse the selected document", error);
        showError(labels.invalidDocument);
        return;
      }

      const currentContents = serializeCurrentDocument();
      const hasUnsavedChanges =
        currentContents !== null &&
        (baselineRef.current === null ||
          currentContents !== baselineRef.current);
      const loadedDocument = { candidate, scene };

      if (hasUnsavedChanges) {
        setPendingDocument(loadedDocument);
      } else {
        await commitLoadedDocument(loadedDocument);
      }
    },
    [
      commitLoadedDocument,
      excalidrawAPI,
      labels.invalidDocument,
      serializeCurrentDocument,
      showError
    ]
  );

  const chooseAndOpenDocument = useCallback(async (): Promise<void> => {
    if (openingDocument || pendingDocument) {
      return;
    }
    setOpeningDocument(true);
    try {
      const candidate =
        await window.excalidrawDesktop.documents.chooseOpen(APP_LANGUAGE);
      if (candidate) {
        await prepareCandidate(candidate);
      }
    } catch (error) {
      console.error("Could not open a document", error);
      showError(labels.documentError);
    } finally {
      setOpeningDocument(false);
    }
  }, [
    labels.documentError,
    openingDocument,
    pendingDocument,
    prepareCandidate,
    showError
  ]);

  const openRecentDocument = useCallback(
    async (document: RecentDocument): Promise<void> => {
      if (openingDocument || pendingDocument) {
        return;
      }
      setRecentDialogOpen(false);
      setOpeningDocument(true);
      try {
        const candidate =
          await window.excalidrawDesktop.documents.readRecent(document.path);
        await prepareCandidate(candidate);
      } catch (error) {
        console.error("Could not open a recent document", error);
        showError(labels.documentError);
        await refreshRecentDocuments();
      } finally {
        setOpeningDocument(false);
      }
    },
    [
      labels.documentError,
      openingDocument,
      pendingDocument,
      prepareCandidate,
      refreshRecentDocuments,
      showError
    ]
  );

  const saveBeforeOpen = useCallback(async (): Promise<void> => {
    if (!pendingDocument || confirmBusy) {
      return;
    }
    setConfirmBusy(true);
    const documentToOpen = pendingDocument;
    const saved = await saveCurrentDocument();
    if (!saved) {
      setPendingDocument(null);
      setConfirmBusy(false);
      return;
    }

    try {
      await commitLoadedDocument(documentToOpen);
    } catch (error) {
      console.error("Could not finish opening the document", error);
      showError(labels.documentError);
      setPendingDocument(null);
    } finally {
      setConfirmBusy(false);
    }
  }, [
    commitLoadedDocument,
    confirmBusy,
    labels.documentError,
    pendingDocument,
    saveCurrentDocument,
    showError
  ]);

  const discardBeforeOpen = useCallback(async (): Promise<void> => {
    if (!pendingDocument || confirmBusy) {
      return;
    }
    setConfirmBusy(true);
    try {
      await commitLoadedDocument(pendingDocument);
    } catch (error) {
      console.error("Could not finish opening the document", error);
      showError(labels.documentError);
      setPendingDocument(null);
    } finally {
      setConfirmBusy(false);
    }
  }, [
    commitLoadedDocument,
    confirmBusy,
    labels.documentError,
    pendingDocument,
    showError
  ]);

  useEffect(() => {
    const handleShortcut = (event: KeyboardEvent): void => {
      if (
        !(event.ctrlKey || event.metaKey) ||
        event.altKey ||
        event.shiftKey ||
        pendingDocument ||
        recentDialogOpen
      ) {
        return;
      }

      if (event.key.toLocaleLowerCase() === "o") {
        event.preventDefault();
        event.stopPropagation();
        void chooseAndOpenDocument();
      } else if (event.key.toLocaleLowerCase() === "s") {
        event.preventDefault();
        event.stopPropagation();
        void saveCurrentDocument();
      }
    };

    window.addEventListener("keydown", handleShortcut, true);
    return () => window.removeEventListener("keydown", handleShortcut, true);
  }, [
    chooseAndOpenDocument,
    pendingDocument,
    recentDialogOpen,
    saveCurrentDocument
  ]);

  const isMac = navigator.platform.toLocaleLowerCase().includes("mac");
  const shortcutPrefix = isMac ? "⌘" : "Ctrl+";

  return (
    <main className="app-shell">
      <Excalidraw
        UIOptions={{
          canvasActions: {
            loadScene: false,
            saveToActiveFile: false
          }
        }}
        excalidrawAPI={setExcalidrawAPI}
        initialData={initialData}
        key={editorKey}
        langCode={APP_LANGUAGE}
        libraryReturnUrl={LIBRARY_RETURN_URL}
        onChange={handleChange}
        validateEmbeddable={validateEmbeddableUrl}
      >
        <MainMenu>
          <MainMenu.Item
            icon={<OpenIcon />}
            onSelect={() => void chooseAndOpenDocument()}
            shortcut={`${shortcutPrefix}O`}
          >
            {labels.open}
          </MainMenu.Item>
          <MainMenu.Item
            icon={<SaveIcon />}
            onSelect={() => void saveCurrentDocument()}
            shortcut={`${shortcutPrefix}S`}
          >
            {labels.saveMenu}
          </MainMenu.Item>
          <MainMenu.Item
            icon={<RecentIcon />}
            onSelect={() => setRecentDialogOpen(true)}
          >
            {labels.recentMenu}
          </MainMenu.Item>
          <MainMenu.DefaultItems.Export />
          <MainMenu.DefaultItems.SaveAsImage />
          <MainMenu.DefaultItems.SearchMenu />
          <MainMenu.DefaultItems.Help />
          <MainMenu.DefaultItems.ClearCanvas />
          <MainMenu.Separator />
          <MainMenu.DefaultItems.ToggleTheme />
          <MainMenu.DefaultItems.ChangeCanvasBackground />
        </MainMenu>
      </Excalidraw>

      {recentDialogOpen && (
        <RecentDocumentsDialog
          busy={openingDocument}
          documents={recentDocuments}
          labels={labels}
          onClose={() => setRecentDialogOpen(false)}
          onOpen={(document) => void openRecentDocument(document)}
        />
      )}

      {pendingDocument && (
        <SaveChangesDialog
          busy={confirmBusy}
          documentName={activeDocument?.name ?? labels.untitled}
          labels={labels}
          onCancel={() => setPendingDocument(null)}
          onDontSave={() => void discardBeforeOpen()}
          onSave={() => void saveBeforeOpen()}
        />
      )}
    </main>
  );
};

ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
