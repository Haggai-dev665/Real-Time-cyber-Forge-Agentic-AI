/**
 * Maintains one shared SSE connection for the whole app and keeps a rolling
 * buffer of recent live events plus the latest metrics snapshot. Screens read
 * from here instead of each opening their own stream (and instead of polling).
 */
import React, { createContext, useContext, useEffect, useRef, useState, useCallback } from 'react';
import { openStream, LiveEvent } from '../api/sse';
import { useAuth } from './AuthContext';

const MAX_EVENTS = 40;

interface LiveFeedValue {
  connected: boolean;
  events: LiveEvent[];
  metrics: Record<string, unknown> | null;
  /** Newest event of a given type, or undefined. */
  latestOf: (type: string) => LiveEvent | undefined;
}

const LiveFeedContext = createContext<LiveFeedValue | null>(null);

export function LiveFeedProvider({ children }: { children: React.ReactNode }) {
  const { token, signedIn } = useAuth();
  const [connected, setConnected] = useState(false);
  const [events, setEvents] = useState<LiveEvent[]>([]);
  const [metrics, setMetrics] = useState<Record<string, unknown> | null>(null);
  const eventsRef = useRef<LiveEvent[]>([]);

  useEffect(() => {
    if (!signedIn) {
      setConnected(false);
      return;
    }

    const dispose = openStream(token, {
      onOpen: () => setConnected(true),
      onError: () => setConnected(false),
      onEvent: (evt) => {
        if (evt.type === 'connected') {
          setConnected(true);
          return;
        }
        if (evt.type === 'metrics:update') {
          setMetrics(evt.data);
          return;
        }
        const next = [evt, ...eventsRef.current].slice(0, MAX_EVENTS);
        eventsRef.current = next;
        setEvents(next);
      },
    });

    return () => {
      dispose();
      setConnected(false);
    };
  }, [token, signedIn]);

  const latestOf = useCallback(
    (type: string) => eventsRef.current.find((e) => e.type === type),
    []
  );

  return (
    <LiveFeedContext.Provider value={{ connected, events, metrics, latestOf }}>
      {children}
    </LiveFeedContext.Provider>
  );
}

export function useLiveFeed(): LiveFeedValue {
  const ctx = useContext(LiveFeedContext);
  if (!ctx) throw new Error('useLiveFeed must be used within LiveFeedProvider');
  return ctx;
}
