// Export functions that will be called from the extension
window.webCopilotTools = {
    pageUpOrDown(direction: 'up' | 'down'): string {
        const amount = direction === 'up' ? -window.innerHeight : window.innerHeight;
        window.scrollBy(0, amount);
        
        // Show the key press indicator
        const key = direction === 'up' ? 'PageUp' : 'PageDown';
        keyPressIndicator.show(key);
        
        return `Scrolled ${direction} one page`;
    },

    typeText(text: string): string {
        const activeElement = document.activeElement as HTMLElement;
        if (!activeElement) {
            return 'No active element found';
        }

        // For input and textarea elements
        if (activeElement instanceof HTMLInputElement || 
            activeElement instanceof HTMLTextAreaElement) {
            
            const start = activeElement.selectionStart || 0;
            const end = activeElement.selectionEnd || 0;
            const value = activeElement.value;
            
            activeElement.value = value.slice(0, start) + text + value.slice(end);
            activeElement.selectionStart = activeElement.selectionEnd = start + text.length;
            
            // Dispatch input event
            const inputEvent = new Event('input', { bubbles: true });
            activeElement.dispatchEvent(inputEvent);
            
            // Dispatch change event
            const changeEvent = new Event('change', { bubbles: true });
            activeElement.dispatchEvent(changeEvent);

            return `Typed text: "${text}"`;
        }
        
        // For contenteditable elements
        if ((activeElement as HTMLElement).isContentEditable) {
            // Create text node
            const textNode = document.createTextNode(text);
            
            // Get selection
            const selection = window.getSelection();
            if (selection && selection.rangeCount > 0) {
                // Get range and insert text
                const range = selection.getRangeAt(0);
                range.deleteContents();
                range.insertNode(textNode);
                
                // Move cursor to end
                range.setStartAfter(textNode);
                range.setEndAfter(textNode);
                selection.removeAllRanges();
                selection.addRange(range);

                // Dispatch input event
                const inputEvent = new InputEvent('input', {
                    bubbles: true,
                    cancelable: true,
                    inputType: 'insertText',
                    data: text
                });
                activeElement.dispatchEvent(inputEvent);
                
                return `Typed text: "${text}"`;
            }
        }

        return 'No suitable input element found';
    },

    handleKeyPress(key: string, modifiers: string[] = []): string {
        const modifierState = {
            ctrl: modifiers.includes('control'),
            alt: modifiers.includes('alt'),
            shift: modifiers.includes('shift'),
            meta: modifiers.includes('meta')
        };

        // For single character keys, convert to proper format
        let keyCode: number;
        let code: string;
        
        if (key.length === 1) {
            // For single characters
            keyCode = key.toUpperCase().charCodeAt(0);
            code = `Key${key.toUpperCase()}`;
        } else {
            // For special keys
            const keyCodeMap: Record<string, number> = {
                'ArrowUp': 38,
                'ArrowDown': 40,
                'ArrowLeft': 37,
                'ArrowRight': 39,
                'Enter': 13,
                'Escape': 27,
                'Tab': 9,
                'Backspace': 8,
                'Delete': 46,
                'Home': 36,
                'End': 35,
                'PageUp': 33,
                'PageDown': 34,
            };
            keyCode = keyCodeMap[key] || key.charCodeAt(0);
            code = key; // Special keys usually have the same code as key
        }

        // Special handling for Tab key
        if (key === 'Tab') {
            simulateTab(modifierState.shift);
            keyPressIndicator.show(key, modifiers);
            return `Pressed key: ${key}${modifiers.length ? ' with modifiers: ' + modifiers.join('+') : ''}`;
        }

        const eventOptions: KeyboardEventInit = {
            key: key.length === 1 ? key.toLowerCase() : key,
            code,
            keyCode,
            which: keyCode,
            bubbles: true,
            cancelable: true,
            composed: true,
            ctrlKey: modifierState.ctrl,
            altKey: modifierState.alt,
            shiftKey: modifierState.shift,
            metaKey: modifierState.meta
        };

        // Show the key press indicator
        keyPressIndicator.show(key, modifiers);

        // Dispatch events at document level
        document.dispatchEvent(new KeyboardEvent('keydown', eventOptions));
        document.dispatchEvent(new KeyboardEvent('keypress', eventOptions));
        document.dispatchEvent(new KeyboardEvent('keyup', eventOptions));

        return `Pressed key: ${key}${modifiers.length ? ' with modifiers: ' + modifiers.join('+') : ''}`;
    },

    scrollAtPosition(x: number, y: number, deltaY: number): string {
        // Find the element at the specified position
        const element = document.elementFromPoint(x, y);
        if (!element) {
            return 'No element found at specified position';
        }

        // Function to find scrollable parent
        const getScrollableParent = (node: Element): Element | null => {
            const isScrollable = (el: Element): boolean => {
                const style = window.getComputedStyle(el);
                const overflowY = style.getPropertyValue('overflow-y');
                return overflowY !== 'visible' && overflowY !== 'hidden' && 
                       (el as HTMLElement).scrollHeight > (el as HTMLElement).clientHeight;
            };

            if (node === document.body) {
                return document.body;
            }

            let parent = node.parentElement;
            while (parent) {
                if (isScrollable(parent)) {
                    return parent;
                }
                parent = parent.parentElement;
            }
            return document.body;
        };

        // Get the scrollable container
        const scrollContainer = getScrollableParent(element);
        
        if (scrollContainer) {
            // Use smooth scrolling with requestAnimationFrame for better performance
            const currentScroll = scrollContainer.scrollTop;
            const targetScroll = currentScroll + deltaY;
            
            scrollContainer.scrollTo({
                top: targetScroll,
                behavior: 'smooth'
            });

            // Also dispatch a native wheel event for compatibility
            const wheelEvent = new WheelEvent('wheel', {
                bubbles: true,
                cancelable: true,
                composed: true,  // Allows the event to cross shadow DOM boundaries
                clientX: x,
                clientY: y,
                deltaY: deltaY,
                deltaMode: 0,    // 0 = pixel mode
                view: window
            });
            
            element.dispatchEvent(wheelEvent);
        } else {
            // Fallback to window scroll if no scrollable container found
            window.scrollBy({
                top: deltaY,
                behavior: 'smooth'
            });
        }

        return `Scrolled at position (${x}, ${y}) with delta ${deltaY}`;
    },
};

// Add type declaration for the global object
declare global {
    interface Window {
        webCopilotTools: {
            pageUpOrDown(direction: 'up' | 'down'): string;
            typeText(text: string): string;
            handleKeyPress(key: string, modifiers?: string[]): string;
            scrollAtPosition(x: number, y: number, deltaY: number): string;
        };
    }
}

// Simplify PageInteractionMessage type
type PageInteractionMessage = {
    type: 'SCROLL_PAGE' | 'TYPE_TEXT' | 'PRESS_KEY' | 'GET_DEVICE_PIXEL_RATIO' | 'PROCESS_SCREENSHOT' | 'SCROLL_AT_POSITION' | 'SIMULATE_CLICK';
    payload?: Partial<{
        direction: 'up' | 'down';
        text: string;
        key: string;
        modifiers: string[];
        dataUrl: string;
        zoomFactor: number;
        devicePixelRatio: number;
        x: number;
        y: number;
        deltaY: number;
        coordinates: string;
        clickType?: 'single' | 'double' | 'triple';
    }>;
};

// Update the PageInteractionResponse type to handle all response types
type PageInteractionResponse = 
    | string 
    | { error: string } 
    | { success: boolean; result: number | string }; // Allow both number and string results

// Add this function to handle image processing
async function processScreenshot(dataUrl: string, zoomFactor: number, devicePixelRatio: number): Promise<string> {
    const img = new Image();
    await new Promise((resolve, reject) => {
        img.onload = resolve;
        img.onerror = reject;
        img.src = dataUrl;
    });

    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    if (!ctx) {
        throw new Error('Failed to get canvas context');
    }

    const scaleFactor = zoomFactor * devicePixelRatio;
    canvas.width = img.width / scaleFactor;
    canvas.height = img.height / scaleFactor;

    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
    return canvas.toDataURL('image/webp');
}

// Update the message listener to ensure consistent return type
chrome.runtime.onMessage.addListener((
    message: PageInteractionMessage,
    _sender: chrome.runtime.MessageSender,
    sendResponse: (response: PageInteractionResponse) => void
) => {
    try {
        const { type, payload = {} } = message;
        
        const handlers: Record<string, () => Promise<PageInteractionResponse> | PageInteractionResponse> = {
            SCROLL_PAGE: () => window.webCopilotTools.pageUpOrDown(payload.direction!),
            TYPE_TEXT: () => window.webCopilotTools.typeText(payload.text!),
            PRESS_KEY: () => window.webCopilotTools.handleKeyPress(payload.key!, payload.modifiers),
            GET_DEVICE_PIXEL_RATIO: () => ({ success: true, result: window.devicePixelRatio }),
            PROCESS_SCREENSHOT: async () => {
                if (!payload.dataUrl || !payload.zoomFactor || !payload.devicePixelRatio) {
                    throw new Error('Missing required screenshot processing parameters');
                }
                const processedDataUrl = await processScreenshot(
                    payload.dataUrl,
                    payload.zoomFactor,
                    payload.devicePixelRatio
                );
                return { success: true, result: processedDataUrl };
            },
            SCROLL_AT_POSITION: () => {
                if (!payload.x || !payload.y || !payload.deltaY) {
                    throw new Error('Missing required scroll position parameters');
                }
                return window.webCopilotTools.scrollAtPosition(
                    payload.x,
                    payload.y,
                    payload.deltaY
                );
            },
            SIMULATE_CLICK: () => {
                // Return a success response with an empty string result
                // to satisfy the PageInteractionResponse type
                return { success: true, result: '' };
            }
        };

        const handler = handlers[type];
        if (!handler) {
            throw new Error(`Unknown message type: ${type}`);
        }

        const result = handler();
        if (result instanceof Promise) {
            result.then(sendResponse).catch(error => {
                sendResponse({ error: error.message });
            });
            return true;
        }
        
        sendResponse(result);
        return true;
    } catch (error) {
        console.error('Error handling message:', error);
        sendResponse({ error: error instanceof Error ? error.message : 'Unknown error' });
        return true;
    }
});

// Add cleanup listeners
window.addEventListener('pagehide', () => keyPressIndicator.cleanup());
window.addEventListener('beforeunload', () => keyPressIndicator.cleanup());

class KeyPressIndicator {
    private element: HTMLDivElement | null = null;
    private hideTimeout: number | null = null;

    constructor() {
        if (document.body) {
            this.init();
        } else {
            document.addEventListener('DOMContentLoaded', () => this.init());
        }
    }

    private init() {
        if (this.element) return;

        this.element = document.createElement('div');
        this.element.id = 'web-copilot-key-indicator';
        this.setupStyles();
        document.body.appendChild(this.element);
    }

    private setupStyles() {
        if (!this.element) return;
        
        this.element.style.cssText = `
            position: fixed;
            right: 20px;
            bottom: 20px;
            padding: 10px 16px;
            background-color: rgba(236, 253, 245, 0.9); /* emerald-50 with transparency */
            color: rgb(6, 95, 70); /* emerald-800 */
            border-radius: 10px;
            font-family: ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, sans-serif;
            font-size: 15px;
            line-height: 1;
            font-weight: 500;
            letter-spacing: -0.01em;
            z-index: 2147483647;
            opacity: 0;
            transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
            transform: translateY(0);
            pointer-events: none;
            display: inline-flex;
            align-items: center;
            gap: 4px;
            justify-content: center;
            border: 1px solid rgb(167, 243, 208); /* emerald-200 */
            box-shadow: 0 1px 3px 0 rgb(0 0 0 / 0.1), 0 1px 2px -1px rgb(0 0 0 / 0.1);
            backdrop-filter: blur(8px);
            -webkit-backdrop-filter: blur(8px);
        `;

        const darkModeStyles = document.createElement('style');
        darkModeStyles.textContent = `
            @media (prefers-color-scheme: dark) {
                #web-copilot-key-indicator {
                    color: rgb(167, 243, 208); /* emerald-200 */
                    border-color: rgba(6, 78, 59, 0.5); /* emerald-900 with transparency */
                    background-color: rgba(6, 78, 59, 0.8); /* emerald-900 with transparency */
                    box-shadow: 0 1px 3px 0 rgb(0 0 0 / 0.2);
                }
            }
        `;
        document.head.appendChild(darkModeStyles);
    }

    show(key: string, modifiers: string[] = []) {
        this.init();
        if (!this.element) return;

        if (this.hideTimeout !== null) {
            window.clearTimeout(this.hideTimeout);
        }

        this.element.textContent = this.formatKeyDisplay(key, modifiers);
        this.element.style.opacity = '1';
        this.element.style.transform = 'translateY(0)';

        this.hideTimeout = window.setTimeout(() => this.hide(), 1000);
    }

    private formatKeyDisplay(key: string, modifiers: string[]): string {
        const modifierSymbols: Record<string, string> = {
            'control': '⌃',  // Control
            'ctrl': '⌃',  // Control
            'alt': '⌥',      // Option
            'shift': '⇧',    // Shift
            'meta': '⌘',     // Command
        };

        const keySymbols: Record<string, string> = {
            'ArrowUp': '↑',
            'ArrowDown': '↓',
            'ArrowLeft': '←',
            'ArrowRight': '→',
            'Enter': '↵',
            'Escape': 'esc',
            'Backspace': '⌫',
            'Delete': '⌦',
            'Home': 'Home',
            'End': 'End',
            'PageUp': 'PageUp',
            'PageDown': 'PageDown',
            'Tab': '⇥',
            ' ': 'space',
        };

        const formattedModifiers = modifiers
            .map(mod => modifierSymbols[mod.toLowerCase()] || mod)
            .join('');
        const formattedKey = keySymbols[key] || key.toUpperCase();

        return formattedModifiers ? `${formattedModifiers}+${formattedKey}` : formattedKey;
    }

    hide() {
        if (!this.element) return;
        this.element.style.opacity = '0';
        this.element.style.transform = 'translateY(10px)';
        this.hideTimeout = null;
    }

    cleanup() {
        if (this.element?.parentNode) {
            this.element.parentNode.removeChild(this.element);
        }
        if (this.hideTimeout !== null) {
            window.clearTimeout(this.hideTimeout);
        }
        this.element = null;
    }
}

// Create a global instance
const keyPressIndicator = new KeyPressIndicator();

function simulateTab(shiftKey = false): void {
    // Get all focusable elements and cast to HTMLElement[]
    const focusable = Array.from(document.querySelectorAll<HTMLElement>(
        'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
    )).filter(el => {
        // Now TypeScript knows el is HTMLElement
        return el.offsetParent !== null;
    });
    
    // Get currently focused element
    const currentElement = document.activeElement as HTMLElement | null;
    let currentIndex = currentElement ? focusable.indexOf(currentElement) : -1;
    
    // Calculate next index
    let nextIndex;
    if (shiftKey) {
        // Shift+Tab moves backwards
        nextIndex = currentIndex > 0 ? currentIndex - 1 : focusable.length - 1;
    } else {
        // Tab moves forwards
        nextIndex = currentIndex < focusable.length - 1 ? currentIndex + 1 : 0;
    }
    
    // Focus next element
    const nextElement = focusable[nextIndex];
    if (nextElement) {
        nextElement.focus();
        nextElement.dispatchEvent(new Event('focus', { bubbles: true }));
    }
}