import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { describe, expect, it } from "vitest";
import { getExcalidrawPathFromArguments } from "./openFileRequest";

describe("getExcalidrawPathFromArguments", () => {
  const workingDirectory = "/home/user/Drawings";

  it("returns an absolute .excalidraw path without splitting spaces", () => {
    const filePath = "/home/user/My diagrams/flow chart.excalidraw";
    expect(
      getExcalidrawPathFromArguments(["excalidraw--", filePath], "/tmp")
    ).toBe(filePath);
  });

  it("resolves relative paths against the launching working directory", () => {
    expect(
      getExcalidrawPathFromArguments(
        ["excalidraw--", "团队/架构.excalidraw"],
        workingDirectory
      )
    ).toBe(resolve(workingDirectory, "团队/架构.excalidraw"));
  });

  it("accepts file URLs and decodes their pathname", () => {
    const filePath = "/home/user/My diagrams/架构.excalidraw";
    expect(
      getExcalidrawPathFromArguments(
        ["excalidraw--", pathToFileURL(filePath).href],
        workingDirectory
      )
    ).toBe(filePath);
  });

  it("matches the extension case-insensitively", () => {
    const filePath = "/home/user/Sketch.EXCALIDRAW";
    expect(
      getExcalidrawPathFromArguments(["excalidraw--", filePath], "/tmp")
    ).toBe(filePath);
  });

  it("uses the last matching file when multiple paths are provided", () => {
    expect(
      getExcalidrawPathFromArguments(
        ["excalidraw--", "first.excalidraw", "second.excalidraw"],
        workingDirectory
      )
    ).toBe(resolve(workingDirectory, "second.excalidraw"));
  });

  it("ignores flags, web URLs, and unrelated files", () => {
    expect(
      getExcalidrawPathFromArguments(
        [
          "excalidraw--",
          "--disable-gpu",
          "https://example.com/drawing.excalidraw",
          "notes.json"
        ],
        workingDirectory
      )
    ).toBeNull();
  });
});
