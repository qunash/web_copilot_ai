import { anthropic, createAnthropic } from '@ai-sdk/anthropic';
import { generateText } from 'ai';

async function main() {
    const anthropicClient = createAnthropic({
        apiKey: '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',
        headers: {
            'anthropic-dangerous-direct-browser-access': 'true'
        },
        fetch: async (url, init = {}) => {
            if (init.body) {
                const requestData = JSON.parse(init.body as string);
                if (requestData.messages) {
                    const messages = requestData.messages.map((msg: any) => {
                        if (msg.role === 'user') {
                            // Handle both array and string content
                            const content = Array.isArray(msg.content) ? msg.content : [msg.content];
                            return {
                                ...msg,
                                content: content.map((content: any) => {
                                    if (content.type === 'tool_result') {
                                        const parsedContent = typeof content.content === 'string'
                                            ? JSON.parse(content.content)
                                            : content.content;
                                        
                                        // Ensure parsedContent is an array
                                        const contentArray = Array.isArray(parsedContent) 
                                            ? parsedContent 
                                            : [parsedContent];

                                        return {
                                            ...content,
                                            content: contentArray.map((item: any) => {
                                                if (item.type === 'image') {
                                                    return {
                                                        type: 'image',
                                                        source: {
                                                            type: 'base64',
                                                            media_type: item.mimeType || 'image/png',
                                                            data: item.data
                                                        }
                                                    };
                                                }
                                                return item;
                                            })
                                        };
                                    }
                                    return content;
                                })
                            };
                        }
                        return msg;
                    });

                    init.body = JSON.stringify({ ...requestData, messages });

                    // Log the final request body
                    console.log('Sending request body:', JSON.parse(init.body));
                }
            }

            const response = await fetch(url, init);
            return response;
        }
    });

    const result = await generateText({
        model: anthropicClient('claude-3-5-sonnet-20241022'),
        tools: {
            computer: anthropic.tools.computer_20241022({
                displayWidthPx: 1024,
                displayHeightPx: 768,

                async execute({ action, coordinate, text }) {
                    switch (action) {
                        case 'screenshot': {
                            return {
                                type: 'image',
                                data: '',
                            };
                        }
                        default: {
                            return `executed ${action}`;
                        }
                    }
                },

                experimental_toToolResultContent(result) {
                    return typeof result === 'string'
                        ? [{ type: 'text', text: result }]
                        : [{ type: 'image', data: result.data, mimeType: 'image/png' }];
                },
            }),
        },
        prompt:
            'Take a screenshot of the current screen and tell me what you see.',
        maxSteps: 5,
    });

    console.log(result.text);
    console.log(result.finishReason);
    console.log(JSON.stringify(result.toolCalls, null, 2));
}

main().catch(console.error);
