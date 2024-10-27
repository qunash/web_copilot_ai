// Add this at the top of the file
console.log('Web Copilot Click Simulator initialized');

// Create a class to manage the click indicator
class ClickIndicator {
    private element: HTMLDivElement | null = null;
    private initialized: boolean = false;

    constructor() {
        // Don't initialize immediately
        this.waitForDOM();
    }

    private waitForDOM() {
        if (document.body) {
            this.init();
        } else {
            // Wait for DOM to be ready
            document.addEventListener('DOMContentLoaded', () => this.init());
        }
    }

    private init() {
        if (this.initialized) return;
        
        this.element = document.createElement('div');
        this.element.id = 'web-copilot-click-indicator';
        this.element.style.cssText = `
            position: fixed;
            pointer-events: none;
            width: 40px;
            height: 40px;
            border: 2px solid #22c55e;
            background-color: rgba(34, 197, 94, 0.2);
            border-radius: 50%;
            z-index: 2147483647;
            transform: translate(-50%, -50%);
            transition: all 0.4s ease-out;
            opacity: 0;
        `;
        document.body.appendChild(this.element);
        this.initialized = true;
    }

    show(x: number, y: number) {
        if (!this.initialized) {
            this.init();
        }
        if (!this.element) return;
        this.element.style.left = `${x}px`;
        this.element.style.top = `${y}px`;
        this.element.style.opacity = '1';
        this.element.animate([
            { transform: 'translate(-50%, -50%) scale(1.2)', opacity: 1 },
            { transform: 'translate(-50%, -50%) scale(1)', opacity: 1 }
        ], {
            duration: 300,
            iterations: 1
        });
    }

    hide() {
        if (!this.element) return;
        this.element.style.opacity = '0';
    }

    cleanup() {
        if (this.element?.parentNode) {
            this.element.parentNode.removeChild(this.element);
        }
        this.element = null;
        this.initialized = false;
    }
}

// Create a global instance
const clickIndicator = new ClickIndicator();

// Export functions that will be called from the extension
async function simulateClick(x: number, y: number): Promise<string> {
    try {
        clickIndicator.show(x, y);
        // Wait for both the initial delay and animation to complete
        await new Promise(resolve => setTimeout(resolve, 400));

        const element = document.elementFromPoint(x, y);
        // if (!element || !(element instanceof HTMLElement)) {
        if (!element) {
            throw new Error(`No clickable element found at (${x}, ${y})`);
        }

        // console.log(`Found element at (${x}, ${y}):`, element.tagName, element);

        // Dispatch event sequence with proper typing
        const eventSequence: [EventType, EventOptions][] = [
            ['mousemove', { buttons: 0 }],
            ['mousedown', { buttons: 1 }],
            ['focus', { bubbles: true }],
            ['mouseup', { buttons: 0 }],
            ['click', { buttons: 0 }]
        ];

        eventSequence.forEach(([type, options]) => {
            const EventClass = type === 'focus' ? FocusEvent : MouseEvent;
            const event = new EventClass(type, {
                view: window,
                bubbles: true,
                cancelable: true,
                clientX: x,
                clientY: y,
                ...options
            });
            if (!element.dispatchEvent(event)) {
                throw new Error(`${type} event was cancelled`);
            }
        });

        if (element instanceof HTMLInputElement || element instanceof HTMLTextAreaElement) {
            element.focus();
            // console.log('Input element focused');
        }

        clickIndicator.hide();
        return `Successfully clicked ${element.tagName.toLowerCase()}${element.id ? `#${element.id}` : ''} at (${x}, ${y})`;
    } catch (error) {
        clickIndicator.hide();
        throw error instanceof Error ? error : new Error('Unknown error during click simulation');
    }
}

// Add type declaration for the global object
declare global {
    interface Window {
        webCopilotClickSimulator: {
            simulateClick(x: number, y: number): Promise<string>;
        };
    }
}

// Add these type definitions at the top of the file, after the global interface declaration
type SimulateClickMessage = {
    type: 'SIMULATE_CLICK';
    payload: {
        x: number;
        y: number;
    };
};

type SimulateClickResponse = {
    success: boolean;
    result?: string;
    error?: string;
};

// Replace the existing chrome.runtime.onMessage listener with this updated version
chrome.runtime.onMessage.addListener((
    message: SimulateClickMessage,
    sender: chrome.runtime.MessageSender,
    sendResponse: (response: SimulateClickResponse) => void
) => {
    console.log('Click Simulator received message:', message);
    
    if (message.type === 'SIMULATE_CLICK') {
        simulateClick(message.payload.x, message.payload.y)
            .then(result => sendResponse({ success: true, result }))
            .catch(error => sendResponse({ 
                success: false, 
                error: error instanceof Error ? error.message : 'Unknown error' 
            }));
        return true;
    }
    return false;
});

// Cleanup on page unload
window.addEventListener('pagehide', () => clickIndicator.cleanup());

// Alternatively, also listen for beforeunload for broader compatibility
window.addEventListener('beforeunload', () => clickIndicator.cleanup());

// Add these type definitions near the top of the file
type EventType = 'mousemove' | 'mousedown' | 'focus' | 'mouseup' | 'click';
type EventOptions = {
    buttons?: number;
    bubbles?: boolean;
    cancelable?: boolean;
};
