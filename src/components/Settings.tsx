import { useState, useEffect } from 'react';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

interface SettingsProps {
  onKeySubmit: () => void;
}

export function Settings({ onKeySubmit }: SettingsProps) {
  const [apiKey, setApiKey] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isValidating, setIsValidating] = useState(false);

  // Load existing API key on mount
  useEffect(() => {
    const loadApiKey = async () => {
      const { anthropic_api_key } = await chrome.storage.local.get('anthropic_api_key');
      if (anthropic_api_key) {
        setApiKey(anthropic_api_key);
      }
    };
    loadApiKey();
  }, []);

  const validateKey = async (key: string) => {
    // Basic format validation
    if (!key.startsWith('sk-ant-api')) {
      return false;
    }
    
    try {
      const response = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'x-api-key': key,
          'anthropic-version': '2023-06-01',
          'content-type': 'application/json',
          'anthropic-dangerous-direct-browser-access': 'true'
        },
        body: JSON.stringify({
          model: 'claude-3-sonnet-20240229',
          max_tokens: 1,
          messages: [{ role: 'user', content: 'Hi' }],
        }),
      });

      return response.ok;
    } catch {
      return false;
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsValidating(true);

    try {
      const isValid = await validateKey(apiKey);
      if (isValid) {
        await chrome.storage.local.set({ 'anthropic_api_key': apiKey });
        // Refresh the side panel to show the chat interface
        await chrome.sidePanel.setOptions({ path: 'sidepanel.html' });
        onKeySubmit();
      } else {
        setError('Invalid API key. Please check your key and try again.');
      }
    } catch (err) {
      setError('An error occurred while validating the API key.');
    } finally {
      setIsValidating(false);
    }
  };

  return (
    <div className="flex flex-col items-center justify-center min-h-screen p-4 bg-white dark:bg-gray-900">
      <div className="w-full max-w-md space-y-6">
        <div className="space-y-2 text-center">
          <h1 className="text-2xl font-bold tracking-tight text-gray-900 dark:text-gray-100">
            Welcome to Web Copilot AI
          </h1>
          <p className="text-gray-500 dark:text-gray-400">
            Enter your <a 
              href="https://console.anthropic.com/settings/keys" 
              target="_blank" 
              rel="noopener noreferrer"
              className="text-blue-500 hover:text-blue-600 dark:text-blue-400"
            >
              Anthropic API key
            </a> to get started.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4 flex flex-col items-center">
          <div className="space-y-2 w-full">
            <Input
              type="password"
              placeholder="sk-ant-api..."
              value={apiKey}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => setApiKey(e.target.value)}
              className="w-full"
            />
            {error && (
              <p className="text-sm text-red-500 dark:text-red-400">
                {error}
              </p>
            )}
          </div>

          <Button
            type="submit"
            className="border border-gray-300 dark:border-gray-700"
            disabled={!apiKey || isValidating}
          >
            {isValidating ? 'Validating...' : 'Save'}
          </Button>
        </form>
      </div>
    </div>
  );
} 