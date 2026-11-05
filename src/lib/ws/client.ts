import { wsEventSchema, type WsEvent } from "@/schemas";
export interface ProjectSocketOptions {
  baseUrl?: string;
  onEvent: (event: WsEvent) => void;
  onError?: (error: Error) => void;
  onOpen?: () => void;
  reconnect?: boolean;
}
export function connectProjectSocket(
  projectId: string,
  options: ProjectSocketOptions,
) {
  if (process.env.NEXT_PUBLIC_API_MOCKING !== "enabled" && !options.baseUrl) {
    const url = new URL("/ws", globalThis.location.origin);
    url.searchParams.set("projectId", projectId);
    const source = new EventSource(url, { withCredentials: true });
    source.onopen = () => options.onOpen?.();
    source.onmessage = (message) => {
      try {
        options.onEvent(wsEventSchema.parse(JSON.parse(message.data)));
      } catch {
        options.onError?.(new Error("Invalid project event"));
      }
    };
    source.onerror = () =>
      options.onError?.(new Error("Project event stream reconnecting"));
    return () => source.close();
  }
  const url = new URL("/ws", options.baseUrl ?? globalThis.location.origin);
  url.protocol =
    url.protocol === "https:" || url.protocol === "wss:" ? "wss:" : "ws:";
  url.searchParams.set("projectId", projectId);
  let socket: WebSocket | undefined;
  let retry: ReturnType<typeof setTimeout> | undefined;
  let stopped = false;
  let attempt = 0;
  function connect() {
    if (stopped) return;
    socket = new WebSocket(url);
    socket.addEventListener("open", () => {
      if (stopped) return;
      attempt = 0;
      options.onOpen?.();
    });
    socket.addEventListener("message", (event) => {
      if (stopped) return;
      try {
        const parsed = wsEventSchema.parse(JSON.parse(String(event.data)));
        options.onEvent(parsed);
      } catch (error) {
        options.onError?.(
          error instanceof Error ? error : new Error("Invalid WebSocket event"),
        );
      }
    });
    socket.addEventListener("error", () =>
      options.onError?.(new Error("Project WebSocket connection failed")),
    );
    socket.addEventListener("close", (event) => {
      if (!stopped && options.reconnect !== false && event.code !== 1008)
        retry = setTimeout(connect, Math.min(1000 * 2 ** attempt++, 30000));
    });
  }
  connect();
  return () => {
    stopped = true;
    clearTimeout(retry);
    socket?.close();
  };
}
