/** Backend response shapes (subset used by the mobile app). */

export interface AuthUser {
  id: string;
  email: string;
  firstName?: string;
  lastName?: string;
  role?: string;
  lastLoginAt?: string;
}

export interface LoginResponse {
  success: boolean;
  message?: string;
  data?: { user: AuthUser; token: string };
}

export interface ThreatStats {
  total_threats?: number;
  active_threats?: number;
  resolved_threats?: number;
  high_severity?: number;
  critical_threats?: number;
  last_scan?: string;
}

export interface Threat {
  _id?: string;
  id?: string;
  threatId?: string;
  timeline?: Array<{ timestamp?: string; event?: string; details?: string }>;
  guidance?: { whyItMatters?: string; nextStep?: string; occurrences?: number };
  occurrences?: number;
  type?: string;
  title?: string;
  severity?: 'low' | 'medium' | 'high' | 'critical';
  status?: string;
  source?: string;
  description?: string;
  detection?: { timestamp?: string; source?: string };
  indicators?: Array<{ type: string; value: string }>;
  recommendation?: string;
}

export interface ThreatsResponse {
  success: boolean;
  data?: {
    threats: Threat[];
    pagination?: {
      currentPage: number;
      totalPages: number;
      totalCount: number;
      hasNext: boolean;
      hasPrev: boolean;
    };
  };
}

export interface OrchestratorAgent {
  name: string;
  role: string;
}

export interface OrchestratorStats {
  totalReports: number;
  avgDurationMs: number;
  verdictBreakdown: Record<string, number>;
  agents: OrchestratorAgent[];
  memory: Record<string, unknown>;
}

export interface OrchestratorReport {
  id: string;
  url?: string;
  verdict?: string;
  riskScore?: number;
  summary?: string;
  durationMs?: number;
  timestamp?: number | string;
}

export interface OtxPulse {
  id?: string;
  name?: string;
  description?: string;
  adversary?: string;
  tags?: string[];
  created?: string;
  modified?: string;
  indicatorCount?: number;
}

export interface SandboxScan {
  id: string;
  url?: string;
  verdict?: string;
  riskScore?: number;
  createdAt?: string | number;
}

export interface AnswerEngine {
  id?: string;
  kind?: string;
  label?: string;
  model?: string | null;
}

export interface AnswerReference {
  id?: string;
  title?: string;
  url?: string;
}

export interface SecurityChatResponse {
  success?: boolean;
  response?: string;
  answer?: string;
  model?: string;
  fallback?: boolean;
  answered?: boolean;
  reason?: string;
  engine?: AnswerEngine;
  references?: AnswerReference[];
  thinking?: string | null;
  thinking_ms?: number | null;
}

/** The finding workflow's actions (backend findingService TRANSITIONS). */
export type FindingAction = 'acknowledge' | 'investigate' | 'resolve' | 'false_positive' | 'reopen';

/** One agent's part of a scan report (AgentBase.execute in the backend). */
export interface ScanAgentResult {
  agent: string;
  role?: string;
  status: 'ok' | 'failed';
  latencyMs?: number;
  result?: Record<string, unknown>;
  error?: string;
}

/** The orchestrator's full report for one address (ReportAgent). */
export interface ScanReport {
  id: string;
  url: string;
  verdict: 'malicious' | 'suspicious' | 'low-risk' | 'clean' | 'unknown' | string;
  riskScore: number;
  evidenceStatus?: string;
  coverage?: { rendered_page?: string; reason?: string | null; gaps?: string[]; agents_failed?: string[] };
  summary?: string;
  summaryEngine?: AnswerEngine | null;
  findings?: string[];
  agents?: Record<string, ScanAgentResult>;
  iocs?: Array<{ type: string; value: string; severity?: string; source?: string }>;
  mitre?: Array<{ id?: string; techniqueId?: string; name?: string; tactic?: string }>;
  createdAt?: string;
}

/** A memory the desktop synced to the account (backend models/SyncedMemory.js). */
export interface SyncedMemory {
  id: string;
  text: string;
  kind?: 'episodic' | 'semantic' | 'procedural' | string;
  url?: string | null;
  category?: string | null;
  risk?: number | null;
  ts?: number | string;
  score?: number;
}

export interface DeviceHeartbeatResult {
  accepted: boolean;
  serverTime: string;
  device?: DeviceRecord;
}

/* ---------------- network capture (mobile VPN) ---------------- */

/** A captured flow as stored/returned by the backend (snake_case envelope). */
export interface NetworkCaptureRecord {
  id?: string;
  host?: string;
  url?: string;
  method?: string;
  scheme?: string;
  ip?: string;
  port?: number;
  status?: number;
  mime?: string;
  app?: string;
  decrypted?: boolean;
  flags?: string[];
  req_bytes?: number;
  resp_bytes?: number;
  duration_ms?: number;
  device_id?: string;
  user_id?: string;
  created_at?: string | number;
}

export interface NetworkCaptureResponse {
  success: boolean;
  data?: {
    flows: NetworkCaptureRecord[];
    count?: number;
  };
}

/**
 * Everything the desktop app saved to the database that the mobile app mirrors
 * for the signed-in user. Each slice is optional so a partial backend response
 * still renders honestly.
 */
export interface DesktopSyncData {
  browserIntelligence?: {
    session_count?: number;
    total_domains?: number;
    total_alerts?: number;
    average_risk?: number;
    sessions_json?: string;
    device_id?: string;
    created_at?: string;
  } | null;
  alerts?: Threat[];
  threatStats?: ThreatStats | null;
}

/** A device of the workspace (backend/src/services/deviceService.js `present`). */
export interface DeviceRecord {
  deviceId: string;
  kind: 'endpoint' | 'backend_worker' | 'inventory_only';
  platform: string;
  displayName: string;
  state: 'pending_approval' | 'active' | 'revoked' | 'inventory';
  connection: 'online' | 'stale' | 'offline' | 'never_connected' | 'awaiting_approval' | 'revoked' | 'not_applicable';
  /** Apart from connection: whether the device's own checks confirm every capability it advertised. */
  coverage: 'full' | 'degraded' | 'unknown' | 'not_applicable';
  degradedBy: string[];
  lastSeenAt: string | null;
  keyFingerprint: string | null;
  keyVersion: number;
  clientVersion: string | null;
  capabilities: { advertised: string[]; enabled: string[]; confirmed: Record<string, 'ok' | 'denied' | 'unavailable'> };
  createdAt: string;
  approvedAt: string | null;
  revokedAt: string | null;
}

/** An agent definition, as the list returns it (AGT-01). */
export interface AgentSummary {
  agentId: string;
  templateId: string;
  templateName: string;
  name: string;
  state: 'draft' | 'ready' | 'active' | 'paused' | 'archived';
  version: number;
  config: { mode: 'observe' | 'assist'; tools: string[]; proposals: string[]; deviceIds: string[]; targets: string[] };
  validation: { ok: boolean; errors: string[] };
}

/** Something an agent proposes; done only once approved and the device reports it (AGT-05). */
export interface AgentAction {
  actionId: string;
  agentId: string;
  type: 'block_domain';
  deviceId: string;
  domain: string;
  reason: string;
  state: 'proposed' | 'approved' | 'rejected' | 'expired';
  expiresAt: string;
  outcome: { commandId: string; state: string; receipt: { status: string; detail: string | null } | null } | null;
}

/** One exact action sent to a device; done only on that device's receipt. */
export interface DeviceCommand {
  commandId: string;
  deviceId: string;
  type: 'block_domain' | 'unblock_domain';
  domain: string;
  state: 'queued' | 'delivered' | 'applied' | 'failed' | 'expired' | 'cancelled';
  createdAt: string;
  expiresAt: string;
  receipt: { status: 'applied' | 'failed'; executor: string | null; detail: string | null; at: string } | null;
}

/** A one-time code for adding a device; shown once. */
export interface DeviceEnrollmentCode {
  enrollmentId: string;
  code: string;
  link: string;
  flow: 'this_device' | 'pair';
  expiresAt: string;
}

/* ---------------- your data (SEC-07) ---------------- */
export type AccountDataScope = 'memory' | 'scans' | 'agents' | 'devices' | 'all';

export interface StoreResult {
  removed: number;
  error?: string;
}

export interface AccountDataDeleteResult {
  scope: AccountDataScope;
  results: Record<string, StoreResult>;
  complete: boolean;
  failed: string[];
}

export interface AccountDeletionReceipt {
  deletionId: string;
  state: 'running' | 'completed' | 'partial';
  requestedAt: string;
  completedAt: string | null;
  results: Record<string, StoreResult>;
  kept: string[];
  failed: string[];
}
