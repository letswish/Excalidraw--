import { mkdir, readFile, rename, unlink, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { app } from "electron";
import {
  LIBRARY_DATA_FILENAME,
  type LibraryPersistedData
} from "../shared/library";

let saveQueue: Promise<void> = Promise.resolve();

const getLibraryDataPath = (): string =>
  join(app.getPath("userData"), LIBRARY_DATA_FILENAME);

const isLibraryPersistedData = (
  value: unknown
): value is LibraryPersistedData => {
  return (
    typeof value === "object" &&
    value !== null &&
    "libraryItems" in value &&
    Array.isArray(value.libraryItems)
  );
};

const backupCorruptedLibraryData = async (dataPath: string): Promise<void> => {
  const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
  const backupPath = join(
    app.getPath("userData"),
    `libraries.corrupt.${timestamp}.json`
  );

  await rename(dataPath, backupPath);
  console.error(`Invalid library data was moved to ${backupPath}`);
};

export const loadLibraryData = async (): Promise<LibraryPersistedData | null> => {
  await saveQueue;

  const dataPath = getLibraryDataPath();
  let serialized: string;

  try {
    serialized = await readFile(dataPath, "utf8");
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      return null;
    }
    throw error;
  }

  try {
    const data: unknown = JSON.parse(serialized);
    if (!isLibraryPersistedData(data)) {
      throw new Error("Library data has an invalid shape");
    }
    return data;
  } catch (error) {
    await backupCorruptedLibraryData(dataPath);
    console.error("Could not parse persisted library data", error);
    return null;
  }
};

const writeLibraryData = async (data: LibraryPersistedData): Promise<void> => {
  if (!isLibraryPersistedData(data)) {
    throw new TypeError("Invalid library data");
  }

  const directory = app.getPath("userData");
  const dataPath = getLibraryDataPath();
  const temporaryPath = join(
    directory,
    `.${LIBRARY_DATA_FILENAME}.${process.pid}.${Date.now()}.tmp`
  );

  await mkdir(directory, { recursive: true, mode: 0o700 });

  try {
    await writeFile(temporaryPath, `${JSON.stringify(data, null, 2)}\n`, {
      encoding: "utf8",
      mode: 0o600
    });
    await rename(temporaryPath, dataPath);
  } catch (error) {
    await unlink(temporaryPath).catch(() => undefined);
    throw error;
  }
};

export const saveLibraryData = (
  data: LibraryPersistedData
): Promise<void> => {
  const saveTask = saveQueue.then(() => writeLibraryData(data));
  saveQueue = saveTask.catch(() => undefined);
  return saveTask;
};
