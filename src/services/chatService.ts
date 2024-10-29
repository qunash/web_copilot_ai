import { createAnthropic } from '@ai-sdk/anthropic';
import { streamText, convertToCoreMessages, type CoreToolCallUnion, type CoreToolResultUnion, generateText } from 'ai';
import { browserTools } from '../tools';

const SYSTEM_PROMPT = `<SYSTEM_CAPABILITY>
* You are Web Copilot AI, a browser assistant that helps users perform actions in their browser using provided tools.
* You operate in the side panel of the user's Google Chrome browser.
* You must try being as helpful and accomodating to the user as possible.
* You can take screenshots of the current page to understand its content and layout.
* You can click on specific coordinates on the page to interact with elements.
* You can open new tabs with specified URLs.
* Always analyze the visual content from screenshots before suggesting actions.
* When presenting choices to the user:
  - Present them as numbered options
  - Keep the option number outside the option tags
  - Format like this: 1. <option>First choice description</option> etc.
  - Keep option text concise and action-oriented
</SYSTEM_CAPABILITY>

<IMPORTANT>
* Before clicking on coordinates, always take a screenshot first to verify the current state of the page. When you are ready to perform a click you must always output the coordinates you are going to click on in your message prior to click.
* When navigating to new URLs, make sure they are properly formatted with the protocol (http:// or https://).
* After performing actions that modify the page state, take a new screenshot to verify the results.
</IMPORTANT>
<ADDITIONAL_INFORMATION>
* The current date and time is ${new Date().toLocaleString()}.
</ADDITIONAL_INFORMATION>`;

interface ImageSource {
  type: 'base64';
  media_type: string;
  data: string;
}

interface ToolResultContent {
  type: string;
  text?: string;
  data?: string;
  mimeType?: string;
  source?: ImageSource;  // Add this for image content
}

interface ToolResultItem {
  type: 'tool_result';
  tool_use_id: string;
  content: string | ToolResultContent[];
}

interface Message {
  role: string;
  content: Array<ToolResultItem | {
    type: string;
    [key: string]: any;
  }>;
}

function normalizeToolResultContent(content: string | ToolResultContent[]): ToolResultContent[] {
  // If already an array of proper format, return as is
  if (Array.isArray(content)) {
    return content;
  }

  // Parse string content if needed
  const parsedContent = typeof content === 'string' 
    ? JSON.parse(content) 
    : content;

  // Handle case where content is just a text string
  if (typeof parsedContent === 'string') {
    return [{
      type: 'text',
      text: parsedContent
    }];
  }

  // Handle {data: "..."} format
  if (!Array.isArray(parsedContent) && parsedContent.data) {
    return [{
      type: 'image',
      source: {
        type: 'base64',
        media_type: parsedContent.mimeType || 'image/png',
        data: parsedContent.data
      }
    }];
  }

  // Convert to array if single object
  const contentArray = Array.isArray(parsedContent) ? parsedContent : [parsedContent];

  // Normalize each item in the array
  return contentArray.map(item => {
    if (item.type === 'image' || item.data) {
      return {
        type: 'image',
        source: {
          type: 'base64',
          media_type: item.mimeType || 'image/png',
          data: item.data
        }
      };
    }
    return item;
  });
}

function normalizeMessages(messages: Message[]): Message[] {
  return messages.map(msg => {
    if (msg.role !== 'user') {
      return msg;
    }

    return {
      ...msg,
      content: msg.content.map(contentItem => {
        if (contentItem.type !== 'tool_result') {
          return contentItem;
        }

        return {
          ...contentItem,
          content: normalizeToolResultContent(contentItem.content)
        };
      })
    };
  });
}

function fixToolUseFormat(init: RequestInit, requestData: any): void {
  const normalizedMessages = normalizeMessages(requestData.messages);
  
  init.body = JSON.stringify({
    ...requestData,
    messages: normalizedMessages
  });
}

function filterMessages(messages: Message[], imagesToKeep: number = 2, minRemovalThreshold: number = 2) {
  if (imagesToKeep === null) return messages;

  // Find messages with image tool results
  const toolResultMessages = messages.filter(message => 
    message.content?.some?.(item => 
      item.type === 'tool_result' && 
      Array.isArray(item.content) &&
      item.content.some(contentItem => contentItem.type === 'image')
    )
  );

  const totalImages = toolResultMessages.length;
  console.log(`Found ${totalImages} total images`);
  
  let imagesToRemove = totalImages - imagesToKeep;
  imagesToRemove -= imagesToRemove % minRemovalThreshold;
  console.log(`Will remove ${imagesToRemove} images to keep ${imagesToKeep} most recent`);

  if (imagesToRemove <= 0) return messages;

  return messages.map(message => {
    if (!message.content?.some?.(item => item.type === 'tool_result')) {
      return message;
    }

    return {
      ...message,
      content: message.content.map(item => {
        if (item.type !== 'tool_result') return item;

        // Now we check if this tool_result contains an image
        const hasImage = Array.isArray(item.content) && 
                        item.content.some(contentItem => contentItem.type === 'image');

        if (hasImage && imagesToRemove > 0) {
          imagesToRemove--;
          console.log('Removing image from message with tool_use_id:', item.tool_use_id);
          return {
            ...item,
            content: [] // Empty array instead of '[]' string
          };
        }
        return item;
      })
    };
  });
}

const anthropicClient = createAnthropic({
  apiKey: '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',
  headers: {
    'anthropic-dangerous-direct-browser-access': 'true'
  },
  fetch: async (url, init = {}) => {
    if (init.body) {
      const requestData = JSON.parse(init.body as string);
      if (requestData.messages) {
        console.log('--- Starting message processing ---');
        console.log('Original messages:', requestData.messages);
        
        // First fix the format
        fixToolUseFormat(init, requestData);
        const fixedData = JSON.parse(init.body as string);
        console.log('Messages after fixing format:', fixedData.messages);
        
        // Then apply filtering
        const filteredMessages = filterMessages(fixedData.messages, 2, 2);
        console.log('Messages after filtering:', filteredMessages);
        
        init.body = JSON.stringify({
          ...requestData,
          messages: filteredMessages
        });
        
        console.log('--- Processing complete ---');
      }
    }
  
    const response = await fetch(url, init);
    return response;
  }
});

export async function handleChatRequest(request: Request): Promise<Response> {
  try {
    const { messages } = await request.json();

    const result = await streamText({
      model: anthropicClient('claude-3-5-sonnet-20241022', { cacheControl: true }),
      messages: [{
        role: "system",
        content: SYSTEM_PROMPT,
        experimental_providerMetadata: {
          anthropic: { cacheControl: { type: "ephemeral" } },
        }
      },
      ...convertToCoreMessages(messages)],
      tools: browserTools,
      maxSteps: 50,
      // experimental_toolCallStreaming: true
    });

    return result.toDataStreamResponse();

  } catch (error) {
    console.error('Error in chat request:', error);
    return new Response(JSON.stringify({ error: 'An error occurred while processing your request.' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}
