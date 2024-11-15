export class PageInteractions {
    private keyPressIndicator: KeyPressIndicator;

    constructor() {
        this.keyPressIndicator = new KeyPressIndicator();
    }

    public handleMessage(type: string, payload: any, sendResponse: (response: any) => void): boolean {
        try {
            const handlers: Record<string, () => Promise<PageInteractionResponse> | PageInteractionResponse> = {
                SCROLL_PAGE: () => this.pageUpOrDown(payload.direction),
                TYPE_TEXT: () => this.typeText(payload.text),
                PRESS_KEY: () => this.handleKeyPress(payload.key, payload.modifiers),
                GET_DEVICE_PIXEL_RATIO: () => ({ success: true, result: window.devicePixelRatio }),
                PROCESS_SCREENSHOT: async () => {
                    if (!payload.dataUrl || !payload.zoomFactor || !payload.devicePixelRatio) {
                        throw new Error('Missing required screenshot processing parameters');
                    }
                    const processedDataUrl = await this.processScreenshot(
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
                    return this.scrollAtPosition(
                        payload.x,
                        payload.y,
                        payload.deltaY
                    );
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
    }

    public getPublicTools() {
        return {
            pageUpOrDown: this.pageUpOrDown.bind(this),
            typeText: this.typeText.bind(this),
            handleKeyPress: this.handleKeyPress.bind(this),
            scrollAtPosition: this.scrollAtPosition.bind(this)
        };
    }

    private pageUpOrDown(direction: 'up' | 'down'): string {
        const amount = direction === 'up' ? -window.innerHeight : window.innerHeight;
        window.scrollBy(0, amount);
        
        // Show the key press indicator
        const key = direction === 'up' ? 'PageUp' : 'PageDown';
        this.keyPressIndicator.show(key);
        
        return `Scrolled ${direction} one page`;
    }

    private typeText(text: string): string {
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
    }

    private handleKeyPress(key: string, modifiers: string[] = []): string {
        const modifierState = {
            ctrl: modifiers.includes('control'),
            alt: modifiers.includes('alt'),
            shift: modifiers.includes('shift'),
            meta: modifiers.includes('meta')
        };

        // Special handling for Enter key
        if (key === 'Enter') {
            const activeElement = document.activeElement as HTMLElement;
            if (activeElement) {
                
                // If the element is inside a form, handle form submission
                const form = activeElement.closest('form');
                if (form) {
                    if (activeElement instanceof HTMLInputElement) {
                        // Try to find and click an associated submit button
                        const submitButton = form.querySelector('button[type="submit"], input[type="submit"]') as HTMLElement;
                        if (submitButton) {
                            submitButton.click();
                            this.keyPressIndicator.show(key, modifiers);
                            return `Pressed key: ${key} and clicked submit button`;
                        }
                    }

                    // Dispatch submit event
                    const submitEvent = new Event('submit', { bubbles: true, cancelable: true });
                    form.dispatchEvent(submitEvent);
                    
                    // If the event wasn't prevented, actually submit the form
                    if (!submitEvent.defaultPrevented) {
                        form.submit();
                    }
                    
                    this.keyPressIndicator.show(key, modifiers);
                    return `Pressed key: ${key} and submitted form`;
                }
                
                // Handle non-form search inputs
                if (activeElement instanceof HTMLInputElement) {
                    // Try multiple approaches for search inputs
                    
                    // // 1. Look for and click a nearby search button
                    // const searchButton = this.findSearchButton(activeElement);
                    // if (searchButton) {
                    //     searchButton.click();
                    //     this.keyPressIndicator.show(key, modifiers);
                    //     return `Pressed key: ${key} and clicked search button`;
                    // }

                    // 2. Dispatch common search-related events
                    const events = [
                        new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }),
                        new KeyboardEvent('keypress', { key: 'Enter', bubbles: true }),
                        new InputEvent('input', { bubbles: true }),
                        new Event('change', { bubbles: true }),
                        new Event('search', { bubbles: true }),
                        new KeyboardEvent('keyup', { key: 'Enter', bubbles: true })
                    ];

                    events.forEach(event => {
                        activeElement.dispatchEvent(event);
                    });
                }
            }
        }

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
            this.simulateTab(modifierState.shift);
            this.keyPressIndicator.show(key, modifiers);
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
        this.keyPressIndicator.show(key, modifiers);

        // Dispatch events at document level
        document.dispatchEvent(new KeyboardEvent('keydown', eventOptions));
        document.dispatchEvent(new KeyboardEvent('keypress', eventOptions));
        document.dispatchEvent(new KeyboardEvent('keyup', eventOptions));

        return `Pressed key: ${key}${modifiers.length ? ' with modifiers: ' + modifiers.join('+') : ''}`;
    }

    private findSearchButton(input: HTMLElement): HTMLElement | null {
        // Look for buttons in common search button locations
        
        // 1. Next sibling
        let searchButton = input.nextElementSibling as HTMLElement;
        if (searchButton?.tagName === 'BUTTON' || 
            (searchButton?.getAttribute('role') === 'button')) {
            return searchButton;
        }

        // 2. Parent's children
        const parent = input.parentElement;
        if (parent) {
            // Look for buttons or elements with button role
            const buttons = Array.from(parent.querySelectorAll('button, [role="button"]'));
            searchButton = buttons.find(button => {
                const rect = button.getBoundingClientRect();
                // Only consider visible buttons
                return rect.width > 0 && rect.height > 0;
            }) as HTMLElement;
            
            if (searchButton) return searchButton;
        }

        // 3. Look for common search button patterns in nearby elements
        const searchButtonSelectors = [
            'button[type="submit"]',
            'button[aria-label*="search" i]',
            'button[title*="search" i]',
            '[role="button"][aria-label*="search" i]',
            'button.search-button',
            'button.search',
            'button svg[aria-label*="search" i]'
        ];

        const root = input.closest('[role="search"]') || input.parentElement?.parentElement;
        if (root) {
            for (const selector of searchButtonSelectors) {
                const button = root.querySelector(selector) as HTMLElement;
                if (button) return button;
            }
        }

        return null;
    }

    private scrollAtPosition(x: number, y: number, deltaY: number): string {
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
                composed: true,
                clientX: x,
                clientY: y,
                deltaY: deltaY,
                deltaMode: 0,
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
    }

    private async processScreenshot(dataUrl: string, zoomFactor: number, devicePixelRatio: number): Promise<string> {
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

    private simulateTab(shiftKey = false): void {
        const focusable = Array.from(document.querySelectorAll<HTMLElement>(
            'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
        )).filter(el => el.offsetParent !== null);
        
        const currentElement = document.activeElement as HTMLElement | null;
        let currentIndex = currentElement ? focusable.indexOf(currentElement) : -1;
        
        let nextIndex;
        if (shiftKey) {
            nextIndex = currentIndex > 0 ? currentIndex - 1 : focusable.length - 1;
        } else {
            nextIndex = currentIndex < focusable.length - 1 ? currentIndex + 1 : 0;
        }
        
        const nextElement = focusable[nextIndex];
        if (nextElement) {
            nextElement.focus();
            nextElement.dispatchEvent(new Event('focus', { bubbles: true }));
        }
    }
}

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
            background-color: rgba(236, 253, 245, 0.9);
            color: rgb(6, 95, 70);
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
            border: 1px solid rgb(167, 243, 208);
            box-shadow: 0 1px 3px 0 rgb(0 0 0 / 0.1), 0 1px 2px -1px rgb(0 0 0 / 0.1);
            backdrop-filter: blur(8px);
            -webkit-backdrop-filter: blur(8px);
        `;

        const darkModeStyles = document.createElement('style');
        darkModeStyles.textContent = `
            @media (prefers-color-scheme: dark) {
                #web-copilot-key-indicator {
                    color: rgb(167, 243, 208);
                    border-color: rgba(6, 78, 59, 0.5);
                    background-color: rgba(6, 78, 59, 0.8);
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
            'control': '⌃',
            'ctrl': '⌃',
            'alt': '⌥',
            'shift': '⇧',
            'meta': '⌘',
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

    private hide() {
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

// Types
type PageInteractionResponse = 
    | string 
    | { error: string } 
    | { success: boolean; result: number | string };