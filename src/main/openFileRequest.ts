import { extname, isAbsolute, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const EXCALIDRAW_EXTENSION = ".excalidraw";
const URI_SCHEME_PATTERN = /^[a-z][a-z\d+.-]*:/i;

const normalizeFileArgument = (
  argument: string,
  workingDirectory: string
): string | null => {
  if (!argument || argument.startsWith("-")) {
    return null;
  }

  let filePath = argument;
  if (argument.toLocaleLowerCase().startsWith("file:")) {
    try {
      filePath = fileURLToPath(argument);
    } catch {
      return null;
    }
  } else if (URI_SCHEME_PATTERN.test(argument)) {
    return null;
  }

  const resolvedPath = isAbsolute(filePath)
    ? resolve(filePath)
    : resolve(workingDirectory, filePath);

  return extname(resolvedPath).toLocaleLowerCase() === EXCALIDRAW_EXTENSION
    ? resolvedPath
    : null;
};

export const getExcalidrawPathFromArguments = (
  commandLine: readonly string[],
  workingDirectory: string
): string | null => {
  for (let index = commandLine.length - 1; index >= 0; index -= 1) {
    const filePath = normalizeFileArgument(
      commandLine[index],
      workingDirectory
    );
    if (filePath) {
      return filePath;
    }
  }

  return null;
};
