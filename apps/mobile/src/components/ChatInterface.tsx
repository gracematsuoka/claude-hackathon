import { useEffect, useRef, useState } from "react";
import {
  FlatList,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { colors, fonts, radius, shadow } from "../theme";
import type { IntakeData } from "./IntakeModal";
import { INITIAL_MESSAGES } from "./utils";
import { sendChatMessage } from "../../../api/handlers";

interface Props {
  intake: IntakeData;
}

interface Message {
  id: string;
  role: "bot" | "user";
  text: string;
}

interface ChatRouteResponse {
  reasoning?: string;
  needs?: string[];
  message?: string;
  dispatch?: boolean;
  error?: string;
  status: number;
  ok: boolean;
  rawBody: string;
}

const FALLBACK_ERROR_MESSAGE =
  "I had trouble reaching Haven just now. Please try again in a moment.";

const getInitialMessage = (language: string) =>
  INITIAL_MESSAGES[language] ?? INITIAL_MESSAGES.English;

// Simple bold + bullet renderer for RN
const renderText = (text: string) => {
  return text.split("\n").map((line, i) => {
    if (line.trim() === "") return <View key={i} style={{ height: 8 }} />;
    if (line.startsWith("• ")) {
      return (
        <View
          key={i}
          style={{ flexDirection: "row", gap: 8, marginVertical: 1 }}
        >
          <Text style={{ color: colors.accent, fontFamily: fonts.body }}>
            •
          </Text>
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
    if (p.startsWith("**") && p.endsWith("**")) {
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
    { id: "init", role: "bot", text: getInitialMessage(intake.language) },
  ]);
  const [responses, setResponses] = useState<ChatRouteResponse[]>([]);
  const [input, setInput] = useState("");
  const [typing, setTyping] = useState(false);
  const listRef = useRef<FlatList>(null);

  useEffect(() => {
    setTimeout(() => listRef.current?.scrollToEnd({ animated: true }), 50);
  }, [messages, typing]);

  const sendMessage = async (text: string) => {
    const trimmed = text.trim();
    if (!trimmed) return;

    setMessages((m) => [
      ...m,
      { id: `${Date.now()}-u`, role: "user", text: trimmed },
    ]);
    setInput("");
    setTyping(true);

    try {
      const routeResponse = await sendChatMessage({
        message: trimmed,
        language: intake.language,
      });

      setResponses((current) => [...current, routeResponse]);

      if (!routeResponse.ok) {
        throw new Error(routeResponse.error || "Chat request failed.");
      }

      if (!routeResponse.rawBody.trim().startsWith("{")) {
        throw new Error(
          "The chat endpoint returned a non-JSON response. Check EXPO_PUBLIC_API_URL.",
        );
      }

      if (!routeResponse.message?.trim()) {
        throw new Error("Chat response was empty.");
      }

      setMessages((m) => [
        ...m,
        {
          id: `${Date.now()}-b`,
          role: "bot",
          text: routeResponse.message!.trim(),
        },
      ]);
    } catch (error) {
      const errorMessage =
        error instanceof Error && error.message
          ? `${FALLBACK_ERROR_MESSAGE}\n\n${error.message}`
          : FALLBACK_ERROR_MESSAGE;

      setMessages((m) => [
        ...m,
        { id: `${Date.now()}-b`, role: "bot", text: errorMessage },
      ]);
    } finally {
      setTyping(false);
    }
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === "ios" ? "padding" : undefined}
      style={{ flex: 1, backgroundColor: colors.background }}
    >
      {/* Header */}
      <View style={[styles.header, { paddingTop: insets.top + 12 }]}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
          <LinearGradient
            colors={
              ["#A8B8F0", "#E8B898", "#FCD68C"] as unknown as [
                string,
                string,
                ...string[],
              ]
            }
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
        <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
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
        renderItem={({ item }) => (
          <MessageRow role={item.role} text={item.text} />
        )}
        ListFooterComponent={
          <>
            {typing && (
              <View style={{ flexDirection: "row", gap: 12, marginTop: 8 }}>
                <LinearGradient
                  colors={
                    ["#A8B8F0", "#E8B898", "#FCD68C"] as unknown as [
                      string,
                      string,
                      ...string[],
                    ]
                  }
                  style={styles.botAvatar}
                />
                <View style={{ flexDirection: "row", gap: 6, paddingTop: 10 }}>
                  <View style={styles.typingDot} />
                  <View style={styles.typingDot} />
                  <View style={styles.typingDot} />
                </View>
              </View>
            )}
          </>
        }
      />

      {/* Composer */}
      <View
        style={[
          styles.composerWrap,
          { paddingBottom: Math.max(insets.bottom, 12) },
        ]}
      >
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
        <Text style={styles.footerNote}>
          Free · confidential · available 24/7
        </Text>
      </View>
    </KeyboardAvoidingView>
  );
};

const MessageRow = ({ role, text }: { role: "bot" | "user"; text: string }) => {
  if (role === "user") {
    return (
      <View style={{ alignItems: "flex-end" }}>
        <View style={styles.userBubble}>
          <Text style={styles.userText}>{text}</Text>
        </View>
      </View>
    );
  }
  return (
    <View style={{ flexDirection: "row", gap: 12 }}>
      <LinearGradient
        colors={
          ["#A8B8F0", "#E8B898", "#FCD68C"] as unknown as [
            string,
            string,
            ...string[],
          ]
        }
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
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    borderBottomWidth: 1,
    borderBottomColor: "rgba(228, 221, 208, 0.5)",
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
    maxWidth: "80%",
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
    backgroundColor: "rgba(42, 36, 56, 0.4)",
  },
  composerWrap: {
    paddingHorizontal: 20,
    paddingTop: 8,
    backgroundColor: colors.background,
  },
  composer: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: colors.card,
    borderRadius: radius.xl,
    borderWidth: 1,
    borderColor: "rgba(228, 221, 208, 0.7)",
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
    alignItems: "center",
    justifyContent: "center",
  },
  sendArrow: {
    color: colors.background,
    fontSize: 18,
    fontFamily: fonts.bodySemibold,
    lineHeight: 20,
  },
  footerNote: {
    textAlign: "center",
    fontFamily: fonts.body,
    fontSize: 11,
    color: colors.mutedForeground,
    marginTop: 10,
  },
});
