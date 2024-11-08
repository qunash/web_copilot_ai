'use client'

import { useChat } from 'ai/react';
import type { ToolInvocation } from '@ai-sdk/ui-utils';
import { useRef, useEffect, type KeyboardEvent as ReactKeyboardEvent, useState } from 'react';
import ReactMarkdown from 'react-markdown';
import { ArrowUp, Square, Settings as SettingsIcon, RefreshCcw } from 'lucide-react';
import { Textarea } from "@/components/ui/textarea"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import { ClickableOption } from './ClickableOption';
import { Settings } from './Settings';
import { ToolDisplay } from './ToolCall';
import { ChatFooter } from './ChatFooter';

const INITIAL_MESSAGE = {
  id: 'initial-message',
  role: 'assistant' as const,
  content: "Hello! I'm your AI web assistant. I can help you interact with web pages, extract information, and perform various tasks. How can I help you today?"
};

function parseOptions(content: string): { before: string, options: string[], after: string } {
  // Match both complete options and partial options (those without closing tags yet)
  const optionRegex = /(\d+)\.\s*<option>(.*?)(?:<\/option>|$)/g;
  const options: string[] = [];
  let lastIndex = 0;
  let before = '';
  let after = '';
  let match;

  while ((match = optionRegex.exec(content)) !== null) {
    if (lastIndex === 0) {
      before = content.slice(0, match.index);
    }
    // If the option doesn't have a closing tag, it's still streaming
    const isComplete = match[0].endsWith('</option>');
    const optionText = match[2];
    
    // Only add complete options or the last incomplete one
    if (isComplete || match.index + match[0].length === content.length) {
      options.push(optionText);
    }
    
    lastIndex = match.index + match[0].length;
  }

  after = content.slice(lastIndex);
  return { before, options, after };
}

function MessageContent({ 
  content, 
  onOptionSelect,
  toolInvocations 
}: { 
  content: string, 
  onOptionSelect: (option: string) => void,
  toolInvocations?: ToolInvocation[]
}) {
  const { before, options, after } = parseOptions(content);

  return (
    <div className="message-content">
      {before && (
        <ReactMarkdown 
          className="prose prose-sm max-w-none dark:prose-invert"
          components={{
            pre: ({ children }) => (
              <pre className="bg-gray-100 dark:bg-gray-900 p-4 overflow-x-auto rounded-md">
                {children}
              </pre>
            ),
            code: ({ className, children }) => {
              if (className) {
                const [lang, file] = className.replace('language-', '').split(':');
                return (
                  <div className="rounded-md overflow-hidden">
                    {file && (
                      <div className="bg-gray-200 dark:bg-gray-700 text-gray-800 dark:text-gray-200 px-4 py-1 text-sm">
                        {file}
                      </div>
                    )}
                    <code className={`block text-gray-800 dark:text-gray-200 ${file ? '' : 'bg-gray-100 dark:bg-gray-900 p-4 rounded-md'}`}>
                      {children}
                    </code>
                  </div>
                );
              }
              return (
                <code className="bg-gray-100 dark:bg-gray-900 px-1.5 py-0.5 rounded text-sm">
                  {children}
                </code>
              );
            }
          }}
        >
          {before}
        </ReactMarkdown>
      )}
      {options.length > 0 && (
        <div className="options-list space-y-2 my-2">
          {options.map((option, index) => (
            <ClickableOption
              key={index}
              index={index + 1}
              content={option}
              onSelect={() => onOptionSelect(option)}
            />
          ))}
        </div>
      )}
      {after && (
        <ReactMarkdown 
          className="prose prose-sm max-w-none dark:prose-invert"
          components={{
            pre: ({ children }) => (
              <pre className="bg-gray-100 dark:bg-gray-900 p-4 overflow-x-auto rounded-md">
                {children}
              </pre>
            ),
            code: ({ className, children }) => {
              if (className) {
                const [lang, file] = className.replace('language-', '').split(':');
                return (
                  <div className="rounded-md overflow-hidden">
                    {file && (
                      <div className="bg-gray-200 dark:bg-gray-700 text-gray-800 dark:text-gray-200 px-4 py-1 text-sm">
                        {file}
                      </div>
                    )}
                    <code className={`block text-gray-800 dark:text-gray-200 ${file ? '' : 'bg-gray-100 dark:bg-gray-900 p-4 rounded-md'}`}>
                      {children}
                    </code>
                  </div>
                );
              }
              return (
                <code className="bg-gray-100 dark:bg-gray-900 px-1.5 py-0.5 rounded text-sm">
                  {children}
                </code>
              );
            }
          }}
        >
          {after}
        </ReactMarkdown>
      )}
      {toolInvocations && <ToolDisplay toolInvocations={toolInvocations} />}
    </div>
  );
}

export function ChatInterface() {
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const [hasApiKey, setHasApiKey] = useState<boolean | null>(null);

  const {
    messages,
    input: chatInput,
    handleInputChange: handleChatInputChange,
    handleSubmit: handleChatSubmit,
    stop,
    isLoading,
    error,
    append,
    setMessages,
  } = useChat({
    api: "/api/chat",
    initialMessages: [INITIAL_MESSAGE]
  });

  useEffect(() => {
    checkApiKey();
  }, []);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

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

  useEffect(() => {
    textareaRef.current?.focus();
  }, []);

  useEffect(() => {
    const handleEscKey = (e: globalThis.KeyboardEvent) => {
      if (e.key === 'Escape' && isLoading) {
        stop();
      }
    };

    document.addEventListener('keydown', handleEscKey);
    return () => document.removeEventListener('keydown', handleEscKey);
  }, [isLoading, stop]);

  const checkApiKey = async () => {
    const { anthropic_api_key } = await chrome.storage.local.get('anthropic_api_key');
    setHasApiKey(!!anthropic_api_key);
  };

  const handleKeyDown = (e: ReactKeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      if (!isLoading && chatInput.trim()) {
        handleChatSubmit(e as any);
      }
    }
  };

  const handleSendClick = (e: React.MouseEvent) => {
    e.preventDefault();
    if (isLoading) {
      stop();
    } else if (chatInput.trim()) {
      handleChatSubmit(e as any);
    }
  };

  function handleOptionSelect(option: string) {
    append({
      role: 'user',
      content: option,
      id: Date.now().toString()
    });
  }

  const handleSettingsClick = () => {
    setHasApiKey(false);
  };

  const handleNewChat = () => {
    stop();
    setMessages([INITIAL_MESSAGE]);
    if (textareaRef.current) {
      textareaRef.current.value = '';
      textareaRef.current.focus();
    }
  };

  if (hasApiKey === null) {
    return <div className="flex items-center justify-center h-screen">Loading...</div>;
  }

  if (!hasApiKey) {
    return <Settings onKeySubmit={checkApiKey} />;
  }

  return (
    <div className="flex flex-col h-screen">
      <div className="flex items-center justify-between p-4 border-b">
        <div className="flex items-center">
          <img 
            src={chrome.runtime.getURL("public/logo_256.png")}
            alt="App Logo"
            className="w-12 h-12 mr-2"
          />
          <h1 className="text-xl font-semibold text-gray-900 dark:text-gray-100">Web Copilot AI</h1>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="icon"
            onClick={handleNewChat}
            className="hover:bg-gray-100 dark:hover:bg-gray-800 rounded-full"
            title="New Chat"
          >
            <RefreshCcw className="h-5 w-5 text-gray-600 dark:text-gray-400" />
            <span className="sr-only">New Chat</span>
          </Button>
          <Button
            variant="ghost"
            size="icon"
            onClick={handleSettingsClick}
            className="hover:bg-gray-100 dark:hover:bg-gray-800 rounded-full"
            title="Settings"
          >
            <SettingsIcon className="h-5 w-5 text-gray-600 dark:text-gray-400" />
            <span className="sr-only">Settings</span>
          </Button>
        </div>
      </div>
      <div className="flex flex-col h-screen max-w-4xl mx-auto p-2 sm:p-4 overflow-hidden">
        <div className="flex-1 overflow-y-auto mb-2 p-4 space-y-6 bg-white dark:bg-gray-900 shadow-inner">
          {messages.map((message) => (
            <div 
              key={message.id} 
              className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
            >
              <div 
                className={`rounded-lg p-4 shadow-md ${
                  message.role === 'user' 
                    ? 'bg-blue-500 text-white max-w-[85%] min-w-0'
                    : 'bg-transparent dark:bg-gray-800 text-gray-800 dark:text-gray-200 w-full'
                }`}
              >
                {message.role === 'user' ? (
                  <div className="whitespace-pre-wrap break-words">{message.content}</div>
                ) : (
                  <>
                    <MessageContent 
                      content={message.content} 
                      onOptionSelect={handleOptionSelect}
                      toolInvocations={message.toolInvocations}
                    />
                  </>
                )}
              </div>
            </div>
          ))}
          <div ref={messagesEndRef} />
        </div>
        
        <div>
          <form onSubmit={handleChatSubmit} className="relative">
            <Button
              type="submit"
              onClick={handleSendClick}
              disabled={!chatInput.trim() && !isLoading}
              size="icon"
              className={cn(
                "absolute right-2 top-2 w-8 h-8 rounded-xl",
                isLoading 
                  ? "bg-black text-white" 
                  : chatInput.trim()
                    ? "bg-black text-white hover:bg-gray-800"
                    : "bg-gray-200 dark:bg-gray-700 text-gray-400 dark:text-gray-400 border border-gray-300 dark:border-gray-600"
              )}
            >
              {isLoading ? (
                <Square className="w-3.5 h-3.5" />
              ) : (
                <ArrowUp className="w-3.5 h-3.5 stroke-[3]" />
              )}
              <span className="sr-only">{isLoading ? 'Stop' : 'Send'}</span>
            </Button>
            <Textarea
              ref={textareaRef}
              value={chatInput}
              onChange={handleChatInputChange}
              onKeyDown={handleKeyDown}
              className="h-[10vh] max-h-[10vh] resize-none pr-14 rounded-xl dark:text-white dark:bg-gray-700 dark:border-gray-600"
              placeholder="What do you need help with?"
            />
          </form>
          <ChatFooter error={error} />
        </div>
      </div>
    </div>
  );
}