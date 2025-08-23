import React, { useState } from 'react';
import {
  View,
  ScrollView,
  StyleSheet,
  Alert,
} from 'react-native';
import {
  Card,
  Title,
  Text,
  TextInput,
  Button,
  Switch,
  Surface,
  useTheme,
} from 'react-native-paper';
import { LinearGradient } from 'expo-linear-gradient';

import { useDesktopConnection } from '../services/DesktopConnection';
import { gradientColors } from '../theme';

export default function SettingsScreen() {
  const theme = useTheme();
  const { isConnected, connectToDesktop, disconnect } = useDesktopConnection();
  const [desktopUrl, setDesktopUrl] = useState('192.168.1.100:8000');
  const [settings, setSettings] = useState({
    threatAlerts: true,
    aiInsights: true,
    autoSync: true,
    notifications: true,
    secureMode: false,
  });

  const handleSettingChange = (setting, value) => {
    setSettings(prev => ({
      ...prev,
      [setting]: value
    }));
  };

  const handleConnect = () => {
    if (!desktopUrl.trim()) {
      Alert.alert('Error', 'Please enter a valid desktop URL');
      return;
    }
    
    const url = desktopUrl.startsWith('ws://') ? desktopUrl : `ws://${desktopUrl}`;
    connectToDesktop(url);
  };

  const handleDisconnect = () => {
    Alert.alert(
      'Disconnect',
      'Are you sure you want to disconnect from the desktop app?',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Disconnect', onPress: disconnect }
      ]
    );
  };

  const testConnection = () => {
    Alert.alert(
      'Connection Test',
      isConnected ? 'Connected successfully!' : 'Not connected to desktop app',
      [{ text: 'OK' }]
    );
  };

  return (
    <LinearGradient colors={gradientColors} style={styles.container}>
      <ScrollView style={styles.scrollView}>
        {/* Connection Settings */}
        <Card style={styles.card}>
          <Card.Content>
            <Title style={styles.sectionTitle}>Desktop Connection</Title>
            
            <TextInput
              label="Desktop IP Address"
              value={desktopUrl}
              onChangeText={setDesktopUrl}
              mode="outlined"
              style={styles.input}
              placeholder="192.168.1.100:8000"
              theme={{
                colors: {
                  primary: theme.colors.primary,
                  text: theme.colors.text,
                  placeholder: theme.colors.placeholder,
                }
              }}
            />
            
            <View style={styles.connectionButtons}>
              <Button
                mode="contained"
                onPress={handleConnect}
                disabled={isConnected}
                style={[styles.button, { flex: 1, marginRight: 8 }]}
              >
                {isConnected ? 'Connected' : 'Connect'}
              </Button>
              
              <Button
                mode="outlined"
                onPress={handleDisconnect}
                disabled={!isConnected}
                style={[styles.button, { flex: 1, marginLeft: 8 }]}
              >
                Disconnect
              </Button>
            </View>
            
            <Button
              mode="text"
              onPress={testConnection}
              style={styles.testButton}
            >
              Test Connection
            </Button>
          </Card.Content>
        </Card>

        {/* Notification Settings */}
        <Card style={styles.card}>
          <Card.Content>
            <Title style={styles.sectionTitle}>Notifications</Title>
            
            <Surface style={styles.settingItem}>
              <View style={styles.settingInfo}>
                <Text style={styles.settingTitle}>Threat Alerts</Text>
                <Text style={styles.settingDescription}>
                  Receive notifications for security threats
                </Text>
              </View>
              <Switch
                value={settings.threatAlerts}
                onValueChange={(value) => handleSettingChange('threatAlerts', value)}
                color={theme.colors.primary}
              />
            </Surface>
            
            <Surface style={styles.settingItem}>
              <View style={styles.settingInfo}>
                <Text style={styles.settingTitle}>AI Insights</Text>
                <Text style={styles.settingDescription}>
                  Get AI-powered security recommendations
                </Text>
              </View>
              <Switch
                value={settings.aiInsights}
                onValueChange={(value) => handleSettingChange('aiInsights', value)}
                color={theme.colors.primary}
              />
            </Surface>
            
            <Surface style={styles.settingItem}>
              <View style={styles.settingInfo}>
                <Text style={styles.settingTitle}>Push Notifications</Text>
                <Text style={styles.settingDescription}>
                  Enable mobile push notifications
                </Text>
              </View>
              <Switch
                value={settings.notifications}
                onValueChange={(value) => handleSettingChange('notifications', value)}
                color={theme.colors.primary}
              />
            </Surface>
          </Card.Content>
        </Card>

        {/* Sync Settings */}
        <Card style={styles.card}>
          <Card.Content>
            <Title style={styles.sectionTitle}>Synchronization</Title>
            
            <Surface style={styles.settingItem}>
              <View style={styles.settingInfo}>
                <Text style={styles.settingTitle}>Auto Sync</Text>
                <Text style={styles.settingDescription}>
                  Automatically sync data with desktop app
                </Text>
              </View>
              <Switch
                value={settings.autoSync}
                onValueChange={(value) => handleSettingChange('autoSync', value)}
                color={theme.colors.primary}
              />
            </Surface>
          </Card.Content>
        </Card>

        {/* Security Settings */}
        <Card style={styles.card}>
          <Card.Content>
            <Title style={styles.sectionTitle}>Security</Title>
            
            <Surface style={styles.settingItem}>
              <View style={styles.settingInfo}>
                <Text style={styles.settingTitle}>Secure Mode</Text>
                <Text style={styles.settingDescription}>
                  Enhanced security with encrypted communication
                </Text>
              </View>
              <Switch
                value={settings.secureMode}
                onValueChange={(value) => handleSettingChange('secureMode', value)}
                color={theme.colors.primary}
              />
            </Surface>
            
            <Button
              mode="outlined"
              onPress={() => Alert.alert('Clear Data', 'All cached data will be cleared')}
              style={styles.clearButton}
            >
              Clear Cached Data
            </Button>
          </Card.Content>
        </Card>

        {/* App Information */}
        <Card style={styles.card}>
          <Card.Content>
            <Title style={styles.sectionTitle}>About</Title>
            
            <View style={styles.infoGrid}>
              <Surface style={styles.infoItem}>
                <Text style={styles.infoLabel}>Version</Text>
                <Text style={styles.infoValue}>1.0.0</Text>
              </Surface>
              
              <Surface style={styles.infoItem}>
                <Text style={styles.infoLabel}>Build</Text>
                <Text style={styles.infoValue}>2024.01</Text>
              </Surface>
              
              <Surface style={styles.infoItem}>
                <Text style={styles.infoLabel}>Platform</Text>
                <Text style={styles.infoValue}>React Native</Text>
              </Surface>
              
              <Surface style={styles.infoItem}>
                <Text style={styles.infoLabel}>License</Text>
                <Text style={styles.infoValue}>MIT</Text>
              </Surface>
            </View>
            
            <Button
              mode="text"
              onPress={() => Alert.alert('Privacy Policy', 'Privacy policy content would be displayed here')}
              style={styles.linkButton}
            >
              Privacy Policy
            </Button>
            
            <Button
              mode="text"
              onPress={() => Alert.alert('Terms of Service', 'Terms of service content would be displayed here')}
              style={styles.linkButton}
            >
              Terms of Service
            </Button>
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
  card: {
    marginBottom: 16,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
  },
  sectionTitle: {
    color: '#ffffff',
    marginBottom: 16,
  },
  input: {
    marginBottom: 16,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
  },
  connectionButtons: {
    flexDirection: 'row',
    marginBottom: 8,
  },
  button: {
    marginVertical: 4,
  },
  testButton: {
    marginTop: 8,
  },
  settingItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    marginBottom: 8,
    borderRadius: 8,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
  },
  settingInfo: {
    flex: 1,
    marginRight: 16,
  },
  settingTitle: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '500',
    marginBottom: 4,
  },
  settingDescription: {
    color: 'rgba(255, 255, 255, 0.7)',
    fontSize: 14,
  },
  clearButton: {
    marginTop: 16,
  },
  infoGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  infoItem: {
    width: '48%',
    padding: 12,
    borderRadius: 8,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    marginBottom: 8,
  },
  infoLabel: {
    color: 'rgba(255, 255, 255, 0.7)',
    fontSize: 12,
    marginBottom: 4,
  },
  infoValue: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '500',
  },
  linkButton: {
    marginVertical: 4,
  },
});