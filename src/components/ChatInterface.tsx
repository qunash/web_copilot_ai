import { createAnthropic } from '@ai-sdk/anthropic';
import { streamText } from 'ai';
import { useState, useRef, useEffect } from 'react';

const anthropicClient = createAnthropic({
    apiKey: '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',
    headers: {
        'anthropic-dangerous-direct-browser-access': 'true'
    }
});

interface Message {
    content: string;
    isUser: boolean;
    isError?: boolean;
}

interface DebugMessage {
    content: string;
    level: 'info' | 'warning' | 'error';
    timestamp: string;
}

interface ChatInterfaceProps {
    debug?: boolean;
}

export const ChatInterface = ({ debug = false }: ChatInterfaceProps) => {
    const [messages, setMessages] = useState<Message[]>([
        { content: "Hello! I'm your Web Copilot AI. How can I help you today?", isUser: false }
    ]);
    const [debugMessages, setDebugMessages] = useState<DebugMessage[]>([]);
    const [isProcessing, setIsProcessing] = useState(false);
    const [inputValue, setInputValue] = useState('');
    const chatContainerRef = useRef<HTMLDivElement>(null);
    const model = anthropicClient('claude-3-haiku-20240307');
    
    const streamStartTimeRef = useRef<number>(0);

    const scrollToBottom = () => {
        if (chatContainerRef.current) {
            chatContainerRef.current.scrollTop = chatContainerRef.current.scrollHeight;
        }
    };

    useEffect(() => {
        scrollToBottom();
    }, [messages, debugMessages]);

    const addDebugMessage = (message: any, level: 'info' | 'warning' | 'error' = 'info') => {
        if (!debug) return;

        const formattedMessage = typeof message === 'object' ? 
            JSON.stringify(message, null, 2) : 
            message;

        setDebugMessages(prev => [...prev, {
            content: formattedMessage,
            level,
            timestamp: new Date().toISOString()
        }]);
    };

    const handleSend = async () => {
        const message = inputValue.trim();
        if (!message || isProcessing) return;

        setInputValue('');
        setMessages(prev => [...prev, { content: message, isUser: true }]);
        addDebugMessage('User message sent');
        setIsProcessing(true);

        try {
            addDebugMessage({
                event: 'streamText_request',
                model: 'claude-3-haiku-20240307',
                message_length: message.length
            });

            streamStartTimeRef.current = Date.now();
            
            setMessages(prev => [...prev, { content: '', isUser: false }]);

            const result = await streamText({
                model,
                messages: [
                    {
                        role: 'system',
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
                    {
                        role: 'user',
                        content: message
                    }
                ]
            });

            let fullResponse = '';
            
            for await (const delta of result.textStream) {
                fullResponse += delta;
                
                addDebugMessage({
                    event: 'streamText_chunk',
                    chunk_length: delta.length,
                    accumulated_length: fullResponse.length
                });

                setMessages(prev => {
                    const newMessages = [...prev];
                    newMessages[newMessages.length - 1] = {
                        content: fullResponse,
                        isUser: false
                    };
                    return newMessages;
                });
            }

            const streamDuration = Date.now() - streamStartTimeRef.current;
            addDebugMessage({
                event: 'streamText_complete',
                final_response_length: fullResponse.length,
                duration_ms: streamDuration,
                tokens_per_second: (fullResponse.length / streamDuration) * 1000
            });

        } catch (error) {
            console.error('Error generating response:', error);
            addDebugMessage({
                event: 'streamText_error',
                error: error instanceof Error ? error.message : String(error)
            }, 'error');
            setMessages(prev => [...prev, {
                content: 'Error: Unable to connect to AI service. Please check your API key and try again.',
                isUser: false,
                isError: true
            }]);
        } finally {
            setIsProcessing(false);
        }
    };

    return (
        <div className="flex flex-col h-screen max-w-3xl mx-auto p-4">
            <div className="border-b border-gray-200 dark:border-gray-700 pb-4 mb-4">
                <h2 className="text-xl font-semibold text-blue-600 dark:text-blue-400">Web Copilot AI</h2>
            </div>

            <div 
                ref={chatContainerRef}
                className="flex-1 overflow-y-auto mb-4 p-4 space-y-4 rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800"
            >
                {messages.map((msg, idx) => (
                    <div
                        key={idx}
                        className={`p-3 rounded-lg max-w-[85%] break-words ${
                            msg.isError
                                ? 'bg-red-100 dark:bg-red-900 text-red-900 dark:text-red-100 ml-0'
                                : msg.isUser
                                ? 'bg-blue-100 dark:bg-blue-900 text-blue-900 dark:text-blue-100 ml-auto'
                                : 'bg-gray-100 dark:bg-gray-700 text-gray-900 dark:text-gray-100 mr-auto'
                        }`}
                    >
                        {msg.content}
                    </div>
                ))}
                
                {debug && debugMessages.map((debug, idx) => (
                    <div
                        key={`debug-${idx}`}
                        className={`debug-message ${debug.level} p-2 rounded-md mt-1 mb-1 w-full border border-gray-300 dark:border-gray-600`}
                    >
                        [DEBUG {debug.timestamp}] {debug.content}
                    </div>
                ))}
            </div>

            <div className="flex gap-2 p-2 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800">
                <input
                    type="text"
                    value={inputValue}
                    onChange={(e) => setInputValue(e.target.value)}
                    onKeyPress={(e) => {
                        if (e.key === 'Enter' && !e.shiftKey) {
                            e.preventDefault();
                            handleSend();
                        }
                    }}
                    placeholder="Type your instructions..."
                    className="flex-1 px-4 py-2 rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400"
                    disabled={isProcessing}
                />
                <button
                    type='button'
                    onClick={handleSend}
                    disabled={isProcessing}
                    className={`px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-md transition-colors duration-200 ${
                        isProcessing ? 'opacity-50 cursor-not-allowed' : ''
                    }`}
                >
                    Send
                </button>
            </div>
        </div>
    );
};