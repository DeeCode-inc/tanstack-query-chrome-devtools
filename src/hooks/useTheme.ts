import { useState, useEffect } from "react";

interface UseThemeReturn {
  isDarkMode: boolean;
}

export const useTheme = (): UseThemeReturn => {
  const [isDarkMode, setIsDarkMode] = useState<boolean>(false);

  // Detect system dark mode preference
  useEffect(() => {
    const mediaQuery = window.matchMedia("(prefers-color-scheme: dark)");
    const abortController = new AbortController();

    // Set initial state
    setIsDarkMode(mediaQuery.matches);

    // Listen for changes
    mediaQuery.addEventListener(
      "change",
      (e) => {
        setIsDarkMode(e.matches);
      },
      { signal: abortController.signal },
    );

    return () => {
      abortController.abort();
    };
  }, []);

  return { isDarkMode };
};
