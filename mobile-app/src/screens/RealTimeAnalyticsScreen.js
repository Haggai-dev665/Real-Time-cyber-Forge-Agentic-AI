/**
 * Real-time Analytics Screen for Mobile App
 * Comprehensive security metrics and live monitoring
 */

import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  RefreshControl,
  TouchableOpacity,
  Dimensions,
  StyleSheet,
  Animated,
  Alert,
} from 'react-native';
import { Card, Title, Button, Surface, Chip } from 'react-native-paper';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { LineChart, BarChart, PieChart } from 'react-native-chart-kit';
import { useTheme } from 'react-native-paper';
import { useDesktopConnection } from '../services/DesktopConnection';

const { width: screenWidth } = Dimensions.get('window');

export default function RealTimeAnalyticsScreen() {
  const theme = useTheme();
  const { isConnected, requestDesktopData, sendToDesktop } = useDesktopConnection();
  const [refreshing, setRefreshing] = useState(false);
  const [fadeAnim] = useState(new Animated.Value(0));
  const [selectedTimeframe, setSelectedTimeframe] = useState('24h');

  const [analyticsData, setAnalyticsData] = useState({
    kpis: {
      threatsToday: 127,
      analysesCompleted: 2456,
      avgResponseTime: 152,
      detectionAccuracy: 95.8,
    },
    trends: {
      threats: '+15%',
      analyses: '+8%',
      responseTime: '-5%',
      accuracy: '+2%',
    },
    threatTimeline: {
      labels: ['6h', '5h', '4h', '3h', '2h', '1h', 'Now'],
      datasets: [{
        data: [12, 18, 25, 31, 22, 28, 35],
        color: (opacity = 1) => `rgba(255, 107, 107, ${opacity})`,
        strokeWidth: 3,
      }, {
        data: [8, 14, 20, 25, 18, 22, 28],
        color: (opacity = 1) => `rgba(78, 205, 196, ${opacity})`,
        strokeWidth: 3,
      }]
    },
    threatCategories: [
      { name: 'Malware', count: 45, color: '#ff6b6b', percentage: 35 },
      { name: 'Phishing', count: 32, color: '#4ecdc4', percentage: 25 },
      { name: 'Network', count: 25, color: '#45b7d1', percentage: 20 },
      { name: 'Suspicious', count: 20, color: '#f9ca24', percentage: 15 },
      { name: 'Other', count: 5, color: '#a55eea', percentage: 5 },
    ],
    systemMetrics: {
      cpu: 65,
      memory: 78,
      network: 45,
      disk: 32,
    },
    recentAlerts: [
      {
        id: 1,
        type: 'Critical',
        title: 'Malware Detected',
        description: 'Suspicious file execution detected on endpoint',
        time: '2 min ago',
        severity: 'critical',
        status: 'active'
      },
      {
        id: 2,
        type: 'High',
        title: 'Phishing Attempt',
        description: 'Suspicious email with malicious links detected',
        time: '5 min ago',
        severity: 'high',
        status: 'investigating'
      },
      {
        id: 3,
        type: 'Medium',
        title: 'Network Anomaly',
        description: 'Unusual traffic pattern detected',
        time: '12 min ago',
        severity: 'medium',
        status: 'resolved'
      },
      {
        id: 4,
        type: 'Low',
        title: 'Failed Login',
        description: 'Multiple failed login attempts',
        time: '25 min ago',
        severity: 'low',
        status: 'monitoring'
      },
    ],
    geographicThreats: [
      { country: 'USA', threats: 45, coordinates: [40.7128, -74.0060] },
      { country: 'China', threats: 32, coordinates: [39.9042, 116.4074] },
      { country: 'Russia', threats: 28, coordinates: [55.7558, 37.6176] },
      { country: 'Brazil', threats: 21, coordinates: [-14.2350, -51.9253] },
      { country: 'India', threats: 18, coordinates: [20.5937, 78.9629] },
    ],
    liveActivity: [
      { time: '14:35', action: 'Threat Blocked', target: '192.168.1.105', type: 'security' },
      { time: '14:34', action: 'Analysis Complete', target: 'suspicious_file.exe', type: 'analysis' },
      { time: '14:33', action: 'Scan Initiated', target: 'Network Segment A', type: 'scan' },
      { time: '14:32', action: 'Alert Generated', target: 'Email Gateway', type: 'alert' },
    ]
  });

  useEffect(() => {
    // Animate screen entrance
    Animated.timing(fadeAnim, {
      toValue: 1,
      duration: 800,
      useNativeDriver: true,
    }).start();

    // Load analytics data if connected
    if (isConnected) {
      loadAnalyticsData();
    }

    // Set up real-time updates
    const interval = setInterval(() => {
      if (isConnected) {
        updateRealTimeMetrics();
      }
    }, 3000);

    return () => clearInterval(interval);
  }, [isConnected, selectedTimeframe]);

  const loadAnalyticsData = async () => {
    try {
      await requestDesktopData('analytics');
    } catch (error) {
      console.error('Failed to load analytics data:', error);
    }
  };

  const updateRealTimeMetrics = () => {
    setAnalyticsData(prev => ({
      ...prev,
      kpis: {
        ...prev.kpis,
        threatsToday: prev.kpis.threatsToday + Math.floor(Math.random() * 3),
        avgResponseTime: 145 + Math.floor(Math.random() * 20),
      },
      liveActivity: [
        {
          time: new Date().toLocaleTimeString('en-US', { hour12: false, hour: '2-digit', minute: '2-digit' }),
          action: getRandomActivity(),
          target: getRandomTarget(),
          type: getRandomActivityType(),
        },
        ...prev.liveActivity.slice(0, 9)
      ]
    }));
  };

  const getRandomActivity = () => {
    const activities = ['Threat Detected', 'Scan Complete', 'Alert Generated', 'Threat Blocked', 'Analysis Started'];
    return activities[Math.floor(Math.random() * activities.length)];
  };

  const getRandomTarget = () => {
    const targets = ['192.168.1.100', 'malware.exe', 'phishing_email.msg', 'Network Segment B', 'Web Gateway'];
    return targets[Math.floor(Math.random() * targets.length)];
  };

  const getRandomActivityType = () => {
    const types = ['security', 'analysis', 'scan', 'alert'];
    return types[Math.floor(Math.random() * types.length)];
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await loadAnalyticsData();
    setTimeout(() => setRefreshing(false), 1000);
  };

  const exportReport = () => {
    Alert.alert(
      'Export Report',
      'Generate and export analytics report?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Export',
          onPress: () => {
            sendToDesktop({ type: 'export_analytics_report', timeframe: selectedTimeframe });
            Alert.alert('Success', 'Report generation started!');
          }
        }
      ]
    );
  };

  const chartConfig = {
    backgroundColor: 'transparent',
    backgroundGradientFrom: 'transparent',
    backgroundGradientTo: 'transparent',
    color: (opacity = 1) => `rgba(255, 255, 255, ${opacity})`,
    strokeWidth: 2,
    barPercentage: 0.7,
    useShadowColorFromDataset: false,
    decimalPlaces: 0,
    propsForLabels: {
      fontSize: 12,
      fontWeight: 'bold'
    }
  };

  const getSeverityColor = (severity) => {
    switch (severity) {
      case 'critical': return '#dc3545';
      case 'high': return '#fd7e14';
      case 'medium': return '#ffc107';
      case 'low': return '#28a745';
      default: return '#6c757d';
    }
  };

  const getActivityIcon = (type) => {
    switch (type) {
      case 'security': return 'shield-checkmark';
      case 'analysis': return 'search';
      case 'scan': return 'scan';
      case 'alert': return 'warning';
      default: return 'information-circle';
    }
  };

  const timeframeOptions = ['1h', '6h', '24h', '7d', '30d'];

  return (
    <LinearGradient
      colors={['#0a0a0a', '#1a1a2e', '#16213e']}
      style={styles.container}
    >
      <Animated.View style={[styles.content, { opacity: fadeAnim }]}>
        <ScrollView
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
          }
          showsVerticalScrollIndicator={false}
        >
          {/* Header */}
          <View style={styles.header}>
            <View>
              <Title style={styles.title}>
                <Ionicons name="analytics" size={24} color="#00f5ff" /> Analytics
              </Title>
              <Text style={styles.subtitle}>Real-time security insights</Text>
            </View>
            <TouchableOpacity onPress={exportReport} style={styles.exportButton}>
              <Ionicons name="download" size={20} color="#ffffff" />
              <Text style={styles.exportText}>Export</Text>
            </TouchableOpacity>
          </View>

          {/* Timeframe Selector */}
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.timeframeContainer}>
            {timeframeOptions.map((timeframe) => (
              <Chip
                key={timeframe}
                selected={selectedTimeframe === timeframe}
                onPress={() => setSelectedTimeframe(timeframe)}
                style={[
                  styles.timeframeChip,
                  selectedTimeframe === timeframe && styles.selectedChip
                ]}
                textStyle={[
                  styles.chipText,
                  selectedTimeframe === timeframe && styles.selectedChipText
                ]}
              >
                {timeframe.toUpperCase()}
              </Chip>
            ))}
          </ScrollView>

          {/* KPI Cards */}
          <View style={styles.kpiGrid}>
            <View style={[styles.kpiCard, { backgroundColor: 'rgba(255, 107, 107, 0.1)' }]}>
              <Ionicons name="warning" size={24} color="#ff6b6b" />
              <Text style={styles.kpiValue}>{analyticsData.kpis.threatsToday}</Text>
              <Text style={styles.kpiLabel}>Threats Today</Text>
              <Text style={[styles.kpiTrend, { color: '#ff6b6b' }]}>{analyticsData.trends.threats}</Text>
            </View>

            <View style={[styles.kpiCard, { backgroundColor: 'rgba(78, 205, 196, 0.1)' }]}>
              <Ionicons name="checkmark-circle" size={24} color="#4ecdc4" />
              <Text style={styles.kpiValue}>{analyticsData.kpis.analysesCompleted.toLocaleString()}</Text>
              <Text style={styles.kpiLabel}>Analyses</Text>
              <Text style={[styles.kpiTrend, { color: '#4ecdc4' }]}>{analyticsData.trends.analyses}</Text>
            </View>

            <View style={[styles.kpiCard, { backgroundColor: 'rgba(69, 183, 209, 0.1)' }]}>
              <Ionicons name="timer" size={24} color="#45b7d1" />
              <Text style={styles.kpiValue}>{analyticsData.kpis.avgResponseTime}ms</Text>
              <Text style={styles.kpiLabel}>Response Time</Text>
              <Text style={[styles.kpiTrend, { color: '#4ecdc4' }]}>{analyticsData.trends.responseTime}</Text>
            </View>

            <View style={[styles.kpiCard, { backgroundColor: 'rgba(249, 202, 36, 0.1)' }]}>
              <Ionicons name="target" size={24} color="#f9ca24" />
              <Text style={styles.kpiValue}>{analyticsData.kpis.detectionAccuracy}%</Text>
              <Text style={styles.kpiLabel}>Accuracy</Text>
              <Text style={[styles.kpiTrend, { color: '#4ecdc4' }]}>{analyticsData.trends.accuracy}</Text>
            </View>
          </View>

          {/* Threat Timeline */}
          <Card style={styles.chartCard}>
            <Card.Content>
              <Title style={styles.cardTitle}>
                <Ionicons name="trending-up" size={20} color="#00f5ff" /> Threat Timeline
              </Title>
              <LineChart
                data={analyticsData.threatTimeline}
                width={screenWidth - 60}
                height={200}
                chartConfig={chartConfig}
                bezier
                style={styles.chart}
                legend={['Detected', 'Mitigated']}
              />
            </Card.Content>
          </Card>

          {/* Threat Categories */}
          <Card style={styles.chartCard}>
            <Card.Content>
              <Title style={styles.cardTitle}>
                <Ionicons name="pie-chart" size={20} color="#00f5ff" /> Threat Distribution
              </Title>
              <View style={styles.categoryContainer}>
                {analyticsData.threatCategories.map((category, index) => (
                  <View key={index} style={styles.categoryItem}>
                    <View style={styles.categoryHeader}>
                      <View style={[styles.categoryDot, { backgroundColor: category.color }]} />
                      <Text style={styles.categoryName}>{category.name}</Text>
                      <Text style={styles.categoryCount}>{category.count}</Text>
                    </View>
                    <View style={styles.progressContainer}>
                      <View style={[styles.progressBar, { width: `${category.percentage}%`, backgroundColor: category.color }]} />
                    </View>
                  </View>
                ))}
              </View>
            </Card.Content>
          </Card>

          {/* System Performance */}
          <Card style={styles.card}>
            <Card.Content>
              <Title style={styles.cardTitle}>
                <Ionicons name="hardware-chip" size={20} color="#00f5ff" /> System Performance
              </Title>
              {Object.entries(analyticsData.systemMetrics).map(([metric, value]) => (
                <View key={metric} style={styles.metricItem}>
                  <View style={styles.metricHeader}>
                    <Text style={styles.metricLabel}>{metric.toUpperCase()}</Text>
                    <Text style={styles.metricValue}>{value}%</Text>
                  </View>
                  <View style={styles.metricBar}>
                    <View 
                      style={[
                        styles.metricFill, 
                        { 
                          width: `${value}%`,
                          backgroundColor: value > 80 ? '#ff6b6b' : value > 60 ? '#f9ca24' : '#4ecdc4'
                        }
                      ]} 
                    />
                  </View>
                </View>
              ))}
            </Card.Content>
          </Card>

          {/* Recent Alerts */}
          <Card style={styles.card}>
            <Card.Content>
              <Title style={styles.cardTitle}>
                <Ionicons name="notifications" size={20} color="#00f5ff" /> Recent Alerts
              </Title>
              {analyticsData.recentAlerts.map((alert) => (
                <View key={alert.id} style={styles.alertItem}>
                  <View style={styles.alertHeader}>
                    <View style={[styles.severityBadge, { backgroundColor: getSeverityColor(alert.severity) }]}>
                      <Text style={styles.severityText}>{alert.type}</Text>
                    </View>
                    <Text style={styles.alertTime}>{alert.time}</Text>
                  </View>
                  <Text style={styles.alertTitle}>{alert.title}</Text>
                  <Text style={styles.alertDescription}>{alert.description}</Text>
                  <View style={styles.alertFooter}>
                    <Chip 
                      mode="outlined"
                      compact
                      style={styles.statusChip}
                      textStyle={styles.statusText}
                    >
                      {alert.status}
                    </Chip>
                  </View>
                </View>
              ))}
            </Card.Content>
          </Card>

          {/* Live Activity Feed */}
          <Card style={styles.card}>
            <Card.Content>
              <View style={styles.cardHeader}>
                <Title style={styles.cardTitle}>
                  <Ionicons name="pulse" size={20} color="#00f5ff" /> Live Activity
                </Title>
                <Surface style={styles.liveIndicator}>
                  <View style={styles.liveDot} />
                  <Text style={styles.liveText}>LIVE</Text>
                </Surface>
              </View>
              
              {analyticsData.liveActivity.map((activity, index) => (
                <View key={index} style={styles.activityItem}>
                  <View style={styles.activityIcon}>
                    <Ionicons 
                      name={getActivityIcon(activity.type)} 
                      size={16} 
                      color="#ffffff" 
                    />
                  </View>
                  <View style={styles.activityContent}>
                    <Text style={styles.activityAction}>{activity.action}</Text>
                    <Text style={styles.activityTarget}>{activity.target}</Text>
                  </View>
                  <Text style={styles.activityTime}>{activity.time}</Text>
                </View>
              ))}
            </Card.Content>
          </Card>

          <View style={styles.bottomSpacing} />
        </ScrollView>
      </Animated.View>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    flex: 1,
    padding: 16,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#ffffff',
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 14,
    color: 'rgba(255, 255, 255, 0.7)',
  },
  exportButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 245, 255, 0.2)',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#00f5ff',
  },
  exportText: {
    color: '#ffffff',
    marginLeft: 6,
    fontSize: 14,
    fontWeight: '600',
  },
  timeframeContainer: {
    marginBottom: 20,
  },
  timeframeChip: {
    marginRight: 8,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
  },
  selectedChip: {
    backgroundColor: '#00f5ff',
  },
  chipText: {
    color: 'rgba(255, 255, 255, 0.7)',
  },
  selectedChipText: {
    color: '#000000',
    fontWeight: '600',
  },
  kpiGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    marginBottom: 20,
  },
  kpiCard: {
    width: '48%',
    padding: 16,
    borderRadius: 12,
    marginBottom: 10,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  kpiValue: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#ffffff',
    marginVertical: 6,
  },
  kpiLabel: {
    fontSize: 12,
    color: 'rgba(255, 255, 255, 0.7)',
    textAlign: 'center',
  },
  kpiTrend: {
    fontSize: 12,
    fontWeight: '600',
    marginTop: 4,
  },
  card: {
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    marginBottom: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  chartCard: {
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    marginBottom: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  cardTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#ffffff',
  },
  chart: {
    borderRadius: 8,
  },
  categoryContainer: {
    paddingTop: 10,
  },
  categoryItem: {
    marginBottom: 12,
  },
  categoryHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 6,
  },
  categoryDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    marginRight: 10,
  },
  categoryName: {
    flex: 1,
    fontSize: 14,
    color: '#ffffff',
    fontWeight: '500',
  },
  categoryCount: {
    fontSize: 14,
    color: 'rgba(255, 255, 255, 0.8)',
    fontWeight: '600',
  },
  progressContainer: {
    height: 4,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: 2,
    overflow: 'hidden',
  },
  progressBar: {
    height: '100%',
    borderRadius: 2,
  },
  metricItem: {
    marginBottom: 16,
  },
  metricHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  metricLabel: {
    fontSize: 12,
    color: 'rgba(255, 255, 255, 0.7)',
    fontWeight: '600',
  },
  metricValue: {
    fontSize: 14,
    color: '#ffffff',
    fontWeight: '600',
  },
  metricBar: {
    height: 6,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: 3,
    overflow: 'hidden',
  },
  metricFill: {
    height: '100%',
    borderRadius: 3,
  },
  alertItem: {
    marginBottom: 16,
    padding: 12,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderRadius: 8,
    borderLeftWidth: 4,
    borderLeftColor: '#ff6b6b',
  },
  alertHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  severityBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 10,
  },
  severityText: {
    fontSize: 10,
    fontWeight: '600',
    color: '#ffffff',
  },
  alertTime: {
    fontSize: 12,
    color: 'rgba(255, 255, 255, 0.6)',
  },
  alertTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#ffffff',
    marginBottom: 4,
  },
  alertDescription: {
    fontSize: 12,
    color: 'rgba(255, 255, 255, 0.8)',
    marginBottom: 8,
  },
  alertFooter: {
    alignItems: 'flex-start',
  },
  statusChip: {
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderColor: 'rgba(255, 255, 255, 0.3)',
  },
  statusText: {
    fontSize: 10,
    color: 'rgba(255, 255, 255, 0.8)',
  },
  liveIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    backgroundColor: 'rgba(78, 205, 196, 0.2)',
  },
  liveDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#4ecdc4',
    marginRight: 6,
  },
  liveText: {
    fontSize: 10,
    fontWeight: '600',
    color: '#4ecdc4',
  },
  activityItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
    paddingVertical: 8,
  },
  activityIcon: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(0, 245, 255, 0.2)',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  activityContent: {
    flex: 1,
  },
  activityAction: {
    fontSize: 14,
    fontWeight: '600',
    color: '#ffffff',
  },
  activityTarget: {
    fontSize: 12,
    color: 'rgba(255, 255, 255, 0.7)',
  },
  activityTime: {
    fontSize: 12,
    color: 'rgba(255, 255, 255, 0.6)',
  },
  bottomSpacing: {
    height: 20,
  },
});