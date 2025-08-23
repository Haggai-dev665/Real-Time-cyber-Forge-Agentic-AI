import React, { useEffect, useState } from 'react';
import {
  View,
  ScrollView,
  StyleSheet,
  RefreshControl,
  Dimensions,
} from 'react-native';
import {
  Card,
  Title,
  Paragraph,
  Button,
  Surface,
  Text,
  ProgressBar,
  Chip,
  useTheme,
} from 'react-native-paper';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';

import { useDesktopConnection } from '../services/DesktopConnection';
import { gradientColors, statusColors, riskColors } from '../theme';

const { width } = Dimensions.get('window');

export default function DashboardScreen() {
  const theme = useTheme();
  const { isConnected, desktopData, connectToDesktop, requestDesktopData } = useDesktopConnection();
  const [refreshing, setRefreshing] = useState(false);
  const [metrics, setMetrics] = useState({
    pagesMonitored: 0,
    threatsDetected: 0,
    riskScore: 0,
    aiInsights: 0,
  });

  useEffect(() => {
    if (isConnected) {
      requestDesktopData('dashboard');
    }
  }, [isConnected]);

  useEffect(() => {
    if (desktopData?.dashboard) {
      setMetrics(desktopData.dashboard);
    }
  }, [desktopData]);

  const onRefresh = async () => {
    setRefreshing(true);
    if (isConnected) {
      requestDesktopData('dashboard');
    }
    setTimeout(() => setRefreshing(false), 1000);
  };

  const getRiskLevel = (score) => {
    if (score < 30) return { level: 'Low', color: riskColors.low };
    if (score < 70) return { level: 'Medium', color: riskColors.medium };
    return { level: 'High', color: riskColors.high };
  };

  const risk = getRiskLevel(metrics.riskScore);

  return (
    <LinearGradient colors={gradientColors} style={styles.container}>
      <ScrollView
        style={styles.scrollView}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
      >
        {/* Connection Status */}
        <Card style={styles.statusCard}>
          <Card.Content style={styles.statusContent}>
            <View style={styles.statusRow}>
              <Ionicons
                name={isConnected ? 'checkmark-circle' : 'close-circle'}
                size={24}
                color={isConnected ? statusColors.connected : statusColors.disconnected}
              />
              <Text style={styles.statusText}>
                Desktop App {isConnected ? 'Connected' : 'Disconnected'}
              </Text>
            </View>
            {!isConnected && (
              <Button
                mode="contained"
                onPress={() => connectToDesktop()}
                style={styles.connectButton}
              >
                Connect to Desktop
              </Button>
            )}
          </Card.Content>
        </Card>

        {/* Metrics Grid */}
        <View style={styles.metricsGrid}>
          <Surface style={[styles.metricCard, { backgroundColor: theme.colors.surface }]}>
            <Ionicons name="globe-outline" size={32} color={theme.colors.primary} />
            <Text style={styles.metricValue}>{metrics.pagesMonitored}</Text>
            <Text style={styles.metricLabel}>Pages Monitored</Text>
          </Surface>

          <Surface style={[styles.metricCard, { backgroundColor: theme.colors.surface }]}>
            <Ionicons name="shield-outline" size={32} color={statusColors.warning} />
            <Text style={styles.metricValue}>{metrics.threatsDetected}</Text>
            <Text style={styles.metricLabel}>Threats Detected</Text>
          </Surface>

          <Surface style={[styles.metricCard, { backgroundColor: theme.colors.surface }]}>
            <Ionicons name="warning-outline" size={32} color={risk.color} />
            <Text style={[styles.metricValue, { color: risk.color }]}>{risk.level}</Text>
            <Text style={styles.metricLabel}>Risk Level</Text>
            <ProgressBar
              progress={metrics.riskScore / 100}
              color={risk.color}
              style={styles.riskBar}
            />
          </Surface>

          <Surface style={[styles.metricCard, { backgroundColor: theme.colors.surface }]}>
            <Ionicons name="bulb-outline" size={32} color={theme.colors.accent} />
            <Text style={styles.metricValue}>{metrics.aiInsights}</Text>
            <Text style={styles.metricLabel}>AI Insights</Text>
          </Surface>
        </View>

        {/* Recent Activity */}
        <Card style={styles.activityCard}>
          <Card.Content>
            <Title style={styles.sectionTitle}>Recent Activity</Title>
            {desktopData?.activity ? (
              desktopData.activity.slice(0, 5).map((item, index) => (
                <View key={index} style={styles.activityItem}>
                  <View style={styles.activityInfo}>
                    <Text style={styles.activityText}>{item.message}</Text>
                    <Text style={styles.activityTime}>{item.timestamp}</Text>
                  </View>
                  <Chip
                    mode="outlined"
                    style={[
                      styles.activityChip,
                      { borderColor: item.type === 'warning' ? statusColors.warning : theme.colors.primary }
                    ]}
                  >
                    {item.type}
                  </Chip>
                </View>
              ))
            ) : (
              <Text style={styles.noDataText}>
                {isConnected ? 'No recent activity' : 'Connect to desktop to view activity'}
              </Text>
            )}
          </Card.Content>
        </Card>

        {/* Quick Actions */}
        <Card style={styles.actionsCard}>
          <Card.Content>
            <Title style={styles.sectionTitle}>Quick Actions</Title>
            <View style={styles.actionButtons}>
              <Button
                mode="contained"
                icon="refresh"
                onPress={() => requestDesktopData('dashboard')}
                disabled={!isConnected}
                style={styles.actionButton}
              >
                Refresh Data
              </Button>
              <Button
                mode="outlined"
                icon="shield-check"
                onPress={() => requestDesktopData('threats')}
                disabled={!isConnected}
                style={styles.actionButton}
              >
                Scan Threats
              </Button>
            </View>
          </Card.Content>
        </Card>
      </ScrollView>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollView: {
    flex: 1,
    padding: 16,
  },
  statusCard: {
    marginBottom: 16,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
  },
  statusContent: {
    alignItems: 'center',
  },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  statusText: {
    marginLeft: 8,
    fontSize: 16,
    fontWeight: '500',
    color: '#ffffff',
  },
  connectButton: {
    marginTop: 8,
  },
  metricsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  metricCard: {
    width: (width - 48) / 2,
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
    marginBottom: 12,
  },
  metricValue: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#ffffff',
    marginTop: 8,
  },
  metricLabel: {
    fontSize: 12,
    color: 'rgba(255, 255, 255, 0.7)',
    textAlign: 'center',
    marginTop: 4,
  },
  riskBar: {
    width: '100%',
    marginTop: 8,
    height: 6,
  },
  activityCard: {
    marginBottom: 16,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
  },
  sectionTitle: {
    color: '#ffffff',
    marginBottom: 12,
  },
  activityItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.1)',
  },
  activityInfo: {
    flex: 1,
  },
  activityText: {
    color: '#ffffff',
    fontSize: 14,
  },
  activityTime: {
    color: 'rgba(255, 255, 255, 0.6)',
    fontSize: 12,
    marginTop: 2,
  },
  activityChip: {
    marginLeft: 8,
  },
  noDataText: {
    color: 'rgba(255, 255, 255, 0.6)',
    textAlign: 'center',
    fontStyle: 'italic',
  },
  actionsCard: {
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
  },
  actionButtons: {
    flexDirection: 'row',
    justifyContent: 'space-around',
  },
  actionButton: {
    flex: 1,
    marginHorizontal: 4,
  },
});