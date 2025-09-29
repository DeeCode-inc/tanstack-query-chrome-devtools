// Content script action processor wrapper
import type { ActionProcessor } from "../../lib/action-processor";

export class ContentScriptActionProcessor {
  private actionProcessor: ActionProcessor | null = null;

  initialize(actionProcessor: ActionProcessor): void {
    this.actionProcessor = actionProcessor;
  }

  start(): void {
    if (!this.actionProcessor) {
      throw new Error("Action processor not initialized");
    }

    this.actionProcessor.start();
  }

  stop(): void {
    if (this.actionProcessor) {
      this.actionProcessor.stop();
    }
  }

  get isRunning(): boolean {
    return this.actionProcessor?.started || false;
  }

  get isInitialized(): boolean {
    return !!this.actionProcessor;
  }

  cleanup(): void {
    if (this.actionProcessor) {
      this.actionProcessor.stop();
      this.actionProcessor = null;
    }
  }
}
