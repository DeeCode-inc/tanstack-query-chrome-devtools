import type { ValueOrUpdateType } from "./base/index.js";
import type { QueryData, MutationData } from "../types/query";

export type BaseStorageType<D> = {
  get: () => Promise<D>;
  set: (value: ValueOrUpdateType<D>) => Promise<void>;
  getSnapshot: () => D | null;
  subscribe: (listener: () => void) => () => void;
};

export type TanstackQueryStateType = {
  queries: QueryData[];
  mutations: MutationData[];
  tanStackQueryDetected: boolean;
  lastUpdated: number;
  artificialStates: Record<string, "loading" | "error">;
};

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
}

// Helper type for tab-scoped storage management
export interface TabScopedStorageManager {
  getStorageForTab: (tabId: number) => TanstackQueryStorageType;
  cleanupTab: (tabId: number) => Promise<void>;
  getAllTabIds: () => Promise<number[]>;
}
