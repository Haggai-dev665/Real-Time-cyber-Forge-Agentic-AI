/**
 * The agent template catalogue (AGT-03) and the tools agents may use (AGT-01).
 *
 * A template says what an agent of that kind does, which tools it may use,
 * which modes it may run in, what it may propose, and what it needs from a
 * device. An agent definition can only narrow these: a tool, mode or action not
 * in its template is refused when the definition is saved or validated,
 * whatever the request asks for.
 *
 * Only templates whose tools exist are available. The others are listed with
 * the reason, so the catalogue does not offer work nothing can do.
 *
 * Modes (AGT-05): observe (findings only), assist (observe, plus proposals a
 * member approves one by one). Guarded automatic mode is not offered: it needs
 * rollback, which no executor supports yet.
 */

const TOOLS = {
  url_classify: { name: 'URL classification', description: 'Scores an address with the ML service\'s URL models.', where: 'backend' },
  ioc_extract: { name: 'Indicator extraction', description: 'Finds domains, IP addresses and hashes in an address.', where: 'backend' },
  device_status: { name: 'Device status', description: 'Reads enrolled devices\' heartbeats, connection and coverage.', where: 'backend' }
};

const TEMPLATES = [
  {
    id: 'url_analyst',
    name: 'URL and Phishing Analyst',
    description: 'Checks the addresses you give it with the URL models and indicator extraction, and reports a verdict with its evidence. In Assist mode it can propose blocking a domain on one of your devices; you approve each proposal.',
    available: true,
    tools: ['url_classify', 'ioc_extract'],
    modes: ['observe', 'assist'],
    proposals: ['block_domain'],
    needsTargets: true,
    deviceCapability: 'hosts_blocking', // only for the devices a proposal may target
    limits: 'No page is fetched and no credential is entered. A block is only ever a proposal.'
  },
  {
    id: 'device_health',
    name: 'Device Health Monitor',
    description: 'Reports devices that are stale, offline, degraded (a capability their own checks did not confirm) or awaiting approval.',
    available: true,
    tools: ['device_status'],
    modes: ['observe'],
    proposals: [],
    needsTargets: false,
    deviceCapability: null,
    limits: 'Reads device records only; changes nothing.'
  },
  { id: 'browser_guardian', name: 'Browser Guardian', available: false, reason: 'Needs visited addresses from enrolled devices, which devices do not send (their telemetry carries enforcement receipts and capability changes only).' },
  { id: 'intel_watcher', name: 'Threat Intelligence Watcher', available: false, reason: 'Needs device observations to match against threat intelligence, which devices do not send yet.' },
  { id: 'incident_investigator', name: 'Incident Investigator', available: false, reason: 'Needs findings linked to evidence across runs; run history is not built yet.' },
  { id: 'report_assistant', name: 'Report Assistant', available: false, reason: 'Needs run history and evidence links; not built yet.' },
  { id: 'policy_response', name: 'Policy Response Agent', available: false, reason: 'Guarded automatic mode needs rollback, which no executor supports yet.' }
];

const byId = Object.fromEntries(TEMPLATES.map(t => [t.id, t]));

const LIMITS = {
  maxTargets: 50,
  maxDevices: 50,
  maxSteps: { min: 1, max: 200, default: 50 },
  timeoutSeconds: { min: 10, max: 600, default: 120 },
  everyMinutes: { min: 15, max: 7 * 24 * 60 }
};

/** What clients are shown: each template, and for the available ones their tools in full. */
function listTemplates() {
  return TEMPLATES.map(t => (t.available
    ? { ...t, tools: t.tools.map(id => ({ id, ...TOOLS[id] })) }
    : { id: t.id, name: t.name, available: false, reason: t.reason }));
}

module.exports = { TOOLS, TEMPLATES, LIMITS, template: id => byId[id] || null, listTemplates };
