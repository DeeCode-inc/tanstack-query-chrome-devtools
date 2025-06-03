// DevTools entry point - registers the TanStack Query panel
chrome.devtools.panels.create(
  'TanStack Query',
  '', // icon path (empty for now)
  'index.html', // panel page
  (panel) => {
    console.log('TanStack Query DevTools panel created');

    // Panel lifecycle events
    panel.onShown.addListener(() => {
      console.log('TanStack Query panel shown');
    });

    panel.onHidden.addListener(() => {
      console.log('TanStack Query panel hidden');
    });
  }
);
