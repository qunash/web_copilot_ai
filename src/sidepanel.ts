import { createAnthropic } from '@ai-sdk/anthropic';
import { streamText } from 'ai';

const anthropicClient = createAnthropic({
    apiKey: 'sk-ant-test123', // This is a dummy key for testing
});

const createChatInterface = () => {
    // State
    let isProcessing = false;
    const model = anthropicClient('claude-3-haiku-20240307');
    
    // DOM Elements
    const chatContainer = document.getElementById('chatContainer') as HTMLElement;
    const messageInput = document.getElementById('messageInput') as HTMLInputElement;
    const sendButton = document.getElementById('sendButton') as HTMLButtonElement;

    // Helper Functions
    const scrollToBottom = () => {
        chatContainer.scrollTop = chatContainer.scrollHeight;
    };

    const addMessage = (message: string, isUser: boolean = false, isError: boolean = false) => {
        const messageElement = document.createElement('div');
        const baseClasses = 'p-3 rounded-lg max-w-[85%] break-words';
        
        if (isError) {
            messageElement.className = `${baseClasses} bg-red-100 dark:bg-red-900 text-red-900 dark:text-red-100 ml-0`;
        } else if (isUser) {
            messageElement.className = `${baseClasses} bg-blue-100 dark:bg-blue-900 text-blue-900 dark:text-blue-100 ml-auto`;
        } else {
            messageElement.className = `${baseClasses} bg-gray-100 dark:bg-gray-700 text-gray-900 dark:text-gray-100 mr-auto`;
        }
        
        messageElement.textContent = message;
        chatContainer.appendChild(messageElement);
        scrollToBottom();
        return messageElement;
    };

    const addDebugMessage = (message: any, level: 'info' | 'warning' | 'error' = 'info') => {
        const messageElement = document.createElement('div');
        messageElement.className = `debug-message ${level} p-2 rounded-md mt-1 mb-1 w-full`;
        
        const formattedMessage = typeof message === 'object' ? 
            JSON.stringify(message, null, 2) : 
            message;

        messageElement.textContent = `[DEBUG ${new Date().toISOString()}] ${formattedMessage}`;
        chatContainer.appendChild(messageElement);
        scrollToBottom();
        return messageElement;
    };

    const setLoading = (loading: boolean) => {
        isProcessing = loading;
        sendButton.disabled = loading;
        messageInput.disabled = loading;
        
        if (loading) {
            messageInput.classList.add('opacity-50');
            sendButton.classList.add('opacity-50');
            addDebugMessage('Setting loading state: true');
        } else {
            messageInput.classList.remove('opacity-50');
            sendButton.classList.remove('opacity-50');
            addDebugMessage('Setting loading state: false');
        }
    };

    const handleSend = async () => {
        const message = messageInput.value.trim();
        if (!message || isProcessing) return;

        messageInput.value = '';
        addMessage(message, true);
        addDebugMessage('User message sent');
        setLoading(true);

        try {
            addDebugMessage({
                event: 'streamText_request',
                model: 'claude-3-haiku-20240307',
                message_length: message.length
            });

            const responseElement = addMessage('', false);
            let responseLength = 0;
            let streamStartTime = Date.now();

            await streamText({
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
                ],
                onChunk: ({ chunk }) => {
                    if (chunk.type === 'text-delta') {
                        responseElement.textContent = responseElement.textContent + chunk.textDelta;
                        responseLength = responseElement.textContent.length;
                        scrollToBottom();
                    }
                }
            });

            const streamDuration = Date.now() - streamStartTime;
            addDebugMessage({
                event: 'streamText_complete',
                response_length: responseLength,
                duration_ms: streamDuration,
                tokens_per_second: (responseLength / streamDuration) * 1000
            });

        } catch (error) {
            console.error('Error generating response:', error);
            addDebugMessage({
                event: 'streamText_error',
                error: error instanceof Error ? error.message : String(error)
            }, 'error');
            addMessage('Error: Unable to connect to AI service. Please check your API key and try again.', false, true);
        } finally {
            setLoading(false);
        }
    };

    // Setup Event Listeners
    const setupEventListeners = () => {
        sendButton.addEventListener('click', handleSend);
        messageInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                handleSend();
            }
        });
    };

    // Initialize
    const initialize = () => {
        setupEventListeners();
        addDebugMessage('ChatInterface initialized');
        addDebugMessage(`API Key: ${anthropicClient.toString()}`);
        addMessage('Hello! I\'m your Web Copilot AI. How can I help you today?', false);
    };

    initialize();
};

// Initialize on DOM load
document.addEventListener('DOMContentLoaded', () => {
    try {
        createChatInterface();
    } catch (error) {
        const container = document.getElementById('chatContainer');
        if (container) {
            const errorElement = document.createElement('div');
            errorElement.className = 'debug-message error p-2 rounded-md mt-1 mb-1 w-full';
            errorElement.textContent = `[DEBUG] Initialization Error: ${error instanceof Error ? error.message : String(error)}`;
            container.appendChild(errorElement);
        }
    }
});