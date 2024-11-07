import manifest from '../manifest.json';

export function ChatFooter({ error }: { error?: Error }) {
  return (
    <div>
      {error && (
        <div className="flex justify-between text-xs text-gray-500 mt-1">
          <div className="text-red-500">
            Error: {error.cause ? JSON.stringify(error.cause) : error.message}
          </div>
        </div>
      )}
      
      <div className="flex items-center justify-center gap-3 text-xs text-gray-500 mt-1">
        <span>v{manifest.version}</span>
        <span>•</span>
        <a 
          href="https://x.com/hahahahohohe" 
          target="_blank" 
          rel="noopener noreferrer"
          className="hover:text-gray-700 dark:hover:text-gray-300"
        >
          𝕏
        </a>
        <span>•</span>
        <a 
          href="https://buymeacoffee.com/anzorq" 
          target="_blank" 
          rel="noopener noreferrer"
          className="hover:text-gray-700 dark:hover:text-gray-300"
        >
          Buy me a coffee
        </a>
      </div>
    </div>
  );
} 