import { auth, db, serverTimestamp } from "@/firebase/config";
import { useLocalSearchParams, useRouter } from "expo-router";
import {
    addDoc,
    collection,
    doc,
    getDocs,
    onSnapshot,
    orderBy,
    query,
    updateDoc,
    where,
} from "firebase/firestore";
import React, { useEffect, useState } from "react";
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

export default function ChatScreen() {
  const params = useLocalSearchParams();
  const chatId = params.id as string;
  const [messages, setMessages] = useState<any[]>([]);
  const [text, setText] = useState("");
  const [chat, setChat] = useState<any>(null);
  const user = auth.currentUser;
  const router = useRouter();

  useEffect(() => {
    if (!chatId) return;

    return onSnapshot(doc(db, "chats", chatId), (snap) => {
      setChat(snap.exists() ? snap.data() : null);
    });
  }, [chatId]);

  useEffect(() => {
    if (!chatId) return;

    const q = query(
      collection(db, `chats/${chatId}/messages`),
      orderBy("createdAt"),
    );

    return onSnapshot(q, (snap) => {
      const nextMessages: any[] = [];
      snap.forEach((messageDoc) => {
        nextMessages.push({ id: messageDoc.id, ...messageDoc.data() });
      });
      setMessages(nextMessages);
    });
  }, [chatId]);

  useEffect(() => {
    if (!chatId || !user) return;

    (async () => {
      const q = query(
        collection(db, `chats/${chatId}/messages`),
        where("read", "==", false),
        where("senderId", "!=", user.uid),
      );
      const snap = await getDocs(q);
      const updates: Promise<void>[] = [];
      snap.forEach((messageDoc) => {
        updates.push(
          updateDoc(doc(db, `chats/${chatId}/messages/${messageDoc.id}`), {
            read: true,
          }),
        );
      });
      await Promise.all(updates);
    })();
  }, [chatId, user]);

  const handleSend = async () => {
    const message = text.trim();
    if (!message || !chatId || !user) return;

    setText("");
    await addDoc(collection(db, `chats/${chatId}/messages`), {
      text: message,
      senderId: user.uid,
      createdAt: serverTimestamp(),
      read: false,
    });
    await updateDoc(doc(db, "chats", chatId), { updatedAt: serverTimestamp() });
  };

  const otherId = (chat?.participants || []).find(
    (id: string) => id !== user?.uid,
  );
  const title = chat?.participantNames?.[otherId] || "Chat";

  return (
    <KeyboardAvoidingView
      style={styles.screen}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <View style={styles.header}>
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>
            {String(title).charAt(0).toUpperCase()}
          </Text>
        </View>
        <View style={styles.headerText}>
          <Text style={styles.title}>{title}</Text>
          <Text style={styles.subtitle}>
            {(chat?.participantMobiles || []).join(" > ")}
          </Text>
        </View>
      </View>

      <FlatList
        data={messages}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.messageList}
        renderItem={({ item }) => {
          const isMe = item.senderId === user?.uid;

          return (
            <View style={[styles.message, isMe ? styles.me : styles.them]}>
              <Text style={[styles.messageText, isMe && styles.meText]}>
                {item.text}
              </Text>
              {isMe ? (
                <Text style={styles.read}>{item.read ? "Seen" : "Sent"}</Text>
              ) : null}
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
        <View style={styles.composer}>
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
    gap: 12,
    paddingHorizontal: 16,
    paddingTop: 30,
    paddingBottom: 10,
    backgroundColor: "#fff",
    borderBottomWidth: 1,
    borderBottomColor: "#dbe4ee",
    
  },
  avatar: {
    width: 46,
    height: 46,
    borderRadius: 23,
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
    paddingBottom: 20,
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
  read: {
    color: "#bfdbfe",
    fontSize: 11,
    fontWeight: "700",
    marginTop: 4,
    textAlign: "right",
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
