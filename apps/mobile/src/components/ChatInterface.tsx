import { useEffect, useRef, useState } from 'react';
import {
  FlatList,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, fonts, radius, shadow } from '../theme';
import type { IntakeData } from './IntakeModal';

interface Props {
  intake: IntakeData;
}

interface Message {
  id: string;
  role: 'bot' | 'user';
  text: string;
}

const SUGGESTED_REPLIES = [
  'A place to sleep tonight',
  'Hot meal nearby',
  'Medical help',
  'Someone to talk to',
];

const DUMMY_RESPONSES: { match: RegExp; reply: string }[] = [
  {
    match: /(sleep|stay|shelter|bed|night)/i,
    reply:
      "I found **3 shelters within your travel range** with open beds tonight:\n\n• **Sunrise House** — 0.6 mi · check-in 6 PM\n• **Hope Center** — 1.2 mi · check-in 7 PM\n• **St. Mary's Refuge** — 1.8 mi · women & families\n\nWould you like directions to one of these?",
  },
  {
    match: /(food|meal|eat|hungry|hot)/i,
    reply:
      "There's a **free hot meal** being served right now:\n\n• **Community Kitchen** — 0.4 mi · open until 8 PM\n• **First Baptist** — 1.1 mi · dinner at 6 PM\n\nNo ID required at either location.",
  },
  {
    match: /(doctor|medical|sick|hurt|pain|clinic)/i,
    reply:
      '**Free clinics** open today:\n\n• **Wellness Mobile Unit** — 0.8 mi · open until 5 PM\n• **County Health** — 1.5 mi · walk-ins welcome\n\nIf this is an emergency, please call 911.',
  },
  {
    match: /(talk|lonely|sad|alone|counsel)/i,
    reply:
      "I'm here to listen. You can also reach a caring person right now:\n\n• **Crisis line:** 988 (call or text)\n• **Drop-in counseling** — 1.0 mi · open until 9 PM\n\nWhat's on your mind?",
  },
  {
    match: /(yes|directions|how do i get|map)/i,
    reply:
      'Walking directions are ready. The route is **safe and well-lit**, and takes about **15 minutes**. I\'ll text them to you if you\'d like.',
  },
];

const getDummyReply = (text: string) => {
  const found = DUMMY_RESPONSES.find((r) => r.match.test(text));
  return (
    found?.reply ??
    "Thank you for sharing that. I'm putting together some options nearby — can you tell me a little more about what would help most right now?"
  );
};

// Simple bold + bullet renderer for RN
const renderText = (text: string) => {
  return text.split('\n').map((line, i) => {
    if (line.trim() === '') return <View key={i} style={{ height: 8 }} />;
    if (line.startsWith('• ')) {
      return (
        <View key={i} style={{ flexDirection: 'row', gap: 8, marginVertical: 1 }}>
          <Text style={{ color: colors.accent, fontFamily: fonts.body }}>•</Text>
          <Text style={styles.botText}>{renderInline(line.slice(2))}</Text>
        </View>
      );
    }
    return (
      <Text key={i} style={styles.botText}>
        {renderInline(line)}
      </Text>
    );
  });
};

const renderInline = (s: string) => {
  const parts = s.split(/(\*\*[^*]+\*\*)/g);
  return parts.map((p, i) => {
    if (p.startsWith('**') && p.endsWith('**')) {
      return (
        <Text key={i} style={{ fontFamily: fonts.bodySemibold }}>
          {p.slice(2, -2)}
        </Text>
      );
    }
    return <Text key={i}>{p}</Text>;
  });
};

export const ChatInterface = ({ intake }: Props) => {
  const insets = useSafeAreaInsets();
  const [messages, setMessages] = useState<Message[]>([
    { id: 'init', role: 'bot', text: 'What services do you need?' },
  ]);
  const [input, setInput] = useState('');
  const [typing, setTyping] = useState(false);
  const listRef = useRef<FlatList>(null);
  const seededRef = useRef(false);

  useEffect(() => {
    if (seededRef.current) return;
    seededRef.current = true;
    if (intake.need) {
      const t = setTimeout(() => sendMessage(intake.need), 600);
      return () => clearTimeout(t);
    }
  }, []);

  useEffect(() => {
    setTimeout(() => listRef.current?.scrollToEnd({ animated: true }), 50);
  }, [messages, typing]);

  const sendMessage = (text: string) => {
    const trimmed = text.trim();
    if (!trimmed) return;
    setMessages((m) => [
      ...m,
      { id: `${Date.now()}-u`, role: 'user', text: trimmed },
    ]);
    setInput('');
    setTyping(true);
    setTimeout(() => {
      setMessages((m) => [
        ...m,
        { id: `${Date.now()}-b`, role: 'bot', text: getDummyReply(trimmed) },
      ]);
      setTyping(false);
    }, 1100);
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      style={{ flex: 1, backgroundColor: colors.background }}
    >
      {/* Header */}
      <View style={[styles.header, { paddingTop: insets.top + 12 }]}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
          <LinearGradient
            colors={['#A8B8F0', '#E8B898', '#FCD68C'] as unknown as [string, string, ...string[]]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.headerOrb}
          />
          <View>
            <Text style={styles.headerTitle}>Haven</Text>
            <Text style={styles.headerMeta}>
              {intake.distance} mi · {intake.language}
            </Text>
          </View>
        </View>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
          <View style={styles.dot} />
          <Text style={styles.headerMeta}>online</Text>
        </View>
      </View>

      {/* Messages */}
      <FlatList
        ref={listRef}
        data={messages}
        keyExtractor={(m) => m.id}
        contentContainerStyle={{ padding: 20, gap: 28 }}
        renderItem={({ item }) => <MessageRow role={item.role} text={item.text} />}
        ListFooterComponent={
          <>
            {typing && (
              <View style={{ flexDirection: 'row', gap: 12, marginTop: 8 }}>
                <LinearGradient
                  colors={['#A8B8F0', '#E8B898', '#FCD68C'] as unknown as [string, string, ...string[]]}
                  style={styles.botAvatar}
                />
                <View style={{ flexDirection: 'row', gap: 6, paddingTop: 10 }}>
                  <View style={styles.typingDot} />
                  <View style={styles.typingDot} />
                  <View style={styles.typingDot} />
                </View>
              </View>
            )}
            {messages.length <= 2 && !typing && (
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={{ gap: 8, paddingTop: 16 }}
              >
                {SUGGESTED_REPLIES.map((s) => (
                  <Pressable
                    key={s}
                    style={styles.chip}
                    onPress={() => sendMessage(s)}
                  >
                    <Text style={styles.chipText}>{s}</Text>
                  </Pressable>
                ))}
              </ScrollView>
            )}
          </>
        }
      />

      {/* Composer */}
      <View style={[styles.composerWrap, { paddingBottom: Math.max(insets.bottom, 12) }]}>
        <View style={styles.composer}>
          <TextInput
            value={input}
            onChangeText={setInput}
            placeholder="Message Haven…"
            placeholderTextColor={colors.mutedForeground}
            style={styles.composerInput}
            maxLength={500}
            onSubmitEditing={() => sendMessage(input)}
            returnKeyType="send"
          />
          <Pressable
            onPress={() => sendMessage(input)}
            disabled={!input.trim()}
            style={[styles.sendBtn, !input.trim() && { opacity: 0.3 }]}
          >
            <Text style={styles.sendArrow}>↑</Text>
          </Pressable>
        </View>
        <Text style={styles.footerNote}>Free · confidential · available 24/7</Text>
      </View>
    </KeyboardAvoidingView>
  );
};

const MessageRow = ({ role, text }: { role: 'bot' | 'user'; text: string }) => {
  if (role === 'user') {
    return (
      <View style={{ alignItems: 'flex-end' }}>
        <View style={styles.userBubble}>
          <Text style={styles.userText}>{text}</Text>
        </View>
      </View>
    );
  }
  return (
    <View style={{ flexDirection: 'row', gap: 12 }}>
      <LinearGradient
        colors={['#A8B8F0', '#E8B898', '#FCD68C'] as unknown as [string, string, ...string[]]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.botAvatar}
      />
      <View style={{ flex: 1, paddingTop: 2 }}>{renderText(text)}</View>
    </View>
  );
};

const styles = StyleSheet.create({
  header: {
    paddingHorizontal: 20,
    paddingBottom: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(228, 221, 208, 0.5)',
    backgroundColor: colors.background,
  },
  headerOrb: {
    height: 32,
    width: 32,
    borderRadius: 999,
  },
  headerTitle: {
    fontFamily: fonts.displayBold,
    fontSize: 18,
    color: colors.foreground,
  },
  headerMeta: {
    fontFamily: fonts.body,
    fontSize: 11,
    color: colors.mutedForeground,
    letterSpacing: 0.3,
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 999,
    backgroundColor: colors.accent,
  },
  botAvatar: {
    height: 28,
    width: 28,
    borderRadius: 999,
    marginTop: 2,
  },
  botText: {
    fontFamily: fonts.body,
    fontSize: 15,
    lineHeight: 22,
    color: colors.foreground,
  },
  userBubble: {
    maxWidth: '80%',
    paddingHorizontal: 16,
    paddingVertical: 10,
    backgroundColor: colors.secondary,
    borderRadius: 18,
    borderBottomRightRadius: 6,
  },
  userText: {
    fontFamily: fonts.body,
    fontSize: 15,
    lineHeight: 22,
    color: colors.foreground,
  },
  typingDot: {
    width: 6,
    height: 6,
    borderRadius: 999,
    backgroundColor: 'rgba(42, 36, 56, 0.4)',
  },
  chip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: 'rgba(239, 233, 221, 0.7)',
    borderWidth: 1,
    borderColor: 'rgba(228, 221, 208, 0.5)',
  },
  chipText: {
    fontFamily: fonts.body,
    fontSize: 13,
    color: 'rgba(42, 36, 56, 0.75)',
  },
  composerWrap: {
    paddingHorizontal: 20,
    paddingTop: 8,
    backgroundColor: colors.background,
  },
  composer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: colors.card,
    borderRadius: radius.xl,
    borderWidth: 1,
    borderColor: 'rgba(228, 221, 208, 0.7)',
    paddingHorizontal: 16,
    paddingVertical: 6,
    ...shadow.soft,
  },
  composerInput: {
    flex: 1,
    fontFamily: fonts.body,
    fontSize: 15,
    color: colors.foreground,
    paddingVertical: 8,
  },
  sendBtn: {
    width: 32,
    height: 32,
    borderRadius: radius.md,
    backgroundColor: colors.foreground,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sendArrow: {
    color: colors.background,
    fontSize: 18,
    fontFamily: fonts.bodySemibold,
    lineHeight: 20,
  },
  footerNote: {
    textAlign: 'center',
    fontFamily: fonts.body,
    fontSize: 11,
    color: colors.mutedForeground,
    marginTop: 10,
  },
});
