#!/usr/bin/env node
// Reproducible evaluation of the live CyberForge assistant (the chat model in the
// Hugging Face Space). Each question in assistant_cases.json is sent the way the
// desktop assistant sends it: POST /api/v2/security-chat, streamed, think=auto,
// priority=interactive, earlier turns as history. Nothing runs locally but this client.
//
//   ML_SERVICE_KEY=... node ml-services/eval/assistant_eval.mjs [--runs 2] [--space URL] [--out DIR]
//
// Saves results/assistant-<timestamp>.json (every answer, its timing and scores)
// and a .md summary next to it. The key is read from the environment and never
// written anywhere. Exit code 0 even when cases fail: this measures, it does not gate.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const args = process.argv.slice(2);
const opt = (name, fallback) => { const i = args.indexOf(name); return i >= 0 ? args[i + 1] : fallback; };
const SPACE = (opt('--space', process.env.SPACE_URL || 'https://che237-cyberforge.hf.space')).replace(/\/$/, '');
const RUNS = Number(opt('--runs', '2'));
const OUT = opt('--out', path.join(HERE, 'results'));
const KEY = process.env.ML_SERVICE_KEY;
if (!KEY) { console.error('ML_SERVICE_KEY must be in the environment'); process.exit(2); }

// Request settings: the same values the backend's securityChatStream sends.
const REQUEST = { max_tokens: 700, time_budget_s: 45, priority: 'interactive', think: 'auto', stream: true };
const SUPPLEMENT = '**From the reviewed sources:**';

const suite = JSON.parse(fs.readFileSync(path.join(HERE, 'assistant_cases.json'), 'utf8'));
const headers = { 'Content-Type': 'application/json', 'X-CyberForge-Service-Key': KEY };

async function getJson(route) {
  const r = await fetch(SPACE + route, { headers, signal: AbortSignal.timeout(20000) });
  return r.ok ? r.json() : { http_status: r.status };
}

async function ask(c) {
  const started = performance.now();
  let firstAnswerMs = null;
  const r = await fetch(SPACE + '/api/v2/security-chat', {
    method: 'POST', headers: { ...headers, Accept: 'text/event-stream' },
    body: JSON.stringify({ query: c.q, history: c.history || [], ...REQUEST }),
    signal: AbortSignal.timeout(120000),
  });
  if (!r.ok) return { error: `HTTP ${r.status}`, wall_ms: Math.round(performance.now() - started) };
  let buffer = '', final = null;
  const decoder = new TextDecoder();
  for await (const chunk of r.body) {
    buffer += decoder.decode(chunk, { stream: true });
    let at;
    while ((at = buffer.indexOf('\n\n')) >= 0) {
      const line = buffer.slice(0, at).split('\n').find(l => l.startsWith('data: '));
      buffer = buffer.slice(at + 2);
      if (!line) continue;
      const event = JSON.parse(line.slice(6));
      if (event.type === 'answer' && firstAnswerMs === null) firstAnswerMs = Math.round(performance.now() - started);
      if (event.type === 'final') final = event.result;
    }
  }
  const wall = Math.round(performance.now() - started);
  if (!final) return { error: 'no final event', wall_ms: wall };
  return { result: final, wall_ms: wall, first_answer_ms: firstAnswerMs };
}

const matches = (text, pattern) => new RegExp(pattern, 'i').test(text);
function score(c, text) {
  if (!text) return { pass: false, missing: c.must, forbidden: [] };
  const missing = c.must.filter(p => !matches(text, p));
  const forbidden = (c.must_not || []).filter(p => matches(text, p));
  return { pass: !missing.length && !forbidden.length, missing, forbidden };
}

const median = xs => { const s = xs.filter(x => typeof x === 'number').sort((a, b) => a - b); if (!s.length) return null; const m = s.length >> 1; return s.length % 2 ? s[m] : Math.round((s[m - 1] + s[m]) / 2); };
const p90 = xs => { const s = xs.filter(x => typeof x === 'number').sort((a, b) => a - b); return s.length ? s[Math.min(s.length - 1, Math.ceil(s.length * 0.9) - 1)] : null; };
const words = t => (t || '').split(/\s+/).filter(Boolean).length;

async function main() {
  const status = await getJson('/api/v2/status');
  const llm = status?.reasoning_llm?.local || {};
  if (!llm.loaded) { console.error('chat model not loaded on the Space (asleep or still starting?)', JSON.stringify(llm).slice(0, 300)); process.exit(3); }
  const meta = {
    suite: suite.version, started_at: new Date().toISOString(), space: SPACE, runs: RUNS, request: REQUEST,
    model: { repo: llm.repo, file: llm.file, revision: llm.revision, accelerator: llm.accelerator },
  };
  console.log(`model ${llm.repo} @ ${llm.revision || '(unpinned)'} on ${llm.accelerator}; ${suite.cases.length} cases x ${RUNS} runs`);

  const rows = [];
  for (let run = 1; run <= RUNS; run++) {
    for (const c of suite.cases) {
      const a = await ask(c);
      const served = a.result?.response || null;
      const mode = a.result?.grounding?.mode || null;
      const own = !served || mode === 'verified_reference' ? null : served.split(SUPPLEMENT)[0].trim();
      const refs = (a.result?.references || []).map(r => r.id);
      const row = {
        run, id: c.id, kind: c.kind, expected_ref: c.ref, q: c.q,
        error: a.error || a.result?.error || null, grounding_mode: mode, references: refs,
        retrieval_ok: c.ref ? refs.includes(c.ref) : null,
        served: score(c, served), own: score(c, own),
        wall_ms: a.wall_ms, first_answer_ms: a.first_answer_ms ?? null,
        thinking_ms: a.result?.thinking_ms ?? null, service_elapsed_ms: a.result?.elapsed_ms ?? null,
        truncated: a.result?.truncated ?? null, words_served: words(served), words_own: words(own),
        answer: served, thinking: a.result?.thinking || null,
      };
      rows.push(row);
      console.log(`run ${run}  ${row.own.pass ? 'PASS' : 'FAIL'}  own  ${row.served.pass ? 'PASS' : 'FAIL'}  served  ${c.id.padEnd(18)} ${String(mode).padEnd(31)} ${String(row.wall_ms).padStart(6)} ms${row.error ? '  ERROR ' + row.error : ''}${row.own.missing.length ? '  missing: ' + row.own.missing.join(' / ').slice(0, 80) : ''}`);
    }
  }

  const summarize = sel => {
    const r = rows.filter(sel);
    const n = r.length;
    const covered = r.filter(x => x.kind === 'covered');
    const modes = {};
    for (const x of r) modes[x.grounding_mode] = (modes[x.grounding_mode] || 0) + 1;
    return {
      cases: n, answered: r.filter(x => x.answer && !x.error).length,
      served_pass: r.filter(x => x.served.pass).length, own_pass: r.filter(x => x.own.pass).length,
      covered: { cases: covered.length, own_pass: covered.filter(x => x.own.pass).length, served_pass: covered.filter(x => x.served.pass).length, retrieval_ok: covered.filter(x => x.retrieval_ok).length },
      uncovered: { cases: r.filter(x => x.kind === 'uncovered').length, own_pass: r.filter(x => x.kind === 'uncovered' && x.own.pass).length },
      followup: { cases: r.filter(x => x.kind === 'followup').length, own_pass: r.filter(x => x.kind === 'followup' && x.own.pass).length },
      grounding_modes: modes,
      forbidden_hits: r.filter(x => x.own.forbidden.length || x.served.forbidden.length).length,
      median_wall_ms: median(r.map(x => x.wall_ms)), p90_wall_ms: p90(r.map(x => x.wall_ms)),
      median_first_answer_ms: median(r.map(x => x.first_answer_ms)), median_thinking_ms: median(r.map(x => x.thinking_ms)),
      median_words_own: median(r.map(x => x.words_own)), truncated: r.filter(x => x.truncated).length,
    };
  };
  const summary = { all: summarize(() => true) };
  for (let run = 1; run <= RUNS; run++) summary[`run${run}`] = summarize(x => x.run === run);

  fs.mkdirSync(OUT, { recursive: true });
  const stamp = meta.started_at.replace(/[:.]/g, '-').slice(0, 19);
  const base = path.join(OUT, `assistant-${stamp}`);
  fs.writeFileSync(base + '.json', JSON.stringify({ meta, summary, rows }, null, 2));

  const pct = (a, b) => b ? `${a}/${b} (${(100 * a / b).toFixed(1)}%)` : '-';
  const md = [`# Assistant eval ${meta.started_at}`, '',
    `Model: \`${llm.repo}\` revision \`${llm.revision || 'unpinned'}\` on ${llm.accelerator}. Suite ${suite.version}: ${suite.cases.length} cases x ${RUNS} runs. Request: ${JSON.stringify(REQUEST)}.`, '',
    '| | ' + Array.from({ length: RUNS }, (_, i) => `Run ${i + 1}`).join(' | ') + ' | All |', '|---|' + '---:|'.repeat(RUNS + 1),
    ...[
      ['Answered', s => pct(s.answered, s.cases)],
      ['Required facts, model\'s own words', s => pct(s.own_pass, s.cases)],
      ['Required facts, served answer', s => pct(s.served_pass, s.cases)],
      ['Covered topics, own words', s => pct(s.covered.own_pass, s.covered.cases)],
      ['Covered topics, right reference retrieved', s => pct(s.covered.retrieval_ok, s.covered.cases)],
      ['Outside the library, own words', s => pct(s.uncovered.own_pass, s.uncovered.cases)],
      ['Follow-ups needing history', s => pct(s.followup.own_pass, s.followup.cases)],
      ['Forbidden statements', s => String(s.forbidden_hits)],
      ['Median time to full answer (ms)', s => String(s.median_wall_ms)],
      ['90th percentile (ms)', s => String(s.p90_wall_ms)],
      ['Median time to first answer text (ms)', s => String(s.median_first_answer_ms)],
      ['Median thinking (ms)', s => String(s.median_thinking_ms)],
      ['Median words (own)', s => String(s.median_words_own)],
    ].map(([label, f]) => `| ${label} | ${Array.from({ length: RUNS }, (_, i) => f(summary[`run${i + 1}`])).join(' | ')} | ${f(summary.all)} |`),
    '', `Grounding modes (all runs): ${JSON.stringify(summary.all.grounding_modes)}`, '',
    '## Automatic failures (model\'s own words)', '',
    ...rows.filter(x => !x.own.pass).map(x => `- run ${x.run} \`${x.id}\` (${x.grounding_mode}): missing ${x.own.missing.map(m => '`' + m + '`').join(', ') || '-'}${x.own.forbidden.length ? '; forbidden ' + x.own.forbidden.join(', ') : ''}${x.error ? '; error ' + x.error : ''}`),
  ].join('\n');
  fs.writeFileSync(base + '.md', md + '\n');
  console.log('\n' + md);
  console.log(`\nsaved ${base}.json and .md`);
}

main().catch(e => { console.error(e); process.exit(1); });
