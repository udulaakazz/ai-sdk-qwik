import {
  useStore,
  useSignal,
  useVisibleTask$,
  $,
  noSerialize,
  type QRL,
  type ReadonlySignal,
  type NoSerialize,
} from "@builder.io/qwik";
import { isServer } from "@builder.io/qwik/build";
import {
  DefaultChatTransport,
  type AbstractChat,
  type ChatInit,
  type CreateUIMessage,
  type UIMessage,
  type PrepareSendMessagesRequest,
  type PrepareReconnectToStreamRequest,
  type ChatOnFinishCallback,
  type ChatOnDataCallback,
  type ChatOnToolCallCallback,
  type ChatRequestOptions,
  type ChatOnErrorCallback,
  IdGenerator,
} from "ai";
import { Chat } from "./chat.qwik";

export type { CreateUIMessage, UIMessage, ChatOnFinishCallback };

/**
 * Qwik-idiomatic configuration options for the `DefaultChatTransport`.
 * Functions are replaced with Qwik QRLs for serialization.
 */
export type QwikDefaultChatTransportOptions<UI_MESSAGE extends UIMessage> = {
  /** The API endpoint to which requests will be sent. Defaults to `/api/chat`. */
  api?: string;
  /** The credentials mode to be used for fetch requests. */
  credentials?: RequestCredentials;
  /** Additional headers to be sent with each request. */
  headers?: Record<string, string> | Headers;
  /** An extra body object to be merged into the request body. */
  body?: object;
  /**
   * A QRL that allows for customizing the request before it is sent.
   * This is useful for adding custom headers or modifying the body.
   */
  prepareSendMessagesRequest$?: QRL<PrepareSendMessagesRequest<UI_MESSAGE>>;
  /**
   * A QRL that allows for customizing the request before reconnecting to a stream.
   */
  prepareReconnectToStreamRequest$?: QRL<PrepareReconnectToStreamRequest>;
};

/**
 * Qwik-idiomatic options for the `useChat` hook.
 * This mirrors the React API, replacing function callbacks with QRLs.
 */
export type UseChatOptions<UI_MESSAGE extends UIMessage> = Omit<
  ChatInit<UI_MESSAGE>,
  "transport"
> & {
  /**
   * A QRL for a custom ID generation function.
   * Defaults to the AI SDK's built-in `nanoid` implementation.
   */
  generateId$?: QRL<IdGenerator>;
  /**
   * Configuration for the `DefaultChatTransport`.
   * This object is used to configure the network requests made by the hook.
   */
  transport?: QwikDefaultChatTransportOptions<UI_MESSAGE>;
  /**
   * A QRL callback that is invoked when the AI model requests a tool call.
   * The developer should execute the tool and respond with `addToolResult`.
   */
  onToolCall$?: QRL<ChatOnToolCallCallback<UI_MESSAGE>>;
  /**
   * A QRL that determines if the chat should automatically resubmit after a tool call.
   */
  sendAutomaticallyWhen$?: QRL<
    (options: { messages: UI_MESSAGE[] }) => boolean | Promise<boolean>
  >;
  /**
   * A QRL callback that is invoked when the assistant's response has finished streaming.
   */
  onFinish$?: QRL<ChatOnFinishCallback<UI_MESSAGE>>;
  /**
   * A QRL callback that is invoked when an error occurs.
   */
  onError$?: QRL<ChatOnErrorCallback>;
  /**
   * A QRL callback that is invoked when a `data` part is received from the stream.
   */
  onData$?: QRL<ChatOnDataCallback<UI_MESSAGE>>;
  /**
   * Custom throttle wait in ms for the chat messages and data updates.
   * Default is undefined, which disables throttling.
   */
  experimental_throttle?: number;
  /**
   * Whether to resume an ongoing chat generation stream. Defaults to `false`.
   */
  resume?: boolean;
};

/**
 * The set of reactive helpers returned by the `useChat` hook.
 */
export type UseChatHelpers<UI_MESSAGE extends UIMessage> = {
  /** The reactive ID of the current chat. */
  readonly id: ReadonlySignal<string | undefined>;
  /** A readonly, reactive store of the chat messages. */
  readonly messages: Readonly<UI_MESSAGE[]>;
  /** The reactive status of the chat request: 'ready', 'streaming', or 'error'. */
  readonly status: ReadonlySignal<AbstractChat<UI_MESSAGE>["status"]>;
  /** The reactive error object, if any. */
  readonly error: ReadonlySignal<Error | undefined>;
  /**
   * A QRL to imperatively update the messages store.
   * This is useful for optimistic UI updates.
   */
  setMessages$: QRL<
    (
      messages: UI_MESSAGE[] | ((currentMessages: UI_MESSAGE[]) => UI_MESSAGE[])
    ) => void
  >;
  /**
   * A QRL to send a new message to the AI. This triggers an API call.
   */
  sendMessage$: QRL<
    (
      message: CreateUIMessage<UI_MESSAGE> | string,
      options?: ChatRequestOptions
    ) => void
  >;
  /**
   * A QRL to regenerate the last assistant message or a specific message by ID.
   */
  regenerate$: QRL<(options?: { messageId?: string }) => void>;
  /**
   * A QRL to abort the current streaming response.
   */
  stop$: QRL<() => void>;
  /**
   * A QRL to clear the current error state.
   */
  clearError$: QRL<() => void>;
  /**
   * A QRL to resume an interrupted streaming response.
   */
  resumeStream$: QRL<() => void>;
  /**
   * A QRL to add a tool result to the chat, which will then be sent back to the AI.
   */
  addToolResult$: QRL<
    (options: { tool: string; toolCallId: string; output: unknown }) => void
  >;
};

/**
 * A Qwik hook for building conversational UIs, with an API
 * inspired by the Vercel AI SDK for React.
 *
 * @param options - Configuration options for the chat hook.
 * @returns A set of reactive helpers for managing the chat state.
 *
 * @example
 * ```tsx
 * import { component$ } from '@builder.io/qwik';
 * import { useChat } from './use-chat.qwik';
 * import { generateUUID } from '~/lib/utils';
 *
 * export default component$(() => {
 *   const { messages, status, sendMessage } = useChat({
 *     id: 'my-chat-id',
 *     generateId$: $(generateUUID),
 *     transport: {
 *       api: '/api/chat/v3',
 *       prepareSendMessagesRequest$: $((request) => {
 *         return {
 *           ...request,
 *           body: {
 *             customData: 'my-custom-data',
 *             ...request.body,
 *           }
 *         };
 *       })
 *     },
 *     onData$: $((data) => {
 *       console.log('Received data part:', data);
 *     })
 *   });
 *
 *   return (
 *     <div>
 *       <div>
 *         {messages.map(m => (
 *           <div key={m.id}>{m.role}: {m.parts?.text}</div>
 *         ))}
 *       </div>
 *
 *       <form onSubmit$={(e, el) => {
 *         const input = el.querySelector('input[name="message"]');
 *         sendMessage(input.value);
 *         input.value = '';
 *       }}>
 *         <input name="message" disabled={status.value !== 'ready'} />
 *         <button type="submit">Send</button>
 *       </form>
 *     </div>
 *   );
 * });
 * ```
 */

/**
 * A Qwik hook for managing a chat conversation, with an API
 * inspired by the Vercel AI SDK for React.
 */
export function useChat<UI_MESSAGE extends UIMessage = UIMessage>(
  options: UseChatOptions<UI_MESSAGE> = {}
): UseChatHelpers<UI_MESSAGE> {
  const chatControllerStore = useStore<{
    instance: NoSerialize<Chat<UI_MESSAGE>>;
  }>({ instance: undefined });

  // The optionsStore holds all serializable configuration, making it safe to
  // use inside the useVisibleTask$.
  const optionsStore = useStore(options);

  const messages = useStore<UI_MESSAGE[]>(options.messages ?? []);
  const status = useSignal<AbstractChat<UI_MESSAGE>["status"]>("ready");
  const error = useSignal<Error | undefined>(undefined);
  const id = useSignal<string | undefined>(options.id);

  // This task runs exclusively on the client. It is responsible for instantiating
  // the non-serializable Chat controller and syncing its state with Qwik's
  // reactive stores and signals. It re-runs if the chat `id` changes.
  // eslint-disable-next-line qwik/no-use-visible-task
  useVisibleTask$(async ({ cleanup, track }) => {
    track(() => optionsStore.id);

    const {
      generateId$,
      transport: transportConfig,
      onToolCall$,
      sendAutomaticallyWhen$,
      onFinish$,
      onError$,
      onData$,
      ...chatInitOptions
    } = optionsStore;

    // Resolve all QRLs into their concrete function implementations.
    const [
      generateId,
      onToolCall,
      sendAutomaticallyWhen,
      onFinish,
      onError,
      onData,
      prepareSendMessagesRequest,
      prepareReconnectToStreamRequest,
    ] = await Promise.all([
      generateId$?.resolve(),
      onToolCall$?.resolve(),
      sendAutomaticallyWhen$?.resolve(),
      onFinish$?.resolve(),
      onError$?.resolve(),
      onData$?.resolve(),
      transportConfig?.prepareSendMessagesRequest$?.resolve(),
      transportConfig?.prepareReconnectToStreamRequest$?.resolve(),
    ]);

    // Construct the non-serializable transport object on the client
    // using the resolved functions.
    const transport = new DefaultChatTransport({
      api: transportConfig?.api,
      credentials: transportConfig?.credentials,
      headers: transportConfig?.headers,
      body: transportConfig?.body,
      prepareSendMessagesRequest: prepareSendMessagesRequest,
      prepareReconnectToStreamRequest: prepareReconnectToStreamRequest, // Pass the resolved function
    });

    // Instantiate the core Chat controller.
    const controller = new Chat({
      ...chatInitOptions,
      generateId,
      transport,
      onToolCall,
      sendAutomaticallyWhen,
      onFinish,
      onError,
      onData,
    });
    chatControllerStore.instance = noSerialize(controller);

    // Establish subscriptions to sync the controller's state to Qwik's state.
    const unregisterMessages = controller["~registerMessagesCallback"](() => {
      messages.length = 0;
      messages.push(...controller.messages);
    }, chatInitOptions.experimental_throttle);
    const unregisterStatus = controller["~registerStatusCallback"](
      () => (status.value = controller.status)
    );
    const unregisterError = controller["~registerErrorCallback"](
      () => (error.value = controller.error)
    );
    id.value = controller.id;
    if (chatInitOptions.resume) controller.resumeStream();

    // Clean up subscriptions when the component unmounts or the task re-runs.
    cleanup(() => {
      unregisterMessages();
      unregisterStatus();
      unregisterError();
    });
  });

  // A helper to create QRLs for the controller's methods, ensuring they are
  // only called on the client after initialization.
  const createControllerMethodQRL = <T extends (...args: any[]) => any>(
    methodName: keyof Chat<UI_MESSAGE>
  ) =>
    $(async (...args: Parameters<T>): Promise<ReturnType<T> | void> => {
      if (isServer) return;
      const controller = chatControllerStore.instance;
      if (!controller) {
        throw new Error("Chat controller is not initialized on the client.");
      }
      const method = controller[methodName];
      if (typeof method !== "function") {
        throw new Error(`Method '${String(methodName)}' is not a function.`);
      }
      return (method as any).apply(controller, args);
    });

  const setMessagesQrl = $(
    (
      updater: UI_MESSAGE[] | ((currentMessages: UI_MESSAGE[]) => UI_MESSAGE[])
    ) => {
      const newMessages =
        typeof updater === "function" ? updater(messages) : updater;
      messages.length = 0;
      messages.push(...newMessages);
      if (chatControllerStore.instance) {
        chatControllerStore.instance.messages = newMessages;
      }
    }
  );

  return {
    id,
    messages,
    status,
    error,
    setMessages$: setMessagesQrl,
    sendMessage$: createControllerMethodQRL("sendMessage"),
    regenerate$: createControllerMethodQRL("regenerate"),
    stop$: createControllerMethodQRL("stop"),
    clearError$: createControllerMethodQRL("clearError"),
    resumeStream$: createControllerMethodQRL("resumeStream"),
    addToolResult$: createControllerMethodQRL("addToolResult"),
  };
}
