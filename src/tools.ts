import { z } from 'zod';

export interface ToolResult {
    output?: string;
    error?: string;
    image_data_url?: string;
    system?: string;
}

interface Tool {
    name: string;
    description: string;
    parameters: {
        type: string;
        properties: Record<string, {
            type: string;
            description: string;
        }>;
        required: string[];
    };
}

// Browser-specific tools implementation
export class BrowserTools {

    private tools: Tool[] = [
        {
            name: 'take_screenshot',
            description: 'Takes a screenshot of the current tab and returns it as a base64 encoded image',
            parameters: {
                type: 'object',
                properties: {},
                required: []
            }
        },
        {
            name: 'click',
            description: 'Clicks at the specified coordinates on the current webpage',
            parameters: {
                type: 'object',
                properties: {
                    x: {
                        type: 'number',
                        description: 'X coordinate on the page (in pixels)'
                    },
                    y: {
                        type: 'number',
                        description: 'Y coordinate on the page (in pixels)'
                    }
                },
                required: ['x', 'y']
            }
        },
        {
            name: 'navigate',
            description: 'Opens the specified URL in a new browser tab',
            parameters: {
                type: 'object',
                properties: {
                    url: {
                        type: 'string',
                        description: 'Complete URL to navigate to (must include http:// or https://)'
                    }
                },
                required: ['url']
            }
        },
        {
            name: 'page_down',
            description: 'Scrolls the webpage down by one page',
            parameters: {
                type: 'object',
                properties: {},
                required: []
            }
        },
        {
            name: 'page_up',
            description: 'Scrolls the webpage up by one page',
            parameters: {
                type: 'object',
                properties: {},
                required: []
            }
        },
        {
            name: 'refresh',
            description: 'Refreshes the current webpage',
            parameters: {
                type: 'object',
                properties: {},
                required: []
            }
        }
    ];

    async runTool(name: string, input: any): Promise<ToolResult> {
        switch (name) {
            case 'take_screenshot':
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
            // Send message to background script to take screenshot
            const response = await chrome.runtime.sendMessage({ action: 'action_take_screenshot' });
            if (response.success) {
                return {
                    image_data_url: response.imageData,
                    system: 'Screenshot taken successfully'
                };
            } else {
                return {
                    error: response.error || 'Unknown error occurred while taking screenshot'
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
        return this.tools.reduce((acc, tool) => {
            // Convert the parameter definition to Zod schema
            const properties: Record<string, z.ZodType> = {};
            Object.entries(tool.parameters.properties).forEach(([key, prop]) => {
                if (prop.type === 'number') {
                    properties[key] = z.number();
                } else if (prop.type === 'string') {
                    properties[key] = z.string();
                }
                // Add more type conversions as needed
            });

            acc[tool.name] = {
                description: tool.description,
                parameters: z.object(properties)
            };
            return acc;
        }, {} as Record<string, any>);
    }
}