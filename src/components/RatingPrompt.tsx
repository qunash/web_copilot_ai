import { CircleXIcon } from 'lucide-react';

interface RatingPromptProps {
  onLinkClick: () => void;
  onClose: () => void;
}

export function RatingPrompt({ onLinkClick, onClose }: RatingPromptProps) {
  return (
    <div className="relative text-center p-3 mb-2 bg-blue-50 dark:bg-gray-800 rounded-lg text-sm text-gray-800 dark:text-gray-200 border border-gray-200 dark:border-gray-700">
      <button
        onClick={onClose}
        className="absolute top-2 right-2 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
        aria-label="Close rating prompt"
      >
        <CircleXIcon className="w-4 h-4" />
      </button>
      ★ ★ ★ ★ ★
      <br />
      <h2 className="font-bold">Enjoying Web Copilot?</h2>
      <br />
      Please consider 
      <a 
        href="https://chromewebstore.google.com/detail/web-copilot-ai/moimddgmepjjlbchcbpcinlpljnnennp"
        target="_blank"
        rel="noopener noreferrer"
        className="text-blue-600 dark:text-blue-400 hover:underline mx-1"
        onClick={onLinkClick}
      >
        rating us on the
        <br />
        Chrome Web Store!
      </a>
    </div>
  );
} 