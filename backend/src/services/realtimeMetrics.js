/**
 * Realtime metrics pulse.
 *
 * Emits a `metrics:update` event on a fixed interval so the live dashboards
 * always have a heartbeat of fresh data (latency, uptime, memory, connection
 * health) even during quiet periods with no threats/scans. Cheap, dependency-
 * free process metrics only — no DB load.
 */

const os = require('os');
const realtimeBus = require('./realtimeBus');

let timer = null;

function snapshot() {
  const mem = process.memoryUsage();
  const load = os.loadavg ? os.loadavg()[0] : 0;
  const cpuCount = os.cpus ? os.cpus().length : 1;
  return {
    uptime: Math.round(process.uptime()),
    rssMb: Math.round((mem.rss / 1024 / 1024) * 10) / 10,
    heapMb: Math.round((mem.heapUsed / 1024 / 1024) * 10) / 10,
    load1: Math.round(load * 100) / 100,
    cpuLoadPct: cpuCount ? Math.min(100, Math.round((load / cpuCount) * 100)) : 0,
    ts: Date.now(),
  };
}

/** Start the metrics pulse. Safe to call once at server startup. */
function start(intervalMs = 5000) {
  if (timer) return timer;
  timer = setInterval(() => {
    realtimeBus.emit('metrics:update', snapshot());
  }, intervalMs);
  // don't keep the event loop alive just for metrics
  if (timer.unref) timer.unref();
  return timer;
}

function stop() {
  if (timer) {
    clearInterval(timer);
    timer = null;
  }
}

module.exports = { start, stop, snapshot };
