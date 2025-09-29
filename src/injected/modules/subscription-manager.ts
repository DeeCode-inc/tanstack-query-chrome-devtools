// Subscription management for real-time updates
import type { TanStackQueryDataExtractor } from "./data-extractor";
import type { InjectedScriptMessageCommunicator } from "./message-communicator";

export class TanStackQuerySubscriptionManager {
  private queryUnsubscribe: (() => void) | null = null;
  private mutationUnsubscribe: (() => void) | null = null;
  private dataExtractor: TanStackQueryDataExtractor;
  private messageCommunicator: InjectedScriptMessageCommunicator;

  constructor(
    dataExtractor: TanStackQueryDataExtractor,
    messageCommunicator: InjectedScriptMessageCommunicator,
  ) {
    this.dataExtractor = dataExtractor;
    this.messageCommunicator = messageCommunicator;
  }

  subscribeToQueries(): void {
    const queryClient = window.__TANSTACK_QUERY_CLIENT__;
    if (!queryClient?.getQueryCache) return;

    try {
      // Clean up existing subscription
      if (this.queryUnsubscribe) {
        this.queryUnsubscribe();
      }

      // Subscribe to cache changes
      this.queryUnsubscribe = queryClient.getQueryCache().subscribe(() => {
        this.sendQueryDataUpdate();
      });
    } catch (error) {
      console.error("Error subscribing to query cache:", error);
    }
  }

  subscribeToMutations(): void {
    const queryClient = window.__TANSTACK_QUERY_CLIENT__;
    if (!queryClient?.getMutationCache) return;

    try {
      // Clean up existing subscription
      if (this.mutationUnsubscribe) {
        this.mutationUnsubscribe();
      }

      // Subscribe to mutation cache changes
      this.mutationUnsubscribe = queryClient
        .getMutationCache()
        .subscribe(() => {
          this.sendMutationDataUpdate();
        });
    } catch (error) {
      console.error("Error subscribing to mutation cache:", error);
    }
  }

  private sendQueryDataUpdate(): void {
    try {
      const queries = this.dataExtractor.getQueryData();
      this.messageCommunicator.sendEvent({
        type: "QEVENT",
        subtype: "QUERY_DATA_UPDATE",
        payload: queries,
      });
    } catch (error) {
      console.error("Error sending query data update:", error);
    }
  }

  private sendMutationDataUpdate(): void {
    try {
      const mutations = this.dataExtractor.getMutationData();
      this.messageCommunicator.sendEvent({
        type: "QEVENT",
        subtype: "MUTATION_DATA_UPDATE",
        payload: mutations,
      });
    } catch (error) {
      console.error("Error sending mutation data update:", error);
    }
  }

  cleanup(): void {
    if (this.queryUnsubscribe) {
      try {
        this.queryUnsubscribe();
      } catch (error) {
        console.warn("Error cleaning up query subscription:", error);
      }
      this.queryUnsubscribe = null;
    }

    if (this.mutationUnsubscribe) {
      try {
        this.mutationUnsubscribe();
      } catch (error) {
        console.warn("Error cleaning up mutation subscription:", error);
      }
      this.mutationUnsubscribe = null;
    }
  }
}
