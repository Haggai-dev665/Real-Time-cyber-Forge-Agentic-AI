/**
 * Network Monitoring Screen for Mobile App
 * Real-time network security monitoring and visualization
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
import { Card, Title, Button, Surface, Chip, ProgressBar } from 'react-native-paper';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { LineChart, BarChart } from 'react-native-chart-kit';
import { useTheme } from 'react-native-paper';
import { useDesktopConnection } from '../services/DesktopConnection';

const { width: screenWidth } = Dimensions.get('window');

export default function NetworkMonitoringScreen() {
  const theme = useTheme();
  const { isConnected, requestDesktopData, sendToDesktop } = useDesktopConnection();
  const [refreshing, setRefreshing] = useState(false);
  const [fadeAnim] = useState(new Animated.Value(0));
  const [selectedInterface, setSelectedInterface] = useState('eth0');

  const [networkData, setNetworkData] = useState({
    interfaces: [
      { name: 'eth0', status: 'active', ip: '192.168.1.100', traffic: 'high' },
      { name: 'wlan0', status: 'active', ip: '192.168.1.101', traffic: 'medium' },
      { name: 'lo', status: 'active', ip: '127.0.0.1', traffic: 'low' },
    ],
    trafficFlow: {
      labels: ['5m', '4m', '3m', '2m', '1m', 'Now'],
      datasets: [{
        data: [25, 30, 45, 35, 50, 42],
        color: (opacity = 1) => `rgba(0, 245, 255, ${opacity})`,
        strokeWidth: 3,
      }, {
        data: [15, 20, 25, 20, 30, 28],
        color: (opacity = 1) => `rgba(78, 205, 196, ${opacity})`,
        strokeWidth: 3,
      }]
    },
    protocolDistribution: {
      labels: ['TCP', 'UDP', 'ICMP', 'HTTP', 'HTTPS'],
      datasets: [{
        data: [35, 25, 10, 20, 10]
      }]
    },
    securityEvents: [
      {
        id: 1,
        time: '14:35',
        type: 'Port Scan',
        source: '192.168.1.50',
        severity: 'high',
        status: 'blocked'
      },
      {
        id: 2,
        time: '14:33',
        type: 'Suspicious Traffic',
        source: '10.0.0.25',
        severity: 'medium',
        status: 'monitoring'
      },
      {
        id: 3,
        time: '14:30',
        type: 'DDoS Attempt',
        source: '203.0.113.10',
        severity: 'critical',
        status: 'mitigated'
      },
      {
        id: 4,
        time: '14:28',
        type: 'Anomalous Pattern',
        source: '192.168.1.75',
        severity: 'low',
        status: 'investigating'
      },
    ],
    activeConnections: [
      { ip: '192.168.1.105', port: 443, protocol: 'HTTPS', status: 'established', country: 'US' },
      { ip: '192.168.1.110', port: 22, protocol: 'SSH', status: 'established', country: 'Local' },
      { ip: '203.0.113.50', port: 80, protocol: 'HTTP', status: 'time_wait', country: 'DE' },
      { ip: '198.51.100.25', port: 993, protocol: 'IMAPS', status: 'established', country: 'UK' },
    ],
    bandwidthUsage: {
      upload: 45,
      download: 78,
      total: 85
    },
    networkStats: {
      packetsPerSecond: 1247,
      bytesPerSecond: 1024 * 1024 * 2.5,
      activeConnections: 156,
      droppedPackets: 12
    }
  });

  useEffect(() => {
    // Animate screen entrance
    Animated.timing(fadeAnim, {
      toValue: 1,
      duration: 800,
      useNativeDriver: true,
    }).start();

    // Load network data if connected
    if (isConnected) {
      loadNetworkData();
    }

    // Set up real-time updates
    const interval = setInterval(() => {
      if (isConnected) {
        updateNetworkMetrics();
      }
    }, 2000);

    return () => clearInterval(interval);
  }, [isConnected, selectedInterface]);

  const loadNetworkData = async () => {
    try {
      await requestDesktopData('network_monitoring');
    } catch (error) {
      console.error('Failed to load network data:', error);
    }
  };

  const updateNetworkMetrics = () => {
    // Simulate real-time network data updates
    setNetworkData(prev => ({
      ...prev,
      networkStats: {
        ...prev.networkStats,
        packetsPerSecond: 1200 + Math.floor(Math.random() * 100),
        bytesPerSecond: 1024 * 1024 * (2 + Math.random() * 2),
        activeConnections: 150 + Math.floor(Math.random() * 20),
        droppedPackets: Math.floor(Math.random() * 20)
      },
      bandwidthUsage: {
        upload: 40 + Math.floor(Math.random() * 20),
        download: 70 + Math.floor(Math.random() * 20),
        total: 80 + Math.floor(Math.random() * 15)
      }
    }));
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await loadNetworkData();
    setTimeout(() => setRefreshing(false), 1000);
  };

  const initiateNetworkScan = () => {
    Alert.alert(
      'Network Scan',
      'Start comprehensive network security scan?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Start Scan',
          onPress: () => {
            sendToDesktop({
              type: 'start_network_scan',
              interface: selectedInterface,
              scan_type: 'comprehensive'
            });
            Alert.alert('Success', 'Network scan initiated!');
          }
        }
      ]
    );
  };

  const blockIP = (ip) => {
    Alert.alert(
      'Block IP Address',
      `Block all traffic from ${ip}?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Block',
          style: 'destructive',
          onPress: () => {
            sendToDesktop({
              type: 'block_ip',
              ip_address: ip,
              duration: '1h'
            });
            Alert.alert('Success', `IP ${ip} has been blocked!`);
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

  const getStatusColor = (status) => {
    switch (status) {
      case 'blocked': return '#dc3545';
      case 'mitigated': return '#28a745';
      case 'monitoring': return '#ffc107';
      case 'investigating': return '#17a2b8';
      default: return '#6c757d';
    }
  };

  const formatBytes = (bytes) => {
    const sizes = ['B', 'KB', 'MB', 'GB'];
    if (bytes === 0) return '0 B';
    const i = Math.floor(Math.log(bytes) / Math.log(1024));
    return `${(bytes / Math.pow(1024, i)).toFixed(1)} ${sizes[i]}`;
  };

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
                <Ionicons name="wifi" size={24} color="#00f5ff" /> Network Monitor
              </Title>
              <Text style={styles.subtitle}>Real-time network security</Text>
            </View>
            <TouchableOpacity onPress={initiateNetworkScan} style={styles.scanButton}>
              <Ionicons name="scan" size={20} color="#ffffff" />
              <Text style={styles.scanText}>Scan</Text>
            </TouchableOpacity>
          </View>

          {/* Interface Selector */}
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.interfaceContainer}>
            {networkData.interfaces.map((interface_) => (
              <Chip
                key={interface_.name}
                selected={selectedInterface === interface_.name}
                onPress={() => setSelectedInterface(interface_.name)}
                style={[
                  styles.interfaceChip,
                  selectedInterface === interface_.name && styles.selectedInterfaceChip
                ]}
                textStyle={[
                  styles.chipText,
                  selectedInterface === interface_.name && styles.selectedChipText
                ]}
              >
                {interface_.name} ({interface_.ip})
              </Chip>
            ))}
          </ScrollView>

          {/* Network Stats */}
          <View style={styles.statsGrid}>
            <View style={[styles.statCard, { backgroundColor: 'rgba(0, 245, 255, 0.1)' }]}>
              <Ionicons name="pulse" size={20} color="#00f5ff" />
              <Text style={styles.statValue}>{networkData.networkStats.packetsPerSecond.toLocaleString()}</Text>
              <Text style={styles.statLabel}>Packets/sec</Text>
            </View>

            <View style={[styles.statCard, { backgroundColor: 'rgba(78, 205, 196, 0.1)' }]}>
              <Ionicons name="download" size={20} color="#4ecdc4" />
              <Text style={styles.statValue}>{formatBytes(networkData.networkStats.bytesPerSecond)}/s</Text>
              <Text style={styles.statLabel}>Throughput</Text>
            </View>

            <View style={[styles.statCard, { backgroundColor: 'rgba(249, 202, 36, 0.1)' }]}>
              <Ionicons name="link" size={20} color="#f9ca24" />
              <Text style={styles.statValue}>{networkData.networkStats.activeConnections}</Text>
              <Text style={styles.statLabel}>Connections</Text>
            </View>

            <View style={[styles.statCard, { backgroundColor: 'rgba(255, 107, 107, 0.1)' }]}>
              <Ionicons name="alert-circle" size={20} color="#ff6b6b" />
              <Text style={styles.statValue}>{networkData.networkStats.droppedPackets}</Text>
              <Text style={styles.statLabel}>Dropped</Text>
            </View>
          </View>

          {/* Traffic Flow Chart */}
          <Card style={styles.chartCard}>
            <Card.Content>
              <Title style={styles.cardTitle}>
                <Ionicons name="trending-up" size={20} color="#00f5ff" /> Traffic Flow (Mbps)
              </Title>
              <LineChart
                data={networkData.trafficFlow}
                width={screenWidth - 60}
                height={200}
                chartConfig={chartConfig}
                bezier
                style={styles.chart}
                legend={['Inbound', 'Outbound']}
              />
            </Card.Content>
          </Card>

          {/* Bandwidth Usage */}
          <Card style={styles.card}>
            <Card.Content>
              <Title style={styles.cardTitle}>
                <Ionicons name="speedometer" size={20} color="#00f5ff" /> Bandwidth Usage
              </Title>
              
              <View style={styles.bandwidthItem}>
                <View style={styles.bandwidthHeader}>
                  <Text style={styles.bandwidthLabel}>Upload</Text>
                  <Text style={styles.bandwidthValue}>{networkData.bandwidthUsage.upload}%</Text>
                </View>
                <ProgressBar
                  progress={networkData.bandwidthUsage.upload / 100}
                  color="#4ecdc4"
                  style={styles.bandwidthBar}
                />
              </View>

              <View style={styles.bandwidthItem}>
                <View style={styles.bandwidthHeader}>
                  <Text style={styles.bandwidthLabel}>Download</Text>
                  <Text style={styles.bandwidthValue}>{networkData.bandwidthUsage.download}%</Text>
                </View>
                <ProgressBar
                  progress={networkData.bandwidthUsage.download / 100}
                  color="#00f5ff"
                  style={styles.bandwidthBar}
                />
              </View>

              <View style={styles.bandwidthItem}>
                <View style={styles.bandwidthHeader}>
                  <Text style={styles.bandwidthLabel}>Total Usage</Text>
                  <Text style={styles.bandwidthValue}>{networkData.bandwidthUsage.total}%</Text>
                </View>
                <ProgressBar
                  progress={networkData.bandwidthUsage.total / 100}
                  color={networkData.bandwidthUsage.total > 80 ? '#ff6b6b' : '#f9ca24'}
                  style={styles.bandwidthBar}
                />
              </View>
            </Card.Content>
          </Card>

          {/* Security Events */}
          <Card style={styles.card}>
            <Card.Content>
              <Title style={styles.cardTitle}>
                <Ionicons name="shield-checkmark" size={20} color="#00f5ff" /> Security Events
              </Title>
              
              {networkData.securityEvents.map((event) => (
                <View key={event.id} style={styles.eventItem}>
                  <View style={styles.eventHeader}>
                    <View style={styles.eventInfo}>
                      <Text style={styles.eventTime}>{event.time}</Text>
                      <Text style={styles.eventType}>{event.type}</Text>
                    </View>
                    <View style={[styles.severityBadge, { backgroundColor: getSeverityColor(event.severity) }]}>
                      <Text style={styles.severityText}>{event.severity.toUpperCase()}</Text>
                    </View>
                  </View>
                  
                  <Text style={styles.eventSource}>Source: {event.source}</Text>
                  
                  <View style={styles.eventFooter}>
                    <Chip 
                      mode="outlined"
                      compact
                      style={[styles.statusChip, { borderColor: getStatusColor(event.status) }]}
                      textStyle={[styles.statusText, { color: getStatusColor(event.status) }]}
                    >
                      {event.status}
                    </Chip>
                    
                    {event.severity !== 'low' && (
                      <TouchableOpacity
                        onPress={() => blockIP(event.source)}
                        style={styles.blockButton}
                      >
                        <Ionicons name="ban" size={16} color="#ff6b6b" />
                        <Text style={styles.blockText}>Block</Text>
                      </TouchableOpacity>
                    )}
                  </View>
                </View>
              ))}
            </Card.Content>
          </Card>

          {/* Active Connections */}
          <Card style={styles.card}>
            <Card.Content>
              <Title style={styles.cardTitle}>
                <Ionicons name="globe" size={20} color="#00f5ff" /> Active Connections
              </Title>
              
              {networkData.activeConnections.map((connection, index) => (
                <View key={index} style={styles.connectionItem}>
                  <View style={styles.connectionHeader}>
                    <Text style={styles.connectionIP}>{connection.ip}:{connection.port}</Text>
                    <Text style={styles.connectionCountry}>{connection.country}</Text>
                  </View>
                  
                  <View style={styles.connectionDetails}>
                    <Chip 
                      compact
                      style={styles.protocolChip}
                      textStyle={styles.protocolText}
                    >
                      {connection.protocol}
                    </Chip>
                    
                    <View style={[
                      styles.statusDot,
                      { backgroundColor: connection.status === 'established' ? '#4ecdc4' : '#f9ca24' }
                    ]} />
                    
                    <Text style={styles.connectionStatus}>{connection.status}</Text>
                  </View>
                </View>
              ))}
            </Card.Content>
          </Card>

          {/* Protocol Distribution */}
          <Card style={styles.chartCard}>
            <Card.Content>
              <Title style={styles.cardTitle}>
                <Ionicons name="bar-chart" size={20} color="#00f5ff" /> Protocol Distribution
              </Title>
              <BarChart
                data={networkData.protocolDistribution}
                width={screenWidth - 60}
                height={200}
                chartConfig={chartConfig}
                style={styles.chart}
                showValuesOnTopOfBars
              />
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
  scanButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 245, 255, 0.2)',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#00f5ff',
  },
  scanText: {
    color: '#ffffff',
    marginLeft: 6,
    fontSize: 14,
    fontWeight: '600',
  },
  interfaceContainer: {
    marginBottom: 20,
  },
  interfaceChip: {
    marginRight: 8,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
  },
  selectedInterfaceChip: {
    backgroundColor: '#00f5ff',
  },
  chipText: {
    color: 'rgba(255, 255, 255, 0.7)',
    fontSize: 12,
  },
  selectedChipText: {
    color: '#000000',
    fontWeight: '600',
  },
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    marginBottom: 20,
  },
  statCard: {
    width: '48%',
    padding: 12,
    borderRadius: 12,
    marginBottom: 10,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  statValue: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#ffffff',
    marginVertical: 4,
  },
  statLabel: {
    fontSize: 10,
    color: 'rgba(255, 255, 255, 0.7)',
    textAlign: 'center',
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
  cardTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#ffffff',
    marginBottom: 16,
  },
  chart: {
    borderRadius: 8,
  },
  bandwidthItem: {
    marginBottom: 16,
  },
  bandwidthHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  bandwidthLabel: {
    fontSize: 14,
    color: 'rgba(255, 255, 255, 0.8)',
    fontWeight: '500',
  },
  bandwidthValue: {
    fontSize: 14,
    color: '#ffffff',
    fontWeight: '600',
  },
  bandwidthBar: {
    height: 8,
    borderRadius: 4,
  },
  eventItem: {
    marginBottom: 16,
    padding: 12,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderRadius: 8,
    borderLeftWidth: 4,
    borderLeftColor: '#ff6b6b',
  },
  eventHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  eventInfo: {
    flex: 1,
  },
  eventTime: {
    fontSize: 12,
    color: 'rgba(255, 255, 255, 0.6)',
  },
  eventType: {
    fontSize: 14,
    fontWeight: '600',
    color: '#ffffff',
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
  eventSource: {
    fontSize: 12,
    color: 'rgba(255, 255, 255, 0.8)',
    marginBottom: 8,
  },
  eventFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  statusChip: {
    backgroundColor: 'transparent',
  },
  statusText: {
    fontSize: 10,
  },
  blockButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 107, 107, 0.2)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  blockText: {
    color: '#ff6b6b',
    marginLeft: 4,
    fontSize: 12,
    fontWeight: '600',
  },
  connectionItem: {
    marginBottom: 12,
    padding: 10,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderRadius: 8,
  },
  connectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  connectionIP: {
    fontSize: 14,
    fontWeight: '600',
    color: '#ffffff',
  },
  connectionCountry: {
    fontSize: 12,
    color: 'rgba(255, 255, 255, 0.6)',
  },
  connectionDetails: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  protocolChip: {
    backgroundColor: 'rgba(0, 245, 255, 0.2)',
    marginRight: 10,
  },
  protocolText: {
    fontSize: 10,
    color: '#00f5ff',
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: 6,
  },
  connectionStatus: {
    fontSize: 12,
    color: 'rgba(255, 255, 255, 0.8)',
  },
  bottomSpacing: {
    height: 20,
  },
});