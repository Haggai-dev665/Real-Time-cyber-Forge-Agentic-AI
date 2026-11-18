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
  DeviceRecord,
  DeviceEnrollmentCode,
  DeviceCommand,
  AgentSummary,
  AgentAction,
  AccountDataScope,
  AccountDataDeleteResult,
  AccountDeletionReceipt,
  Threat,
  FindingAction,
  ScanReport,
  SyncedMemory,
  DeviceHeartbeatResult,
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

  /** One finding with its timeline and guidance (why it matters, next step). */
  threat: (threatId: string) =>
    api.get<Envelope<{ threat: Threat }>>(`/api/threats/${encodeURIComponent(threatId)}`),

  /** Move a finding through its workflow (DET-02); every device of the account sees the change. */
  findingTransition: (threatId: string, action: FindingAction, note?: string) =>
    api.put<Envelope<{ threatId: string; status: string; severity: string }>>(
      `/api/threats/${encodeURIComponent(threatId)}/state`,
      { action, ...(note ? { note } : {}) }
    ),

  /* ---------------- orchestrator (Agent) ---------------- */
  /** Run the eight analysis agents on an address the user chose (sends that address). */
  orchestratorAnalyze: (url: string) =>
    api.post<{ success: boolean; report: ScanReport }>('/api/orchestrator/analyze', { url }),

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

  /* ---------------- synced memory (what the desktop copies to the account) ---------------- */
  memories: (limit = 60) =>
    api.get<Envelope<{ total: number; episodic: number; semantic: number; procedural: number; memories: SyncedMemory[]; retentionDays?: number }>>(
      `/api/memory?limit=${limit}`
    ),
  memorySearch: (query: string, topK = 12) =>
    api.post<Envelope<{ results: SyncedMemory[] }>>('/api/memory/search', { query, topK }),

  /* ---------------- ML inference ---------------- */
  mlHealth: () => api.get<Record<string, unknown>>('/api/cyberforge-ml/health'),
  mlModels: () =>
    api.get<Envelope<unknown[]> & { models?: unknown[] }>('/api/cyberforge-ml/models'),

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

  /* ---------------- devices (DEV-01/02): the phone as the approving companion ---------------- */
  devices: () => api.get<Envelope<{ devices: DeviceRecord[]; total: number }>>('/api/v1/devices?limit=200'),

  /** A one-time code: for another device to claim (`pair`), or for this phone (`this_device`). It expires in 10 minutes. */
  deviceEnrollmentCreate: (flow: 'pair' | 'this_device' = 'pair', platform?: string) =>
    api.post<Envelope<DeviceEnrollmentCode>>('/api/v1/device-enrollments', { flow, ...(platform ? { platform } : {}) }),

  /** This phone claims a code with its own key (src/device/protocol.ts signs the body). */
  deviceClaim: (body: Record<string, unknown>) =>
    api.post<Envelope<DeviceRecord>>('/api/v1/device-enrollments/claim', body),

  device: (deviceId: string) => api.get<Envelope<DeviceRecord>>(`/api/v1/devices/${encodeURIComponent(deviceId)}`),

  /** A heartbeat signed by this phone's key over the exact body text (see src/device/identity.ts). */
  deviceHeartbeat: (deviceId: string, rawBody: string, headers: Record<string, string>) =>
    api.post<Envelope<DeviceHeartbeatResult>>(`/api/v1/devices/${encodeURIComponent(deviceId)}/heartbeat`, undefined, { rawBody, headers }),

  /** Approve a device that claimed a code, naming the fingerprint compared on both screens. */
  deviceApprove: (deviceId: string, keyFingerprint: string) =>
    api.post<Envelope<DeviceRecord>>(`/api/v1/devices/${encodeURIComponent(deviceId)}/approve`, { keyFingerprint }),

  deviceRevoke: (deviceId: string) =>
    api.post<Envelope<DeviceRecord>>(`/api/v1/devices/${encodeURIComponent(deviceId)}/revoke`),

  /** Ask a device to block or unblock one domain; the idempotency key makes a retry safe. */
  deviceCommandSend: (deviceId: string, type: DeviceCommand['type'], domain: string, idempotencyKey: string) =>
    api.post<Envelope<DeviceCommand>>(`/api/v1/devices/${encodeURIComponent(deviceId)}/commands`, { type, domain, idempotencyKey }),

  /* ---------------- agents (AGT-05): proposals and the emergency pause ---------------- */
  agents: () => api.get<Envelope<{ agents: AgentSummary[] }>>('/api/v1/agents'),
  agentActions: () => api.get<Envelope<{ actions: AgentAction[] }>>('/api/v1/actions?limit=50'),
  agentActionApprove: (actionId: string) => api.post<Envelope<AgentAction>>(`/api/v1/actions/${encodeURIComponent(actionId)}/approve`),
  agentActionReject: (actionId: string) => api.post<Envelope<AgentAction>>(`/api/v1/actions/${encodeURIComponent(actionId)}/reject`),
  agentPause: (agentId: string) => api.post<Envelope<AgentSummary>>(`/api/v1/agents/${encodeURIComponent(agentId)}/pause`),
  agentResume: (agentId: string) => api.post<Envelope<AgentSummary>>(`/api/v1/agents/${encodeURIComponent(agentId)}/resume`),
  agentsPauseAll: () => api.post<Envelope<{ paused: number }>>('/api/v1/agents/pause-all'),

  deviceCommands: (deviceId: string) =>
    api.get<Envelope<{ commands: DeviceCommand[] }>>(`/api/v1/devices/${encodeURIComponent(deviceId)}/commands?limit=5`),

  /* ---------------- your data (SEC-07): export, deletion, account deletion ---------------- */
  accountExport: () => api.get<Envelope<Record<string, unknown>>>('/api/v1/me/export'),
  accountDataDelete: (scope: AccountDataScope) =>
    api.del<Envelope<AccountDataDeleteResult>>(`/api/v1/me/data?scope=${encodeURIComponent(scope)}`),
  accountDelete: (confirm: string) => api.post<Envelope<AccountDeletionReceipt>>('/api/v1/me/delete-account', { confirm }),
  accountDeletion: (deletionId: string) =>
    api.get<Envelope<AccountDeletionReceipt>>(`/api/v1/account-deletions/${encodeURIComponent(deletionId)}`),
};
