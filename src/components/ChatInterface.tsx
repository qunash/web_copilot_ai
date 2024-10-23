import { useChat } from '../hooks/useChat';

export const ChatInterface = () => {
    const {
        messages,
        isProcessing,
        inputValue,
        setInputValue,
        sendMessage,
        chatContainerRef
    } = useChat();

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        sendMessage(inputValue.trim());
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
                        className={`p-3 rounded-lg max-w-[85%] break-words ${msg.isError
                            ? 'bg-red-100 dark:bg-red-900 text-red-900 dark:text-red-100 ml-0'
                            : msg.isUser
                                ? 'bg-blue-100 dark:bg-blue-900 text-blue-900 dark:text-blue-100 ml-auto'
                                : 'bg-gray-100 dark:bg-gray-700 text-gray-900 dark:text-gray-100 mr-auto'
                            }`}
                    >
                        {msg.content}
                    </div>
                ))}
            </div>

            <form 
                onSubmit={handleSubmit}
                className="flex gap-2 p-2 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800"
            >
                <input
                    type="text"
                    value={inputValue}
                    onChange={(e) => setInputValue(e.target.value)}
                    placeholder="Type your instructions..."
                    className="flex-1 px-4 py-2 rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400"
                    disabled={isProcessing}
                />
                <button
                    type="submit"
                    disabled={isProcessing}
                    className={`px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-md transition-colors duration-200 ${isProcessing ? 'opacity-50 cursor-not-allowed' : ''}`}
                >
                    Send
                </button>
            </form>
        </div>
    );
};