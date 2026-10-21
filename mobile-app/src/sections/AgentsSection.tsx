/**
 * Agents — the phone as the approving companion (AGT-05, AGT-07): proposals
 * waiting for a decision, what each agent is and did last, and the emergency
 * pause. Creating and editing agents is on the desktop. Everything shown is
 * what /api/v1 returns; an approval becomes a device command whose outcome is
 * the device's own receipt.
 */
import React, { useState } from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';

import { colors, fonts, tint } from '../theme';
import { Card, SecLabel, Pill, Loading } from '../components/ui';
import { endpoints } from '../api/endpoints';
import { useApi } from '../hooks/useApi';
import type { AgentAction, AgentSummary } from '../api/types';

const STATE_COLOR: Record<string, string> = {
  active: colors.green, ready: colors.amber2, paused: colors.amber2, draft: colors.faint, archived: colors.faint,
  proposed: colors.amber2, approved: colors.green, rejected: colors.faint, expired: colors.faint,
  applied: colors.green, failed: colors.red, queued: colors.amber2, delivered: colors.amber2, cancelled: colors.faint,
};

export function AgentsSection() {
  const agents = useApi(() => endpoints.agents(), []);
  const actions = useApi(() => endpoints.agentActions(), []);
  const [problem, setProblem] = useState<string | null>(null);
  const [armed, setArmed] = useState(false);

  const act = async (work: () => Promise<unknown>) => {
    setProblem(null);
    try {
      await work();
      await Promise.all([agents.refresh(), actions.refresh()]);
    } catch (e) {
      setProblem(e instanceof Error ? e.message : 'The request failed');
    }
  };

  const list: AgentSummary[] = agents.data?.data?.agents ?? [];
  const proposals: AgentAction[] = actions.data?.data?.actions ?? [];
  const waiting = proposals.filter((a) => a.state === 'proposed');

  return (
    <>
      <SecLabel>Proposals to decide</SecLabel>
      <Card style={{ padding: 13 }}>
        {actions.loading && !actions.data ? <Loading label="Loading proposals…" /> : null}
        {!actions.loading && waiting.length === 0 ? (
          <Text style={styles.note}>Nothing waiting. Agents in assist mode propose actions here; nothing is done until you approve.</Text>
        ) : null}
        {waiting.map((a) => (
          <View key={a.actionId} style={styles.item}>
            <Text style={styles.title}>Block {a.domain}</Text>
            <Text style={styles.sub}>{a.reason}</Text>
            <Text style={styles.sub}>device {a.deviceId} · expires {new Date(a.expiresAt).toLocaleString()}</Text>
            <View style={styles.buttons}>
              <Button label="Approve" tone="go" onPress={() => act(() => endpoints.agentActionApprove(a.actionId))} />
              <Button label="Reject" onPress={() => act(() => endpoints.agentActionReject(a.actionId))} />
            </View>
          </View>
        ))}
        {proposals.filter((a) => a.state !== 'proposed').slice(0, 6).map((a) => (
          <Text key={a.actionId} style={styles.sub}>
            {a.domain} · {a.state}
            {a.outcome ? ` · device: ${a.outcome.state}${a.outcome.receipt?.detail ? ` — ${a.outcome.receipt.detail}` : ''}` : ''}
          </Text>
        ))}
        {problem ? <Text style={styles.error}>{problem}</Text> : null}
      </Card>

      <SecLabel>Agents</SecLabel>
      <Card style={{ overflow: 'hidden' }}>
        {agents.loading && !agents.data ? <Loading label="Loading agents…" /> : null}
        {agents.error ? <Text style={[styles.error, { padding: 13 }]}>{agents.error}</Text> : null}
        {!agents.loading && list.length === 0 ? <Text style={[styles.note, { padding: 13 }]}>No agents yet. Create one on the desktop's Agents page.</Text> : null}
        {list.map((agent, i) => (
          <View key={agent.agentId} style={[styles.row, i > 0 && styles.rowBorder]}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <Text style={[styles.title, { flex: 1 }]} numberOfLines={1}>{agent.name}</Text>
              <Pill label={agent.state} color={STATE_COLOR[agent.state] ?? colors.faint} />
            </View>
            <Text style={styles.sub}>
              {agent.templateName} · v{agent.version} · {agent.config.mode === 'assist' ? 'proposes, you approve' : 'findings only'}
            </Text>
            <View style={styles.buttons}>
              {agent.state === 'active' ? <Button label="Pause" onPress={() => act(() => endpoints.agentPause(agent.agentId))} /> : null}
              {agent.state === 'paused' ? <Button label="Resume" tone="go" onPress={() => act(() => endpoints.agentResume(agent.agentId))} /> : null}
            </View>
          </View>
        ))}
      </Card>

      <View style={[styles.buttons, { marginTop: 12 }]}>
        {armed ? (
          <>
            <Button label="Confirm: pause every agent" tone="warn" onPress={() => { setArmed(false); act(() => endpoints.agentsPauseAll()); }} />
            <Button label="Cancel" onPress={() => setArmed(false)} />
          </>
        ) : (
          <Button label="Pause all agents" tone="warn" onPress={() => setArmed(true)} />
        )}
      </View>
    </>
  );
}

function Button({ label, onPress, tone }: { label: string; onPress: () => void; tone?: 'go' | 'warn' }) {
  const color = tone === 'go' ? colors.green : tone === 'warn' ? colors.red : colors.dim;
  return (
    <Pressable accessibilityRole="button" onPress={onPress} style={[styles.button, { borderColor: tint(color, 0.45) }]}>
      <Text style={[styles.buttonText, { color }]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  item: { paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: colors.line },
  row: { padding: 13 },
  rowBorder: { borderTopWidth: 1, borderTopColor: colors.line },
  title: { fontFamily: fonts.sansSemiBold, fontSize: 13, color: colors.text },
  sub: { fontFamily: fonts.mono, fontSize: 9.5, color: colors.faint, marginTop: 3 },
  note: { fontFamily: fonts.sans, fontSize: 11.5, color: colors.dim, lineHeight: 17 },
  error: { fontFamily: fonts.sans, fontSize: 11.5, color: colors.red, marginTop: 6 },
  buttons: { flexDirection: 'row', gap: 8, marginTop: 8, flexWrap: 'wrap' },
  button: { borderWidth: 1, borderRadius: 8, paddingHorizontal: 12, paddingVertical: 7, backgroundColor: colors.tile },
  buttonText: { fontFamily: fonts.mono, fontSize: 10.5 },
});
