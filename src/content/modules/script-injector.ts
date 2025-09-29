// Content script script injector implementation

export class ContentScriptInjector {
  private injectedScriptLoaded = false;

  async injectScript(): Promise<void> {
    if (this.injectedScriptLoaded) return;

    try {
      // Create script element
      const script = document.createElement("script");
      script.src = chrome.runtime.getURL("injected.js");

      // Set up event handlers
      script.onload = () => {
        this.injectedScriptLoaded = true;
        script.remove(); // Clean up after loading
      };

      script.onerror = () => {
        console.error("Failed to load injected script");
        script.remove();
      };

      // Inject into page
      (document.head || document.documentElement).appendChild(script);
    } catch (error) {
      console.error("Error injecting script:", error);
    }
  }

  get isLoaded(): boolean {
    return this.injectedScriptLoaded;
  }
}
