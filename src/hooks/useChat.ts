import { useState, useRef, useEffect } from 'react';
import { createAnthropic } from '@ai-sdk/anthropic';
import { streamText } from 'ai';
import type { ToolResult } from '../tools';
import { BrowserTools } from '../tools';

interface ChatMessage {
    content: string | ToolResult;
    isUser: boolean;
    isError?: boolean;
    isToolResult?: boolean;
    toolUseId?: string;
}

const SYSTEM_PROMPT = `<SYSTEM_CAPABILITY>
* You are Web Copilot AI, a browser assistant that helps users perform actions in their browser using provided tools.
* You can take screenshots of the current page to understand its content and layout.
* You can click on specific coordinates on the page to interact with elements.
* You can open new tabs with specified URLs.
* Always analyze the visual content from screenshots before suggesting actions.
* Provide clear, step-by-step instructions about which tools to use and why.
</SYSTEM_CAPABILITY>

<IMPORTANT>
* Before clicking on coordinates, always take a screenshot first to verify the current state of the page.
* When navigating to new URLs, make sure they are properly formatted with the protocol (http:// or https://).
* After performing actions that modify the page state, take a new screenshot to verify the results.
</IMPORTANT>`;

const anthropicClient = createAnthropic({
    apiKey: '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',
    headers: {
        'anthropic-dangerous-direct-browser-access': 'true'
    }
});

export const useChat = () => {
    const model = anthropicClient('claude-3-5-sonnet-20241022');
    const browserTools = new BrowserTools();
    const [messages, setMessages] = useState<ChatMessage[]>([
        { content: "Hello! I'm your Web Copilot AI. How can I help you today?", isUser: false }
    ]);
    const [isProcessing, setIsProcessing] = useState(false);
    const [inputValue, setInputValue] = useState('');
    const chatContainerRef = useRef<HTMLDivElement>(null);

    const scrollToBottom = () => {
        if (chatContainerRef.current) {
            chatContainerRef.current.scrollTop = chatContainerRef.current.scrollHeight;
        }
    };

    useEffect(() => {
        scrollToBottom();
    }, [messages]);

    const convertMessagesForAPI = (messages: ChatMessage[]): any[] => {
        console.log('Converting messages for API:', messages);
        return messages.map(message => {
            if (message.isToolResult && message.toolUseId) {
                return {
                    role: 'tool',
                    content: [{
                        type: 'tool-result',
                        toolCallId: message.toolUseId,
                        toolName: 'navigate',
                        content: typeof message.content === 'string'
                            ? message.content
                            : JSON.stringify(message.content)
                    }]
                };
            }
            return {
                role: message.isUser ? 'user' : 'assistant',
                content: typeof message.content === 'string' 
                    ? message.content 
                    : JSON.stringify(message.content)
            };
        });
    };

    const handleNewMessage = async (messages: ChatMessage[]) => {
        if (isProcessing) return;
        
        setIsProcessing(true);
        try {
            const result = await streamText({
                model,
                messages: [
                    { role: 'system', content: SYSTEM_PROMPT },
                    ...convertMessagesForAPI(messages)
                ],
                tools: browserTools.getTools(),
                experimental_toolCallStreaming: true
            });

            // Add initial empty assistant message
            setMessages(prev => [...prev, { content: '', isUser: false }]);
            let fullResponse = '';

            for await (const chunk of result.fullStream) {
                switch (chunk.type) {
                    case 'text-delta':
                        fullResponse += chunk.textDelta;
                        setMessages(prev => [
                            ...prev.slice(0, -1),
                            { content: fullResponse, isUser: false }
                        ]);
                        break;

                    case 'tool-call':
                        try {
                            const toolResult = await browserTools.runTool(chunk.toolName, chunk.args);
                            setMessages(prev => [...prev, {
                                content: toolResult,
                                isUser: true,
                                isToolResult: true,
                                toolUseId: chunk.toolCallId
                            }]);
                        } catch (toolError) {
                            console.error('Tool execution error:', toolError);
                            setMessages(prev => [...prev, {
                                content: toolError instanceof Error ? toolError.message : String(toolError),
                                isUser: true,
                                isToolResult: true,
                                toolUseId: chunk.toolCallId,
                                isError: true
                            }]);
                        }
                        break;

                    case 'error':
                        setMessages(prev => [...prev, {
                            content: typeof chunk.error === 'string' ? chunk.error : String(chunk.error),
                            isUser: false,
                            isError: true
                        }]);
                }
            }
        } catch (error) {
            console.error('Error generating response:', error);
            setMessages(prev => [...prev, {
                content: error instanceof Error ? error.message : String(error),
                isUser: false,
                isError: true
            }]);
        } finally {
            setIsProcessing(false);
        }
    };

    useEffect(() => {
        const lastMessage = messages[messages.length - 1];
        if (lastMessage?.isUser || lastMessage?.isToolResult) {
            handleNewMessage(messages);
        }
    }, [messages]);

    const sendMessage = (message: ChatMessage) => {
        setInputValue('');
        setMessages(prev => [...prev, message]);
    };

    return {
        messages,
        isProcessing,
        inputValue,
        setInputValue,
        sendMessage,
        chatContainerRef
    };
};