/**
 * Memory Service — multi-tier context layer for the orchestrator.
 *
 * Tiers:
 *   1. process — fast in-memory Map, lives only as long as the dyno
 *   2. redis   — cross-request cache (TTL'd), shared across nodes
 *   3. vector  — Pinecone/Chroma for semantic retrieval (similar past threats)
 *
 * Memory shapes:
 *   - domainMemory(host)   → { firstSeen, visitCount, verdicts[], iocsSeen[], lastVerdict, lastVisit }
 *   - sessionMemory(sid)   → { sessionId, urls[], started, lastActivity }
 *   - llmContext(key)      → { messages[], lastUsed }    // for fallback LLM continuity
 *
 * Persistence:
 *   - In-process Map writes are sync.
 *   - Redis writes are async, fire-and-forget (no blocking).
 *   - Vector embeddings are best-effort (skipped if Pinecone offline).
 */

const redisService = require('./redis');
// Lazy-load vector DB — it pulls in chromadb which may not be installed
let _vectorDatabase = null;
function _getVectorDB() {
    if (_vectorDatabase !== null) return _vectorDatabase;
    try { _vectorDatabase = require('./vectorDatabase'); }
    catch (_) { _vectorDatabase = false; /* don't try again */ }
    return _vectorDatabase;
}

class MemoryService {
    constructor() {
        // Tier 1: fast in-process. Capped to prevent memory blowup.
        this.domainCache  = new Map();   // host → record
        this.sessionCache = new Map();   // sid  → record
        this.llmCache     = new Map();   // key  → { messages, lastUsed }
        this.MAX_DOMAINS  = 5000;
        this.MAX_SESSIONS = 1000;
        this.MAX_LLM_CTX  = 500;
        this.LLM_CTX_TTL  = 60 * 30;     // 30 min
    }

    // ────────────────────────────────────────────────────────────
    // DOMAIN MEMORY — tracks what we've learned about a host across visits
    // ────────────────────────────────────────────────────────────

    async getDomainMemory(host) {
        if (!host) return null;
        if (this.domainCache.has(host)) return this.domainCache.get(host);
        // Try Redis
        try {
            const raw = await redisService.get(`mem:domain:${host}`);
            if (raw) {
                const parsed = JSON.parse(raw);
                this._setDomainCache(host, parsed);
                return parsed;
            }
        } catch (_) { /* redis offline, fall through */ }
        return null;
    }

    async recordDomainVisit(host, { verdict, riskScore, iocs = [], summary = '' } = {}) {
        if (!host) return null;
        const now = new Date().toISOString();
        const existing = (await this.getDomainMemory(host)) || {
            host, firstSeen: now, visitCount: 0, verdicts: [], iocsSeen: [],
        };
        existing.visitCount += 1;
        existing.lastVisit = now;
        existing.lastVerdict = verdict;
        existing.lastRiskScore = riskScore;
        existing.lastSummary = summary;
        // Keep last 20 verdicts only
        existing.verdicts = [{ verdict, riskScore, at: now }, ...existing.verdicts].slice(0, 20);
        // Track unique IOCs across visits (cap at 100)
        const existingIocSet = new Set(existing.iocsSeen.map(i => `${i.type}:${i.value}`));
        for (const ioc of iocs) {
            const k = `${ioc.type}:${ioc.value}`;
            if (!existingIocSet.has(k) && existing.iocsSeen.length < 100) {
                existingIocSet.add(k);
                existing.iocsSeen.push({ type: ioc.type, value: ioc.value, severity: ioc.severity, firstSeen: now });
            }
        }
        this._setDomainCache(host, existing);
        // Mirror to Redis (fire-and-forget, 7-day TTL)
        redisService.set(`mem:domain:${host}`, JSON.stringify(existing), 7 * 24 * 60 * 60).catch(() => {});
        return existing;
    }

    /** A simple risk multiplier from prior history — used to escalate verdicts */
    domainHistoryMultiplier(memory) {
        if (!memory || memory.visitCount <= 1) return 1.0;
        // If past visits flagged this domain, future ones get a bump
        const recentBad = memory.verdicts.slice(0, 5).filter(v => v.verdict === 'malicious' || v.verdict === 'suspicious').length;
        return 1.0 + (recentBad * 0.1); // up to +50%
    }

    // ────────────────────────────────────────────────────────────
    // SESSION MEMORY — current browsing session (URLs, dwell, journey)
    // ────────────────────────────────────────────────────────────

    getSession(sid) {
        if (!sid) return null;
        return this.sessionCache.get(sid) || null;
    }

    recordUrlInSession(sid, { url, verdict, host }) {
        if (!sid) return null;
        const now = new Date().toISOString();
        let s = this.sessionCache.get(sid);
        if (!s) {
            s = { sessionId: sid, started: now, urls: [], hosts: new Set() };
            this.sessionCache.set(sid, s);
        }
        s.lastActivity = now;
        s.urls.unshift({ url, host, verdict, at: now });
        if (s.urls.length > 200) s.urls.pop();
        if (host) s.hosts.add(host);
        // Cap session cache size
        if (this.sessionCache.size > this.MAX_SESSIONS) {
            const oldest = [...this.sessionCache.entries()].sort((a, b) => a[1].lastActivity?.localeCompare(b[1].lastActivity || ''))[0];
            if (oldest) this.sessionCache.delete(oldest[0]);
        }
        return s;
    }

    sessionStats(sid) {
        const s = this.getSession(sid);
        if (!s) return { urls: 0, hosts: 0, threats: 0 };
        return {
            urls: s.urls.length,
            hosts: s.hosts.size,
            threats: s.urls.filter(u => u.verdict === 'malicious' || u.verdict === 'suspicious').length,
        };
    }

    // ────────────────────────────────────────────────────────────
    // LLM CONTEXT — short conversation buffer for fallback continuity
    // ────────────────────────────────────────────────────────────

    pushLlmTurn(key, role, content) {
        if (!key) return;
        const now = Date.now();
        let ctx = this.llmCache.get(key);
        if (!ctx) {
            ctx = { messages: [], lastUsed: now };
            this.llmCache.set(key, ctx);
        }
        ctx.messages.push({ role, content: String(content).slice(0, 4000), at: now });
        if (ctx.messages.length > 12) ctx.messages = ctx.messages.slice(-12);
        ctx.lastUsed = now;
        // Evict oldest when over capacity
        if (this.llmCache.size > this.MAX_LLM_CTX) {
            const oldest = [...this.llmCache.entries()].sort((a, b) => a[1].lastUsed - b[1].lastUsed)[0];
            if (oldest) this.llmCache.delete(oldest[0]);
        }
    }

    getLlmContext(key, limit = 8) {
        const ctx = this.llmCache.get(key);
        if (!ctx) return [];
        // Drop expired entries
        const cutoff = Date.now() - (this.LLM_CTX_TTL * 1000);
        ctx.messages = ctx.messages.filter(m => m.at > cutoff);
        return ctx.messages.slice(-limit).map(m => ({ role: m.role, content: m.content }));
    }

    // ────────────────────────────────────────────────────────────
    // VECTOR — semantic similarity (best-effort)
    // ────────────────────────────────────────────────────────────

    async storeVisitVector(scanRecord) {
        try {
            const vdb = _getVectorDB();
            if (!vdb || typeof vdb.storeAnalysisVector !== 'function') return null;
            return await vdb.storeAnalysisVector({
                id: scanRecord.id,
                summary: scanRecord.summary || scanRecord.target,
                metadata: {
                    target: scanRecord.target,
                    verdict: scanRecord.verdict,
                    riskScore: scanRecord.riskScore,
                    createdAt: scanRecord.createdAt,
                },
            });
        } catch (_) { return null; /* vector DB optional */ }
    }

    async findSimilarVisits(queryText, k = 5) {
        try {
            const vdb = _getVectorDB();
            if (!vdb || typeof vdb.searchSimilarAnalyses !== 'function') return [];
            return await vdb.searchSimilarAnalyses(queryText, k);
        } catch (_) { return []; }
    }

    // ────────────────────────────────────────────────────────────
    // STATS / OBSERVABILITY
    // ────────────────────────────────────────────────────────────

    stats() {
        return {
            domains: this.domainCache.size,
            sessions: this.sessionCache.size,
            llmContexts: this.llmCache.size,
            redisReady: typeof redisService.isReady === 'function' ? redisService.isReady() : false,
        };
    }

    // ────────────────────────────────────────────────────────────
    // INTERNAL
    // ────────────────────────────────────────────────────────────

    _setDomainCache(host, rec) {
        this.domainCache.set(host, rec);
        if (this.domainCache.size > this.MAX_DOMAINS) {
            // Drop a random old entry — good enough for cap enforcement
            const firstKey = this.domainCache.keys().next().value;
            this.domainCache.delete(firstKey);
        }
    }
}

const memoryService = new MemoryService();
module.exports = { MemoryService, memoryService };
