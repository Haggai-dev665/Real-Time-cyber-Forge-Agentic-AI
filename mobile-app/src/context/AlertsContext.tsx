/**
 * Unified alerts feed = persisted threats (GET /api/threats) merged with live
 * alert/threat events from the SSE stream. Screens consume this normalized list;
 * the detail screen looks an alert up by id. No synthetic data — when both
 * sources are empty the list is empty and screens render an idle state.
 */
import React, { createContext, useContext, useEffect, useMemo, useState, useCallback } from 'react';
import { endpoints } from '../api/endpoints';
import type { Threat } from '../api/types';
import { useLiveFeed } from './LiveFeedContext';
import { ApiError } from '../api/client';

export interface NormalizedAlert {
  id: string;
  severity: 'critical' | 'high' | 'medium' | 'low';
  category: 'browser' | 'network' | 'system';
  title: string;
  source: string;
  ts: number;
  unread: boolean;
  description?: string;
  indicators: Array<[string, string]>;
  recommendation?: string;
}

interface AlertsValue {
  alerts: NormalizedAlert[];
  loading: boolean;
  error: string | null;
  rateLimited: boolean;
  refresh: () => Promise<void>;
  getById: (id: string) => NormalizedAlert | undefined;
}

const AlertsContext = createContext<AlertsValue | null>(null);

const SEVERITIES = ['critical', 'high', 'medium', 'low'] as const;

function coerceSeverity(s: unknown): NormalizedAlert['severity'] {
  return SEVERITIES.includes(s as never) ? (s as NormalizedAlert['severity']) : 'medium';
}

function categoryFor(type?: string): NormalizedAlert['category'] {
  const t = (type ?? '').toLowerCase();
  if (t.includes('browser') || t.includes('url') || t.includes('extension')) return 'browser';
  if (t.includes('network') || t.includes('connection') || t.includes('port')) return 'network';
  return 'system';
}

function normalizeThreat(t: Threat): NormalizedAlert {
  return {
    id: t._id || t.id || `${t.type}-${t.detection?.timestamp ?? Math.random()}`,
    severity: coerceSeverity(t.severity),
    category: categoryFor(t.type),
    title: t.title || t.type || 'Threat detected',
    source: t.source || t.detection?.source || t.type || 'unknown',
    ts: t.detection?.timestamp ? Date.parse(t.detection.timestamp) : Date.now(),
    unread: t.status === 'active',
    description: t.description,
    indicators: (t.indicators ?? []).map((i) => [i.type, i.value] as [string, string]),
    recommendation: t.recommendation,
  };
}

export function AlertsProvider({ children }: { children: React.ReactNode }) {
  const { events } = useLiveFeed();
  const [fetched, setFetched] = useState<NormalizedAlert[]>([]);
  const [live, setLive] = useState<NormalizedAlert[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [rateLimited, setRateLimited] = useState(false);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await endpoints.threats({ status: 'active', limit: 50 });
      const threats = res.data?.threats ?? [];
      setFetched(threats.map(normalizeThreat));
      setRateLimited(false);
    } catch (e) {
      const apiErr = e instanceof ApiError ? e : null;
      setError(e instanceof Error ? e.message : 'Failed to load alerts');
      setRateLimited(!!apiErr?.rateLimited);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  // Fold incoming live alert/threat events into the live list.
  useEffect(() => {
    const relevant = events.filter((e) => e.type === 'alert:new' || e.type === 'threat:new');
    if (relevant.length === 0) return;
    const mapped: NormalizedAlert[] = relevant.map((e) => {
      const d = e.data as Record<string, unknown>;
      return {
        id: (d.id as string) || `live-${e.ts}`,
        severity: coerceSeverity(d.severity),
        category: categoryFor((d.type as string) || e.type),
        title: (d.title as string) || (d.message as string) || 'Live alert',
        source: (d.source as string) || (d.host as string) || (d.url as string) || 'live stream',
        ts: e.ts,
        unread: true,
        description: d.description as string | undefined,
        indicators: Array.isArray(d.indicators)
          ? (d.indicators as Array<{ type: string; value: string }>).map((i) => [i.type, i.value] as [string, string])
          : [],
        recommendation: d.recommendation as string | undefined,
      };
    });
    setLive((prev) => {
      const seen = new Set(prev.map((a) => a.id));
      const fresh = mapped.filter((a) => !seen.has(a.id));
      return [...fresh, ...prev].slice(0, 50);
    });
  }, [events]);

  const alerts = useMemo(() => {
    const merged = new Map<string, NormalizedAlert>();
    [...live, ...fetched].forEach((a) => {
      if (!merged.has(a.id)) merged.set(a.id, a);
    });
    return Array.from(merged.values()).sort((a, b) => b.ts - a.ts);
  }, [live, fetched]);

  const getById = useCallback((id: string) => alerts.find((a) => a.id === id), [alerts]);

  return (
    <AlertsContext.Provider value={{ alerts, loading, error, rateLimited, refresh, getById }}>
      {children}
    </AlertsContext.Provider>
  );
}

export function useAlerts(): AlertsValue {
  const ctx = useContext(AlertsContext);
  if (!ctx) throw new Error('useAlerts must be used within AlertsProvider');
  return ctx;
}
