/**
 * The catalogue of the app's sub-screens: what the Explore tab lists and what
 * the screen router (app/screen/[key].tsx) titles each one. Labels only; every
 * screen fetches its own data.
 *
 * This file was missing from the repository: the root .gitignore's `data/`
 * rule also matched this folder, so it was never committed and a clean
 * checkout could not build. The root .gitignore now re-includes it.
 */
import { colors } from '../theme';
import type { IconName } from '../components/Icon';
import { isSupported as captureAvailable } from '../native/vpn';

export interface SectionMeta {
  title: string;
  sub: string;
  icon: IconName;
  color: string;
  /** Shows the live indicator in the screen header. Only for screens fed by the live stream. */
  live?: boolean;
}

export const SECTIONS: Record<string, SectionMeta> = {
  assistant: { title: 'AI Assistant', sub: 'ask about threats and your findings', icon: 'spark', color: colors.amber2 },
  sandbox: { title: 'Sandbox', sub: 'static URL and file analysis', icon: 'flask', color: colors.cyan },
  devices: { title: 'Devices', sub: 'enrolled devices and approvals', icon: 'desktop', color: colors.green },
  agents: { title: 'Agents', sub: 'proposals to approve, pause', icon: 'bot', color: colors.amber2 },
  vpn: { title: 'Network Capture', sub: captureAvailable ? 'on-device capture' : 'not available in this build', icon: 'radar', color: colors.blue },
  intel: { title: 'Threat Intel', sub: 'OTX pulses and indicators', icon: 'globe', color: colors.amber2 },
  browser: { title: 'Browser Intelligence', sub: 'what the desktop app reported', icon: 'eye', color: colors.cyan },
  orchestrator: { title: 'Orchestrator', sub: 'analysis agents and reports', icon: 'nodes', color: colors.blue },
  pipeline: { title: 'Signal Pipeline', sub: 'ingest, analyse, reason', icon: 'activity', color: colors.sage },
  models: { title: 'Models', sub: 'the ML service and its models', icon: 'brain', color: colors.blue },
  tasks: { title: 'Tasks', sub: 'agent tasks', icon: 'list', color: colors.sage },
  memory: { title: 'Memory', sub: 'what the agent remembers', icon: 'box', color: colors.sage },
  settings: { title: 'Settings', sub: 'account and app', icon: 'gear', color: colors.dim },
};

/** Shown as tiles at the top of Explore. */
// Capture is featured only in a build that can capture (see src/native/vpn.ts).
export const FEATURED: string[] = ['assistant', 'agents', 'devices', ...(captureAvailable ? ['vpn'] : [])];

/** Every other screen, listed below. */
export const REST: string[] = Object.keys(SECTIONS).filter((key) => !FEATURED.includes(key));
