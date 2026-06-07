/**
 * AI assistant — a real chat against POST /api/cyberforge-ml/v2/security-chat
 * (DeepSeek via HF, with the backend's KB fallback). Streams a Q&A thread.
 */
import React, { useState, useRef } from 'react';
import { View, Text, TextInput, Pressable, StyleSheet, ActivityIndicator } from 'react-native';

import { colors, fonts, tint } from '../theme';
import { Card, SecLabel } from '../components/ui';
import { Icon } from '../components/Icon';
import { endpoints } from '../api/endpoints';

interface Msg {
  role: 'user' | 'assistant';
  text: string;
  fallback?: boolean;
}

const SUGGESTIONS = [
  'What changed in my security posture today?',
  'Explain how RedLine Stealer works',
  'How do I respond to a credential theft alert?',
];

export function AssistantSection() {
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState('');
  const [busy, setBusy] = useState(false);
  const idRef = useRef(0);

  const send = async (text: string) => {
    const q = text.trim();
    if (!q || busy) return;
    setInput('');
    setMessages((m) => [...m, { role: 'user', text: q }]);
    setBusy(true);
    try {
      const res = await endpoints.securityChat(q);
      const answer = res.response || res.answer || 'No response returned.';
      setMessages((m) => [...m, { role: 'assistant', text: answer, fallback: res.fallback }]);
    } catch (e) {
      setMessages((m) => [
        ...m,
        { role: 'assistant', text: e instanceof Error ? `Couldn't reach the assistant: ${e.message}` : 'Request failed.' },
      ]);
    } finally {
      setBusy(false);
      idRef.current += 1;
    }
  };

  return (
    <>
      <Card style={styles.intro}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 4 }}>
          <Icon name="spark" size={18} color={colors.orange} />
          <Text style={styles.introTitle}>Ask CyberForge</Text>
        </View>
        <Text style={styles.introText}>
          Grounded cybersecurity Q&A powered by the backend's security-chat model.
        </Text>
      </Card>

      {messages.length === 0 ? (
        <>
          <SecLabel>Suggested</SecLabel>
          <Card style={{ overflow: 'hidden' }}>
            {SUGGESTIONS.map((q, i) => (
              <Pressable key={q} style={[styles.suggest, i > 0 && styles.border]} onPress={() => send(q)}>
                <Icon name="spark" size={15} color={colors.orange} />
                <Text style={styles.suggestText}>{q}</Text>
                <Icon name="chevR" size={15} color={colors.faint} />
              </Pressable>
            ))}
          </Card>
        </>
      ) : (
        <View style={{ marginTop: 16, gap: 10 }}>
          {messages.map((m, i) => (
            <View
              key={i}
              style={[
                styles.bubble,
                m.role === 'user' ? styles.userBubble : styles.botBubble,
              ]}
            >
              {m.role === 'assistant' && m.fallback ? (
                <Text style={styles.kbTag}>KNOWLEDGE BASE</Text>
              ) : null}
              <Text style={[styles.bubbleText, m.role === 'user' && { color: colors.text }]}>{m.text}</Text>
            </View>
          ))}
          {busy ? (
            <View style={[styles.bubble, styles.botBubble, { flexDirection: 'row', gap: 8, alignItems: 'center' }]}>
              <ActivityIndicator size="small" color={colors.amber2} />
              <Text style={styles.bubbleText}>Thinking…</Text>
            </View>
          ) : null}
        </View>
      )}

      <View style={styles.inputRow}>
        <TextInput
          style={styles.input}
          placeholder="Ask a security question…"
          placeholderTextColor={colors.faint}
          value={input}
          onChangeText={setInput}
          onSubmitEditing={() => send(input)}
          returnKeyType="send"
          editable={!busy}
        />
        <Pressable style={styles.sendBtn} onPress={() => send(input)} disabled={busy}>
          <Icon name="bolt" size={18} color="#1a1206" />
        </Pressable>
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  intro: { padding: 16 },
  introTitle: { fontFamily: fonts.sansSemiBold, fontSize: 14, color: colors.text },
  introText: { fontFamily: fonts.sans, fontSize: 13, color: colors.dim, lineHeight: 19, marginTop: 6 },
  suggest: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 13 },
  border: { borderTopWidth: 1, borderTopColor: colors.line },
  suggestText: { flex: 1, fontFamily: fonts.sans, fontSize: 13, color: colors.text },
  bubble: { padding: 13, borderRadius: 14, maxWidth: '92%' },
  userBubble: { alignSelf: 'flex-end', backgroundColor: colors.surface2, borderWidth: 1, borderColor: colors.line2 },
  botBubble: { alignSelf: 'flex-start', backgroundColor: colors.amberDim, borderWidth: 1, borderColor: tint(colors.amber, 0.25) },
  kbTag: { fontFamily: fonts.mono, fontSize: 8.5, color: colors.amber2, letterSpacing: 1, marginBottom: 5 },
  bubbleText: { fontFamily: fonts.sans, fontSize: 13.5, color: colors.text, lineHeight: 20 },
  inputRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 18 },
  input: {
    flex: 1,
    height: 48,
    paddingHorizontal: 14,
    backgroundColor: colors.tile,
    borderWidth: 1,
    borderColor: colors.line2,
    borderRadius: 13,
    color: colors.text,
    fontFamily: fonts.sans,
    fontSize: 14,
  },
  sendBtn: { width: 48, height: 48, borderRadius: 13, backgroundColor: colors.amber2, alignItems: 'center', justifyContent: 'center' },
});
