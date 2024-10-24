import { handleChatRequest } from './services/chatService';

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

// Add this new listener for fetch events
self.addEventListener('fetch', (event: FetchEvent) => {
  if (event.request.url.endsWith('/api/chat')) {
    event.respondWith(handleChatRequest(event.request));
  }
});
