/** Common screen scaffold: dark background, safe-area top inset, scroll body
 *  with bottom padding clear of the floating tab bar. */
import React from 'react';
import { View, ScrollView, StyleSheet, RefreshControl } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors } from '../theme';

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

  if (!scroll) {
    return <View style={[styles.root, { paddingTop: top }]}>{children}</View>;
  }

  return (
    <View style={[styles.root, { paddingTop: top }]}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.content}
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
  content: { paddingBottom: 110 },
});
