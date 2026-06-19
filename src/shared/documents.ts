export const RECENT_DOCUMENTS_DATA_FILENAME = "recent-files.json";
export const MAX_RECENT_DOCUMENTS = 10;

export const DOCUMENT_IPC_CHANNELS = {
  listRecent: "documents:list-recent",
  chooseOpen: "documents:choose-open",
  readRecent: "documents:read-recent",
  commitOpen: "documents:commit-open",
  save: "documents:save"
} as const;

export type RecentDocument = {
  path: string;
  name: string;
  lastOpenedAt: number;
};

export type DocumentCandidate = {
  id: string;
  path: string;
  name: string;
  contents: string;
};

export type DocumentLanguage = "en" | "zh-CN";

export type SaveDocumentRequest = {
  contents: string;
  suggestedName: string;
  language: DocumentLanguage;
};

export type SaveDocumentResult =
  | {
      status: "saved";
      document: RecentDocument;
    }
  | {
      status: "canceled";
    };

export type DocumentBridge = {
  listRecent: () => Promise<RecentDocument[]>;
  chooseOpen: (
    language: DocumentLanguage
  ) => Promise<DocumentCandidate | null>;
  readRecent: (path: string) => Promise<DocumentCandidate>;
  commitOpen: (candidateId: string) => Promise<RecentDocument>;
  save: (request: SaveDocumentRequest) => Promise<SaveDocumentResult>;
};
