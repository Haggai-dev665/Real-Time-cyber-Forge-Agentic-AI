/** Typed endpoint helpers grouped by feature. */
import { api } from './client';
import type {
  LoginResponse,
  ThreatStats,
  ThreatsResponse,
  OrchestratorStats,
  OrchestratorAgent,
  OrchestratorReport,
  OtxPulse,
  SandboxScan,
  SecurityChatResponse,
  NetworkCaptureRecord,
  NetworkCaptureResponse,
} from './types';

interface Envelope<T> {
  success?: boolean;
  data?: T;
  [key: string]: unknown;
}

export const endpoints = {
  /* ---------------- auth ---------------- */
  login: (email: string, password: string) =>
    api.post<LoginResponse>('/api/auth/login', { email, password }, { anonymous: true }),

  register: (payload: {
    email: string;
    password: string;
    firstName: string;
    lastName: string;
  }) => api.post<LoginResponse>('/api/auth/register', payload, { anonymous: true }),

  health: () => api.get<{ status: string }>('/health', { anonymous: true }),

  /* ---------------- threats (Home + Alerts) ---------------- */
  threatStats: () => api.get<Envelope<ThreatStats>>('/api/threats/stats'),

  threats: (params?: { status?: string; severity?: string; limit?: number }) => {
    const q = new URLSearchParams();
    if (params?.status) q.set('status', params.status);
    if (params?.severity) q.set('severity', params.severity);
    if (params?.limit) q.set('limit', String(params.limit));
    const qs = q.toString();
    return api.get<ThreatsResponse>(`/api/threats${qs ? `?${qs}` : ''}`);
  },

  /* ---------------- orchestrator (Agent) ---------------- */
  orchestratorStats: () =>
    api.get<{ success: boolean; stats: OrchestratorStats }>('/api/orchestrator/stats'),
  orchestratorAgents: () =>
    api.get<{ success: boolean; agents: OrchestratorAgent[] }>('/api/orchestrator/agents'),
  orchestratorRecent: (limit = 20) =>
    api.get<{ success: boolean; reports: OrchestratorReport[] }>(
      `/api/orchestrator/recent?limit=${limit}`
    ),

  /* ---------------- threat intelligence (OTX) ---------------- */
  otxPulses: () => api.get<Envelope<OtxPulse[]> & { pulses?: OtxPulse[] }>('/api/otx/pulses'),
  otxStats: () => api.get<Envelope<Record<string, number>>>('/api/otx/stats'),
  otxRecent: () =>
    api.get<Envelope<unknown[]> & { threats?: unknown[] }>('/api/otx/threats/recent'),

  /* ---------------- sandbox ---------------- */
  sandboxHistory: () =>
    api.get<Envelope<SandboxScan[]> & { history?: SandboxScan[]; scans?: SandboxScan[] }>(
      '/api/sandbox/history'
    ),
  sandboxIocs: () =>
    api.get<Envelope<unknown[]> & { iocs?: unknown[] }>('/api/sandbox/iocs'),

  /* ---------------- browser intelligence ---------------- */
  browserSnapshot: () =>
    api.get<Envelope<Record<string, unknown>>>('/api/browser-intelligence/snapshot'),

  /* ---------------- ML inference ---------------- */
  mlHealth: () =>
    api.get<Record<string, unknown>>('/api/cyberforge-ml/health', { anonymous: true }),
  mlModels: () =>
    api.get<Envelope<unknown[]> & { models?: unknown[] }>('/api/cyberforge-ml/models', {
      anonymous: true,
    }),

  /* ---------------- AI assistant ---------------- */
  securityChat: (query: string) =>
    api.post<SecurityChatResponse>('/api/cyberforge-ml/v2/security-chat', { query }),

  /* ---------------- network capture (mobile VPN) ----------------
   * The mobile VPN engine streams captures here for the signed-in user; the
   * same records are then readable from any of the user's devices. */
  pushNetworkCapture: (flows: NetworkCaptureRecord[], deviceId = 'mobile') =>
    api.post<{ success: boolean; data?: { stored: number } }>('/api/network-capture/ingest', {
      deviceId,
      flows,
    }),

  networkCapture: (params?: { limit?: number; host?: string }) => {
    const q = new URLSearchParams();
    if (params?.limit) q.set('limit', String(params.limit));
    if (params?.host) q.set('host', params.host);
    const qs = q.toString();
    return api.get<NetworkCaptureResponse>(`/api/network-capture${qs ? `?${qs}` : ''}`);
  },
};
