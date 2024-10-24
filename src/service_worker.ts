// Configure the side panel to open when the action (extension icon) is clicked
chrome.sidePanel
  .setPanelBehavior({ openPanelOnActionClick: true })
  .catch((error) => console.error('Failed to set panel behavior:', error));

// Optional: Listen for when the extension is installed or updated
chrome.runtime.onInstalled.addListener(() => {
  // Set default options for the side panel
  chrome.sidePanel
    .setOptions({
      path: 'sidepanel.html',
      enabled: true
    })
    .catch((error) => console.error('Failed to set panel options:', error));
});

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === 'action_take_screenshot') {
    chrome.tabs.captureVisibleTab(
      undefined,
      { format: 'png', quality: 100 },
      (dataUrl) => {
        if (!dataUrl) {
          console.error('Screenshot capture failed');
          (sendResponse as (response: any) => void)({ success: false, error: 'Failed to capture screenshot' });
        } else {
          (sendResponse as (response: any) => void)({
            success: true,
            imageData: dataUrl
          });
        }
      }
    );

    // Return true to indicate we will send a response asynchronously
    return true;
  }

});