/**
 * The small Markdown subset the assistant and the scan summaries use: headings
 * (#, ##), paragraphs, bullet and numbered lists, **bold**, *italic* and
 * `code`, and horizontal rules. Text is rendered as text: nothing in a model's
 * answer can become a link or markup on the phone.
 */
import React from 'react';
import { View, Text, StyleSheet, type TextStyle, type StyleProp } from 'react-native';
import { colors, fonts } from '../theme';

type Block =
  | { kind: 'heading'; text: string }
  | { kind: 'para'; text: string }
  | { kind: 'bullets'; items: string[] }
  | { kind: 'numbers'; items: string[] }
  | { kind: 'rule' };

export function parseBlocks(source: string): Block[] {
  const blocks: Block[] = [];
  let para: string[] = [];
  const flush = () => {
    if (para.length) blocks.push({ kind: 'para', text: para.join(' ') });
    para = [];
  };
  for (const raw of source.replace(/\r/g, '').split('\n')) {
    const line = raw.trim();
    if (!line) {
      flush();
      continue;
    }
    const heading = line.match(/^#{1,6}\s+(.+)$/);
    const bullet = line.match(/^[-*•]\s+(.+)$/);
    const number = line.match(/^\d+[.)]\s+(.+)$/);
    if (/^(-{3,}|\*{3,})$/.test(line)) {
      flush();
      blocks.push({ kind: 'rule' });
    } else if (heading) {
      flush();
      blocks.push({ kind: 'heading', text: heading[1] });
    } else if (bullet || number) {
      flush();
      const kind = bullet ? 'bullets' : 'numbers';
      const text = (bullet ?? number)![1];
      const last = blocks[blocks.length - 1];
      if (last && last.kind === kind) last.items.push(text);
      else blocks.push(kind === 'bullets' ? { kind, items: [text] } : { kind, items: [text] });
    } else {
      para.push(line);
    }
  }
  flush();
  return blocks;
}

/** **bold**, *italic* and `code` within one line, as nested Text. */
function Inline({ text, style }: { text: string; style?: StyleProp<TextStyle> }) {
  const parts = text.split(/(\*\*[^*]+\*\*|`[^`]+`|\*[^*\s][^*]*\*)/g).filter(Boolean);
  return (
    <Text style={style}>
      {parts.map((p, i) =>
        p.startsWith('**') && p.endsWith('**') ? (
          <Text key={i} style={styles.bold}>{p.slice(2, -2)}</Text>
        ) : p.startsWith('`') && p.endsWith('`') ? (
          <Text key={i} style={styles.code}>{p.slice(1, -1)}</Text>
        ) : p.startsWith('*') && p.endsWith('*') && p.length > 2 ? (
          <Text key={i} style={styles.italic}>{p.slice(1, -1)}</Text>
        ) : (
          <Text key={i}>{p}</Text>
        ),
      )}
    </Text>
  );
}

export function Markdown({ text, color = colors.text }: { text: string; color?: string }) {
  const blocks = parseBlocks(text);
  const base = [styles.text, { color }];
  return (
    <View style={{ gap: 8 }}>
      {blocks.map((b, i) => {
        if (b.kind === 'rule') return <View key={i} style={styles.rule} />;
        if (b.kind === 'heading') return <Inline key={i} text={b.text} style={styles.heading} />;
        if (b.kind === 'para') return <Inline key={i} text={b.text} style={base} />;
        return (
          <View key={i} style={{ gap: 5 }}>
            {b.items.map((item, j) => (
              <View key={j} style={styles.item}>
                <Text style={[styles.marker, b.kind === 'numbers' && styles.number]}>{b.kind === 'numbers' ? `${j + 1}.` : '•'}</Text>
                <Inline text={item} style={[base, { flex: 1 }]} />
              </View>
            ))}
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  text: { fontFamily: fonts.sans, fontSize: 14, lineHeight: 21 },
  heading: { fontFamily: fonts.sansSemiBold, fontSize: 14.5, color: colors.amber2, marginTop: 2 },
  bold: { fontFamily: fonts.sansSemiBold, color: colors.amber2 },
  italic: { fontStyle: 'italic' },
  code: { fontFamily: fonts.mono, fontSize: 12.5, color: colors.cyan },
  item: { flexDirection: 'row', gap: 8, paddingLeft: 2 },
  marker: { fontFamily: fonts.sansSemiBold, fontSize: 14, lineHeight: 21, color: colors.amber2, width: 12 },
  number: { fontFamily: fonts.mono, fontSize: 12.5, width: 20 },
  rule: { height: 1, backgroundColor: colors.line, marginVertical: 4 },
});
