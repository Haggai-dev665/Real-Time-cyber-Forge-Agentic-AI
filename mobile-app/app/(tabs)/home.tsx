/**
 * Home / dashboard. Real data:
 *  - security score + stat tiles derived from GET /api/threats/stats
 *  - live connection state + activity feed from the shared SSE stream
 */
import React from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';

import { colors, fonts, tint } from '../../src/theme';
import { Screen } from '../../src/components/Screen';
import { Card, SecLabel, StatTiles, FeedRow, TopBar, Loading, EmptyState } from '../../src/components/ui';
import { Ring } from '../../src/components/Ring';
import { Icon } from '../../src/components/Icon';
import { BrandMark } from '../../src/components/BrandMark';
import { LiveDot } from '../../src/components/LiveDot';
import { useApi } from '../../src/hooks/useApi';
import { endpoints } from '../../src/api/endpoints';
import { useLiveFeed } from '../../src/context/LiveFeedContext';
import { useAuth } from '../../src/context/AuthContext';
import { timeAgo, eventTitle } from '../../src/utils/format';

const FEED_COLORS: Record<string, string> = {
  'threat:new': colors.red,
  'alert:new': colors.amber2,
  'scan:update': colors.cyan,
  'agent:activity': colors.green,
};

export default function Home() {
  const router = useRouter();
  const { user, isGuest } = useAuth();
  const { connected, events } = useLiveFeed();
  const stats = useApi(() => endpoints.threatStats(), []);

  const data = stats.data?.data;
  const active = data?.active_threats ?? 0;
  const resolved = data?.resolved_threats ?? 0;
  const score = data ? Math.max(20, 100 - active * 8) : null;

  return (
    <Screen refreshing={stats.loading} onRefresh={stats.refresh}>
      <TopBar
        title="Protected"
        sub={connected ? 'Live · synced now' : 'Connecting…'}
        right={<BrandMark size={36} />}
      />

      <View style={styles.pad}>
        {stats.loading && !data ? (
          <Loading label="Loading security posture…" />
        ) : stats.error ? (
          <EmptyState
            icon="shield"
            title="Posture unavailable"
            hint={stats.rateLimited ? 'Rate limited — pull to refresh shortly.' : stats.error}
          />
        ) : (
          <>
            {/* score ring */}
            <Card style={styles.scoreCard}>
              <LinearGradient
                colors={[tint(active === 0 ? colors.green : colors.amber2, 0.08), 'transparent']}
                style={StyleSheet.absoluteFill}
              />
              <Ring value={score ?? 0} size={172} stroke={14} color={active === 0 ? colors.green : colors.amber2}>
                <Text style={[styles.scoreNum, { color: active === 0 ? colors.green : colors.amber2 }]}>
                  {score}
                </Text>
                <Text style={styles.scoreLbl}>SECURITY SCORE</Text>
              </Ring>
              <View style={styles.scoreStatus}>
                <LiveDot color={active === 0 ? colors.green : colors.amber2} />
                <Text style={[styles.scoreStatusText, { color: active === 0 ? colors.green : colors.amber2 }]}>
                  {active === 0 ? 'All systems protected' : `${active} active threat${active === 1 ? '' : 's'}`}
                </Text>
              </View>
            </Card>

            {/* stat tiles */}
            <View style={{ marginTop: 14 }}>
              <StatTiles
                items={[
                  { value: String(resolved), label: 'resolved', color: colors.amber2, icon: 'shield' },
                  { value: String(active), label: 'active threats', color: active === 0 ? colors.green : colors.red, icon: 'check' },
                  { value: String(data?.total_threats ?? 0), label: 'total tracked', color: colors.cyan, icon: 'activity' },
                ]}
              />
            </View>

            {/* connection card */}
            <Card style={[styles.connCard, { borderColor: tint(colors.cyan, 0.25) }]}>
              <View style={styles.connIcon}>
                <Icon name="plug" size={19} color={colors.cyan} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.connTitle}>{connected ? 'Live stream connected' : 'Reconnecting…'}</Text>
                <Text style={styles.connSub}>
                  {isGuest ? 'Guest · public feed' : user?.email ?? 'Authenticated'}
                </Text>
              </View>
              <LiveDot color={connected ? colors.cyan : colors.faint} />
            </Card>
          </>
        )}

        {/* live activity */}
        <SecLabel>Live activity</SecLabel>
        <Card style={{ overflow: 'hidden' }}>
          {events.length === 0 ? (
            <View style={{ padding: 18, alignItems: 'center' }}>
              <Text style={styles.idle}>
                {connected ? 'Listening for live events…' : 'Waiting for connection…'}
              </Text>
            </View>
          ) : (
            events.slice(0, 6).map((e, i) => (
              <FeedRow
                key={`${e.ts}-${i}`}
                first={i === 0}
                dotColor={FEED_COLORS[e.type] ?? colors.cyan}
                text={eventTitle(e.type, e.data)}
                meta={timeAgo(e.ts)}
              />
            ))
          )}
        </Card>

        <Pressable style={styles.cta} onPress={() => router.push('/(tabs)/alerts')}>
          <Icon name="alert" size={15} color={colors.red} />
          <Text style={styles.ctaText}>View all alerts</Text>
        </Pressable>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  pad: { paddingHorizontal: 18 },
  scoreCard: { padding: 22, alignItems: 'center', overflow: 'hidden' },
  scoreNum: { fontFamily: fonts.monoSemiBold, fontSize: 40, lineHeight: 44 },
  scoreLbl: { fontFamily: fonts.mono, fontSize: 9, color: colors.faint, marginTop: 3 },
  scoreStatus: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 10 },
  scoreStatusText: { fontFamily: fonts.mono, fontSize: 11 },
  connCard: { padding: 14, marginTop: 14, flexDirection: 'row', alignItems: 'center', gap: 12 },
  connIcon: { width: 40, height: 40, borderRadius: 11, backgroundColor: colors.cyanDim, borderWidth: 1, borderColor: colors.line2, alignItems: 'center', justifyContent: 'center' },
  connTitle: { fontFamily: fonts.sansSemiBold, fontSize: 13.5, color: colors.text },
  connSub: { fontFamily: fonts.mono, fontSize: 10, color: colors.faint, marginTop: 2 },
  idle: { fontFamily: fonts.mono, fontSize: 11, color: colors.faint },
  cta: {
    height: 46,
    borderRadius: 13,
    marginTop: 14,
    borderWidth: 1,
    borderColor: colors.line2,
    backgroundColor: colors.surface2,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  ctaText: { fontFamily: fonts.sansSemiBold, fontSize: 13.5, color: colors.text },
});
