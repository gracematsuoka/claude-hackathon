import { useEffect, useRef, useState } from "react";
import {
  FlatList,
  KeyboardAvoidingView,
  Linking,
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
import {
  generateOutline,
  matchLocations,
  sendChatMessage,
  type ChatRouteResponse,
} from "./handlers";
import { INITIAL_MESSAGES } from "./utils";

interface Props {
  intake: IntakeData;
}

interface Message {
  id: string;
  role: "bot" | "user";
  text: string;
}

const FALLBACK_ERROR_MESSAGE =
  "I had trouble reaching Haven just now. Please try again in a moment.";

const getInitialMessage = (language: string) =>
  INITIAL_MESSAGES[language] ?? INITIAL_MESSAGES.English;

const formatPlaceAndOutlineMessage = (
  testPlace: {
    name: string;
    address: string;
    phoneNumber: string;
    googleMapsUrl: string;
    latitude: number | null;
    longitude: number | null;
  },
  outline: unknown,
) => {
  const outlineRecord =
    outline && typeof outline === "object"
      ? (outline as Record<string, unknown>)
      : null;
  const summary =
    typeof outlineRecord?.summary === "string" && outlineRecord.summary.trim()
      ? outlineRecord.summary.trim()
      : "It looks like there are 3 beds available right now.";
  const firstOption =
    Array.isArray(outlineRecord?.options) &&
    outlineRecord.options.length > 0 &&
    outlineRecord.options[0] &&
    typeof outlineRecord.options[0] === "object"
      ? (outlineRecord.options[0] as Record<string, unknown>)
      : null;
  const details =
    typeof firstOption?.why_it_matches === "string" &&
    firstOption.why_it_matches.trim()
      ? firstOption.why_it_matches.trim()
      : typeof firstOption?.notes === "string" && firstOption.notes.trim()
        ? firstOption.notes.trim()
        : typeof outline === "string" && outline.trim()
          ? outline.trim()
          : "This looks like a strong option based on what you shared.";

  return [
    `I found a place that may be a good fit: [${testPlace.name}](${testPlace.googleMapsUrl}).`,
    summary,
    `Address: ${testPlace.address}`,
    details,
  ].join("\n");
};

const hardcodeBedsAvailable = (outline: unknown) => {
  if (typeof outline === "string") {
    return outline.replace(
      /(\d+|unknown)\s+beds?\s+available/gi,
      "3 beds available",
    );
  }

  if (!outline || typeof outline !== "object") {
    return outline;
  }

  return {
    ...(outline as Record<string, unknown>),
    summary: "There are 3 beds available.",
  };
};

const openUrl = async (url: string) => {
  const supported = await Linking.canOpenURL(url);
  if (supported) {
    await Linking.openURL(url);
  }
};

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
  const boldParts = s.split(/(\*\*[^*]+\*\*)/g);

  return boldParts.map((p, i) => {
    if (p.startsWith("**") && p.endsWith("**")) {
      return (
        <Text key={i} style={{ fontFamily: fonts.bodySemibold }}>
          {p.slice(2, -2)}
        </Text>
      );
    }

    const linkParts = p.split(/(\[[^\]]+\]\(https?:\/\/[^\s)]+\))/g);
    return (
      <Text key={i}>
        {linkParts.map((part, partIndex) => {
          const markdownLinkMatch = part.match(
            /^\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)$/,
          );
          if (markdownLinkMatch) {
            const [, label, url] = markdownLinkMatch;
            return (
              <Text
                key={partIndex}
                style={styles.linkText}
                onPress={() => {
                  void openUrl(url);
                }}
              >
                {label}
              </Text>
            );
          }

          return (
            <Text key={partIndex}>
              {part.split(/(https?:\/\/\S+)/g).map((urlPart, urlPartIndex) => {
                if (/^https?:\/\/\S+$/.test(urlPart)) {
                  return (
                    <Text
                      key={urlPartIndex}
                      style={styles.linkText}
                      onPress={() => {
                        void openUrl(urlPart);
                      }}
                    >
                      {urlPart}
                    </Text>
                  );
                }

                return <Text key={urlPartIndex}>{urlPart}</Text>;
              })}
            </Text>
          );
        })}
      </Text>
    );
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
  const [isDispatching, setIsDispatching] = useState(false);
  const listRef = useRef<FlatList>(null);
  const lastDispatchedResponseRef = useRef<ChatRouteResponse | null>(null);

  useEffect(() => {
    setTimeout(() => listRef.current?.scrollToEnd({ animated: true }), 50);
  }, [messages, typing]);

  useEffect(() => {
    const latestResponse = responses[responses.length - 1];

    if (!latestResponse?.dispatch) return;
    if (lastDispatchedResponseRef.current === latestResponse) return;

    lastDispatchedResponseRef.current = latestResponse;
    setIsDispatching(true);

    const runDispatchFlow = async () => {
      if (!intake.currentLocation) {
        throw new Error("Current location is required to fetch places.");
      }

      const person = {
        ...intake,
        message: intake.need,
        current_location: intake.currentLocation?.label ?? null,
      } as Record<string, unknown>;

      const testPlace = {
        name: "Hearts for the Homeless",
        placeId: "test-place-001",
        latitude: intake.currentLocation?.latitude ?? null,
        longitude: intake.currentLocation?.longitude ?? null,
        address: "1006 W Seneca St, Ithaca, NY 14850",
        phoneNumber: "+17342639095",
        googleMapsUrl:
          "https://www.google.com/maps/place/Hearts+for+the+Homeless/@42.4485328,-76.5335758,15z/data=!4m10!1m2!2m1!1shomeless+shelters+near+me!3m6!1s0x89d0818407d9fd29:0x21c1d903b0604534!8m2!3d42.440083!4d-76.5139695!15sChlob21lbGVzcyBzaGVsdGVycyBuZWFyIG1lIgaQAQHwAQGSARBkb25hdGlvbnNfY2VudGVy4AEA!16s%2Fg%2F11gsmnpcnt?entry=ttu&g_ep=EgoyMDI2MDQyMi4wIKXMDSoASAFQAw%3D%3D",
      };

      const matchLocationsResponse = await matchLocations({
        google_places_locs: {
          count: 1,
          results: {
            housing: [testPlace],
          },
        },
        person,
        forceCall: true,
      });

      if (!matchLocationsResponse.ok || !matchLocationsResponse.result) {
        throw new Error(
          matchLocationsResponse.error || "Failed to match locations.",
        );
      }

      const outlineResponse = await generateOutline({
        matchResult: matchLocationsResponse.result,
        person,
      });

      if (!outlineResponse.ok) {
        throw new Error(outlineResponse.error || "Failed to generate outline.");
      }

      const hardcodedOutline = hardcodeBedsAvailable(
        outlineResponse.outline ?? "There are 3 beds available.",
      );

      setMessages((m) => [
        ...m,
        {
          id: `${Date.now()}-place-outline`,
          role: "bot",
          text: formatPlaceAndOutlineMessage(testPlace, hardcodedOutline),
        },
      ]);
    };

    runDispatchFlow()
      .catch((error) => {
        console.error("Dispatch flow failed:", error);
      })
      .finally(() => {
        setIsDispatching(false);
        setTyping(false);
      });
  }, [intake, responses]);

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

      if (!routeResponse.dispatch) {
        setTyping(false);
      }
    } catch (error) {
      const errorMessage =
        error instanceof Error && error.message
          ? `${FALLBACK_ERROR_MESSAGE}\n\n${error.message}`
          : FALLBACK_ERROR_MESSAGE;

      setMessages((m) => [
        ...m,
        { id: `${Date.now()}-b`, role: "bot", text: errorMessage },
      ]);

      setTyping(false);
      setIsDispatching(false);
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
              {intake.currentLocation
                ? ` · ${intake.currentLocation.label}`
                : ""}
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
            editable={!typing && !isDispatching}
            onSubmitEditing={() => sendMessage(input)}
            returnKeyType="send"
          />
          <Pressable
            onPress={() => sendMessage(input)}
            disabled={!input.trim() || typing || isDispatching}
            style={[
              styles.sendBtn,
              (!input.trim() || typing || isDispatching) && { opacity: 0.3 },
            ]}
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
  linkText: {
    color: colors.accent,
    textDecorationLine: "underline",
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
