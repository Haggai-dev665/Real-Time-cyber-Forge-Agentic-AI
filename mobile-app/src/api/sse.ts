/**
 * Server-Sent Events client for the backend live feed (GET /api/stream?token=).
 *
 * EventSource can't set headers, so the JWT rides as a query param (matches the
 * backend contract in backend/src/routes/stream.js). The backend fans out named
 * events; we subscribe to the concrete types it emits.
 */
import EventSource from 'react-native-sse';
import { API_BASE_URL } from './config';

/** Event names emitted by realtimeBus on the backend. */
export const SSE_EVENTS = [
  'connected',
  'threat:new',
  'alert:new',
  'scan:update',
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
  const url =
    `${API_BASE_URL}/api/stream` +
    (token ? `?token=${encodeURIComponent(token)}` : '');

  const es = new EventSource<SseEventName>(url, {
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
