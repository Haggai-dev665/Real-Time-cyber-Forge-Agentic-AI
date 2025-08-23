/**
 * ML Dashboard Screen for Mobile App
 * Real-time machine learning model monitoring and management
 */

import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  RefreshControl,
  TouchableOpacity,
  Dimensions,
  Alert,
  StyleSheet,
  Animated,
} from 'react-native';
import { Card, Title, Button, Surface, ProgressBar } from 'react-native-paper';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { LineChart, PieChart, BarChart } from 'react-native-chart-kit';
import { useTheme } from 'react-native-paper';
import { useDesktopConnection } from '../services/DesktopConnection';

const { width: screenWidth } = Dimensions.get('window');

export default function MLDashboardScreen() {
  const theme = useTheme();
  const { isConnected, requestDesktopData, sendToDesktop } = useDesktopConnection();
  const [refreshing, setRefreshing] = useState(false);
  const [fadeAnim] = useState(new Animated.Value(0));
  const [scaleAnim] = useState(new Animated.Value(0.95));

  const [mlData, setMLData] = useState({
    activeModels: 3,
    avgAccuracy: 92.5,
    inferenceTime: 145,
    threatsDetected: 47,
    modelPerformance: {
      labels: ['9AM', '10AM', '11AM', '12PM', '1PM', '2PM'],
      datasets: [{
        data: [85, 88, 92, 89, 94, 91],
        strokeWidth: 3,
        color: (opacity = 1) => `rgba(0, 245, 255, ${opacity})`,
      }]
    },
    threatCategories: [
      { name: 'Malware', count: 20, color: '#ff6b6b' },
      { name: 'Phishing', count: 15, color: '#4ecdc4' },
      { name: 'Network', count: 8, color: '#45b7d1' },
      { name: 'Other', count: 4, color: '#f9ca24' },
    ],
    trainingQueue: [
      { id: 1, name: 'Malware Detection v2.1', progress: 0.75, status: 'training' },
      { id: 2, name: 'Phishing Classifier', progress: 0.0, status: 'queued' },
      { id: 3, name: 'Network Anomaly', progress: 1.0, status: 'completed' },
    ],
    recentPredictions: [
      { time: '14:32', type: 'Malware', result: 'Threat', confidence: 0.95, severity: 'high' },
      { time: '14:30', type: 'Phishing', result: 'Safe', confidence: 0.89, severity: 'low' },
      { time: '14:28', type: 'Network', result: 'Suspicious', confidence: 0.67, severity: 'medium' },
      { time: '14:25', type: 'Malware', result: 'Safe', confidence: 0.88, severity: 'low' },
    ]
  });

  useEffect(() => {
    // Animate screen entrance
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 800,
        useNativeDriver: true,
      }),
      Animated.spring(scaleAnim, {
        toValue: 1,
        friction: 8,
        tension: 40,
        useNativeDriver: true,
      }),
    ]).start();

    // Load ML data if connected
    if (isConnected) {
      loadMLData();
    }

    // Set up periodic updates
    const interval = setInterval(() => {
      if (isConnected) {
        updateRealTimeData();
      }
    }, 5000);

    return () => clearInterval(interval);
  }, [isConnected]);

  const loadMLData = async () => {
    try {
      await requestDesktopData('ml_dashboard');
    } catch (error) {
      console.error('Failed to load ML data:', error);
    }
  };

  const updateRealTimeData = () => {
    // Simulate real-time updates
    setMLData(prev => ({
      ...prev,
      threatsDetected: prev.threatsDetected + Math.floor(Math.random() * 3),
      inferenceTime: 140 + Math.floor(Math.random() * 20),
    }));
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await loadMLData();
    setTimeout(() => setRefreshing(false), 1000);
  };

  const triggerModelTraining = () => {
    Alert.alert(
      'Train New Model',
      'Start training a new machine learning model?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Start Training',
          onPress: () => {
            sendToDesktop({
              type: 'start_model_training',
              dataset: 'cybersecurity_combined'
            });
            Alert.alert('Success', 'Model training started!');
          }
        }
      ]
    );
  };

  const downloadDatasets = () => {
    Alert.alert(
      'Download Datasets',
      'Download new cybersecurity datasets?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Download',
          onPress: () => {
            sendToDesktop({ type: 'download_datasets' });
            Alert.alert('Success', 'Dataset download started!');
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

  const pieData = mlData.threatCategories.map(category => ({
    name: category.name,
    population: category.count,
    color: category.color,
    legendFontColor: '#ffffff',
    legendFontSize: 12,
  }));

  return (
    <LinearGradient
      colors={['#0a0a0a', '#1a1a2e', '#16213e']}
      style={styles.container}
    >
      <Animated.View 
        style={[
          styles.content,
          {
            opacity: fadeAnim,
            transform: [{ scale: scaleAnim }]
          }
        ]}
      >
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
                <Ionicons name="brain" size={24} color="#00f5ff" /> ML Dashboard
              </Title>
              <Text style={styles.subtitle}>Real-time model performance</Text>
            </View>
            {isConnected && (
              <Surface style={styles.statusIndicator}>
                <View style={[styles.statusDot, { backgroundColor: '#4ecdc4' }]} />
                <Text style={styles.statusText}>Live</Text>
              </Surface>
            )}
          </View>

          {/* Stats Grid */}
          <View style={styles.statsGrid}>
            <Animated.View style={[styles.statCard, { backgroundColor: 'rgba(255, 107, 107, 0.1)' }]}>
              <Ionicons name="layers" size={24} color="#ff6b6b" />
              <Text style={styles.statValue}>{mlData.activeModels}</Text>
              <Text style={styles.statLabel}>Active Models</Text>
              <Text style={styles.statTrend}>+12%</Text>
            </Animated.View>

            <Animated.View style={[styles.statCard, { backgroundColor: 'rgba(78, 205, 196, 0.1)' }]}>
              <Ionicons name="analytics" size={24} color="#4ecdc4" />
              <Text style={styles.statValue}>{mlData.avgAccuracy}%</Text>
              <Text style={styles.statLabel}>Avg Accuracy</Text>
              <Text style={styles.statTrend}>+5.2%</Text>
            </Animated.View>

            <Animated.View style={[styles.statCard, { backgroundColor: 'rgba(69, 183, 209, 0.1)' }]}>
              <Ionicons name="timer" size={24} color="#45b7d1" />
              <Text style={styles.statValue}>{mlData.inferenceTime}ms</Text>
              <Text style={styles.statLabel}>Inference Time</Text>
              <Text style={[styles.statTrend, { color: '#4ecdc4' }]}>-15%</Text>
            </Animated.View>

            <Animated.View style={[styles.statCard, { backgroundColor: 'rgba(249, 202, 36, 0.1)' }]}>
              <Ionicons name="shield-checkmark" size={24} color="#f9ca24" />
              <Text style={styles.statValue}>{mlData.threatsDetected}</Text>
              <Text style={styles.statLabel}>Threats Today</Text>
              <Text style={styles.statTrend}>+8</Text>
            </Animated.View>
          </View>

          {/* Model Performance Chart */}
          <Card style={styles.chartCard}>
            <Card.Content>
              <View style={styles.cardHeader}>
                <Title style={styles.cardTitle}>
                  <Ionicons name="trending-up" size={20} color="#00f5ff" /> Model Performance
                </Title>
              </View>
              <LineChart
                data={mlData.modelPerformance}
                width={screenWidth - 60}
                height={200}
                chartConfig={chartConfig}
                bezier
                style={styles.chart}
              />
            </Card.Content>
          </Card>

          {/* Threat Categories */}
          <Card style={styles.chartCard}>
            <Card.Content>
              <View style={styles.cardHeader}>
                <Title style={styles.cardTitle}>
                  <Ionicons name="pie-chart" size={20} color="#00f5ff" /> Threat Categories
                </Title>
              </View>
              <PieChart
                data={pieData}
                width={screenWidth - 60}
                height={200}
                chartConfig={chartConfig}
                accessor="population"
                backgroundColor="transparent"
                paddingLeft="15"
                style={styles.chart}
              />
            </Card.Content>
          </Card>

          {/* Training Queue */}
          <Card style={styles.card}>
            <Card.Content>
              <View style={styles.cardHeader}>
                <Title style={styles.cardTitle}>
                  <Ionicons name="list" size={20} color="#00f5ff" /> Training Queue
                </Title>
                <Button
                  mode="contained"
                  onPress={triggerModelTraining}
                  icon="plus"
                  compact
                  style={styles.actionButton}
                >
                  Train
                </Button>
              </View>
              
              {mlData.trainingQueue.map((item, index) => (
                <View key={item.id} style={styles.queueItem}>
                  <View style={styles.queueInfo}>
                    <Text style={styles.queueName}>{item.name}</Text>
                    <Text style={[styles.queueStatus, { color: getStatusColor(item.status) }]}>
                      {item.status.toUpperCase()}
                    </Text>
                  </View>
                  <View style={styles.progressContainer}>
                    <ProgressBar
                      progress={item.progress}
                      color="#00f5ff"
                      style={styles.progressBar}
                    />
                    <Text style={styles.progressText}>
                      {Math.round(item.progress * 100)}%
                    </Text>
                  </View>
                </View>
              ))}
            </Card.Content>
          </Card>

          {/* Real-time Predictions */}
          <Card style={styles.card}>
            <Card.Content>
              <View style={styles.cardHeader}>
                <Title style={styles.cardTitle}>
                  <Ionicons name="eye" size={20} color="#00f5ff" /> Real-time Predictions
                </Title>
                <Surface style={[styles.statusIndicator, { backgroundColor: 'rgba(78, 205, 196, 0.2)' }]}>
                  <View style={[styles.statusDot, { backgroundColor: '#4ecdc4' }]} />
                  <Text style={styles.statusText}>Live</Text>
                </Surface>
              </View>
              
              {mlData.recentPredictions.map((prediction, index) => (
                <View key={index} style={styles.predictionItem}>
                  <View style={styles.predictionHeader}>
                    <Text style={styles.predictionTime}>{prediction.time}</Text>
                    <View style={[styles.severityBadge, { backgroundColor: getSeverityColor(prediction.severity) }]}>
                      <Text style={styles.severityText}>{prediction.severity.toUpperCase()}</Text>
                    </View>
                  </View>
                  <Text style={styles.predictionType}>{prediction.type}</Text>
                  <Text style={styles.predictionResult}>{prediction.result}</Text>
                  <View style={styles.confidenceContainer}>
                    <Text style={styles.confidenceLabel}>Confidence:</Text>
                    <ProgressBar
                      progress={prediction.confidence}
                      color={prediction.confidence > 0.8 ? '#4ecdc4' : prediction.confidence > 0.6 ? '#f9ca24' : '#ff6b6b'}
                      style={styles.confidenceBar}
                    />
                    <Text style={styles.confidenceValue}>
                      {Math.round(prediction.confidence * 100)}%
                    </Text>
                  </View>
                </View>
              ))}
            </Card.Content>
          </Card>

          {/* Action Buttons */}
          <View style={styles.actionContainer}>
            <Button
              mode="contained"
              onPress={downloadDatasets}
              icon="download"
              style={[styles.fullButton, { backgroundColor: '#4ecdc4' }]}
              labelStyle={styles.buttonLabel}
            >
              Download Datasets
            </Button>
            
            <Button
              mode="outlined"
              onPress={() => sendToDesktop({ type: 'refresh_models' })}
              icon="refresh"
              style={styles.fullButton}
              labelStyle={styles.buttonLabel}
            >
              Refresh Models
            </Button>
          </View>

          <View style={styles.bottomSpacing} />
        </ScrollView>
      </Animated.View>
    </LinearGradient>
  );
}

const getStatusColor = (status) => {
  switch (status) {
    case 'training': return '#f9ca24';
    case 'completed': return '#4ecdc4';
    case 'queued': return '#6c757d';
    default: return '#ffffff';
  }
};

const getSeverityColor = (severity) => {
  switch (severity) {
    case 'high': return 'rgba(255, 107, 107, 0.8)';
    case 'medium': return 'rgba(249, 202, 36, 0.8)';
    case 'low': return 'rgba(78, 205, 196, 0.8)';
    default: return 'rgba(108, 117, 125, 0.8)';
  }
};

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
  statusIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    backgroundColor: 'rgba(78, 205, 196, 0.2)',
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: 6,
  },
  statusText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#ffffff',
  },
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    marginBottom: 20,
  },
  statCard: {
    width: '48%',
    padding: 16,
    borderRadius: 12,
    marginBottom: 10,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  statValue: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#ffffff',
    marginVertical: 8,
  },
  statLabel: {
    fontSize: 12,
    color: 'rgba(255, 255, 255, 0.7)',
    textAlign: 'center',
  },
  statTrend: {
    fontSize: 12,
    fontWeight: '600',
    color: '#4ecdc4',
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
  actionButton: {
    backgroundColor: '#00f5ff',
  },
  chart: {
    borderRadius: 8,
  },
  queueItem: {
    marginBottom: 16,
    padding: 12,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderRadius: 8,
  },
  queueInfo: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  queueName: {
    fontSize: 14,
    fontWeight: '600',
    color: '#ffffff',
    flex: 1,
  },
  queueStatus: {
    fontSize: 12,
    fontWeight: '600',
  },
  progressContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  progressBar: {
    flex: 1,
    height: 6,
    marginRight: 12,
  },
  progressText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#ffffff',
    minWidth: 40,
    textAlign: 'right',
  },
  predictionItem: {
    marginBottom: 16,
    padding: 12,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderRadius: 8,
    borderLeftWidth: 4,
    borderLeftColor: '#00f5ff',
  },
  predictionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  predictionTime: {
    fontSize: 12,
    color: 'rgba(255, 255, 255, 0.6)',
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
  predictionType: {
    fontSize: 14,
    fontWeight: '600',
    color: '#ffffff',
    marginBottom: 2,
  },
  predictionResult: {
    fontSize: 12,
    color: 'rgba(255, 255, 255, 0.8)',
    marginBottom: 8,
  },
  confidenceContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  confidenceLabel: {
    fontSize: 12,
    color: 'rgba(255, 255, 255, 0.7)',
    marginRight: 8,
  },
  confidenceBar: {
    flex: 1,
    height: 4,
    marginRight: 8,
  },
  confidenceValue: {
    fontSize: 12,
    fontWeight: '600',
    color: '#ffffff',
    minWidth: 35,
    textAlign: 'right',
  },
  actionContainer: {
    marginTop: 10,
  },
  fullButton: {
    marginBottom: 12,
    borderRadius: 8,
  },
  buttonLabel: {
    fontSize: 16,
    fontWeight: '600',
  },
  bottomSpacing: {
    height: 20,
  },
});