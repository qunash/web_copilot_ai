import { handleChatRequest } from './services/chatService';

// Configure the side panel to open when the action (extension icon) is clicked
chrome.sidePanel
  .setPanelBehavior({ openPanelOnActionClick: true })
  .catch((error) => console.error('Failed to set panel behavior:', error));

self.addEventListener('fetch', (event: FetchEvent) => {
  if (event.request.url.endsWith('/api/chat')) {
    event.respondWith(handleChatRequest(event.request));
  }
});
