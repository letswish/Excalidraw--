import React, { useEffect, useState } from "react";
import ReactDOM from "react-dom/client";
import {
  Excalidraw,
  MainMenu,
  useHandleLibrary
} from "@excalidraw/excalidraw";
import type { ExcalidrawImperativeAPI } from "@excalidraw/excalidraw/types";
import "@excalidraw/excalidraw/index.css";
import {
  LIBRARY_RETURN_URL,
  LIBRARY_WINDOW_NAME,
  type LibraryPersistedData
} from "../../shared/library";
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

const App = (): React.JSX.Element => {
  const [excalidrawAPI, setExcalidrawAPI] =
    useState<ExcalidrawImperativeAPI | null>(null);

  useHandleLibrary({
    excalidrawAPI,
    adapter: libraryPersistenceAdapter
  });

  useEffect(() => {
    return window.excalidrawDesktop.libraries.onInstall((hash) => {
      const params = new URLSearchParams(hash.replace(/^#/, ""));
      if (params.has("addLibrary")) {
        window.location.hash = hash;
      }
    });
  }, []);

  return (
    <main className="app-shell">
      <Excalidraw
        excalidrawAPI={setExcalidrawAPI}
        libraryReturnUrl={LIBRARY_RETURN_URL}
        validateEmbeddable={validateEmbeddableUrl}
      >
        <MainMenu>
          <MainMenu.DefaultItems.LoadScene />
          <MainMenu.DefaultItems.SaveToActiveFile />
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
    </main>
  );
};

ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
