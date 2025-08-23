import React from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from 'react-native-paper';

import DashboardScreen from '../screens/DashboardScreen';
import AnalysisScreen from '../screens/AnalysisScreen';
import ThreatsScreen from '../screens/ThreatsScreen';
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
          } else if (route.name === 'Threats') {
            iconName = focused ? 'warning' : 'warning-outline';
          } else if (route.name === 'Settings') {
            iconName = focused ? 'settings' : 'settings-outline';
          }

          return <Ionicons name={iconName} size={size} color={color} />;
        },
        tabBarActiveTintColor: theme.colors.primary,
        tabBarInactiveTintColor: theme.colors.placeholder,
        tabBarStyle: {
          backgroundColor: theme.colors.surface,
          borderTopColor: 'rgba(255, 255, 255, 0.1)',
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
        }}
      />
      <Tab.Screen 
        name="Analysis" 
        component={AnalysisScreen}
        options={{
          title: 'Security Analysis',
        }}
      />
      <Tab.Screen 
        name="Threats" 
        component={ThreatsScreen}
        options={{
          title: 'Threat Monitor',
        }}
      />
      <Tab.Screen 
        name="Settings" 
        component={SettingsScreen}
        options={{
          title: 'Settings',
        }}
      />
    </Tab.Navigator>
  );
}