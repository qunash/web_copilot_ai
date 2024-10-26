import { z } from 'zod';
import { tool, type CoreToolResult } from 'ai';

type ScriptInjectionFunction = (...args: any[]) => void | Promise<void> | string | Promise<string>;

interface InjectionResult<T = any> {
    frameId: number;
    result: T;
}

// Browser-specific tools implementation
export const browserTools = {
    take_screenshot: tool({
        description: 'Takes a screenshot of the current tab and returns it as a base64 encoded image',
        parameters: z.object({}),
        execute: async (_, { abortSignal } = {}): Promise<{ data: string }> => {
            return takeScreenshot();
        },
        experimental_toToolResultContent(result) {
            return [{ type: 'image', data: result.data, mimeType: 'image/png' }];
        },

    }),

    click: tool({
        description: 'Clicks at the specified coordinates on the current webpage',
        parameters: z.object({
            x: z.number().describe('X coordinate on the page (in pixels)'),
            y: z.number().describe('Y coordinate on the page (in pixels)')
        }),
        execute: async ({ x, y }, { abortSignal } = {}) => {
            try {
                return simulateClick(x, y);
            } catch (error) {
                throw new Error(`Failed to click at coordinates (${x}, ${y}): ${error}`);
            }
        }
    }),

    navigate: tool({
        description: 'Opens the specified URL in a new browser tab',
        parameters: z.object({
            url: z.string().describe('Complete URL to navigate to (must include http:// or https://)')
        }),
        execute: async ({ url }, { abortSignal } = {}) => {
            return navigateToUrl(url);
        }
    }),

    page_down: tool({
        description: 'Scrolls the webpage down by one page',
        parameters: z.object({}),
        execute: async (_, { abortSignal } = {}) => {
            return pageDown();
        }
    }),

    page_up: tool({
        description: 'Scrolls the webpage up by one page',
        parameters: z.object({}),
        execute: async (_, { abortSignal } = {}) => {
            return pageUp();
        }
    }),

    refresh: tool({
        description: 'Refreshes the current webpage',
        parameters: z.object({}),
        execute: async (_, { abortSignal } = {}) => {
            return refreshPage();
        }
    }),

    close_tab: tool({
        description: 'Closes the current browser tab',
        parameters: z.object({}),
        execute: async (_, { abortSignal } = {}) => {
            return closeTab();
        }
    }),

    go_back: tool({
        description: 'Navigate to the previous page in browser history',
        parameters: z.object({}),
        execute: async (_, { abortSignal } = {}) => {
            return goBack();
        }
    }),

    go_forward: tool({
        description: 'Navigate to the next page in browser history',
        parameters: z.object({}),
        execute: async (_, { abortSignal } = {}) => {
            return goForward();
        }
    }),

    type_text: tool({
        description: 'Types the specified text at the current cursor position',
        parameters: z.object({
            text: z.string().describe('The text to type')
        }),
        execute: async ({ text }, { abortSignal } = {}) => {
            return typeText(text);
        }
    }),

    press_key: tool({
        description: 'Simulates pressing a specific keyboard key',
        parameters: z.object({
            key: z.string().describe('The key to press (e.g., "Enter", "Tab", "ArrowUp")'),
            modifiers: z.array(z.enum(['ctrl', 'alt', 'shift', 'meta'])).optional()
                .describe('Optional modifier keys to hold while pressing the key')
        }),
        execute: async ({ key, modifiers }, { abortSignal } = {}) => {
            return pressKey(key, modifiers);
        }
    })
};

// Helper function to safely execute scripts
async function executeScript<T extends ScriptInjectionFunction>(
    tabId: number,
    func: T,
    ...args: Parameters<T>
): Promise<InjectionResult<Awaited<ReturnType<T>>>[]> {
    const results = await chrome.scripting.executeScript({
        target: { tabId },
        func,
        args
    }) as InjectionResult<Awaited<ReturnType<T>>>[];

    return results;
}

// Move the implementation functions outside of the browserTools object
async function takeScreenshot(): Promise<{ data: string }> {
    try {
        const dataUrl = await chrome.tabs.captureVisibleTab(undefined, { format: 'png', quality: 100 });
        if (!dataUrl) {
            throw new Error('Failed to capture screenshot');
        }

        // Extract base64 data directly
        const base64Data = dataUrl.split(',')[1];
        if (!base64Data) {
            throw new Error('Invalid screenshot data format');
        }

        return { data: base64Data };
    } catch (error) {
        throw new Error(`Failed to take screenshot: ${error}`);
    }
}

async function simulateClick(x: number, y: number): Promise<string> {
    try {
        const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
        if (!tab?.id) {
            throw new Error('No active tab found');
        }

        const clickAtPoint = (x: number, y: number): string => {
            const element = document.elementFromPoint(x, y);
            if (!element) {
                throw new Error(`No element found at coordinates (${x}, ${y})`);
            }
            if (!(element instanceof HTMLElement)) {
                throw new Error(`Element at (${x}, ${y}) is not an HTMLElement`);
            }

            const simulateMouseEvent = (eventName: string) => {
                const event = new MouseEvent(eventName, {
                    view: window,
                    bubbles: true,
                    cancelable: true,
                    clientX: x,
                    clientY: y,
                    button: 0
                });
                
                const dispatched = element.dispatchEvent(event);
                if (!dispatched) {
                    throw new Error(`${eventName} event was cancelled`);
                }
            };

            try {
                // Focus the element first
                element.focus();
                
                // Simulate the click sequence
                simulateMouseEvent("mousedown");
                simulateMouseEvent("mouseup");
                simulateMouseEvent("click");

                return `Successfully clicked ${element.tagName.toLowerCase()}${element.id ? `#${element.id}` : ''} at coordinates (${x}, ${y})`;
            } catch (error) {
                if (error instanceof Error) {
                    throw new Error(`Click simulation failed: ${error.message}`);
                }
                throw new Error('Click simulation failed with unknown error');
            }
        };

        const results = await executeScript(tab.id, clickAtPoint, x, y);
        if (!results || !results.length) {
            throw new Error('Script execution returned no results');
        }
        
        return results[0]?.result || 'Click operation completed but no result returned';
        
    } catch (error) {
        const errorMessage = error instanceof Error 
            ? error.message 
            : 'Unknown error occurred during click operation';
        
        console.error('Click operation failed:', error);
        throw new Error(errorMessage);
    }
}

async function navigateToUrl(url: string): Promise<string> {
    const tab = await chrome.tabs.create({ url });
    if (!tab.id) {
        return `Failed to create new tab`;
    }

    // Wait for the page to finish loading
    return new Promise((resolve, reject) => {
        function listener(
            tabId: number,
            changeInfo: { status?: string },
            tab: chrome.tabs.Tab
        ) {
            if (tabId === tab.id && changeInfo.status === 'complete') {
                // Remove the listener once we're done
                chrome.tabs.onUpdated.removeListener(listener);
                resolve(`Successfully loaded page: ${url}`);
            }
        }

        // Add listener for tab updates
        chrome.tabs.onUpdated.addListener(listener);

        // Set a timeout in case the page takes too long to load
        setTimeout(() => {
            chrome.tabs.onUpdated.removeListener(listener);
            resolve(`Opened new tab with URL: ${url} (timeout reached)`);
        }, 30000); // 30 second timeout
    });
}

async function pageDown(): Promise<string> {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab?.id) {
        throw new Error('No active tab found');
    }

    const scrollDown = (): string => {
        window.scrollBy(0, window.innerHeight);
        return 'Scrolled down one page';
    };

    const results = await executeScript(tab.id, scrollDown);
    return results[0].result;
}

async function pageUp(): Promise<string> {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab?.id) {
        throw new Error('No active tab found');
    }

    const scrollUp = (): string => {
        window.scrollBy(0, -window.innerHeight);
        return 'Scrolled up one page';
    };

    const results = await executeScript(tab.id, scrollUp);
    return results[0].result;
}

async function refreshPage(): Promise<string> {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab?.id) {
        throw new Error('No active tab found');
    }

    await chrome.tabs.reload(tab.id);
    return 'Page refreshed successfully';
}

async function closeTab(): Promise<string> {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab?.id) {
        throw new Error('No active tab found');
    }

    await chrome.tabs.remove(tab.id);
    return 'Tab closed successfully';
}

async function goBack(): Promise<string> {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab?.id) {
        throw new Error('No active tab found');
    }

    await chrome.tabs.goBack(tab.id);
    return 'Navigated back successfully';
}

async function goForward(): Promise<string> {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab?.id) {
        throw new Error('No active tab found');
    }

    await chrome.tabs.goForward(tab.id);
    return 'Navigated forward successfully';
}

async function typeText(text: string): Promise<string> {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab?.id) {
        throw new Error('No active tab found');
    }

    const insertText = (text: string): string => {
        const activeElement = document.activeElement as HTMLElement;
        if (activeElement && 'value' in activeElement) {
            const inputElement = activeElement as HTMLInputElement;
            const startPos = inputElement.selectionStart || 0;
            const endPos = inputElement.selectionEnd || 0;
            const currentValue = inputElement.value;

            inputElement.value = currentValue.substring(0, startPos) +
                text +
                currentValue.substring(endPos);

            // Move cursor to end of inserted text
            const newPos = startPos + text.length;
            inputElement.setSelectionRange(newPos, newPos);
            return `Typed text: "${text}"`;
        }
        return `No active input element found`;
    };

    const results = await executeScript(tab.id, insertText, text);
    return results[0].result;
}

async function pressKey(key: string, modifiers: string[] = []): Promise<string> {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab?.id) {
        return `No active tab found`;
    }

    const handleKeyPress = (key: string, modifiers: string[]): string => {
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

        if (key === 'Enter' &&
            (activeElement instanceof HTMLButtonElement ||
                activeElement instanceof HTMLAnchorElement)) {
            activeElement.click();
            return 'Clicked element';
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
    };

    const results = await executeScript(tab.id, handleKeyPress, key, modifiers);
    return results[0].result;
}
