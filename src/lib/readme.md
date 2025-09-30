# `useChat$` Hook API Reference (for Qwik)

The `useChat$` hook for Qwik provides a powerful, reactive interface for building conversational UIs. Inspired by the Vercel AI SDK for React, it handles streaming responses, state management, and user interactions, all in a way that is idiomatic to the Qwik framework.

It manages the entire lifecycle of a chat conversation, from sending user messages to rendering streamed AI responses and handling complex features like tool calls.

> **Note:** This hook is designed to be a Qwik-native equivalent of the Vercel AI SDK's `useChat` hook. It leverages Qwik's unique features like QRLs (`$`) and stores for optimal performance and serializability.

## Quick Start: Example Usage

Here is a complete example of a simple chat component using the `useChat` hook.

```tsx
// src/components/chat/chat.tsx

import { component$, $ } from "@builder.io/qwik";
import { useChat$, type UIMessage } from "./use-chat";
import { generateUUID } from "~/lib/utils"; // Your custom UUID function

export const MyChatComponent = component$(() => {
  const { messages, status, sendMessage, error, clearError } =
    useChat$<UIMessage>({
      // A unique ID for the conversation.
      id: "my-unique-chat-id",

      // A QRL for your custom ID generation function for messages.
      generateId$: $(() => {
        generateUUID();
      }),

      // Configuration for the network requests.
      transport: {
        api: "/api/chat", // Your backend API endpoint.
      },

      // A QRL callback for when data parts are received.
      onData$: $((data) => {
        console.log("Received data part:", data);
      }),
    });

  return (
    <div class="chat-container">
      {/* Message List */}
      <div class="message-list">
        {messages.map((m) => (
          <div key={m.id} class={`message role-${m.role}`}>
            <strong>{m.role === "user" ? "You" : "Assistant"}:</strong>
            <p>{m.parts.find((p) => p.type === "text")?.text}</p>
          </div>
        ))}
        {status.value === "streaming" && (
          <div class="streaming-indicator"></div>
        )}
      </div>

      {/* Error Display */}
      {error.value && (
        <div class="error-box">
          <p>Error: {error.value.message}</p>
          <button onClick$={$(() => clearError())}>Clear</button>
        </div>
      )}

      {/* Input Form */}
      <form
        preventdefault:submit
        onSubmit$={async (e, form) => {
          const input = form.querySelector('input[name="message"]');
          if (!input || !input.value) return;

          await sendMessage({ role: "user", content: input.value });
          input.value = "";
        }}
      >
        <input
          name="message"
          placeholder="Say something..."
          disabled={status.value !== "ready"}
        />
        <button type="submit" disabled={status.value !== "ready"}>
          {status.value === "ready" ? "Send" : "Generating..."}
        </button>
      </form>
    </div>
  );
});
```

## API Reference

### `useChat$(options)`

The hook takes a single `options` object as its parameter.

### Parameters (`UseChatOptions`)

All function properties must be passed as QRLs, marked with a `$` at the end of the property name (e.g., `onFinish$`).

| Option                   | Type                                          | Description                                                                                  |
| ------------------------ | --------------------------------------------- | -------------------------------------------------------------------------------------------- |
| `id`                     | `string`                                      | Optional. A unique identifier for the chat. If not provided, a random one will be generated. |
| `messages`               | `UIMessage[]`                                 | Optional. An initial array of messages to populate the conversation.                         |
| `generateId$`            | `QRL<IdGenerator>`                            | Optional. A QRL for a custom function to generate unique message IDs.                        |
| `transport`              | `QwikDefaultChatTransportOptions<UI_MESSAGE>` | Optional. Configuration for the network requests. See details below.                         |
| `onFinish$`              | `QRL<ChatOnFinishCallback<UI_MESSAGE>>`       | Optional. A QRL callback invoked when the assistant's response has finished streaming.       |
| `onError$`               | `QRL<ChatOnErrorCallback>`                    | Optional. A QRL callback invoked when an error occurs.                                       |
| `onData$`                | `QRL<ChatOnDataCallback<UI_MESSAGE>>`         | Optional. A QRL callback invoked when a `data` part is received from the stream.             |
| `onToolCall$`            | `QRL<ChatOnToolCallCallback<UI_MESSAGE>>`     | Optional. A QRL callback invoked when the AI requests a tool call.                           |
| `sendAutomaticallyWhen$` | `QRL<({ messages }) => boolean>`              | Optional. A QRL that determines if the chat should automatically resubmit after a tool call. |
| `experimental_throttle`  | `number`                                      | Optional. Throttle wait time in ms for message updates. Disables throttling if `undefined`.  |
| `resume`                 | `boolean`                                     | Optional. Whether to resume an ongoing chat stream on component load. Defaults to `false`.   |

#### The `transport` Object

This object configures the `DefaultChatTransport` used for API calls.

| Property                      | Type                                          | Description                                                                                                                                                    |
| ----------------------------- | --------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `api`                         | `string`                                      | Optional. The API endpoint to call. Defaults to `/api/chat`.                                                                                                   |
| `credentials`                 | `RequestCredentials`                          | Optional. The credentials mode for the `fetch` request.                                                                                                        |
| `headers`                     | `Record<string, string>`                      | Optional. Additional headers to send with each request.                                                                                                        |
| `body`                        | `object`                                      | Optional. An extra body object to merge into the request body.                                                                                                 |
| `prepareSendMessagesRequest$` | `QRL<PrepareSendMessagesRequest<UI_MESSAGE>>` | Optional. A QRL to customize the request object before it's sent. **This is the recommended way to add custom data to your API calls.** See the example below. |

---

### Return Values (`UseChatHelpers`)

The hook returns a reactive object with the following properties.

| Helper          | Type                                                | Description                                                                                      |
| --------------- | --------------------------------------------------- | ------------------------------------------------------------------------------------------------ |
| `id`            | `ReadonlySignal<string>`                            | The reactive ID of the current chat.                                                             |
| `messages`      | `Readonly<UIMessage[]>`                             | A readonly, reactive store of the chat messages.                                                 |
| `status`        | `ReadonlySignal<'ready' \| 'streaming' \| 'error'>` | The reactive status of the chat request. Use this to update your UI (e.g., disable buttons).     |
| `error`         | `ReadonlySignal<Error \| undefined>`                | The reactive error object if a request fails.                                                    |
| `sendMessage`   | `QRL<(message, options?) => void>`                  | A QRL function to send a new message to the AI. This triggers an API call.                       |
| `regenerate`    | `QRL<(options?) => void>`                           | A QRL function to regenerate the last assistant message or a specific message by ID.             |
| `stop`          | `QRL<() => void>`                                   | A QRL function to abort the current streaming response.                                          |
| `clearError`    | `QRL<() => void>`                                   | A QRL function to clear the current error state.                                                 |
| `resumeStream`  | `QRL<() => void>`                                   | A QRL function to resume an interrupted streaming response.                                      |
| `addToolResult` | `QRL<({ tool, toolCallId, output }) => void>`       | A QRL function to add a tool result to the chat, which is then sent back to the AI.              |
| `setMessages`   | `QRL<(updater) => void>`                            | A QRL function to imperatively update the messages state locally without triggering an API call. |

## Advanced Usage

### Customizing the API Request

The most common advanced use case is adding custom data to the API request. Use the `prepareSendMessagesRequest$` QRL for this.

```tsx
const { sendMessage } = useChat$({
  transport: {
    api: "/api/chat/custom",
    prepareSendMessagesRequest$: $((request) => {
      // Return a new object that includes the original request properties,
      // plus any custom data you need at the top level.
      return {
        ...request,
        selectedChatModel: "qwik-ai-pro",
        selectedVisibilityType: "private",
      };
    }),
  },
});
```

### Type Imports

You can import the following types directly from the hook file to use in your components:

```typescript
import {
  useChat,
  type UIMessage,
  type OnFinishOptions,
  type UseChatOptions,
} from "./use-chat";
```
