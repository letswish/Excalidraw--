import { describe, expect, it, vi } from "vitest";
import { createWindowCloseGuard } from "./windowCloseGuard";

describe("createWindowCloseGuard", () => {
  it("blocks native closes until the renderer approves one", () => {
    const requestCloseConfirmation = vi.fn();
    const closeWindow = vi.fn();
    const preventDefault = vi.fn();
    const guard = createWindowCloseGuard({
      requestCloseConfirmation,
      closeWindow
    });

    guard.handleClose({ preventDefault });

    expect(preventDefault).toHaveBeenCalledOnce();
    expect(requestCloseConfirmation).toHaveBeenCalledOnce();
    expect(closeWindow).not.toHaveBeenCalled();

    guard.approveClose();

    expect(closeWindow).toHaveBeenCalledOnce();

    guard.handleClose({ preventDefault });

    expect(preventDefault).toHaveBeenCalledOnce();
    expect(requestCloseConfirmation).toHaveBeenCalledOnce();
  });

  it("ignores duplicate approvals", () => {
    const closeWindow = vi.fn();
    const guard = createWindowCloseGuard({
      requestCloseConfirmation: vi.fn(),
      closeWindow
    });

    guard.approveClose();
    guard.approveClose();

    expect(closeWindow).toHaveBeenCalledOnce();
  });
});
