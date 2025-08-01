import type { QueryData, MutationData } from "./query";

export interface QueryState {
  queries: QueryData[];
  mutations: MutationData[];
  tanStackQueryDetected: boolean;
  lastUpdated: number;
  tabId?: number;
  artificialStates?: Record<string, "loading" | "error">;
}
