import { useChat, type Message } from 'ai/react';
import { useEffect } from 'react';
import type { ToolInvocation } from '@ai-sdk/ui-utils';

export const ChatInterface = () => {
    const {
        messages,
        input,
        handleInputChange,
        handleSubmit,
        isLoading,
        error
    } = useChat({
        api: "/api/chat",
        keepLastMessageOnError: true
    });

    const renderToolInvocations = (toolInvocations?: ToolInvocation[]) => {
        if (!toolInvocations?.length) return null;

        return (
            <div className="mt-2 space-y-2 text-sm">
                {toolInvocations.map((tool) => (
                    <div
                        key={tool.toolCallId}
                        className="flex items-center space-x-2 text-gray-600 dark:text-gray-400"
                    >
                        <span 
                            className={`inline-block w-2 h-2 rounded-full ${
                                tool.state === 'result' ? 'bg-green-500' :
                                'bg-yellow-500 animate-pulse'
                            }`}
                        ></span>
                        <span className="font-mono">
                            {tool.toolName}(
                            {(tool.state === 'call' || tool.state === 'partial-call') && tool.args && 
                                Object.entries(tool.args)
                                    .map(([key, value]) => `${key}: ${JSON.stringify(value)}`)
                                    .join(', ')
                            }
                            {tool.state === 'result' && tool.result && JSON.stringify(tool.result)}
                            )
                        </span>
                    </div>
                ))}
            </div>
        );
    };

    return (
        <div className="flex flex-col h-screen max-w-3xl mx-auto p-4">
            <div className="border-b border-gray-200 dark:border-gray-700 pb-4 mb-4">
                <h2 className="text-xl font-semibold text-blue-600 dark:text-blue-400">Web Copilot AI</h2>
            </div>

            <div className="flex-1 overflow-y-auto mb-4 p-4 space-y-4 rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800">
                {messages.map((message) => (
                    <div
                        key={message.id}
                        className={`p-3 rounded-lg max-w-[85%] ${
                            message.role === 'user'
                                ? 'bg-blue-100 dark:bg-blue-900 text-blue-900 dark:text-blue-100 ml-auto'
                                : 'bg-gray-100 dark:bg-gray-700 text-gray-900 dark:text-gray-100 mr-auto'
                        }`}
                    >
                        <div className="break-words">
                            {message.content}
                        </div>
                        {message.toolInvocations && message.toolInvocations.length > 0 && (
                            <div className="mt-2">
                                {(() => {
                                    try {
                                        return renderToolInvocations(message.toolInvocations);
                                    } catch (error) {
                                        console.error('Error rendering tool invocations:', error);
                                        return (
                                            <div className="text-red-500 text-sm">
                                                Error rendering tool invocations
                                            </div>
                                        );
                                    }
                                })()}
                            </div>
                        )}
                    </div>
                ))}
            </div>

            {error && (
                <div className="mb-4 p-3 rounded-lg bg-red-100 dark:bg-red-900 text-red-900 dark:text-red-100">
                    An error occurred. Please try again.
                    <div className="font-mono text-sm mt-2">
                        {error.message || String(error)}
                    </div>
                </div>
            )}

            <form
                onSubmit={handleSubmit}
                className="flex gap-2 p-2 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800"
            >
                <input
                    type="text"
                    value={input}
                    onChange={handleInputChange}
                    placeholder="Type your instructions..."
                    className="flex-1 px-4 py-2 rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400"
                    disabled={isLoading}
                />
                <button
                    type="submit"
                    disabled={isLoading}
                    className={`px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-md transition-colors duration-200 ${
                        isLoading ? 'opacity-50 cursor-not-allowed' : ''
                    }`}
                >
                    Send
                </button>
            </form>
        </div>
    );
};
