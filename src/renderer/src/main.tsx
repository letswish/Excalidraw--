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

type PendingDocumentAction =
  | {
      type: "open";
      document: LoadedDocument;
    }
  | {
      type: "close";
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
      saveChangesBeforeOpenDescription: (name) =>
        `“${name}”包含尚未保存的更改。是否在打开其他文件前保存？`,
      saveChangesBeforeCloseDescription: (name) =>
        `“${name}”包含尚未保存的更改。是否在关闭窗口前保存？`,
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
    saveChangesBeforeOpenDescription: (name) =>
      `“${name}” has unsaved changes. Save before opening another file?`,
    saveChangesBeforeCloseDescription: (name) =>
      `“${name}” has unsaved changes. Save before closing the window?`,
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
  const [pendingAction, setPendingAction] =
    useState<PendingDocumentAction | null>(null);
  const [openingDocument, setOpeningDocument] = useState(false);
  const [confirmBusy, setConfirmBusy] = useState(false);
  const [documentBaselineReady, setDocumentBaselineReady] = useState(false);
  const [externalOpenRevision, setExternalOpenRevision] = useState(0);
  const baselineRef = useRef<string | null>(null);
  const awaitingBaselineRef = useRef(true);
  const processedExternalOpenRevisionRef = useRef(0);
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

  useEffect(() => {
    const unsubscribe =
      window.excalidrawDesktop.documents.onExternalOpenRequested(() => {
        setExternalOpenRevision((revision) => revision + 1);
      });
    setExternalOpenRevision((revision) => revision + 1);
    return unsubscribe;
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
        setDocumentBaselineReady(true);
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

  const hasUnsavedChanges = useCallback((): boolean => {
    const currentContents = serializeCurrentDocument();
    return (
      currentContents !== null &&
      (baselineRef.current === null ||
        currentContents !== baselineRef.current)
    );
  }, [serializeCurrentDocument]);

  useEffect(() => {
    return window.excalidrawDesktop.windowLifecycle.onCloseRequested(() => {
      if (confirmBusy) {
        return;
      }

      if (hasUnsavedChanges()) {
        setRecentDialogOpen(false);
        setPendingAction({ type: "close" });
      } else {
        window.excalidrawDesktop.windowLifecycle.confirmClose();
      }
    });
  }, [confirmBusy, hasUnsavedChanges]);

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
      setDocumentBaselineReady(false);
      setInitialData(scene);
      setEditorKey((key) => key + 1);
      setActiveDocument(document);
      setRecentDocuments((documents) =>
        promoteRecentDocument(documents, document)
      );
      setPendingAction(null);
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

      const loadedDocument = { candidate, scene };

      if (hasUnsavedChanges()) {
        setPendingAction({ type: "open", document: loadedDocument });
      } else {
        await commitLoadedDocument(loadedDocument);
      }
    },
    [
      commitLoadedDocument,
      excalidrawAPI,
      hasUnsavedChanges,
      labels.invalidDocument,
      showError
    ]
  );

  useEffect(() => {
    if (
      !excalidrawAPI ||
      !documentBaselineReady ||
      openingDocument ||
      pendingAction ||
      processedExternalOpenRevisionRef.current >= externalOpenRevision
    ) {
      return;
    }

    processedExternalOpenRevisionRef.current = externalOpenRevision;
    setOpeningDocument(true);

    void (async () => {
      try {
        const candidate =
          await window.excalidrawDesktop.documents.consumeExternalOpen();
        if (candidate) {
          await prepareCandidate(candidate);
        }
      } catch (error) {
        console.error("Could not open an externally requested document", error);
        showError(labels.documentError);
      } finally {
        setOpeningDocument(false);
      }
    })();
  }, [
    documentBaselineReady,
    excalidrawAPI,
    externalOpenRevision,
    labels.documentError,
    openingDocument,
    pendingAction,
    prepareCandidate,
    showError
  ]);

  const chooseAndOpenDocument = useCallback(async (): Promise<void> => {
    if (openingDocument || pendingAction) {
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
    pendingAction,
    prepareCandidate,
    showError
  ]);

  const openRecentDocument = useCallback(
    async (document: RecentDocument): Promise<void> => {
      if (openingDocument || pendingAction) {
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
      pendingAction,
      prepareCandidate,
      refreshRecentDocuments,
      showError
    ]
  );

  const completePendingAction = useCallback(
    async (action: PendingDocumentAction): Promise<void> => {
      if (action.type === "open") {
        await commitLoadedDocument(action.document);
      } else {
        window.excalidrawDesktop.windowLifecycle.confirmClose();
      }
    },
    [commitLoadedDocument]
  );

  const saveBeforePendingAction = useCallback(async (): Promise<void> => {
    if (!pendingAction || confirmBusy) {
      return;
    }
    setConfirmBusy(true);
    const actionToComplete = pendingAction;
    const saved = await saveCurrentDocument();
    if (!saved) {
      setPendingAction(null);
      setConfirmBusy(false);
      return;
    }

    try {
      await completePendingAction(actionToComplete);
    } catch (error) {
      console.error("Could not complete the pending document action", error);
      showError(labels.documentError);
      setPendingAction(null);
    } finally {
      setConfirmBusy(false);
    }
  }, [
    completePendingAction,
    confirmBusy,
    labels.documentError,
    pendingAction,
    saveCurrentDocument,
    showError
  ]);

  const discardBeforePendingAction = useCallback(async (): Promise<void> => {
    if (!pendingAction || confirmBusy) {
      return;
    }
    setConfirmBusy(true);
    try {
      await completePendingAction(pendingAction);
    } catch (error) {
      console.error("Could not complete the pending document action", error);
      showError(labels.documentError);
      setPendingAction(null);
    } finally {
      setConfirmBusy(false);
    }
  }, [
    completePendingAction,
    confirmBusy,
    labels.documentError,
    pendingAction,
    showError
  ]);

  useEffect(() => {
    const handleShortcut = (event: KeyboardEvent): void => {
      if (
        !(event.ctrlKey || event.metaKey) ||
        event.altKey ||
        event.shiftKey ||
        pendingAction ||
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
    pendingAction,
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

      {pendingAction && (
        <SaveChangesDialog
          busy={confirmBusy}
          description={
            pendingAction.type === "close"
              ? labels.saveChangesBeforeCloseDescription(
                  activeDocument?.name ?? labels.untitled
                )
              : labels.saveChangesBeforeOpenDescription(
                  activeDocument?.name ?? labels.untitled
                )
          }
          labels={labels}
          onCancel={() => setPendingAction(null)}
          onDontSave={() => void discardBeforePendingAction()}
          onSave={() => void saveBeforePendingAction()}
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
