import { z } from 'zod';
import { tool } from 'ai';

export interface ToolResult {
    output?: string;
    error?: string;
    image_data_url?: string;
    system?: string;
}

// Browser-specific tools implementation
export class BrowserTools {
    private tools = {
        take_screenshot: tool({
            description: 'Takes a screenshot of the current tab and returns it as a base64 encoded image',
            parameters: z.object({}),
            execute: async () => {
                return this.takeScreenshot();
            }
        }),

        click: tool({
            description: 'Clicks at the specified coordinates on the current webpage',
            parameters: z.object({
                x: z.number().describe('X coordinate on the page (in pixels)'),
                y: z.number().describe('Y coordinate on the page (in pixels)')
            }),
            execute: async ({ x, y }) => {
                return this.simulateClick(x, y);
            }
        }),

        navigate: tool({
            description: 'Opens the specified URL in a new browser tab',
            parameters: z.object({
                url: z.string().describe('Complete URL to navigate to (must include http:// or https://)')
            }),
            execute: async ({ url }) => {
                return this.navigateToUrl(url);
            }
        }),

        page_down: tool({
            description: 'Scrolls the webpage down by one page',
            parameters: z.object({}),
            execute: async () => {
                return this.pageDown();
            }
        }),

        page_up: tool({
            description: 'Scrolls the webpage up by one page',
            parameters: z.object({}),
            execute: async () => {
                return this.pageUp();
            }
        }),

        refresh: tool({
            description: 'Refreshes the current webpage',
            parameters: z.object({}),
            execute: async () => {
                return this.refreshPage();
            }
        }),

        close_tab: tool({
            description: 'Closes the current browser tab',
            parameters: z.object({}),
            execute: async () => {
                return this.closeTab();
            }
        }),

        go_back: tool({
            description: 'Navigate to the previous page in browser history',
            parameters: z.object({}),
            execute: async () => {
                return this.goBack();
            }
        }),

        go_forward: tool({
            description: 'Navigate to the next page in browser history',
            parameters: z.object({}),
            execute: async () => {
                return this.goForward();
            }
        }),

        type_text: tool({
            description: 'Types the specified text at the current cursor position',
            parameters: z.object({
                text: z.string().describe('The text to type')
            }),
            execute: async ({ text }) => {
                return this.typeText(text);
            }
        }),

        press_key: tool({
            description: 'Simulates pressing a specific keyboard key',
            parameters: z.object({
                key: z.string().describe('The key to press (e.g., "Enter", "Tab", "ArrowUp")'),
                modifiers: z.array(z.enum(['ctrl', 'alt', 'shift', 'meta'])).optional()
                    .describe('Optional modifier keys to hold while pressing the key')
            }),
            execute: async ({ key, modifiers }) => {
                return this.pressKey(key, modifiers);
            }
        })
    };

    async runTool(name: string, input: any): Promise<ToolResult> {
        switch (name) {
            case 'take_screenshot':
                // Directly call the takeScreenshot method without sending a message
                return this.takeScreenshot();
            case 'click':
                return this.simulateClick(input.x, input.y);
            case 'navigate':
                return this.navigateToUrl(input.url);
            case 'page_down':
                return this.pageDown();
            case 'page_up':
                return this.pageUp();
            case 'refresh':
                return this.refreshPage();
            case 'close_tab':
                return this.closeTab();
            case 'go_back':
                return this.goBack();
            case 'go_forward':
                return this.goForward();
            case 'type_text':
                return this.typeText(input.text);
            case 'press_key':
                return this.pressKey(input.key, input.modifiers);
            default:
                return {
                    error: `Unknown tool: ${name}`
                };
        }
    }

    private async takeScreenshot(): Promise<ToolResult> {
        try {
            const dataUrl = await chrome.tabs.captureVisibleTab(undefined, { format: 'png', quality: 100 });
            if (dataUrl) {
                return {
                    image_data_url: dataUrl,
                    system: 'Screenshot taken successfully'
                };
            } else {
                return {
                    error: 'Failed to capture screenshot'
                };
            }
        } catch (error) {
            return {
                error: `Failed to take screenshot: ${error}`
            };
        }
    }

    private async simulateClick(x: number, y: number): Promise<ToolResult> {
        try {
            // Get the active tab
            const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
            if (!tab?.id) {
                return { error: 'No active tab found' };
            }

            // Execute the script in the active tab
            const result = await chrome.scripting.executeScript({
                target: { tabId: tab.id },
                func: function () {
                    const x = arguments[0]; // Get x from args
                    const y = arguments[1]; // Get y from args
                    const element = document.elementFromPoint(x, y);
                    if (element instanceof HTMLElement) {
                        element.click();
                        return `Clicked on element at coordinates (${x}, ${y})`;
                    }
                    throw new Error(`No element found at coordinates (${x}, ${y})`);
                },
                args: [x, y] // Pass the arguments here
            });

            if (result && (result[0] as { result?: string }).result) {
                return { output: (result[0] as { result?: string }).result };
            } else {
                return { error: 'Click simulation failed' };
            }
        } catch (error) {
            return {
                error: `Failed to simulate click: ${error}`
            };
        }
    }

    private async navigateToUrl(url: string): Promise<ToolResult> {
        try {
            const tab = await chrome.tabs.create({ url });
            return {
                output: `Opened new tab with URL: ${url}`,
                system: `Tab created with id: ${tab.id}`
            };
        } catch (error) {
            return {
                error: `Failed to navigate to URL: ${error}`
            };
        }
    }

    private async pageDown(): Promise<ToolResult> {
        try {
            // Get the active tab
            const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
            if (!tab?.id) {
                return { error: 'No active tab found' };
            }

            // Execute the script in the active tab to scroll down
            await chrome.scripting.executeScript({
                target: { tabId: tab.id },
                func: () => {
                    window.scrollBy(0, window.innerHeight);
                }
            });

            return { output: 'Scrolled down one page' };
        } catch (error) {
            return {
                error: `Failed to scroll down: ${error}`
            };
        }
    }

    private async pageUp(): Promise<ToolResult> {
        try {
            // Get the active tab
            const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
            if (!tab?.id) {
                return { error: 'No active tab found' };
            }

            // Execute the script in the active tab to scroll up
            await chrome.scripting.executeScript({
                target: { tabId: tab.id },
                func: () => {
                    window.scrollBy(0, -window.innerHeight);
                }
            });

            return { output: 'Scrolled up one page' };
        } catch (error) {
            return {
                error: `Failed to scroll up: ${error}`
            };
        }
    }

    private async refreshPage(): Promise<ToolResult> {
        try {
            // Get the active tab
            const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
            if (!tab?.id) {
                return { error: 'No active tab found' };
            }

            // Refresh the active tab
            await chrome.tabs.reload(tab.id);
            return { output: 'Page refreshed successfully' };
        } catch (error) {
            return {
                error: `Failed to refresh page: ${error}`
            };
        }
    }

    private async closeTab(): Promise<ToolResult> {
        try {
            // Get the active tab
            const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
            if (!tab?.id) {
                return { error: 'No active tab found' };
            }

            // Close the active tab
            await chrome.tabs.remove(tab.id);
            return { output: 'Tab closed successfully' };
        } catch (error) {
            return {
                error: `Failed to close tab: ${error}`
            };
        }
    }

    private async goBack(): Promise<ToolResult> {
        try {
            // Get the active tab
            const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
            if (!tab?.id) {
                return { error: 'No active tab found' };
            }

            // Go back in browser history
            await chrome.tabs.goBack(tab.id);
            return { output: 'Navigated back successfully' };
        } catch (error) {
            return {
                error: `Failed to navigate back: ${error}`
            };
        }
    }

    private async goForward(): Promise<ToolResult> {
        try {
            // Get the active tab
            const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
            if (!tab?.id) {
                return { error: 'No active tab found' };
            }

            // Go forward in browser history
            await chrome.tabs.goForward(tab.id);
            return { output: 'Navigated forward successfully' };
        } catch (error) {
            return {
                error: `Failed to navigate forward: ${error}`
            };
        }
    }

    private async typeText(text: string): Promise<ToolResult> {
        try {
            const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
            if (!tab?.id) {
                return { error: 'No active tab found' };
            }

            await chrome.scripting.executeScript({
                target: { tabId: tab.id },
                func: function() {
                    const textToType = arguments[0];
                    const activeElement = document.activeElement as HTMLElement;
                    if (activeElement && 'value' in activeElement) {
                        const inputElement = activeElement as HTMLInputElement;
                        const startPos = inputElement.selectionStart || 0;
                        const endPos = inputElement.selectionEnd || 0;
                        const currentValue = inputElement.value;
                        
                        inputElement.value = currentValue.substring(0, startPos) + 
                            textToType + 
                            currentValue.substring(endPos);
                        
                        // Move cursor to end of inserted text
                        const newPos = startPos + textToType.length;
                        inputElement.setSelectionRange(newPos, newPos);
                    }
                },
                args: [text]
            });

            return { 
                output: `Typed text: "${text}"`,
                system: 'Text input completed'
            };
        } catch (error) {
            return {
                error: `Failed to type text: ${error}`
            };
        }
    }

    private async pressKey(key: string, modifiers: string[] = []): Promise<ToolResult> {
        try {
            const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
            if (!tab?.id) {
                return { error: 'No active tab found' };
            }

            await chrome.scripting.executeScript({
                target: { tabId: tab.id },
                func: function() {
                    const keyToPress = arguments[0];
                    const keyModifiers = arguments[1];
                    const options: KeyboardEventInit = {
                        key: keyToPress,
                        bubbles: true,
                        cancelable: true,
                        ctrlKey: keyModifiers.includes('ctrl'),
                        altKey: keyModifiers.includes('alt'),
                        shiftKey: keyModifiers.includes('shift'),
                        metaKey: keyModifiers.includes('meta')
                    };

                    // Dispatch keydown event
                    const keydownEvent = new KeyboardEvent('keydown', options);
                    document.activeElement?.dispatchEvent(keydownEvent);

                    // Dispatch keyup event
                    const keyupEvent = new KeyboardEvent('keyup', options);
                    document.activeElement?.dispatchEvent(keyupEvent);
                },
                args: [key, modifiers]
            });

            const modifierString = modifiers.length > 0 
                ? ` with modifiers: ${modifiers.join('+')}` 
                : '';

            return { 
                output: `Pressed key: "${key}"${modifierString}`,
                system: 'Key press simulated'
            };
        } catch (error) {
            return {
                error: `Failed to press key: ${error}`
            };
        }
    }

    getTools(): Record<string, any> {
        return this.tools;
    }
}
