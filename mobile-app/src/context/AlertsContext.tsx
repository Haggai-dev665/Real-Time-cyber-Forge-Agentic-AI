/**
 * Unified alerts feed = the account's findings (GET /api/threats) merged with
 * live alert/threat events from the SSE stream. Screens consume this normalized
 * list; the detail screen looks an alert up by id. No synthetic data — when
 * both sources are empty the list is empty and screens render an idle state.
 *
 * Sync across devices: a finding moved through its workflow here (acknowledge,
 * investigate, resolve, false positive, reopen) is changed on the backend, and
 * the backend's `threat:update` event updates the same finding on the desktop
 * and on any other signed-in phone; changes made there arrive here the same way.
 * The last list loaded is kept for the account and shown, marked as such, when
 * the backend cannot be reached.
 */
import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { endpoints } from '../api/endpoints';
import type { FindingAction, Threat } from '../api/types';
import { useLiveFeed } from './LiveFeedContext';
import { useAuth } from './AuthContext';
import { ApiError } from '../api/client';
import { readJson, writeJson, cacheName, type Cached } from '../api/userStore';

export interface NormalizedAlert {
  id: string;
  severity: 'critical' | 'high' | 'medium' | 'low';
  category: 'browser' | 'network' | 'system';
  title: string;
  source: string;
  ts: number;
  unread: boolean;
  /** Workflow state (detected, acknowledged, investigating, resolved, false_positive, …). */
  status: string;
  /** Whether the backend holds this finding (live-only events cannot be moved through the workflow). */
  stored: boolean;
  description?: string;
  indicators: Array<[string, string]>;
  recommendation?: string;
}

/** Open states: the finding still needs a decision. */
export const OPEN_STATES = ['detected', 'active', 'acknowledged', 'investigating', 'confirmed'];

/** What each action does, and the states it applies to (backend findingService TRANSITIONS). */
export const FINDING_ACTIONS: Array<{ action: FindingAction; label: string; from: string[] }> = [
  { action: 'acknowledge', label: 'Acknowledge', from: ['detected', 'active'] },
  { action: 'investigate', label: 'Investigate', from: ['detected', 'active', 'acknowledged', 'confirmed'] },
  { action: 'resolve', label: 'Resolve', from: OPEN_STATES },
  { action: 'false_positive', label: 'False positive', from: OPEN_STATES },
  { action: 'reopen', label: 'Reopen', from: ['resolved', 'false_positive', 'dismissed', 'mitigated', 'excepted'] },
];

interface AlertsValue {
  alerts: NormalizedAlert[];
  loading: boolean;
  error: string | null;
  rateLimited: boolean;
  /** The list shown is the copy kept from an earlier load (the backend could not be reached). */
  stale: boolean;
  loadedAt: number | null;
  refresh: () => Promise<void>;
  getById: (id: string) => NormalizedAlert | undefined;
  /** Move a finding through its workflow on the backend (all the account's devices follow). */
  transition: (id: string, action: FindingAction, note?: string) => Promise<void>;
}

const AlertsContext = createContext<AlertsValue | null>(null);

const SEVERITIES = ['critical', 'high', 'medium', 'low'] as const;
const CACHE = cacheName('alerts');

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
  const status = t.status || 'detected';
  return {
    id: t._id || t.id || t.threatId || `${t.type}-${t.detection?.timestamp ?? Math.random()}`,
    severity: coerceSeverity(t.severity),
    category: categoryFor(t.type),
    title: t.title || t.type || 'Threat detected',
    source: t.source || t.detection?.source || t.type || 'unknown',
    ts: t.detection?.timestamp ? Date.parse(t.detection.timestamp) : Date.now(),
    unread: status === 'detected' || status === 'active',
    status,
    stored: Boolean(t._id || t.threatId),
    description: t.description,
    indicators: (t.indicators ?? []).map((i) => [i.type, i.value] as [string, string]),
    recommendation: t.recommendation ?? t.guidance?.nextStep,
  };
}

export function AlertsProvider({ children }: { children: React.ReactNode }) {
  const { events } = useLiveFeed();
  const { user, isGuest } = useAuth();
  const userId = isGuest ? null : user?.id ?? null;
  const [fetched, setFetched] = useState<NormalizedAlert[]>([]);
  const [live, setLive] = useState<NormalizedAlert[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [rateLimited, setRateLimited] = useState(false);
  const [stale, setStale] = useState(false);
  const [loadedAt, setLoadedAt] = useState<number | null>(null);
  const applied = useRef(new Set<string>());

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await endpoints.threats({ limit: 60 });
      const list = (res.data?.threats ?? []).map(normalizeThreat);
      setFetched(list);
      setRateLimited(false);
      setStale(false);
      setLoadedAt(Date.now());
      void writeJson(userId, CACHE, { at: Date.now(), data: list } satisfies Cached<NormalizedAlert[]>);
    } catch (e) {
      const apiErr = e instanceof ApiError ? e : null;
      setError(e instanceof Error ? e.message : 'Failed to load alerts');
      setRateLimited(!!apiErr?.rateLimited);
      setStale(true);
    } finally {
      setLoading(false);
    }
  }, [userId]);

  // the account's kept copy first (so the list is there offline), then the backend
  useEffect(() => {
    let cancelled = false;
    setFetched([]);
    setLive([]);
    void (async () => {
      const cached = await readJson<Cached<NormalizedAlert[]>>(userId, CACHE);
      if (!cancelled && cached?.data) {
        setFetched(cached.data);
        setLoadedAt(cached.at);
        setStale(true);
      }
      if (!cancelled) await refresh();
    })();
    return () => {
      cancelled = true;
    };
  }, [refresh, userId]);

  // Live events: new alerts join the list; workflow changes from any device update it.
  useEffect(() => {
    const fresh: NormalizedAlert[] = [];
    const updates: Array<{ ids: string[]; status: string; severity?: string }> = [];
    for (const e of events) {
      const key = `${e.type}:${e.ts}:${String((e.data as Record<string, unknown>).id ?? '')}`;
      if (applied.current.has(key)) continue;
      applied.current.add(key);
      const d = e.data as Record<string, unknown>;
      if (e.type === 'threat:update') {
        updates.push({ ids: [String(d.id ?? ''), String(d.threatId ?? '')].filter(Boolean), status: String(d.status ?? ''), severity: d.severity as string | undefined });
      } else if (e.type === 'alert:new' || e.type === 'threat:new') {
        fresh.push({
          id: (d.id as string) || `live-${e.ts}`,
          severity: coerceSeverity(d.severity),
          category: categoryFor((d.type as string) || e.type),
          title: (d.title as string) || (d.message as string) || 'Live alert',
          source: (d.source as string) || (d.host as string) || (d.url as string) || 'live stream',
          ts: e.ts,
          unread: true,
          status: (d.status as string) || 'detected',
          stored: false,
          description: d.description as string | undefined,
          indicators: Array.isArray(d.indicators)
            ? (d.indicators as Array<{ type: string; value: string }>).map((i) => [i.type, i.value] as [string, string])
            : [],
          recommendation: d.recommendation as string | undefined,
        });
      }
    }
    if (fresh.length) {
      setLive((prev) => {
        const seen = new Set(prev.map((a) => a.id));
        return [...fresh.filter((a) => !seen.has(a.id)), ...prev].slice(0, 50);
      });
    }
    if (updates.length) {
      const apply = (list: NormalizedAlert[]) =>
        list.map((a) => {
          const u = updates.find((x) => x.ids.includes(a.id));
          return u && u.status ? { ...a, status: u.status, unread: u.status === 'detected', severity: coerceSeverity(u.severity ?? a.severity) } : a;
        });
      setFetched(apply);
      setLive(apply);
    }
  }, [events]);

  const transition = useCallback(
    async (id: string, action: FindingAction, note?: string) => {
      const res = await endpoints.findingTransition(id, action, note);
      const status = res.data?.status;
      if (!status) return;
      const apply = (list: NormalizedAlert[]) => list.map((a) => (a.id === id ? { ...a, status, unread: status === 'detected' } : a));
      setFetched((list) => {
        const next = apply(list);
        void writeJson(userId, CACHE, { at: Date.now(), data: next } satisfies Cached<NormalizedAlert[]>);
        return next;
      });
      setLive(apply);
    },
    [userId],
  );

  const alerts = useMemo(() => {
    const merged = new Map<string, NormalizedAlert>();
    // stored findings first: they carry the workflow state
    [...fetched, ...live].forEach((a) => {
      if (!merged.has(a.id)) merged.set(a.id, a);
    });
    return Array.from(merged.values()).sort((a, b) => b.ts - a.ts);
  }, [live, fetched]);

  const getById = useCallback((id: string) => alerts.find((a) => a.id === id), [alerts]);

  return (
    <AlertsContext.Provider value={{ alerts, loading, error, rateLimited, stale, loadedAt, refresh, getById, transition }}>
      {children}
    </AlertsContext.Provider>
  );
}

export function useAlerts(): AlertsValue {
  const ctx = useContext(AlertsContext);
  if (!ctx) throw new Error('useAlerts must be used within AlertsProvider');
  return ctx;
}
