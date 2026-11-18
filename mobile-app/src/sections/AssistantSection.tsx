/**
 * AI assistant — a conversation with the CyberForge assistant.
 *
 * - Answers stream as they are written (POST …/security-chat/stream): the
 *   model's reasoning shows in a "Thinking" panel, then the answer appears.
 *   A backend without the stream route is asked through the plain chat route.
 * - The earlier turns go with each question, so follow-ups are understood.
 * - Answers are formatted (headings, lists, bold) by src/components/Markdown.
 * - The conversation is kept for the signed-in account on this phone and
 *   removed at sign-out; "New chat" starts again.
 *
 * Sends a question only while "Assistant (language model)" is on in
 * Settings › Privacy (SEC-07); otherwise it says so and sends nothing.
 */
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { View, Text, TextInput, Pressable, StyleSheet, ActivityIndicator } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';

import { colors, fonts, tint } from '../theme';
import { Card, SecLabel } from '../components/ui';
import { Icon } from '../components/Icon';
import { Markdown } from '../components/Markdown';
import { endpoints } from '../api/endpoints';
import { openChatStream, type ChatTurn } from '../api/sse';
import { readJson, writeJson, removeKey } from '../api/userStore';
import { usePrivacy } from '../context/PrivacyContext';
import { useAuth } from '../context/AuthContext';
import type { AnswerReference } from '../api/types';

interface Msg {
  role: 'user' | 'assistant';
  text: string;
  thinking?: string;
  thinkingMs?: number | null;
  references?: AnswerReference[];
  failed?: boolean;
  at: number;
}

const STORE = 'assistant_chat';
const MAX_KEPT = 40;
const HISTORY_TURNS = 6;

const SUGGESTIONS = [
  'What should I do if I clicked a phishing link?',
  'How do I know if my phone has malware?',
  'Explain how ransomware spreads and how to stop it',
];

export function AssistantSection() {
  const params = useLocalSearchParams<{ q?: string }>();
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState(typeof params.q === 'string' ? params.q : '');
  const [busy, setBusy] = useState(false);
  const [live, setLive] = useState<{ thinking: string; answer: string; started: number } | null>(null);
  const [openThought, setOpenThought] = useState<number | null>(null);
  const stopRef = useRef<(() => void) | null>(null);
  const privacy = usePrivacy();
  const { token, user, isGuest } = useAuth();
  const userId = isGuest ? null : user?.id ?? null;
  const router = useRouter();
  const allowed = privacy.allows('llm_processing');

  // the account's saved conversation
  useEffect(() => {
    let cancelled = false;
    void readJson<Msg[]>(userId, STORE).then((saved) => {
      if (!cancelled && Array.isArray(saved)) setMessages(saved);
    });
    return () => {
      cancelled = true;
    };
  }, [userId]);

  useEffect(() => () => stopRef.current?.(), []);

  const save = useCallback((next: Msg[]) => void writeJson(userId, STORE, next.slice(-MAX_KEPT)), [userId]);

  const send = async (text: string) => {
    const q = text.trim();
    if (!q || busy) return;
    if (!privacy.allowsNow('llm_processing')) return;
    setInput('');
    const asked: Msg = { role: 'user', text: q, at: Date.now() };
    const before = messages;
    const withQuestion = [...before, asked];
    setMessages(withQuestion);
    setBusy(true);
    const history: ChatTurn[] = before
      .filter((m) => !m.failed)
      .slice(-HISTORY_TURNS)
      .map((m) => ({ role: m.role, content: m.text.slice(0, 1500) }));

    const finish = (reply: Msg) => {
      const next = [...withQuestion, reply];
      setMessages(next);
      save(next);
      setLive(null);
      setBusy(false);
      stopRef.current = null;
    };

    // the plain chat route, when the stream is not available
    const plain = async () => {
      try {
        const res = await endpoints.securityChat(q);
        finish({
          role: 'assistant',
          text: res.response || res.answer || 'No response returned.',
          references: res.references,
          failed: res.answered === false,
          at: Date.now(),
        });
      } catch (e) {
        finish({ role: 'assistant', text: e instanceof Error ? `Couldn't reach the assistant: ${e.message}` : 'Request failed.', failed: true, at: Date.now() });
      }
    };

    const started = Date.now();
    let thinking = '';
    let answer = '';
    let answerAt = 0;
    setLive({ thinking: '', answer: '', started });
    stopRef.current = openChatStream(token, { query: q, history, think: 'auto' }, {
      onThinking: (d) => {
        thinking += d;
        setLive({ thinking, answer, started });
      },
      onAnswer: (d) => {
        if (!answerAt) answerAt = Date.now();
        answer += d;
        setLive({ thinking, answer, started });
      },
      onFinal: (r) => {
        const text = (typeof r.response === 'string' && r.response) || answer || 'No response returned.';
        finish({
          role: 'assistant',
          text,
          thinking: (typeof r.thinking === 'string' && r.thinking) || thinking || undefined,
          thinkingMs: typeof r.thinking_ms === 'number' ? r.thinking_ms : thinking ? (answerAt || Date.now()) - started : null,
          references: Array.isArray(r.references) ? (r.references as AnswerReference[]) : undefined,
          failed: r.answered === false,
          at: Date.now(),
        });
      },
      onError: (message, status) => {
        // nothing arrived yet (an older backend, or the stream refused): ask the plain way
        if (!answer && (status === 404 || status === undefined || status === 0)) void plain();
        else finish({ role: 'assistant', text: answer || `Couldn't reach the assistant: ${message}`, failed: !answer, at: Date.now() });
      },
    });
  };

  const stop = () => {
    stopRef.current?.();
    stopRef.current = null;
    if (live) {
      const next: Msg[] = [...messages, { role: 'assistant', text: live.answer || 'Stopped.', failed: !live.answer, at: Date.now() }];
      setMessages(next);
      save(next);
    }
    setLive(null);
    setBusy(false);
  };

  const newChat = () => {
    stop();
    setMessages([]);
    void removeKey(userId, STORE);
  };

  return (
    <>
      <Card style={styles.intro}>
        <View style={styles.introHead}>
          <Icon name="spark" size={18} color={colors.orange} />
          <Text style={styles.introTitle}>Ask CyberForge</Text>
          {messages.length > 0 ? (
            <Pressable accessibilityRole="button" accessibilityLabel="New chat" onPress={newChat} style={styles.newChat} hitSlop={8}>
              <Text style={styles.newChatText}>New chat</Text>
            </Pressable>
          ) : null}
        </View>
        <Text style={styles.introText}>
          Security questions answered by the CyberForge assistant, checked against reviewed security sources. Follow-up questions
          use the conversation so far.
        </Text>
      </Card>

      {!allowed ? (
        <Pressable
          style={styles.off}
          onPress={() => router.push({ pathname: '/screen/[key]', params: { key: 'settings' } })}
          accessibilityRole="button"
        >
          <Icon name="lock" size={16} color={colors.amber2} />
          <Text style={styles.offText}>
            The assistant is off in Settings › Privacy. Turning it on sends your questions to the CyberForge backend and its
            language model. Tap to open Privacy.
          </Text>
        </Pressable>
      ) : null}

      {messages.length === 0 && !live ? (
        <>
          <SecLabel>Suggested</SecLabel>
          <Card style={{ overflow: 'hidden' }}>
            {SUGGESTIONS.map((q, i) => (
              <Pressable accessibilityRole="button" key={q} style={[styles.suggest, i > 0 && styles.border]} onPress={() => send(q)}>
                <Icon name="spark" size={15} color={colors.orange} />
                <Text style={styles.suggestText}>{q}</Text>
                <Icon name="chevR" size={15} color={colors.faint} />
              </Pressable>
            ))}
          </Card>
        </>
      ) : (
        <View style={styles.thread}>
          {messages.map((m, i) =>
            m.role === 'user' ? (
              <View key={i} style={[styles.bubble, styles.userBubble]}>
                <Text style={styles.userText}>{m.text}</Text>
              </View>
            ) : (
              <View key={i} style={[styles.bubble, styles.botBubble, m.failed && styles.failed]}>
                {m.thinking ? (
                  <Pressable accessibilityRole="button" onPress={() => setOpenThought(openThought === i ? null : i)} style={styles.thoughtHead}>
                    <Text style={styles.thoughtLabel}>
                      {`Thought${m.thinkingMs ? ` for ${(m.thinkingMs / 1000).toFixed(1)} s` : ''} ${openThought === i ? '▾' : '▸'}`}
                    </Text>
                  </Pressable>
                ) : null}
                {m.thinking && openThought === i ? <Text style={styles.thoughtBody}>{m.thinking}</Text> : null}
                <Markdown text={m.text} />
                {m.references && m.references.length > 0 ? (
                  <Text style={styles.sources} numberOfLines={2}>
                    Sources: {m.references.map((r) => r.title).filter(Boolean).join(' · ')}
                  </Text>
                ) : null}
              </View>
            ),
          )}
          {live ? (
            <View style={[styles.bubble, styles.botBubble]}>
              {!live.answer ? (
                <View style={styles.thinkingRow}>
                  <ActivityIndicator size="small" color={colors.amber2} />
                  <Text style={styles.thoughtLabel}>Thinking…</Text>
                </View>
              ) : null}
              {live.thinking && !live.answer ? (
                <Text style={styles.thoughtBody} numberOfLines={6}>{live.thinking}</Text>
              ) : null}
              {live.answer ? <Markdown text={live.answer} /> : null}
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
          multiline
          blurOnSubmit
          editable={!busy && allowed}
          accessibilityLabel="Question"
        />
        {busy ? (
          <Pressable accessibilityRole="button" accessibilityLabel="Stop" style={[styles.sendBtn, styles.stopBtn]} onPress={stop}>
            <Icon name="x" size={18} color={colors.text} />
          </Pressable>
        ) : (
          <Pressable accessibilityRole="button" accessibilityLabel="Send" style={[styles.sendBtn, !allowed && { opacity: 0.4 }]} onPress={() => send(input)} disabled={!allowed}>
            <Icon name="bolt" size={18} color="#1a1206" />
          </Pressable>
        )}
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  intro: { padding: 16 },
  introHead: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 4 },
  introTitle: { flex: 1, fontFamily: fonts.sansSemiBold, fontSize: 14, color: colors.text },
  introText: { fontFamily: fonts.sans, fontSize: 13, color: colors.dim, lineHeight: 19, marginTop: 6 },
  newChat: { paddingHorizontal: 10, paddingVertical: 5, borderRadius: 99, borderWidth: 1, borderColor: colors.line2 },
  newChatText: { fontFamily: fonts.sansSemiBold, fontSize: 12, color: colors.amber2 },
  suggest: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 13 },
  border: { borderTopWidth: 1, borderTopColor: colors.line },
  suggestText: { flex: 1, fontFamily: fonts.sans, fontSize: 13, color: colors.text },
  thread: { marginTop: 16, gap: 10 },
  bubble: { padding: 13, borderRadius: 14, maxWidth: '94%' },
  userBubble: { alignSelf: 'flex-end', backgroundColor: colors.surface2, borderWidth: 1, borderColor: colors.line2 },
  userText: { fontFamily: fonts.sans, fontSize: 14, color: colors.text, lineHeight: 20 },
  botBubble: { alignSelf: 'stretch', backgroundColor: colors.amberDim, borderWidth: 1, borderColor: tint(colors.amber, 0.25) },
  failed: { backgroundColor: colors.surface2, borderColor: colors.line2 },
  thoughtHead: { marginBottom: 6 },
  thoughtLabel: { fontFamily: fonts.mono, fontSize: 10.5, color: colors.faint },
  thoughtBody: { fontFamily: fonts.sans, fontSize: 12, color: colors.faint, lineHeight: 17, fontStyle: 'italic', marginBottom: 8 },
  thinkingRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 4 },
  sources: { fontFamily: fonts.mono, fontSize: 10, color: colors.faint, marginTop: 8 },
  inputRow: { flexDirection: 'row', alignItems: 'flex-end', gap: 10, marginTop: 18 },
  input: {
    flex: 1,
    minHeight: 48,
    maxHeight: 120,
    paddingHorizontal: 14,
    paddingTop: 13,
    paddingBottom: 13,
    backgroundColor: colors.tile,
    borderWidth: 1,
    borderColor: colors.line2,
    borderRadius: 13,
    color: colors.text,
    fontFamily: fonts.sans,
    fontSize: 14,
  },
  off: {
    flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 12, padding: 12, borderRadius: 13,
    borderWidth: 1, borderColor: tint(colors.amber2, 0.4), backgroundColor: tint(colors.amber2, 0.08),
  },
  offText: { flex: 1, fontFamily: fonts.sans, fontSize: 12, color: colors.text, lineHeight: 17 },
  sendBtn: { width: 48, height: 48, borderRadius: 13, backgroundColor: colors.amber2, alignItems: 'center', justifyContent: 'center' },
  stopBtn: { backgroundColor: colors.surface2, borderWidth: 1, borderColor: colors.line2 },
});
