import { ClickIndicator } from './clickSimulator';
import { PageInteractions } from './pageInteractions';

// Initialize the modules
const clickIndicator = new ClickIndicator();
const pageInteractions = new PageInteractions();

// Message handler types
type MessageType = 
  | 'SIMULATE_CLICK'
  | 'SCROLL_PAGE'
  | 'TYPE_TEXT'
  | 'PRESS_KEY'
  | 'GET_DEVICE_PIXEL_RATIO'
  | 'PROCESS_SCREENSHOT'
  | 'SCROLL_AT_POSITION';

type Message = {
  type: MessageType;
  payload?: any;
};

// Central message handler
chrome.runtime.onMessage.addListener(function(
  message: any,
  sender: chrome.runtime.MessageSender,
  sendResponse: (response?: any) => void
): boolean {
  try {
    const typedMessage = message as Message;
    const { type, payload } = typedMessage;

    // Route messages to appropriate handlers
    switch (type) {
      case 'SIMULATE_CLICK':
        clickIndicator.handleClick(payload, sendResponse);
        break;
      
      case 'SCROLL_PAGE':
      case 'TYPE_TEXT':
      case 'PRESS_KEY':
      case 'GET_DEVICE_PIXEL_RATIO':
      case 'PROCESS_SCREENSHOT':
      case 'SCROLL_AT_POSITION':
        pageInteractions.handleMessage(type, payload, sendResponse);
        break;
      
      default:
        sendResponse({ 
          success: false, 
          error: `Unknown message type: ${type}` 
        });
        return false;
    }
    
    return true; // Keep the message channel open for async responses
  } catch (error) {
    console.error('Error handling message:', error);
    sendResponse({ 
      success: false, 
      error: error instanceof Error ? error.message : 'Unknown error' 
    });
    return false;
  }
});

// Expose tools to window object
window.webCopilotTools = {
  ...pageInteractions.getPublicTools(),
  simulateClick: clickIndicator.simulateClick.bind(clickIndicator)
};

// Update global type declaration
declare global {
  interface Window {
    webCopilotTools: {
      pageUpOrDown(direction: 'up' | 'down'): string;
      typeText(text: string): string;
      handleKeyPress(key: string, modifiers?: string[]): string;
      scrollAtPosition(x: number, y: number, deltaY: number): string;
      simulateClick(x: number, y: number, clickType?: 'single' | 'double' | 'triple'): Promise<string>;
    };
  }
} 