import React, { useEffect, useState } from 'react';
import {
  View,
  ScrollView,
  StyleSheet,
  RefreshControl,
} from 'react-native';
import {
  Card,
  Title,
  Text,
  List,
  Surface,
  useTheme,
} from 'react-native-paper';
import { LinearGradient } from 'expo-linear-gradient';

import { useDesktopConnection } from '../services/DesktopConnection';
import { gradientColors } from '../theme';

export default function AnalysisScreen() {
  const theme = useTheme();
  const { isConnected, desktopData, requestDesktopData } = useDesktopConnection();
  const [refreshing, setRefreshing] = useState(false);
  const [analysisData, setAnalysisData] = useState(null);

  useEffect(() => {
    if (isConnected) {
      requestDesktopData('analysis');
    }
  }, [isConnected]);

  useEffect(() => {
    if (desktopData?.analysis) {
      setAnalysisData(desktopData.analysis);
    }
  }, [desktopData]);

  const onRefresh = async () => {
    setRefreshing(true);
    if (isConnected) {
      requestDesktopData('analysis');
    }
    setTimeout(() => setRefreshing(false), 1000);
  };

  const formatUrl = (url) => {
    try {
      const urlObj = new URL(url);
      return urlObj.hostname;
    } catch {
      return url;
    }
  };

  return (
    <LinearGradient colors={gradientColors} style={styles.container}>
      <ScrollView
        style={styles.scrollView}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
      >
        {/* Analysis Summary */}
        <Card style={styles.summaryCard}>
          <Card.Content>
            <Title style={styles.sectionTitle}>Analysis Summary</Title>
            {analysisData ? (
              <View style={styles.summaryGrid}>
                <Surface style={styles.summaryItem}>
                  <Text style={styles.summaryValue}>{analysisData.totalPages || 0}</Text>
                  <Text style={styles.summaryLabel}>Total Pages</Text>
                </Surface>
                <Surface style={styles.summaryItem}>
                  <Text style={styles.summaryValue}>{analysisData.securePages || 0}</Text>
                  <Text style={styles.summaryLabel}>Secure Pages</Text>
                </Surface>
                <Surface style={styles.summaryItem}>
                  <Text style={styles.summaryValue}>{analysisData.riskyPages || 0}</Text>
                  <Text style={styles.summaryLabel}>Risky Pages</Text>
                </Surface>
                <Surface style={styles.summaryItem}>
                  <Text style={styles.summaryValue}>{analysisData.blockedPages || 0}</Text>
                  <Text style={styles.summaryLabel}>Blocked Pages</Text>
                </Surface>
              </View>
            ) : (
              <Text style={styles.noDataText}>
                {isConnected ? 'No analysis data available' : 'Connect to desktop to view analysis'}
              </Text>
            )}
          </Card.Content>
        </Card>

        {/* Recent Pages */}
        <Card style={styles.pagesCard}>
          <Card.Content>
            <Title style={styles.sectionTitle}>Recent Pages Analyzed</Title>
            {analysisData?.recentPages ? (
              analysisData.recentPages.map((page, index) => (
                <List.Item
                  key={index}
                  title={formatUrl(page.url)}
                  description={`Risk: ${page.riskLevel} • ${new Date(page.timestamp).toLocaleTimeString()}`}
                  left={(props) => (
                    <List.Icon
                      {...props}
                      icon={page.isSecure ? 'shield-check' : 'shield-alert'}
                      color={page.isSecure ? theme.colors.primary : theme.colors.error}
                    />
                  )}
                  titleStyle={styles.pageTitle}
                  descriptionStyle={styles.pageDescription}
                  style={styles.pageItem}
                />
              ))
            ) : (
              <Text style={styles.noDataText}>No recent pages to display</Text>
            )}
          </Card.Content>
        </Card>

        {/* Security Patterns */}
        <Card style={styles.patternsCard}>
          <Card.Content>
            <Title style={styles.sectionTitle}>Security Patterns</Title>
            {analysisData?.patterns ? (
              <View style={styles.patternsList}>
                {analysisData.patterns.map((pattern, index) => (
                  <Surface key={index} style={styles.patternItem}>
                    <Text style={styles.patternTitle}>{pattern.name}</Text>
                    <Text style={styles.patternDescription}>{pattern.description}</Text>
                    <Text style={[styles.patternSeverity, { color: getSeverityColor(pattern.severity) }]}>
                      {pattern.severity.toUpperCase()}
                    </Text>
                  </Surface>
                ))}
              </View>
            ) : (
              <Text style={styles.noDataText}>No security patterns detected</Text>
            )}
          </Card.Content>
        </Card>

        {/* AI Insights */}
        <Card style={styles.insightsCard}>
          <Card.Content>
            <Title style={styles.sectionTitle}>AI Security Insights</Title>
            {desktopData?.insights ? (
              desktopData.insights.slice(0, 3).map((insight, index) => (
                <Surface key={index} style={styles.insightItem}>
                  <Text style={styles.insightTitle}>{insight.title}</Text>
                  <Text style={styles.insightDescription}>{insight.description}</Text>
                  <Text style={styles.insightTime}>
                    {new Date(insight.timestamp).toLocaleString()}
                  </Text>
                </Surface>
              ))
            ) : (
              <Text style={styles.noDataText}>No AI insights available</Text>
            )}
          </Card.Content>
        </Card>
      </ScrollView>
    </LinearGradient>
  );
}

const getSeverityColor = (severity) => {
  switch (severity.toLowerCase()) {
    case 'high': return '#ff4444';
    case 'medium': return '#ffaa00';
    case 'low': return '#00ff88';
    default: return '#ffffff';
  }
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollView: {
    flex: 1,
    padding: 16,
  },
  summaryCard: {
    marginBottom: 16,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
  },
  sectionTitle: {
    color: '#ffffff',
    marginBottom: 16,
  },
  summaryGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  summaryItem: {
    width: '48%',
    padding: 12,
    borderRadius: 8,
    alignItems: 'center',
    marginBottom: 8,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
  },
  summaryValue: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#ffffff',
  },
  summaryLabel: {
    fontSize: 12,
    color: 'rgba(255, 255, 255, 0.7)',
    marginTop: 4,
  },
  pagesCard: {
    marginBottom: 16,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
  },
  pageItem: {
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    marginBottom: 8,
    borderRadius: 8,
  },
  pageTitle: {
    color: '#ffffff',
    fontSize: 14,
  },
  pageDescription: {
    color: 'rgba(255, 255, 255, 0.7)',
    fontSize: 12,
  },
  patternsCard: {
    marginBottom: 16,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
  },
  patternsList: {
    gap: 8,
  },
  patternItem: {
    padding: 12,
    borderRadius: 8,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
  },
  patternTitle: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '500',
    marginBottom: 4,
  },
  patternDescription: {
    color: 'rgba(255, 255, 255, 0.7)',
    fontSize: 14,
    marginBottom: 8,
  },
  patternSeverity: {
    fontSize: 12,
    fontWeight: 'bold',
  },
  insightsCard: {
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
  },
  insightItem: {
    padding: 12,
    borderRadius: 8,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    marginBottom: 8,
  },
  insightTitle: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '500',
    marginBottom: 4,
  },
  insightDescription: {
    color: 'rgba(255, 255, 255, 0.8)',
    fontSize: 14,
    marginBottom: 8,
  },
  insightTime: {
    color: 'rgba(255, 255, 255, 0.6)',
    fontSize: 12,
  },
  noDataText: {
    color: 'rgba(255, 255, 255, 0.6)',
    textAlign: 'center',
    fontStyle: 'italic',
    padding: 20,
  },
});