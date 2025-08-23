import React from 'react';
import { StatusBar } from 'expo-status-bar';
import { Provider as PaperProvider } from 'react-native-paper';
import { NavigationContainer } from '@react-navigation/native';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { theme } from './src/theme';
import AppNavigator from './src/navigation/AppNavigator';
import { DesktopConnectionProvider } from './src/services/DesktopConnection';

export default function App() {
  return (
    <SafeAreaProvider>
      <PaperProvider theme={theme}>
        <DesktopConnectionProvider>
          <NavigationContainer>
            <AppNavigator />
            <StatusBar style="light" backgroundColor="#1e3c72" />
          </NavigationContainer>
        </DesktopConnectionProvider>
      </PaperProvider>
    </SafeAreaProvider>
  );
}