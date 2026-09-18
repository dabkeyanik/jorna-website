// Live group-chat socket, mirroring the iOS ChatSocket.
//
// The backend pushes each new message (the same shape REST returns) to everyone
// connected to a conversation's socket. Browsers can't set headers on a
// WebSocket, so it authenticates with ?token=. We upsert by message_id, so the
// sender's own echoed frame and the POST response de-duplicate naturally, and a
// slow 5s REST poll (owned by the page) backstops a dropped socket or the
// single-replica fan-out caveat.

import { API_BASE, currentAccessToken } from "./api";
import type { GroupMessage } from "./types";

export function conversationWsUrl(conversationId: string): string | null {
  const token = currentAccessToken();
  if (!token) return null;
  // https -> wss, http -> ws
  const base = API_BASE.replace(/^http/, "ws");
  return `${base}/conversations/ws/${conversationId}?token=${encodeURIComponent(token)}`;
}

type Handlers = {
  onMessage: (msg: GroupMessage) => void;
  onOpen?: () => void;
  onClose?: () => void;
};

/**
 * Opens a conversation socket and keeps it alive with capped-backoff reconnects
 * until `.close()`. Returns a handle; call close() on unmount.
 */
export function openConversationSocket(
  conversationId: string,
  handlers: Handlers,
): { close: () => void } {
  let ws: WebSocket | null = null;
  let closedByUs = false;
  let retry = 0;
  let reconnectTimer: ReturnType<typeof setTimeout> | null = null;

  const connect = () => {
    const url = conversationWsUrl(conversationId);
    if (!url) return; // not authed — the page's poll still works
    try {
      ws = new WebSocket(url);
    } catch {
      scheduleReconnect();
      return;
    }
    ws.onopen = () => {
      retry = 0;
      handlers.onOpen?.();
    };
    ws.onmessage = (ev) => {
      try {
        const data = JSON.parse(ev.data);
        // The socket also carries membership notices ({type: ...}); only real
        // messages have a message_id + content.
        if (data && data.message_id && typeof data.content === "string") {
          handlers.onMessage(data as GroupMessage);
        }
      } catch {
        /* ignore non-JSON frames */
      }
    };
    ws.onclose = () => {
      handlers.onClose?.();
      if (!closedByUs) scheduleReconnect();
    };
    ws.onerror = () => ws?.close();
  };

  const scheduleReconnect = () => {
    if (closedByUs) return;
    retry += 1;
    const delay = Math.min(1000 * 2 ** retry, 15000);
    reconnectTimer = setTimeout(connect, delay);
  };

  connect();

  return {
    close() {
      closedByUs = true;
      if (reconnectTimer) clearTimeout(reconnectTimer);
      ws?.close();
    },
  };
}
