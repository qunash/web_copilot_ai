import { createAnthropic } from '@ai-sdk/anthropic';
import { streamText } from 'ai';
import { BrowserTools } from '../tools';

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
    }
});

const model = anthropicClient('claude-3-5-sonnet-20241022');
const browserTools = new BrowserTools();

export async function handleChatRequest(request: Request): Promise<Response> {
  try {
    const { messages } = await request.json();
    
    const result = await streamText({
      model,
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        ...messages
      ],
      tools: browserTools.getTools(),
      maxSteps: 10,
      experimental_toolCallStreaming: true
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
