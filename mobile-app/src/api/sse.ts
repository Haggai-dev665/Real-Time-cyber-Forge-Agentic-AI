/**
 * Server-Sent Events client for the backend live feed (GET /api/stream).
 *
 * The session token is sent in the Authorization header, never in the URL,
 * where proxies and access logs would record it (backend contract in
 * backend/src/routes/stream.js). The backend fans out named events; we
 * subscribe to the concrete types it emits.
 */
import EventSource from 'react-native-sse';
import { API_BASE_URL } from './config';

/** Event names emitted by realtimeBus on the backend. */
export const SSE_EVENTS = [
  'connected',
  'threat:new',
  'threat:update',
  'alert:new',
  'scan:update',
  'scan:explanation',
  'agent:activity',
  'metrics:update',
] as const;

export type SseEventName = (typeof SSE_EVENTS)[number];

export interface LiveEvent {
  type: string;
  data: Record<string, unknown> & { userId?: string };
  ts: number;
}

export interface StreamHandlers {
  onEvent: (evt: LiveEvent) => void;
  onOpen?: () => void;
  onError?: (err: unknown) => void;
}

/**
 * Opens an SSE connection and forwards every backend event to `onEvent`.
 * Returns a disposer that closes the connection.
 */
export function openStream(token: string | null, handlers: StreamHandlers): () => void {
  const es = new EventSource<SseEventName>(`${API_BASE_URL}/api/stream`, {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
    // Auto-reconnect ~5s after a drop; keep the request open indefinitely.
    pollingInterval: 5000,
    timeout: 0,
    timeoutBeforeConnection: 0,
  });

  es.addEventListener('open', () => handlers.onOpen?.());

  es.addEventListener('error', (event) => handlers.onError?.(event));

  for (const name of SSE_EVENTS) {
    es.addEventListener(name, (event) => {
      // Custom named events carry the JSON envelope in `data`.
      const raw = (event as { data?: string | null }).data;
      if (!raw) {
        handlers.onEvent({ type: name, data: {}, ts: Date.now() });
        return;
      }
      try {
        const parsed = JSON.parse(raw) as LiveEvent;
        handlers.onEvent({
          type: parsed.type ?? name,
          data: parsed.data ?? {},
          ts: parsed.ts ?? Date.now(),
        });
      } catch {
        handlers.onEvent({ type: name, data: { raw }, ts: Date.now() });
      }
    });
  }

  return () => {
    es.removeAllEventListeners();
    es.close();
  };
}

/* ---------------- the assistant's streamed answer ---------------- */

export interface ChatTurn {
  role: 'user' | 'assistant';
  content: string;
}

export interface ChatStreamHandlers {
  onThinking: (delta: string) => void;
  onAnswer: (delta: string) => void;
  /** The checked answer (with its engine and references), or a no-answer result. */
  onFinal: (result: Record<string, unknown>) => void;
  onError: (message: string, status?: number) => void;
}

/**
 * Ask the assistant and receive its reasoning and answer as they are written
 * (POST /api/cyberforge-ml/v2/security-chat/stream, server-sent events). The
 * session goes in the Authorization header, never in the address. Returns a
 * function that stops the request.
 */
export function openChatStream(
  token: string | null,
  request: { query: string; history: ChatTurn[]; think: 'auto' | 'on' | 'off' },
  handlers: ChatStreamHandlers,
): () => void {
  let done = false;
  const es = new EventSource(`${API_BASE_URL}/api/cyberforge-ml/v2/security-chat/stream`, {
    method: 'POST',
    headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}), 'Content-Type': 'application/json' },
    body: JSON.stringify(request),
    pollingInterval: 0, // one answer: no reconnect
    timeout: 0,
  });
  const finish = () => {
    done = true;
    es.removeAllEventListeners();
    es.close();
  };
  es.addEventListener('message', (event) => {
    const raw = (event as { data?: string | null }).data;
    if (!raw) return;
    try {
      const evt = JSON.parse(raw) as { type?: string; delta?: string; result?: Record<string, unknown> };
      if (evt.type === 'thinking' && typeof evt.delta === 'string') handlers.onThinking(evt.delta);
      else if (evt.type === 'answer' && typeof evt.delta === 'string') handlers.onAnswer(evt.delta);
      else if (evt.type === 'final') {
        handlers.onFinal(evt.result ?? {});
        finish();
      }
    } catch {
      /* a malformed line is skipped */
    }
  });
  es.addEventListener('error', (event) => {
    if (done) return;
    const e = event as { message?: string; xhrStatus?: number };
    handlers.onError(e.message || 'The connection to the assistant was lost', e.xhrStatus);
    finish();
  });
  return () => {
    if (!done) finish();
  };
}
