import { useChat } from 'ai/react';
import type { ToolInvocation } from '@ai-sdk/ui-utils';
import { useMemo } from 'react';
import { useRef, useEffect } from 'react';
import ReactMarkdown from 'react-markdown';

const INITIAL_MESSAGE = {
    id: 'initial-message',
    role: 'assistant' as const,
    content: "Hello! I'm your AI web assistant. I can help you interact with web pages, extract information, and perform various tasks. How can I help you today?"
};

const ToolResult = ({ tool }: { tool: ToolInvocation }) => {
    const content = useMemo(() => {
        // Show the tool name and arguments
        const toolInfo = (
            <div className="font-mono text-xs mb-1">
                {tool.toolName}({
                    Object.entries(tool.args)
                        .map(([key, value]) => `${key}: ${JSON.stringify(value)}`)
                        .join(', ')
                })
            </div>
        );

        // Handle tool results
        if (tool.state === 'result' && 'result' in tool) {
            const result = tool.result;
            
            // Handle screenshot tool result
            if (tool.toolName === 'take_screenshot') {
                if (result.error) {
                    return (
                        <>
                            {toolInfo}
                            <div className="text-red-500">{result.error}</div>
                        </>
                    );
                }
                
                if (result.data) {
                    return (
                        <>
                            {toolInfo}
                            <img 
                                src={`data:image/png;base64,${result.data}`}
                                alt="Screenshot result"
                                className="max-w-full rounded-lg mt-2 border border-gray-200 dark:border-gray-600"
                            />
                        </>
                    );
                }
            }

            // Handle other tool results
            return (
                <>
                    {toolInfo}
                    <div className="mt-1">
                        <span>{typeof result === 'string' ? result : JSON.stringify(result)}</span>
                    </div>
                </>
            );
        }

        // Show processing state
        return (
            <>
                {toolInfo}
                <div className="mt-1">
                    <span>{tool.state === 'partial-call' ? tool.state : 'Processing...'}</span>
                </div>
            </>
        );
    }, [tool]);

    return (
        <div className="text-sm font-normal bg-gray-100 dark:bg-gray-700 p-2 rounded">
            {content}
        </div>
    );
};

// Update the renderToolInvocations styling
const renderToolInvocations = (toolInvocations?: ToolInvocation[]) => {
    if (!toolInvocations?.length) return null;

    return (
        <div className="mt-2 space-y-2">
            {toolInvocations.map((tool) => (
                <div
                    key={tool.toolCallId}
                    className="flex items-start space-x-2 text-gray-600 dark:text-gray-400"
                >
                    <span 
                        className={`inline-block w-2 h-2 mt-1.5 rounded-full flex-shrink-0 ${
                            tool.state === 'result' ? 'bg-green-500' :
                            'bg-yellow-500 animate-pulse'
                        }`}
                    ></span>
                    <div className="flex-1">
                        <ToolResult tool={tool} />
                    </div>
                </div>
            ))}
        </div>
    );
};

export function ChatInterface() {
    const messagesEndRef = useRef<HTMLDivElement>(null);

    const {
        messages,
        input: chatInput,
        handleInputChange: handleChatInputChange,
        handleSubmit: handleChatSubmit,
        isLoading,
        error
    } = useChat({
        api: "/api/chat",
        initialMessages: [INITIAL_MESSAGE]
    });

    // Auto-scroll to bottom when messages change
    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages]);

    // Update the error logging
    useEffect(() => {
        if (error) {
            console.error('Chat interface error:', JSON.stringify({
                name: error.name,
                message: error.message,
                cause: error.cause,
                stack: error.stack,
                fullError: error
            }, null, 2));
        }
    }, [error]);

    return (
        <div className="flex flex-col h-screen max-w-3xl mx-auto p-4">
            <div className="border-b border-gray-200 dark:border-gray-700 pb-4 mb-4">
                <h2 className="text-xl font-semibold text-blue-600 dark:text-blue-400">Web Copilot AI</h2>
            </div>

            <div className="flex-1 overflow-y-auto mb-4 p-4 space-y-4 rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800">
                {messages.map((message) => (
                    <div 
                        key={message.id} 
                        className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
                    >
                        <div 
                            className={`max-w-[80%] rounded-lg p-3 ${
                                message.role === 'user' 
                                    ? 'bg-blue-500 text-white' 
                                    : 'bg-gray-200 text-black'
                            }`}
                        >
                            {message.role === 'user' ? (
                                <div className="whitespace-pre-wrap">{message.content}</div>
                            ) : (
                                <>
                                    <ReactMarkdown 
                                        className="prose prose-sm max-w-none dark:prose-invert"
                                        components={{
                                            pre: ({ children }) => (
                                                <pre className="bg-gray-800 p-4 overflow-x-auto rounded-md">
                                                    {children}
                                                </pre>
                                            ),
                                            code: ({ className, children }) => {
                                                if (className) {
                                                    const [lang, file] = className.replace('language-', '').split(':');
                                                    return (
                                                        <div className="rounded-md overflow-hidden">
                                                            {file && (
                                                                <div className="bg-gray-700 text-gray-200 px-4 py-1 text-sm">
                                                                    {file}
                                                                </div>
                                                            )}
                                                            <code className={`block text-gray-100 ${file ? '' : 'bg-gray-800 p-4 rounded-md'}`}>
                                                                {children}
                                                            </code>
                                                        </div>
                                                    );
                                                }
                                                return (
                                                    <code className="bg-gray-100 dark:bg-gray-800 px-1.5 py-0.5 rounded text-sm">
                                                        {children}
                                                    </code>
                                                );
                                            }
                                        }}
                                    >
                                        {message.content}
                                    </ReactMarkdown>
                                    {message.toolInvocations && renderToolInvocations(message.toolInvocations)}
                                </>
                            )}
                        </div>
                    </div>
                ))}
                <div ref={messagesEndRef} />
            </div>
            
            <div className="border-t p-4">
                <form onSubmit={handleChatSubmit} className="flex space-x-4">
                    <input
                        type="text"
                        value={chatInput}
                        onChange={handleChatInputChange}
                        className="flex-1 border rounded-lg px-4 py-2"
                        placeholder="Type your message..."
                        disabled={isLoading}
                    />
                    <button
                        type="submit"
                        disabled={isLoading}
                        className={`px-6 py-2 rounded-lg text-white ${
                            isLoading 
                                ? 'bg-blue-400 cursor-not-allowed' 
                                : 'bg-blue-500 hover:bg-blue-600'
                        }`}
                    >
                        {isLoading ? 'Sending...' : 'Send'}
                    </button>
                </form>
                {error && (
                    <div className="mt-2 text-red-500 text-sm">
                        Error: {error.cause ? JSON.stringify(error.cause) : error.message}
                    </div>
                )}
            </div>
        </div>
    );
}
