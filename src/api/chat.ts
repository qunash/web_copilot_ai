import { StreamingTextResponse, type Message } from 'ai';

export async function chat(messages: Message[]): Promise<Response> {
  // Send a message to the background script
  const response = await chrome.runtime.sendMessage({
    type: 'CHAT_REQUEST',
    messages: messages
  });

  // Check if there's an error
  if (response.error) {
    return new Response(JSON.stringify({ error: response.error }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }

  // Create a ReadableStream for the streaming response
  const stream = new ReadableStream({
    async start(controller) {
      for (const chunk of response.chunks) {
        controller.enqueue(chunk);
      }
      controller.close();
    },
  });

  // Return a StreamingTextResponse
  return new StreamingTextResponse(stream);
}
