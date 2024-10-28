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
        if (!element) {
            throw new Error(`No clickable element found at (${x}, ${y})`);
        }

        // Define the sequence of pointer events
        const eventSequence: Array<[string, PointerEventInit]> = [
            ['pointerover', { isPrimary: true, pressure: 0, pointerId: 1 }],
            ['pointerenter', { isPrimary: true, pressure: 0, pointerId: 1 }],
            ['pointermove', { isPrimary: true, pressure: 0, pointerId: 1 }],
            ['pointerdown', { isPrimary: true, pressure: 0.5, pointerId: 1 }],
            ['pointerup', { isPrimary: true, pressure: 0, pointerId: 1 }],
            // Include mouse events for better compatibility
            ['mousedown', { buttons: 1 }],
            ['focus', { bubbles: true }],
            ['mouseup', { buttons: 0 }],
            ['click', { buttons: 0 }],
            ['focus', { bubbles: true }]
        ];

        // Create and dispatch each event
        eventSequence.forEach(([type, options]) => {
            const eventInit = {
                view: window,
                bubbles: true,
                cancelable: true,
                clientX: x,
                clientY: y,
                screenX: x,
                screenY: y,
                ...options
            };

            let event;
            if (type.startsWith('pointer')) {
                event = new PointerEvent(type, {
                    pointerType: 'mouse',
                    width: 1,
                    height: 1,
                    ...eventInit
                });
            } else {
                event = new MouseEvent(type, eventInit);
            }

            element.dispatchEvent(event);
            console.log(`Dispatched ${type} at (${x}, ${y}) on`, element);
        });

        // Attempt to focus on the element after events
        if (element instanceof HTMLElement) {
            element.focus();
            console.log(`Focused on element at (${x}, ${y})`);
        }

        clickIndicator.hide();
        return `Successfully clicked ${element.tagName.toLowerCase()}${element.id ? `#${element.id}` : ''} at (${x}, ${y})`;
    } catch (error) {
        clickIndicator.hide();
        // throw error instanceof Error ? error : new Error('Unknown error during click simulation');
        return `Error during click simulation: ${error instanceof Error ? error.message : 'Unknown error'}`;
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
    // console.log('Click Simulator received message:', message);

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
