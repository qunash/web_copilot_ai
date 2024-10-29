interface ClickableOptionProps {
  content: string;
  onSelect: () => void;
  index: number;
}

export function ClickableOption({ content, onSelect, index }: ClickableOptionProps) {
  return (
    <div 
      className="cursor-pointer p-3 rounded-lg transition-all
        border border-gray-200 dark:border-gray-700
        hover:border-blue-500 dark:hover:border-blue-400
        hover:bg-blue-50 dark:hover:bg-blue-900/30
        hover:shadow-md
        flex items-center gap-3"
      onClick={onSelect}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onSelect();
        }
      }}
    >
      <span className="flex-shrink-0 w-6 h-6 rounded-full bg-blue-100 dark:bg-blue-900 
        flex items-center justify-center text-blue-600 dark:text-blue-400 text-sm font-medium">
        {index}
      </span>
      <span className="flex-1">{content}</span>
    </div>
  );
} 