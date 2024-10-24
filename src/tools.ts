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

    getTools(): Record<string, any> {
        return this.tools;
    }
}
