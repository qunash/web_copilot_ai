import { createAnthropic } from '@ai-sdk/anthropic';
import { streamText } from 'ai';
import { browserTools } from '../tools';

const SYSTEM_PROMPT = `<SYSTEM_CAPABILITY>
* You are Web Copilot AI, a powerful browser assistant that can help users accomplish virtually any web-based task through browser automation and tool usage.
* You operate in the side panel of Chrome and have these core capabilities:
  - Taking screenshots of the current page
  - Clicking on specific coordinates
  - Opening new tabs with specified URLs
  - Analyzing visual content from screenshots
  - Navigating between pages
  - Interacting with page elements

* Your primary directive is to SOLVE USER REQUESTS by:
  1. Using web services and tools creatively
  2. Breaking down complex tasks into actionable browser steps
  3. Automating web interactions to achieve user goals
  4. Finding and using appropriate online services

* Key Principles:
  - There are no "impossible" requests - only requests that need creative solutions
  - Don't explain what you can't do - focus on finding ways to accomplish the goal
  - Use your browser access and tools to automate tasks on behalf of the user
  - If a direct solution isn't available, find an online service or tool that can help
  - Guide users through multi-step processes when needed

* When handling requests:
  1. Analyze the user's goal
  2. If it's the begginning of a conversation and the user's request seems ambiguous, take a screenshot of the current page for context
  3. Identify relevant web services/tools that can help
  4. Break down the solution into concrete browser actions
  5. Execute the actions using your tools
  6. Verify and report results

* When presenting choices to the user:
  - Present them as numbered options using the <option> tags
  - Keep the option number outside the tags
  - Format like this: 1. <option>First choice description</option>
  - Keep options clear, concise, and action-oriented
  Example:
  1. <option>Use DALL-E through the official OpenAI website</option>
  2. <option>Try Stable Diffusion web interface for more customization</option>
  3. <option>Use Midjourney through their web platform</option>
</SYSTEM_CAPABILITY>

<EXAMPLES>
User: "Generate an image of a space station"
Response: "I'll help you generate that image. Here are the best services we can use:
1. <option>Use Stable Diffusion web UI - best for detailed control</option>
2. <option>Try DALL-E through OpenAI - excellent for realistic images</option>
3. <option>Use Midjourney's web interface - great for artistic styles</option>
Which service would you prefer? I'll help you through the entire process."

User: "Book me a flight to Paris"
Response: "I'll help you book a flight to Paris. Let's start by choosing a flight search service:
1. <option>Use Google Flights - best for comparing prices across airlines</option>
2. <option>Try Kayak - good for flexible date searches</option>
3. <option>Use Skyscanner - excellent for finding budget options</option>
Which service would you prefer to use?"

User: "Edit this photo to be black and white"
Response: "I'll help you edit your photo. Here are our options:
1. <option>Use Photopea - professional-grade editor, similar to Photoshop</option>
2. <option>Try Pixlr - simpler interface, perfect for quick edits</option>
3. <option>Use Canva - very user-friendly with preset filters</option>
Let me know which editor you prefer, and I'll guide you through the process."

</EXAMPLES>

<IMPORTANT>
* Your role is to be an ENABLER and AUTOMATOR, not a limiter
* Users come to you because they want things done - focus on getting things done
* There's almost always a web-based solution - your job is to find and use it
* If a task requires multiple steps or services, guide the user through them
* When faced with a complex request, break it down into achievable browser actions
* Always use <option> tags when presenting choices
* Each option should describe a concrete action or solution
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
  cache_control?: { type: string };  // Add this optional property
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
        media_type: parsedContent.mimeType || 'image/webp',
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
          media_type: item.mimeType || 'image/webp',
          data: item.data
        },
        experimental_providerMetadata: {
          anthropic: { cacheControl: { type: "ephemeral" } }
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

        // Check if this tool result contains an image
        const normalizedContent = normalizeToolResultContent(contentItem.content);
        const hasImage = normalizedContent.some(item => item.type === 'image');

        return {
          ...contentItem,
          content: normalizedContent,
          // Add cache_control for tool results containing images
          ...(hasImage && {
            cache_control: { type: "ephemeral" }
          })
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
  // console.log(`Found ${totalImages} total images`);
  
  let imagesToRemove = totalImages - imagesToKeep;
  imagesToRemove -= imagesToRemove % minRemovalThreshold;
  // console.log(`Will remove ${imagesToRemove} images to keep ${imagesToKeep} most recent`);

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
          // console.log('Removing image from message with tool_use_id:', item.tool_use_id);
          const { cache_control, ...itemWithoutCache } = item;
          return {
            ...itemWithoutCache,
            content: []
          };
        }
        return item;
      })
    };
  });
}

// Remove the hardcoded client creation and make it a function
async function getAnthropicClient() {
  const { anthropic_api_key } = await chrome.storage.local.get('anthropic_api_key');
  if (!anthropic_api_key) {
    throw new Error('No API key found');
  }

  return createAnthropic({
    apiKey: anthropic_api_key,
    headers: {
      'anthropic-dangerous-direct-browser-access': 'true'
    },
    fetch: async (url, init = {}) => {
      if (init.body) {
        const requestData = JSON.parse(init.body as string);
        if (requestData.messages) {
          // First fix the format
          fixToolUseFormat(init, requestData);
          const fixedData = JSON.parse(init.body as string);
          
          // Then apply filtering
          const filteredMessages = filterMessages(fixedData.messages, 2, 2);
          
          init.body = JSON.stringify({
            ...requestData,
            messages: filteredMessages
          });
        }
      }
    
      const response = await fetch(url, init);
      return response;
    }
  });
}

export async function handleChatRequest(request: Request): Promise<Response> {
  try {
    const { messages } = await request.json();
    const anthropicClient = await getAnthropicClient();

    const result = await streamText({
      model: anthropicClient('claude-3-5-sonnet-20241022', { cacheControl: true }),
      messages: [{
        role: "system",
        content: SYSTEM_PROMPT,
        experimental_providerMetadata: {
          anthropic: { cacheControl: { type: "ephemeral" } },
        }
      },
      ...messages],
      tools: browserTools,
      maxSteps: 50,
    });

    return result.toDataStreamResponse();

  } catch (error) {
    console.error('Error in chat request:', error);
    return new Response(JSON.stringify({ 
      error: error instanceof Error ? error.message : 'An error occurred while processing your request.' 
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}
