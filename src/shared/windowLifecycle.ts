export const WINDOW_LIFECYCLE_IPC_CHANNELS = {
  closeRequested: "window:close-requested",
  confirmClose: "window:confirm-close"
} as const;

export type WindowLifecycleBridge = {
  onCloseRequested: (callback: () => void) => () => void;
  confirmClose: () => void;
};
