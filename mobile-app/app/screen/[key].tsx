/**
 * Explore sub-screen router. Renders the section body for /screen/<key> using
 * the shared SECTIONS catalog. Unknown keys fall back to an idle state.
 */
import React from 'react';
import { View, ScrollView, StyleSheet, KeyboardAvoidingView, Platform } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { colors } from '../../src/theme';
import { SubHeader } from '../../src/components/SubHeader';
import { EmptyState } from '../../src/components/ui';
import { SECTIONS } from '../../src/data/sections';
import { useBottomPadding } from '../../src/components/layout';
import {
  SandboxSection,
  IntelSection,
  BrowserSection,
  OrchestratorSection,
  PipelineSection,
  ModelsSection,
  TasksSection,
  MemorySection,
} from '../../src/sections/DataSections';
import { AssistantSection } from '../../src/sections/AssistantSection';
import { DevicesSection } from '../../src/sections/DevicesSection';
import { AgentsSection } from '../../src/sections/AgentsSection';
import { SettingsSection } from '../../src/sections/SettingsSection';
import { ScanSection } from '../../src/sections/ScanSection';

const BODIES: Record<string, React.ComponentType> = {
  sandbox: SandboxSection,
  intel: IntelSection,
  browser: BrowserSection,
  orchestrator: OrchestratorSection,
  pipeline: PipelineSection,
  models: ModelsSection,
  tasks: TasksSection,
  memory: MemorySection,
  assistant: AssistantSection,
  devices: DevicesSection,
  agents: AgentsSection,
  settings: SettingsSection,
  scan: ScanSection,
};

export default function SubScreen() {
  const { key } = useLocalSearchParams<{ key: string }>();
  const insets = useSafeAreaInsets();
  const section = key ? SECTIONS[key] : undefined;
  const Body = key ? BODIES[key] : undefined;
  const bottom = useBottomPadding(32);
  const scroller = React.useRef<ScrollView>(null);
  // the conversation follows the newest message
  const follow = key === 'assistant';

  return (
    <View style={[styles.root, { paddingTop: insets.top + 6 }]}>
      <SubHeader
        title={section?.title ?? 'Screen'}
        sub={section?.sub}
        live={section?.live}
      />
      {/* inputs (assistant, scan, memory search) stay above the keyboard */}
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        <ScrollView
          ref={scroller}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="interactive"
          contentContainerStyle={[styles.content, { paddingBottom: bottom }]}
          onContentSizeChange={follow ? () => scroller.current?.scrollToEnd({ animated: true }) : undefined}
        >
          {Body ? (
            <Body />
          ) : (
            <EmptyState icon="box" title="Screen unavailable" hint="This section isn't wired up yet." />
          )}
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  content: { paddingHorizontal: 18 },
});
