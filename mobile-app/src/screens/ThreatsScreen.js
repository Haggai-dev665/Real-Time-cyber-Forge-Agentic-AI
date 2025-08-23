import React, { useEffect, useState } from 'react';
import {
  View,
  ScrollView,
  StyleSheet,
  RefreshControl,
  Alert,
} from 'react-native';
import {
  Card,
  Title,
  Text,
  Button,
  Chip,
  Surface,
  useTheme,
} from 'react-native-paper';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';

import { useDesktopConnection } from '../services/DesktopConnection';
import { gradientColors, riskColors } from '../theme';

export default function ThreatsScreen() {
  const theme = useTheme();
  const { isConnected, desktopData, requestDesktopData, sendToDesktop } = useDesktopConnection();
  const [refreshing, setRefreshing] = useState(false);
  const [threats, setThreats] = useState([]);
  const [scanning, setScanning] = useState(false);

  useEffect(() => {
    if (isConnected) {
      requestDesktopData('threats');
    }
  }, [isConnected]);

  useEffect(() => {
    if (desktopData?.threats) {
      setThreats(desktopData.threats);
    }
  }, [desktopData]);

  const onRefresh = async () => {
    setRefreshing(true);
    if (isConnected) {
      requestDesktopData('threats');
    }
    setTimeout(() => setRefreshing(false), 1000);
  };

  const scanForThreats = async () => {
    if (!isConnected) {
      Alert.alert('Not Connected', 'Please connect to the desktop app first.');
      return;
    }

    setScanning(true);
    sendToDesktop({
      type: 'scan_threats',
      timestamp: new Date().toISOString()
    });

    // Simulate scan time
    setTimeout(() => {
      setScanning(false);
      requestDesktopData('threats');
    }, 3000);
  };

  const getSeverityIcon = (severity) => {
    switch (severity.toLowerCase()) {
      case 'high': return 'alert-circle';
      case 'medium': return 'warning';
      case 'low': return 'information-circle';
      default: return 'help-circle';
    }
  };

  const getSeverityColor = (severity) => {
    switch (severity.toLowerCase()) {
      case 'high': return riskColors.high;
      case 'medium': return riskColors.medium;
      case 'low': return riskColors.low;
      default: return '#ffffff';
    }
  };

  const formatTimestamp = (timestamp) => {
    return new Date(timestamp).toLocaleString();
  };

  const dismissThreat = (threatId) => {
    Alert.alert(
      'Dismiss Threat',
      'Are you sure you want to dismiss this threat?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Dismiss',
          onPress: () => {
            sendToDesktop({
              type: 'dismiss_threat',
              threat_id: threatId
            });
            setThreats(threats.filter(threat => threat.id !== threatId));
          }
        }
      ]
    );
  };

  return (
    <LinearGradient colors={gradientColors} style={styles.container}>
      <ScrollView
        style={styles.scrollView}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
      >
        {/* Threat Overview */}
        <Card style={styles.overviewCard}>
          <Card.Content>
            <Title style={styles.sectionTitle}>Threat Overview</Title>
            <View style={styles.overviewGrid}>
              <Surface style={styles.overviewItem}>
                <Ionicons name="shield-checkmark" size={24} color={riskColors.low} />
                <Text style={styles.overviewValue}>
                  {threats.filter(t => t.severity === 'low').length}
                </Text>
                <Text style={styles.overviewLabel}>Low Risk</Text>
              </Surface>
              
              <Surface style={styles.overviewItem}>
                <Ionicons name="warning" size={24} color={riskColors.medium} />
                <Text style={styles.overviewValue}>
                  {threats.filter(t => t.severity === 'medium').length}
                </Text>
                <Text style={styles.overviewLabel}>Medium Risk</Text>
              </Surface>
              
              <Surface style={styles.overviewItem}>
                <Ionicons name="alert-circle" size={24} color={riskColors.high} />
                <Text style={styles.overviewValue}>
                  {threats.filter(t => t.severity === 'high').length}
                </Text>
                <Text style={styles.overviewLabel}>High Risk</Text>
              </Surface>
            </View>
            
            <Button
              mode="contained"
              onPress={scanForThreats}
              loading={scanning}
              disabled={!isConnected || scanning}
              icon="shield-search"
              style={styles.scanButton}
            >
              {scanning ? 'Scanning...' : 'Scan for Threats'}
            </Button>
          </Card.Content>
        </Card>

        {/* Threats List */}
        <Card style={styles.threatsCard}>
          <Card.Content>
            <Title style={styles.sectionTitle}>Active Threats</Title>
            {threats.length > 0 ? (
              threats.map((threat, index) => (
                <Surface key={threat.id || index} style={styles.threatItem}>
                  <View style={styles.threatHeader}>
                    <View style={styles.threatInfo}>
                      <Ionicons
                        name={getSeverityIcon(threat.severity)}
                        size={20}
                        color={getSeverityColor(threat.severity)}
                      />
                      <Text style={styles.threatTitle}>{threat.type}</Text>
                    </View>
                    <Chip
                      mode="outlined"
                      style={[
                        styles.severityChip,
                        { borderColor: getSeverityColor(threat.severity) }
                      ]}
                      textStyle={{ color: getSeverityColor(threat.severity) }}
                    >
                      {threat.severity.toUpperCase()}
                    </Chip>
                  </View>
                  
                  <Text style={styles.threatDescription}>
                    {threat.description}
                  </Text>
                  
                  {threat.url && (
                    <Text style={styles.threatUrl}>
                      Target: {threat.url}
                    </Text>
                  )}
                  
                  <View style={styles.threatFooter}>
                    <Text style={styles.threatTime}>
                      {formatTimestamp(threat.timestamp)}
                    </Text>
                    <Button
                      mode="text"
                      onPress={() => dismissThreat(threat.id)}
                      textColor={theme.colors.primary}
                    >
                      Dismiss
                    </Button>
                  </View>
                </Surface>
              ))
            ) : (
              <View style={styles.noThreatsContainer}>
                <Ionicons name="shield-checkmark" size={48} color={riskColors.low} />
                <Text style={styles.noThreatsText}>
                  {isConnected ? 'No active threats detected' : 'Connect to desktop to monitor threats'}
                </Text>
                {isConnected && (
                  <Text style={styles.noThreatsSubtext}>
                    Your browsing appears to be secure. Run a scan to check for new threats.
                  </Text>
                )}
              </View>
            )}
          </Card.Content>
        </Card>

        {/* Security Recommendations */}
        <Card style={styles.recommendationsCard}>
          <Card.Content>
            <Title style={styles.sectionTitle}>Security Recommendations</Title>
            <View style={styles.recommendationsList}>
              <Surface style={styles.recommendationItem}>
                <Ionicons name="shield-checkmark" size={20} color={theme.colors.primary} />
                <Text style={styles.recommendationText}>
                  Keep your browser updated to the latest version
                </Text>
              </Surface>
              
              <Surface style={styles.recommendationItem}>
                <Ionicons name="lock-closed" size={20} color={theme.colors.primary} />
                <Text style={styles.recommendationText}>
                  Always verify SSL certificates for sensitive sites
                </Text>
              </Surface>
              
              <Surface style={styles.recommendationItem}>
                <Ionicons name="eye-off" size={20} color={theme.colors.primary} />
                <Text style={styles.recommendationText}>
                  Use private browsing for sensitive activities
                </Text>
              </Surface>
              
              <Surface style={styles.recommendationItem}>
                <Ionicons name="warning" size={20} color={theme.colors.primary} />
                <Text style={styles.recommendationText}>
                  Be cautious with downloads from unknown sources
                </Text>
              </Surface>
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
  overviewCard: {
    marginBottom: 16,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
  },
  sectionTitle: {
    color: '#ffffff',
    marginBottom: 16,
  },
  overviewGrid: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginBottom: 16,
  },
  overviewItem: {
    padding: 12,
    borderRadius: 8,
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    minWidth: 80,
  },
  overviewValue: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#ffffff',
    marginTop: 4,
  },
  overviewLabel: {
    fontSize: 12,
    color: 'rgba(255, 255, 255, 0.7)',
    marginTop: 2,
  },
  scanButton: {
    marginTop: 8,
  },
  threatsCard: {
    marginBottom: 16,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
  },
  threatItem: {
    padding: 16,
    borderRadius: 8,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    marginBottom: 12,
  },
  threatHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  threatInfo: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  threatTitle: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '500',
    marginLeft: 8,
  },
  severityChip: {
    height: 28,
  },
  threatDescription: {
    color: 'rgba(255, 255, 255, 0.8)',
    fontSize: 14,
    marginBottom: 8,
    lineHeight: 20,
  },
  threatUrl: {
    color: 'rgba(255, 255, 255, 0.6)',
    fontSize: 12,
    fontFamily: 'monospace',
    marginBottom: 8,
  },
  threatFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  threatTime: {
    color: 'rgba(255, 255, 255, 0.6)',
    fontSize: 12,
  },
  noThreatsContainer: {
    alignItems: 'center',
    padding: 32,
  },
  noThreatsText: {
    color: '#ffffff',
    fontSize: 16,
    textAlign: 'center',
    marginTop: 16,
  },
  noThreatsSubtext: {
    color: 'rgba(255, 255, 255, 0.7)',
    fontSize: 14,
    textAlign: 'center',
    marginTop: 8,
  },
  recommendationsCard: {
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
  },
  recommendationsList: {
    gap: 12,
  },
  recommendationItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderRadius: 8,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
  },
  recommendationText: {
    color: '#ffffff',
    fontSize: 14,
    marginLeft: 12,
    flex: 1,
  },
});