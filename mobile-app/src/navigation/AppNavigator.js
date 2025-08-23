import React from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from 'react-native-paper';
import { View, Text } from 'react-native';

import DashboardScreen from '../screens/DashboardScreen';
import AnalysisScreen from '../screens/AnalysisScreen';
import ThreatsScreen from '../screens/ThreatsScreen';
import MLDashboardScreen from '../screens/MLDashboardScreen';
import RealTimeAnalyticsScreen from '../screens/RealTimeAnalyticsScreen';
import SettingsScreen from '../screens/SettingsScreen';

const Tab = createBottomTabNavigator();

export default function AppNavigator() {
  const theme = useTheme();

  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        tabBarIcon: ({ focused, color, size }) => {
          let iconName;

          if (route.name === 'Dashboard') {
            iconName = focused ? 'speedometer' : 'speedometer-outline';
          } else if (route.name === 'Analysis') {
            iconName = focused ? 'analytics' : 'analytics-outline';
          } else if (route.name === 'MLDashboard') {
            iconName = focused ? 'brain' : 'brain';
          } else if (route.name === 'RealTimeAnalytics') {
            iconName = focused ? 'pulse' : 'pulse-outline';
          } else if (route.name === 'Threats') {
            iconName = focused ? 'warning' : 'warning-outline';
          } else if (route.name === 'Settings') {
            iconName = focused ? 'settings' : 'settings-outline';
          }

          // Add "NEW" badge for new screens
          const isNewScreen = route.name === 'MLDashboard' || route.name === 'RealTimeAnalytics';
          
          return (
            <View style={{ alignItems: 'center', position: 'relative' }}>
              <Ionicons name={iconName} size={size} color={color} />
              {isNewScreen && (
                <View style={{
                  position: 'absolute',
                  top: -5,
                  right: -8,
                  backgroundColor: '#00f5ff',
                  borderRadius: 8,
                  paddingHorizontal: 4,
                  paddingVertical: 1,
                }}>
                  <Text style={{ fontSize: 8, color: '#000', fontWeight: 'bold' }}>NEW</Text>
                </View>
              )}
            </View>
          );
        },
        tabBarActiveTintColor: theme.colors.primary,
        tabBarInactiveTintColor: theme.colors.placeholder,
        tabBarStyle: {
          backgroundColor: theme.colors.surface,
          borderTopColor: 'rgba(255, 255, 255, 0.1)',
          height: 65,
          paddingBottom: 8,
          paddingTop: 8,
        },
        tabBarLabelStyle: {
          fontSize: 11,
          fontWeight: '600',
        },
        headerStyle: {
          backgroundColor: theme.colors.background,
        },
        headerTintColor: theme.colors.text,
        headerTitleStyle: {
          fontWeight: 'bold',
        },
      })}
    >
      <Tab.Screen 
        name="Dashboard" 
        component={DashboardScreen}
        options={{
          title: 'Cyber Forge AI',
          tabBarLabel: 'Dashboard',
        }}
      />
      <Tab.Screen 
        name="MLDashboard" 
        component={MLDashboardScreen}
        options={{
          title: 'ML Dashboard',
          tabBarLabel: 'ML',
        }}
      />
      <Tab.Screen 
        name="RealTimeAnalytics" 
        component={RealTimeAnalyticsScreen}
        options={{
          title: 'Real-time Analytics',
          tabBarLabel: 'Analytics',
        }}
      />
      <Tab.Screen 
        name="Analysis" 
        component={AnalysisScreen}
        options={{
          title: 'Security Analysis',
          tabBarLabel: 'Analysis',
        }}
      />
      <Tab.Screen 
        name="Threats" 
        component={ThreatsScreen}
        options={{
          title: 'Threat Monitor',
          tabBarLabel: 'Threats',
        }}
      />
      <Tab.Screen 
        name="Settings" 
        component={SettingsScreen}
        options={{
          title: 'Settings',
          tabBarLabel: 'Settings',
        }}
      />
    </Tab.Navigator>
  );
}