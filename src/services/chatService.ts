import { createAnthropic } from '@ai-sdk/anthropic';
import { streamText, convertToCoreMessages, type CoreToolCallUnion, type CoreToolResultUnion, generateText } from 'ai';
import { browserTools } from '../tools';

const SYSTEM_PROMPT = `<SYSTEM_CAPABILITY>
* You are Web Copilot AI, a browser assistant that helps users perform actions in their browser using provided tools.
* You can take screenshots of the current page to understand its content and layout.
* You can click on specific coordinates on the page to interact with elements.
* You can open new tabs with specified URLs.
* Always analyze the visual content from screenshots before suggesting actions.
* Provide clear, step-by-step instructions about which tools to use and why.
</SYSTEM_CAPABILITY>

<IMPORTANT>
* Before clicking on coordinates, always take a screenshot first to verify the current state of the page.
* When navigating to new URLs, make sure they are properly formatted with the protocol (http:// or https://).
* After performing actions that modify the page state, take a new screenshot to verify the results.
</IMPORTANT>`;

const anthropicClient = createAnthropic({
  apiKey: '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',
  headers: {
    'anthropic-dangerous-direct-browser-access': 'true'
  },
  fetch: async (url, init = {}) => {
    if (init.body) {
      const requestData = JSON.parse(init.body as string);
      if (requestData.messages) {
        const messages = requestData.messages.map((msg: any) => {
          if (msg.role === 'user') {
            const content = msg.content;
            return {
              ...msg,
              content: content.map((content: any) => {
                if (content.type === 'tool_result') {
                  const parsedContent = typeof content.content === 'string'
                    ? JSON.parse(content.content)
                    : content.content;

                  // console.log('Parsed content:', parsedContent);

                  // Handle string content by converting to text object array
                  if (typeof parsedContent === 'string') {
                    return {
                      ...content,
                      content: [{
                        type: 'text',
                        text: parsedContent
                      }]
                    };
                  }

                  // Ensure parsedContent is an array
                  const contentArray = Array.isArray(parsedContent)
                    ? parsedContent
                    : [parsedContent];

                  return {
                    ...content,
                    content: contentArray.map((item: any) => {
                      // if (item.type === 'image') {
                        return {
                          type: 'image',
                          source: {
                            type: 'base64',
                            media_type: item.mimeType || 'image/png',
                            data: item.data
                          }
                        };
                      // }
                      return item;
                    })
                  };
                }
                return content;
              })
            };
          }
          return msg;
        });

        init.body = JSON.stringify({ ...requestData, messages });
      }
    }

    const response = await fetch(url, init);
    return response;
  }
});

const model = anthropicClient('claude-3-5-sonnet-20241022');


export async function handleChatRequest(request: Request): Promise<Response> {
  try {
    const { messages } = await request.json();

    const result = await streamText({
      model,
      system: SYSTEM_PROMPT,
      messages: convertToCoreMessages(messages),
      tools: browserTools,
      maxSteps: 100,
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
