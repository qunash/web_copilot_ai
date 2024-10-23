import { useState, useRef, useEffect } from 'react';
import { createAnthropic } from '@ai-sdk/anthropic';
import { streamText } from 'ai';

interface ChatMessage {
    content: string;
    isUser: boolean;
    isError?: boolean;
}

const anthropicClient = createAnthropic({
    apiKey: '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',
    headers: {
        'anthropic-dangerous-direct-browser-access': 'true'
    }
});

export const useChat = () => {
    const model = anthropicClient('claude-3-haiku-20240307');
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

    const convertMessagesForAPI = (messages: ChatMessage[]): { role: 'user' | 'assistant'; content: string; id: string; }[] => {
        return messages.map((msg, index) => ({
            id: String(index),
            role: msg.isUser ? 'user' : 'assistant',
            content: msg.content
        }));
    };

    const sendMessage = async (message: string) => {
        if (!message || isProcessing) return;

        setInputValue('');
        setMessages(prev => [...prev, { content: message, isUser: true }]);
        setIsProcessing(true);

        try {
            setMessages(prev => [...prev, { content: '', isUser: false }]);

            const result = await streamText({
                model,
                messages: [
                    {
                        role: 'system' as const,
                        content: `You are Web Copilot AI, a browser assistant that helps users perform actions in their browser. 
                        You should analyze user requests and provide specific instructions about which browser actions would help accomplish their goals.
                        You can assist with tasks like:
                        - Navigation
                        - Form filling
                        - Content extraction
                        - Tab management
                        - Bookmark operations
                        Always provide clear, step-by-step instructions for what actions need to be taken.`
                    },
                    ...convertMessagesForAPI(messages),
                    {
                        role: 'user' as const,
                        content: message
                    }
                ]
            });

            let fullResponse = '';

            for await (const delta of result.textStream) {
                fullResponse += delta;

                setMessages(prev => {
                    const newMessages = [...prev];
                    newMessages[newMessages.length - 1] = {
                        content: fullResponse,
                        isUser: false
                    };
                    return newMessages;
                });
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

    return {
        messages,
        isProcessing,
        inputValue,
        setInputValue,
        sendMessage,
        chatContainerRef
    };
};