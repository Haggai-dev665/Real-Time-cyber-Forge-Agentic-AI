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

export interface SecurityChatResponse {
  success?: boolean;
  response?: string;
  answer?: string;
  model?: string;
  fallback?: boolean;
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
