// Export functions that will be called from the extension
window.webCopilotTools = {
    pageUpOrDown(direction: 'up' | 'down'): string {
        const amount = direction === 'up' ? -window.innerHeight : window.innerHeight;
        window.scrollBy(0, amount);
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
        if (activeElement.isContentEditable) {
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
        const activeElement = document.activeElement || document.body;

        if (activeElement instanceof HTMLInputElement ||
            activeElement instanceof HTMLTextAreaElement) {

            if (key === 'Enter' && activeElement.form) {
                activeElement.form.submit();
                return 'Form submitted';
            } else if (key === 'Tab') {
                const focusableElements = 'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])';
                const elements = Array.from(document.querySelectorAll(focusableElements));
                const index = elements.indexOf(activeElement);
                const nextElement = elements[index + 1] || elements[0];
                (nextElement as HTMLElement).focus();
                return 'Moved focus to next element';
            } else if (key === 'Backspace') {
                const start = activeElement.selectionStart || 0;
                const end = activeElement.selectionEnd || 0;
                if (start === end) {
                    activeElement.value = activeElement.value.slice(0, start - 1) +
                        activeElement.value.slice(end);
                    activeElement.setSelectionRange(start - 1, start - 1);
                } else {
                    activeElement.value = activeElement.value.slice(0, start) +
                        activeElement.value.slice(end);
                    activeElement.setSelectionRange(start, start);
                }
                return 'Deleted text';
            }
        }

        const scrollAmount = 40;
        switch (key) {
            case 'ArrowUp':
                window.scrollBy(0, -scrollAmount);
                return 'Scrolled up';
            case 'ArrowDown':
                window.scrollBy(0, scrollAmount);
                return 'Scrolled down';
            case 'ArrowLeft':
                window.scrollBy(-scrollAmount, 0);
                return 'Scrolled left';
            case 'ArrowRight':
                window.scrollBy(scrollAmount, 0);
                return 'Scrolled right';
            case 'PageUp':
                window.scrollBy(0, -window.innerHeight);
                return 'Scrolled up one page';
            case 'PageDown':
                window.scrollBy(0, window.innerHeight);
                return 'Scrolled down one page';
            case 'Home':
                window.scrollTo(0, 0);
                return 'Scrolled to top';
            case 'End':
                window.scrollTo(0, document.body.scrollHeight);
                return 'Scrolled to bottom';
            default:
                return `Pressed key: ${key}${modifiers.length ? ' with modifiers: ' + modifiers.join('+') : ''}`;
        }
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

// Add these type definitions after the global interface declaration
type PageInteractionMessage = {
    type: 'SCROLL_PAGE' | 'TYPE_TEXT' | 'PRESS_KEY' | 'GET_DEVICE_PIXEL_RATIO' | 'PROCESS_SCREENSHOT' | 'SCROLL_AT_POSITION';
    payload?: {
        direction?: 'up' | 'down';
        text?: string;
        key?: string;
        modifiers?: string[];
        // Add new payload properties for PROCESS_SCREENSHOT
        dataUrl?: string;
        zoomFactor?: number;
        devicePixelRatio?: number;
        x?: number;
        y?: number;
        deltaY?: number;
    };
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
    sender: chrome.runtime.MessageSender,
    sendResponse: (response: PageInteractionResponse) => void
) => {
    // console.log('Page Interactions content script received message:', message);
    try {
        switch (message.type) {
            case 'SCROLL_PAGE':
                sendResponse(window.webCopilotTools.pageUpOrDown(message.payload!.direction!));
                break;
            case 'TYPE_TEXT':
                sendResponse(window.webCopilotTools.typeText(message.payload!.text!));
                break;
            case 'PRESS_KEY':
                sendResponse(window.webCopilotTools.handleKeyPress(
                    message.payload!.key!,
                    message.payload!.modifiers
                ));
                break;
            case 'GET_DEVICE_PIXEL_RATIO':
                sendResponse({
                    success: true,
                    result: window.devicePixelRatio
                });
                break;
            case 'PROCESS_SCREENSHOT':
                if (!message.payload?.dataUrl || 
                    !message.payload?.zoomFactor || 
                    !message.payload?.devicePixelRatio) {
                    throw new Error('Missing required screenshot processing parameters');
                }
                
                processScreenshot(
                    message.payload.dataUrl,
                    message.payload.zoomFactor,
                    message.payload.devicePixelRatio
                )
                    .then(processedDataUrl => {
                        sendResponse({ success: true, result: processedDataUrl });
                    })
                    .catch(error => {
                        sendResponse({ success: false, error: error.message });
                    });
                return true;
            case 'SCROLL_AT_POSITION':
                if (!message.payload?.x || !message.payload?.y || !message.payload?.deltaY) {
                    throw new Error('Missing required scroll position parameters');
                }
                sendResponse(window.webCopilotTools.scrollAtPosition(
                    message.payload.x,
                    message.payload.y,
                    message.payload.deltaY
                ));
                break;
        }
    } catch (error) {
        console.error('Error handling message:', error);
        sendResponse({ error: error instanceof Error ? error.message : 'Unknown error' });
    }
    return true;
});
