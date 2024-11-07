import { type ToolInvocation } from '@ai-sdk/ui-utils';
import { useState, useMemo } from 'react';
import { Camera, MousePointer, Globe, ArrowLeft, ArrowRight, RotateCw, X as XIcon, Keyboard, ScrollText, ChevronRight } from 'lucide-react';
import { cn } from "@/lib/utils";

const TOOL_ICONS = {
  take_screenshot: Camera,
  click: MousePointer,
  navigate: Globe,
  go_back: ArrowLeft,
  go_forward: ArrowRight,
  refresh_page: RotateCw,
  close_tab: XIcon,
  type_text: Keyboard,
  press_key: Keyboard,
  scroll_at_position: ScrollText,
} as const;

const getToolIcon = (toolName: string) => {
  const IconComponent = TOOL_ICONS[toolName as keyof typeof TOOL_ICONS];
  return IconComponent ? <IconComponent className="w-5 h-5" /> : null;
};

const ToolResult = ({ tool }: { tool: ToolInvocation }) => {
  const hasError = tool.state === 'result' && 
    'result' in tool && 
    typeof tool.result === 'object' && 
    'error' in tool.result;

  const [isCollapsed, setIsCollapsed] = useState(
    !(tool.toolName === 'take_screenshot' || hasError)
  );
  
  const content = useMemo(() => {
    const toolInfo = (
      <div 
        className={cn(
          "font-mono text-xs mb-1 text-gray-500 dark:text-gray-400 break-all",
          "flex gap-2",
          (!hasError && tool.toolName !== 'take_screenshot') && "cursor-pointer hover:text-gray-700 dark:hover:text-gray-300"
        )}
        onClick={() => {
          if (!hasError && tool.toolName !== 'take_screenshot') {
            setIsCollapsed(!isCollapsed);
          }
        }}
      >
        {!hasError && tool.toolName !== 'take_screenshot' && (
          <ChevronRight className={cn("w-3 h-3 flex-shrink-0 transition-transform", 
            !isCollapsed && "rotate-90"
          )} />
        )}
        <span>
          {tool.toolName}({
            Object.entries(tool.args)
              .map(([key, value]) => `${key}: ${JSON.stringify(value)}`)
              .join(', ')
          })
        </span>
      </div>
    );

    // For screenshot results
    if (tool.toolName === 'take_screenshot' && tool.state === 'result' && 'result' in tool) {
      if ('error' in tool.result) {
        return (
          <>
            {toolInfo}
            <div className="text-red-500">{tool.result.error}</div>
          </>
        );
      }
      
      if ('data' in tool.result) {
        return (
          <>
            {toolInfo}
            <img 
              src={`data:image/webp;base64,${tool.result.data}`}
              alt="Screenshot result"
              className="max-w-full rounded-lg mt-2 border border-gray-200 dark:border-gray-700 shadow-md"
            />
          </>
        );
      }
    }

    // For all other results
    return (
      <>
        {toolInfo}
        {(!isCollapsed || hasError) && tool.state === 'result' && 'result' in tool && (
          <div className="mt-1 text-sm">
            {hasError ? (
              <div className="text-red-500">{tool.result.error}</div>
            ) : (
              <pre className="whitespace-pre-wrap break-all overflow-hidden">
                {'data' in tool.result ? tool.result.data : JSON.stringify(tool.result, null, 2)}
              </pre>
            )}
          </div>
        )}
        {!isCollapsed && tool.state !== 'result' && (
          <div className="mt-1 text-sm">
            <span>{tool.state === 'partial-call' ? tool.state : 'Processing...'}</span>
          </div>
        )}
      </>
    );
  }, [tool, isCollapsed, hasError]);

  return (
    <div className="text-sm font-normal bg-gray-100 dark:bg-gray-800 p-3 rounded-lg shadow-sm max-w-full">
      {content}
    </div>
  );
};

export function ToolDisplay({ toolInvocations }: { toolInvocations?: ToolInvocation[] }) {
  if (!toolInvocations?.length) return null;

  return (
    <div className="mt-3 space-y-2 max-w-full">
      {toolInvocations.map((tool) => {
        const hasError = tool.state === 'result' && 
          'result' in tool && 
          typeof tool.result === 'object' && 
          'error' in tool.result;

        return (
          <div
            key={tool.toolCallId}
            className="flex items-start space-x-2 text-gray-600 dark:text-gray-400 max-w-full"
          >
            <div className="flex flex-col items-center gap-1 pt-[0.875rem]">
              {getToolIcon(tool.toolName)}
              <div className="h-4 flex items-center">
                <span 
                  className={`inline-block w-2 h-2 rounded-full flex-shrink-0 ${
                    tool.state === 'result' 
                      ? hasError 
                        ? 'bg-red-500' 
                        : 'bg-green-500'
                      : 'bg-yellow-500 animate-pulse'
                  }`}
                />
              </div>
            </div>
            <div className="flex-1 min-w-0">
              <ToolResult tool={tool} />
            </div>
          </div>
        );
      })}
    </div>
  );
} 