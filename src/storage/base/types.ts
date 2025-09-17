import type { StorageEnum } from "./enums";
import type { QueryData, MutationData } from "../../types/query";
import type {
  QueryActionMessage,
  BulkQueryActionMessage,
  RequestImmediateUpdateMessage,
} from "../../types/messages";

export type ValueOrUpdateType<D> = D | ((prev: D) => Promise<D> | D);

export type BaseStorageType<D> = {
  get: () => Promise<D>;
  set: (value: ValueOrUpdateType<D>) => Promise<void>;
  getSnapshot: () => D | null;
  subscribe: (listener: () => void) => () => void;
};

export type StorageConfigType<D = string> = {
  /**
   * Assign the {@link StorageEnum} to use.
   * @default Local
   */
  storageEnum?: (typeof StorageEnum)[keyof typeof StorageEnum];
  /**
   * Only for {@link StorageEnum.Session}: Grant Content scripts access to storage area?
   * @default false
   */
  sessionAccessForContentScripts?: boolean;
  /**
   * Keeps state live in sync between all instances of the extension. Like between popup, side panel and content scripts.
   * To allow chrome background scripts to stay in sync as well, use {@link StorageEnum.Session} storage area with
   * {@link StorageConfigType.sessionAccessForContentScripts} potentially also set to true.
   * @see https://stackoverflow.com/a/75637138/2763239
   * @default false
   */
  liveUpdate?: boolean;
  /**
   * An optional props for converting values from storage and into it.
   * @default undefined
   */
  serialization?: {
    /**
     * convert non-native values to string to be saved in storage
     */
    serialize: (value: D) => string;
    /**
     * convert string value from storage to non-native values
     */
    deserialize: (text: string) => D;
  };
};

export interface TanstackQueryStateType {
  queries: QueryData[];
  mutations: MutationData[];
  tanStackQueryDetected: boolean;
  lastUpdated: number;
  artificialStates: Record<string, "loading" | "error">;
}

export interface TanstackQueryStorageType
  extends BaseStorageType<TanstackQueryStateType> {
  // Actions for TanStack Query specific operations
  updateQueries: (queries: QueryData[]) => Promise<void>;
  updateMutations: (mutations: MutationData[]) => Promise<void>;
  setDetectionStatus: (detected: boolean) => Promise<void>;
  updateArtificialStates: (
    states: Record<string, "loading" | "error">,
  ) => Promise<void>;
  clearArtificialStates: () => Promise<void>;
  reset: () => Promise<void>;
  batchUpdate: (updates: {
    queries?: QueryData[];
    mutations?: MutationData[];
    tanStackQueryDetected?: boolean;
    artificialStates?: Record<string, "loading" | "error">;
    clearArtificialStates?: boolean;
  }) => Promise<void>;
}

// Action queue types for storage-based communication
export interface StorageAction {
  id: string;
  timestamp: number;
  type: "QUERY_ACTION" | "BULK_QUERY_ACTION" | "REQUEST_IMMEDIATE_UPDATE";
  payload:
    | QueryActionMessage
    | BulkQueryActionMessage
    | RequestImmediateUpdateMessage;
  processed?: boolean;
}

export interface ActionQueueState {
  actions: StorageAction[];
  lastProcessed: number;
}

// Enhanced storage interface with action queue support
export interface TanstackQueryStorageTypeWithActions
  extends TanstackQueryStorageType {
  enqueueAction(action: Omit<StorageAction, "id" | "timestamp">): Promise<void>;
  dequeueActions(): Promise<StorageAction[]>;
  markActionProcessed(actionId: string): Promise<void>;
  clearProcessedActions(): Promise<void>;
}

// Helper type for tab-scoped storage management
export interface TabScopedStorageManager {
  getStorageForTab: (tabId: number) => TanstackQueryStorageTypeWithActions;
  cleanupTab: (tabId: number) => Promise<void>;
  getAllTabIds: () => Promise<number[]>;
}
