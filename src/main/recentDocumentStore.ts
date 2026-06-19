import { mkdir, readFile, rename, stat, unlink, writeFile } from "node:fs/promises";
import { basename, extname, join, resolve } from "node:path";
import { app } from "electron";
import {
  MAX_RECENT_DOCUMENTS,
  RECENT_DOCUMENTS_DATA_FILENAME,
  type RecentDocument
} from "../shared/documents";

type RecentDocumentsPersistedData = {
  version: 1;
  recentDocuments: RecentDocument[];
};

let mutationQueue: Promise<void> = Promise.resolve();

const getDataPath = (): string =>
  join(app.getPath("userData"), RECENT_DOCUMENTS_DATA_FILENAME);

const normalizePathForComparison = (filePath: string): string => {
  const normalized = resolve(filePath);
  return process.platform === "win32"
    ? normalized.toLocaleLowerCase()
    : normalized;
};

const isExcalidrawPath = (filePath: string): boolean =>
  extname(filePath).toLocaleLowerCase() === ".excalidraw";

const isRecentDocument = (value: unknown): value is RecentDocument => {
  return (
    typeof value === "object" &&
    value !== null &&
    "path" in value &&
    typeof value.path === "string" &&
    "name" in value &&
    typeof value.name === "string" &&
    "lastOpenedAt" in value &&
    typeof value.lastOpenedAt === "number" &&
    Number.isFinite(value.lastOpenedAt)
  );
};

const isPersistedData = (
  value: unknown
): value is RecentDocumentsPersistedData => {
  return (
    typeof value === "object" &&
    value !== null &&
    "version" in value &&
    value.version === 1 &&
    "recentDocuments" in value &&
    Array.isArray(value.recentDocuments) &&
    value.recentDocuments.every(isRecentDocument)
  );
};

const backupCorruptedData = async (dataPath: string): Promise<void> => {
  const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
  const backupPath = join(
    app.getPath("userData"),
    `recent-files.corrupt.${timestamp}.json`
  );

  await rename(dataPath, backupPath);
  console.error(`Invalid recent-file data was moved to ${backupPath}`);
};

const readPersistedData = async (): Promise<RecentDocument[]> => {
  const dataPath = getDataPath();
  let serialized: string;

  try {
    serialized = await readFile(dataPath, "utf8");
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      return [];
    }
    throw error;
  }

  try {
    const data: unknown = JSON.parse(serialized);
    if (!isPersistedData(data)) {
      throw new Error("Recent-file data has an invalid shape");
    }
    return data.recentDocuments;
  } catch (error) {
    await backupCorruptedData(dataPath);
    console.error("Could not parse persisted recent-file data", error);
    return [];
  }
};

const writePersistedData = async (
  recentDocuments: RecentDocument[]
): Promise<void> => {
  const directory = app.getPath("userData");
  const dataPath = getDataPath();
  const temporaryPath = join(
    directory,
    `.${RECENT_DOCUMENTS_DATA_FILENAME}.${process.pid}.${Date.now()}.tmp`
  );
  const data: RecentDocumentsPersistedData = {
    version: 1,
    recentDocuments
  };

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

const sanitizeRecentDocuments = async (
  entries: RecentDocument[]
): Promise<RecentDocument[]> => {
  const seen = new Set<string>();
  const sanitized: RecentDocument[] = [];

  for (const entry of entries) {
    const resolvedPath = resolve(entry.path);
    const comparisonPath = normalizePathForComparison(resolvedPath);
    if (!isExcalidrawPath(resolvedPath) || seen.has(comparisonPath)) {
      continue;
    }

    try {
      const fileStats = await stat(resolvedPath);
      if (!fileStats.isFile()) {
        continue;
      }
    } catch {
      continue;
    }

    seen.add(comparisonPath);
    sanitized.push({
      path: resolvedPath,
      name: basename(resolvedPath),
      lastOpenedAt: entry.lastOpenedAt
    });

    if (sanitized.length === MAX_RECENT_DOCUMENTS) {
      break;
    }
  }

  return sanitized;
};

const queueMutation = <T>(task: () => Promise<T>): Promise<T> => {
  const result = mutationQueue.then(task);
  mutationQueue = result.then(
    () => undefined,
    () => undefined
  );
  return result;
};

export const loadRecentDocuments = async (): Promise<RecentDocument[]> => {
  await mutationQueue;
  const persisted = await readPersistedData();
  const sanitized = await sanitizeRecentDocuments(persisted);

  if (JSON.stringify(persisted) !== JSON.stringify(sanitized)) {
    await writePersistedData(sanitized);
  }

  return sanitized;
};

export const recordRecentDocument = (
  filePath: string
): Promise<RecentDocument[]> => {
  return queueMutation(async () => {
    const resolvedPath = resolve(filePath);
    if (!isExcalidrawPath(resolvedPath)) {
      throw new TypeError("Only .excalidraw documents can be recorded");
    }

    const persisted = await readPersistedData();
    const comparisonPath = normalizePathForComparison(resolvedPath);
    const next = [
      {
        path: resolvedPath,
        name: basename(resolvedPath),
        lastOpenedAt: Date.now()
      },
      ...persisted.filter(
        (entry) =>
          normalizePathForComparison(entry.path) !== comparisonPath
      )
    ];
    const sanitized = await sanitizeRecentDocuments(next);
    await writePersistedData(sanitized);
    return sanitized;
  });
};

export const isRecordedRecentDocument = async (
  filePath: string
): Promise<boolean> => {
  const comparisonPath = normalizePathForComparison(filePath);
  const recentDocuments = await loadRecentDocuments();
  return recentDocuments.some(
    (entry) => normalizePathForComparison(entry.path) === comparisonPath
  );
};
