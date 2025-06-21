// DevTools entry point - registers the TanStack Query panel
chrome.devtools.panels.create(
  "TanStack Query",
  "", // icon path (empty for now)
  "index.html", // panel page
);
