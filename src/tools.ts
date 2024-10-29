import { z } from 'zod';
import { tool, type CoreToolResult } from 'ai';

export const browserTools = {
    take_screenshot: tool({
        description: 'Takes a screenshot of the current tab and returns it as a base64 encoded image',
        parameters: z.object({}),
        execute: async (_, { abortSignal } = {}): Promise<{ data: string } | string> => {
            return takeScreenshot();
        },
        experimental_toToolResultContent(result) {
            // return [{ type: 'image', data: result.data, mimeType: 'image/png' }];
            return typeof result === 'string'
            ? [{ type: 'text', text: result }]
            : [{ type: 'image', data: result.data, mimeType: 'image/png' }];
        },

    }),

    click: tool({
        description: 'Clicks at the specified x and y coordinates on the current webpage. The coordinates are in pixels in the following format: {"x": <x-coordinate>, "y": <y-coordinate>}. There must only be two numbers, one for x and one for y.',
        parameters: z.object({
            x: z.number().describe('X coordinate on the page (in pixels), type: number'),
            y: z.number().describe('Y coordinate on the page (in pixels), type: number')
        }),
        execute: async ({ x, y }, { abortSignal } = {}) => {
            try {
                console.log(`simulateClick tool is called (${x}, ${y})`)
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
        description: 'Presses the Page Down key',
        parameters: z.object({}),
        execute: async (_, { abortSignal } = {}) => {
            return pageDown();
        }
    }),

    page_up: tool({
        description: 'Presses the Page Up key',
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
    }),

    scroll_at_position: tool({
        description: 'Simulates mouse scrolling at the specified coordinates. Positive deltaY scrolls down, negative scrolls up.',
        parameters: z.object({
            x: z.number().describe('X coordinate on the page (in pixels)'),
            y: z.number().describe('Y coordinate on the page (in pixels)'),
            deltaY: z.number().describe('Amount to scroll: positive for down, negative for up')
        }),
        execute: async ({ x, y, deltaY }, { abortSignal } = {}) => {
            return scrollAtPosition(x, y, deltaY);
        }
    }),
};

// Move the implementation functions outside of the browserTools object
async function takeScreenshot(): Promise<{ data: string } | string> {
    try {
        const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
        if (!tab?.id) {
            throw new Error('No active tab found');
        }

        if (tab.url?.startsWith('chrome://')) {
            return 'Cannot take screenshot of `chrome://` pages due to browser security restrictions';
        }

        const zoomFactor = await chrome.tabs.getZoom(tab.id);
        const dataUrl = await chrome.tabs.captureVisibleTab(undefined, { format: 'png', quality: 80 });
        
        if (!dataUrl) {
            throw new Error('Failed to capture screenshot');
        }

        const devicePixelRatio = await sendContentScriptMessage<number>({
            type: 'GET_DEVICE_PIXEL_RATIO'
        });

        const processedImage = await sendContentScriptMessage<string>({
            type: 'PROCESS_SCREENSHOT',
            payload: {
                dataUrl,
                zoomFactor,
                devicePixelRatio: Number(devicePixelRatio)
            }
        });

        if (!processedImage) {
            throw new Error('Failed to process screenshot');
        }

        const base64Data = processedImage.toString().split(',')[1];
        if (!base64Data) {
            throw new Error('Invalid screenshot data format');
        }

        return { data: base64Data };
    } catch (error) {
        return `Failed to take screenshot: ${error}`;
    }
}

// Update the type for content script responses
type ContentScriptResponse<T> = {
    success: boolean;
    result?: T;
    error?: string;
} | string;

// Update the sendContentScriptMessage function for better error handling
async function sendContentScriptMessage<T>(message: { type: string; payload?: any }): Promise<string> {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab?.id) {
        throw new Error('No active tab found');
    }

    try {
        const response = await chrome.tabs.sendMessage(tab.id, message) as ContentScriptResponse<T>;
        
        if (typeof response === 'string') {
            return response;
        }

        if (!response.success) {
            throw new Error(response.error || 'Operation failed');
        }

        return response.result?.toString() || 'Operation completed';
    } catch (error) {
        // Handle both chrome.runtime.lastError and regular errors
        const errorMessage = error instanceof Error 
                ? error.message 
                : 'Unknown error';
        throw new Error(`Content script communication failed: ${errorMessage}`);
    }
}

// Update the simulateClick function
async function simulateClick(x: number, y: number): Promise<string> {
    try {
        const response = await sendContentScriptMessage<string>({
            type: 'SIMULATE_CLICK',
            payload: { x, y }
        });
        return response;
    } catch (error) {
        const errorMessage = error instanceof Error 
            ? error.message 
            : 'Unknown error occurred during click operation';
        console.error('Click operation failed:', error);
        return `Failed to click at coordinates (${x}, ${y}): ${errorMessage}`;
    }
}

async function navigateToUrl(url: string): Promise<string> {
    const tab = await chrome.tabs.create({ url });
    if (!tab.id) {
        return `Failed to create new tab`;
    }

    // Wait for the page to finish loading
    return new Promise((resolve) => {
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
    return sendContentScriptMessage({
        type: 'SCROLL_PAGE',
        payload: { direction: 'down' }
    });
}

async function pageUp(): Promise<string> {
    return sendContentScriptMessage({
        type: 'SCROLL_PAGE',
        payload: { direction: 'up' }
    });
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
    try {
        const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
        if (!tab?.id) {
        return 'No active tab found';
        }

        await chrome.tabs.goBack(tab.id);
        return 'Navigated back successfully';
    } catch (error) {
        return `Failed to navigate back: ${error}`;
    }
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
    return sendContentScriptMessage({
        type: 'TYPE_TEXT',
        payload: { text }
    });
}

async function pressKey(key: string, modifiers: string[] = []): Promise<string> {
    return sendContentScriptMessage({
        type: 'PRESS_KEY',
        payload: { key, modifiers }
    });
}

async function scrollAtPosition(x: number, y: number, deltaY: number): Promise<string> {
    try {
        const response = await sendContentScriptMessage<string>({
            type: 'SCROLL_AT_POSITION',
            payload: { x, y, deltaY }
        });
        return response;
    } catch (error) {
        const errorMessage = error instanceof Error 
            ? error.message 
            : 'Unknown error occurred during scroll operation';
        console.error('Scroll operation failed:', error);
        return `Failed to scroll at coordinates (${x}, ${y}): ${errorMessage}`;
    }
}

