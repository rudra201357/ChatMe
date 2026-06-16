import { auth, db, serverTimestamp } from "@/firebase/config";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useIsFocused } from "@react-navigation/native";
import { User as FirebaseUser, onAuthStateChanged } from "firebase/auth";
import {
  collection,
  doc,
  increment,
  onSnapshot,
  orderBy,
  query,
  writeBatch,
} from "firebase/firestore";
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  AppState,
  BackHandler,
  FlatList,
  Keyboard,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";

type MessageRow = {
  type: "message";
  key: string;
  message: any;
};

type DateRow = {
  type: "date";
  key: string;
  label: string;
};

type ChatRow = MessageRow | DateRow;

const MONTHS = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
];

const padTime = (value: number) => String(value).padStart(2, "0");

const getMessageDate = (value: any) => {
  if (!value) return null;
  if (value instanceof Date) return value;
  if (typeof value.toDate === "function") return value.toDate() as Date;
  if (typeof value.seconds === "number") {
    return new Date(value.seconds * 1000);
  }
  return null;
};

const getDateKey = (date: Date) =>
  `${date.getFullYear()}-${padTime(date.getMonth() + 1)}-${padTime(
    date.getDate(),
  )}`;

const startOfDay = (date: Date) =>
  new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime();

const formatDateLabel = (date: Date) => {
  const today = new Date();
  const dayDiff = Math.round(
    (startOfDay(today) - startOfDay(date)) / (24 * 60 * 60 * 1000),
  );

  if (dayDiff === 0) return "Today";
  if (dayDiff === 1) return "Yesterday";

  return `${padTime(date.getDate())} ${
    MONTHS[date.getMonth()]
  } ${date.getFullYear()}`;
};

const formatMessageTime = (value: any) => {
  const date = getMessageDate(value);
  if (!date) return "--:--";
  return `${padTime(date.getHours())}:${padTime(date.getMinutes())}`;
};

const buildChatRows = (messageList: any[]): ChatRow[] => {
  const rows: ChatRow[] = [];
  let previousDateKey: string | null = null;

  messageList.forEach((message) => {
    const messageDate = getMessageDate(message.createdAt);

    if (messageDate) {
      const dateKey = getDateKey(messageDate);
      if (dateKey !== previousDateKey) {
        rows.push({
          type: "date",
          key: `date-${dateKey}`,
          label: formatDateLabel(messageDate),
        });
        previousDateKey = dateKey;
      }
    }

    rows.push({
      type: "message",
      key: message.id,
      message,
    });
  });

  return rows;
};

export default function ChatScreen() {
  const params = useLocalSearchParams();
  const chatId = params.id as string;
  const [messages, setMessages] = useState<any[]>([]);
  const [text, setText] = useState("");
  const [chat, setChat] = useState<any>(null);
  const [user, setUser] = useState<FirebaseUser | null>(auth.currentUser);
  const router = useRouter();
  const isFocused = useIsFocused();
  const flatListRef = useRef<any>(null);
  const [keyboardOpen, setKeyboardOpen] = useState(false);
  const [isAppActive, setIsAppActive] = useState(
    AppState.currentState === "active",
  );
  const chatRows = useMemo(() => buildChatRows(messages), [messages]);
  const goHome = useCallback(() => {
    router.replace("/");
  }, [router]);

  useEffect(() => {
    if (!isFocused) return;

    const sub = BackHandler.addEventListener("hardwareBackPress", () => {
      goHome();
      return true;
    });

    return () => {
      sub.remove();
    };
  }, [goHome, isFocused]);

  useEffect(() => {
    return onAuthStateChanged(auth, (nextUser) => {
      setUser(nextUser);

      if (!nextUser) {
        setChat(null);
        setMessages([]);
        setText("");
        router.replace("/");
      }
    });
  }, [router]);

  useEffect(() => {
    if (!chatId || !user) return;

    return onSnapshot(
      doc(db, "chats", chatId),
      (snap) => {
        setChat(snap.exists() ? snap.data() : null);
      },
      () => {
        setChat(null);
      },
    );
  }, [chatId, user]);

  useEffect(() => {
    if (Platform.OS !== "android") return;

    const showSub = Keyboard.addListener("keyboardDidShow", () =>
      setKeyboardOpen(true),
    );
    const hideSub = Keyboard.addListener("keyboardDidHide", () =>
      setKeyboardOpen(false),
    );

    return () => {
      showSub.remove();
      hideSub.remove();
    };
  }, []);

  useEffect(() => {
    if (!chatId || !user) return;

    const q = query(
      collection(db, `chats/${chatId}/messages`),
      orderBy("createdAt"),
    );

    return onSnapshot(
      q,
      (snap) => {
        const nextMessages: any[] = [];
        snap.forEach((messageDoc) => {
          nextMessages.push({ id: messageDoc.id, ...messageDoc.data() });
        });
        setMessages(nextMessages);
      },
      () => {
        setMessages([]);
      },
    );
  }, [chatId, user]);

  useEffect(() => {
    const sub = AppState.addEventListener?.("change", (state) => {
      setIsAppActive(state === "active");
    });

    return () => {
      sub?.remove?.();
    };
  }, []);

  useEffect(() => {
    if (!chatId || !user || !isAppActive || !isFocused) return;

    const unreadIncoming = messages.filter(
      (message) =>
        message.id && message.senderId !== user.uid && message.read !== true,
    );
    if (unreadIncoming.length === 0) return;

    const batch = writeBatch(db);
    unreadIncoming.forEach((message) => {
      batch.update(doc(db, "chats", chatId, "messages", message.id), {
        read: true,
      });
    });
    batch.update(doc(db, "chats", chatId), {
      [`unreadCounts.${user.uid}`]: 0,
    });

    batch.commit().catch(() => null);
  }, [chatId, isAppActive, isFocused, messages, user]);

  const handleSend = async () => {
    const message = text.trim();
    if (!message || !chatId || !user) return;

    setText("");
    const batch = writeBatch(db);
    const chatRef = doc(db, "chats", chatId);
    const messageRef = doc(collection(db, "chats", chatId, "messages"));

    batch.set(messageRef, {
      text: message,
      senderId: user.uid,
      createdAt: serverTimestamp(),
      read: false,
    });

    const unreadUpdates = (chat?.participants || [])
      .filter((id: string) => id !== user.uid)
      .reduce(
        (updates: Record<string, ReturnType<typeof increment>>, id: string) => {
          updates[`unreadCounts.${id}`] = increment(1);
          return updates;
        },
        {},
      );

    batch.update(chatRef, {
      ...unreadUpdates,
      lastMessage: message,
      lastMessageSenderId: user.uid,
      updatedAt: serverTimestamp(),
    });
    await batch.commit();
  };

  const otherId = (chat?.participants || []).find(
    (id: string) => id !== user?.uid,
  );
  const title = chat?.participantNames?.[otherId] || "Chat";
  const otherMobileId = (chat?.participantMobiles || [])[
    (chat?.participants || []).indexOf(otherId)
  ];
  const otherMobile =
    chat?.participantMobilesById?.[otherId] ||
    otherMobileId ||
    (chat?.participantMobiles || []).find(Boolean);

  useEffect(() => {
    // scroll to end whenever messages update
    try {
      (flatListRef.current as any)?.scrollToEnd?.({ animated: true });
    } catch {
      // ignore
    }
  }, [messages]);

  return (
    <KeyboardAvoidingView
      style={styles.screen}
      behavior={Platform.OS === "ios" ? "padding" : "height"}
      keyboardVerticalOffset={0}
    >
      <View style={styles.header}>
      
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>
            {String(title).charAt(0).toUpperCase()}
          </Text>
        </View>
        <View style={styles.headerText}>
          <Text style={styles.title}>{title}</Text>
          <Text style={styles.subtitle}>{otherMobile || "User"}</Text>
        </View>
      </View>

      <FlatList
        ref={flatListRef}
        data={chatRows}
        keyExtractor={(item) => item.key}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={styles.messageList}
        onContentSizeChange={() => {
          try {
            (flatListRef.current as any)?.scrollToEnd?.({ animated: true });
          } catch {}
        }}
        renderItem={({ item }) => {
          if (item.type === "date") {
            return (
              <View style={styles.dateDivider}>
                <Text style={styles.dateDividerText}>{item.label}</Text>
              </View>
            );
          }

          const message = item.message;
          const isMe = message.senderId === user?.uid;

          return (
            <View style={[styles.message, isMe ? styles.me : styles.them]}>
              <Text style={[styles.messageText, isMe && styles.meText]}>
                {message.text}
              </Text>
              <View style={styles.messageMetaRow}>
                <Text style={[styles.messageTime, isMe && styles.meTime]}>
                  {formatMessageTime(message.createdAt)}
                </Text>
                {isMe ? (
                  <View
                    style={[
                      styles.statusDot,
                      message.read ? styles.seenDot : styles.sentDot,
                    ]}
                  />
                ) : null}
              </View>
            </View>
          );
        }}
        ListEmptyComponent={
          <View style={styles.emptyState}>
            <Text style={styles.emptyTitle}>Say hello</Text>
            <Text style={styles.emptyText}>
              Messages will appear here in real time.
            </Text>
          </View>
        }
      />

      {user ? (
        <View
          style={[styles.composer, keyboardOpen && styles.composerKeyboardOpen]}
        >
          <TextInput
            value={text}
            onChangeText={setText}
            placeholder="Write a message"
            placeholderTextColor="#8b95a7"
            style={styles.input}
            multiline
          />
          <Pressable onPress={handleSend} style={styles.sendButton}>
            <Text style={styles.sendButtonText}>Send</Text>
          </Pressable>
        </View>
      ) : (
        <View style={styles.loggedOut}>
          <Text style={{ marginBottom: 8 }}>
            You are signed out. Please sign in to send messages.
          </Text>
          <Pressable onPress={() => router.push("/")} style={styles.sendButton}>
            <Text style={styles.sendButtonText}>Go to Sign In</Text>
          </Pressable>
        </View>
      )}
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: "#eef4fa",
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingHorizontal: 16,
    paddingTop: 30,
    paddingBottom: 10,
    backgroundColor: "#fff",
    borderBottomWidth: 1,
    borderBottomColor: "#dbe4ee",
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#eef4fa",
    borderWidth: 1,
    borderColor: "#dbe4ee",
    marginTop: 10,
  },
  backButtonText: {
    color: "#0f172a",
    fontSize: 24,
    fontWeight: "900",
    lineHeight: 26,
  },
  avatar: {
    width: 46,
    height: 46,
    borderRadius: 23,
    marginTop: 10, // extra margin to offset from top padding
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#0f172a",
  },
  avatarText: {
    color: "#fff",
    fontSize: 18,
    fontWeight: "900",
  },
  headerText: {
    flex: 1,
  },
  title: {
    color: "#111827",
    fontSize: 20,
    fontWeight: "900",
  },
  subtitle: {
    color: "#64748b",
    marginTop: 3,
  },
  messageList: {
    padding: 14,
    paddingBottom: 18,
  },
  dateDivider: {
    alignItems: "center",
    marginVertical: 12,
  },
  dateDividerText: {
    color: "#526071",
    fontSize: 12,
    fontWeight: "800",
    backgroundColor: "#dbeafe",
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 6,
    overflow: "hidden",
  },
  message: {
    paddingHorizontal: 13,
    paddingVertical: 10,
    borderRadius: 8,
    marginBottom: 9,
    maxWidth: "80%",
  },
  me: {
    backgroundColor: "#2563eb",
    alignSelf: "flex-end",
  },
  them: {
    backgroundColor: "#fff",
    alignSelf: "flex-start",
    borderWidth: 1,
    borderColor: "#dde6f0",
  },
  messageText: {
    color: "#0f172a",
    fontSize: 15,
    lineHeight: 20,
  },
  meText: {
    color: "#fff",
  },
  messageMetaRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "flex-end",
    gap: 6,
    marginTop: 5,
  },
  messageTime: {
    color: "#64748b",
    fontSize: 11,
    fontWeight: "700",
  },
  meTime: {
    color: "#dbeafe",
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  sentDot: {
    backgroundColor: "#f97316",
  },
  seenDot: {
    backgroundColor: "#22c55e",
  },
  composer: {
    flexDirection: "row",
    alignItems: "flex-end",
    gap: 10,
    padding: 12,
    backgroundColor: "#fff",
    borderTopWidth: 1,
    borderTopColor: "#dbe4ee",
  },
  composerKeyboardOpen: {
    paddingBottom: 8,
  },
  input: {
    flex: 1,
    maxHeight: 120,
    minHeight: 48,
    borderWidth: 1,
    borderColor: "#d6e0ea",
    backgroundColor: "#fbfdff",
    paddingHorizontal: 12,
    paddingVertical: 12,
    borderRadius: 8,
    color: "#111827",
  },
  sendButton: {
    minHeight: 48,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#22c55e",
    borderRadius: 8,
    paddingHorizontal: 18,
  },
  sendButtonText: {
    color: "#052e16",
    fontWeight: "900",
  },
  loggedOut: {
    padding: 12,
    alignItems: "center",
    backgroundColor: "#fff",
    borderTopWidth: 1,
    borderTopColor: "#dbe4ee",
  },
  emptyState: {
    alignItems: "center",
    justifyContent: "center",
    padding: 28,
    marginTop: 32,
    borderRadius: 8,
    backgroundColor: "#fff",
    borderWidth: 1,
    borderColor: "#dde6f0",
  },
  emptyTitle: {
    color: "#111827",
    fontSize: 18,
    fontWeight: "900",
  },
  emptyText: {
    color: "#64748b",
    marginTop: 5,
    textAlign: "center",
  },
});
