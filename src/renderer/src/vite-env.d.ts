/// <reference types="vite/client" />

import type { ExcalidrawDesktopBridge } from "../../shared/library";

declare global {
  interface Window {
    excalidrawDesktop: ExcalidrawDesktopBridge;
  }
}
