// Script injection utility for content script
// Injects the injected script into the page context

/**
 * Injects a script into the page's DOM
 * @param scriptUrl - The URL of the script to inject (from chrome.runtime.getURL)
 * @returns Promise that resolves when script is loaded or rejects on error
 */
export async function injectScript(scriptUrl: string): Promise<void> {
  return new Promise((resolve, reject) => {
    try {
      // Create script element
      const script = document.createElement("script");
      script.src = scriptUrl;

      // Set up event handlers
      script.onload = () => {
        script.remove(); // Clean up after loading
        resolve();
      };

      script.onerror = () => {
        const error = new Error(`Failed to load script: ${scriptUrl}`);
        console.error(error.message);
        script.remove();
        reject(error);
      };

      // Inject into page
      (document.head || document.documentElement).appendChild(script);
    } catch (error) {
      console.error("Error injecting script:", error);
      reject(error);
    }
  });
}
