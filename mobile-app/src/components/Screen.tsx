/** Common screen scaffold: dark background, safe-area top inset, scroll body
 *  with bottom padding clear of the floating tab bar and the system's
 *  navigation area (src/components/layout.ts). */
import React from 'react';
import { View, ScrollView, StyleSheet, RefreshControl } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors } from '../theme';
import { useTabContentPadding } from './layout';

export function Screen({
  children,
  scroll = true,
  refreshing,
  onRefresh,
}: {
  children: React.ReactNode;
  scroll?: boolean;
  refreshing?: boolean;
  onRefresh?: () => void;
}) {
  const insets = useSafeAreaInsets();
  const top = insets.top + 6;
  const bottom = useTabContentPadding();

  if (!scroll) {
    return <View style={[styles.root, { paddingTop: top }]}>{children}</View>;
  }

  return (
    <View style={[styles.root, { paddingTop: top }]}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: bottom }}
        keyboardShouldPersistTaps="handled"
        refreshControl={
          onRefresh ? (
            <RefreshControl refreshing={!!refreshing} onRefresh={onRefresh} tintColor={colors.amber2} />
          ) : undefined
        }
      >
        {children}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
});
