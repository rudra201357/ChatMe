import { useRouter } from "expo-router";
import React, { useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";

import { auth, db } from "@/firebase/config";
import {
  createUserWithEmailAndPassword,
  deleteUser,
  User as FirebaseUser,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signOut,
} from "firebase/auth";
import {
  collection,
  doc,
  DocumentData,
  getDoc,
  onSnapshot,
  query,
  runTransaction,
  serverTimestamp,
  setDoc,
  where,
} from "firebase/firestore";

type Profile = {
  uid: string;
  name: string;
  email: string | null;
  mobileNumber: string;
};

const normalizeMobile = (value: string) => value.replace(/[^\d]/g, "");

export default function HomeScreen() {
  const router = useRouter();
  const [user, setUser] = useState<FirebaseUser | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [name, setName] = useState("");
  const [mobileNumber, setMobileNumber] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [chats, setChats] = useState<DocumentData[]>([]);
  const [newChatWith, setNewChatWith] = useState("");
  const [isSignup, setIsSignup] = useState(false);
  const [loading, setLoading] = useState(false);

  const cleanMobile = useMemo(
    () => normalizeMobile(mobileNumber),
    [mobileNumber],
  );

  useEffect(() => onAuthStateChanged(auth, setUser), []);

  useEffect(() => {
    if (!user) {
      setProfile(null);
      return;
    }

    return onSnapshot(doc(db, "users", user.uid), (snap) => {
      setProfile(snap.exists() ? (snap.data() as Profile) : null);
    });
  }, [user]);

  useEffect(() => {
    if (!user) {
      setChats([]);
      return;
    }

    const q = query(
      collection(db, "chats"),
      where("participants", "array-contains", user.uid),
    );

    return onSnapshot(q, (snap) => {
      const data: DocumentData[] = [];
      snap.forEach((chatDoc) =>
        data.push({ id: chatDoc.id, ...chatDoc.data() }),
      );
      setChats(
        data.sort(
          (a, b) => (b.updatedAt?.seconds || 0) - (a.updatedAt?.seconds || 0),
        ),
      );
    });
  }, [user]);

  const validateSignup = () => {
    if (!name.trim()) {
      Alert.alert("Name required", "Add your display name.");
      return false;
    }
    if (cleanMobile.length < 8) {
      Alert.alert("Mobile required", "Enter a valid mobile number.");
      return false;
    }
    return true;
  };

  const handleSignup = async () => {
    if (!validateSignup()) return;

    setLoading(true);
    let createdUser: FirebaseUser | null = null;
    try {
      const cred = await createUserWithEmailAndPassword(
        auth,
        email.trim(),
        password,
      );
      createdUser = cred.user;

      await runTransaction(db, async (transaction) => {
        const mobileRef = doc(db, "mobileNumbers", cleanMobile);
        const existing = await transaction.get(mobileRef);

        if (existing.exists()) {
          throw new Error(
            "This mobile number is already linked to an account.",
          );
        }

        const userProfile = {
          uid: cred.user.uid,
          name: name.trim(),
          email: cred.user.email,
          mobileNumber: cleanMobile,
          createdAt: serverTimestamp(),
        };

        transaction.set(doc(db, "users", cred.user.uid), userProfile);
        transaction.set(mobileRef, {
          uid: cred.user.uid,
          mobileNumber: cleanMobile,
          name: name.trim(),
          createdAt: serverTimestamp(),
        });
      });
    } catch (e) {
      if (createdUser) {
        await deleteUser(createdUser).catch(() => {});
      }
      Alert.alert("Signup error", e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  };

  const handleLogin = async () => {
    setLoading(true);
    try {
      await signInWithEmailAndPassword(auth, email.trim(), password);
    } catch (e) {
      Alert.alert("Login error", e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = async () => {
    try {
      await signOut(auth);
      setPassword("");
      setNewChatWith("");
    } catch (e) {
      Alert.alert("Sign out error", String(e));
    }
  };

  const handleCreateChat = async () => {
    if (!user) return Alert.alert("Not signed in");

    const receiverMobile = normalizeMobile(newChatWith);
    if (receiverMobile.length < 8) {
      return Alert.alert(
        "Mobile required",
        "Enter the receiver mobile number.",
      );
    }
    if (receiverMobile === profile?.mobileNumber) {
      return Alert.alert("Same account", "Enter another user's mobile number.");
    }

    setLoading(true);
    try {
      const mobileSnap = await getDoc(doc(db, "mobileNumbers", receiverMobile));
      if (!mobileSnap.exists()) {
        return Alert.alert("Not found", "No account uses this mobile number.");
      }

      const receiver = mobileSnap.data();
      const participantIds = [user.uid, receiver.uid].sort();
      const chatId = participantIds.join("_");
      await setDoc(
        doc(db, "chats", chatId),
        {
          participants: participantIds,
          participantMobiles: [profile?.mobileNumber, receiverMobile].filter(
            Boolean,
          ),
          participantNames: {
            [user.uid]: profile?.name || user.email || "Me",
            [receiver.uid]: receiver.name || receiverMobile,
          },
          updatedAt: serverTimestamp(),
          createdAt: serverTimestamp(),
        },
        { merge: true },
      );

      setNewChatWith("");
      router.push(`/chat/${chatId}`);
    } catch (e) {
      Alert.alert("Error", e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  };

  if (!user) {
    return (
      <KeyboardAvoidingView
        style={styles.screen}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <ScrollView contentContainerStyle={styles.authWrap}>
          <View style={styles.heroBadge}>
            <Text style={styles.heroBadgeText}>ChatMe</Text>
          </View>
          <Text style={styles.heroTitle}>Private chats by mobile ID</Text>
          <Text style={styles.heroSub}>
            Sign in with email and password. Your mobile number becomes your
            unique ChatMe ID.
          </Text>

          <View style={styles.panel}>
            <View style={styles.segment}>
              <Pressable
                onPress={() => setIsSignup(false)}
                style={[
                  styles.segmentButton,
                  !isSignup && styles.segmentActive,
                ]}
              >
                <Text
                  style={[
                    styles.segmentText,
                    !isSignup && styles.segmentTextActive,
                  ]}
                >
                  Sign in
                </Text>
              </Pressable>
              <Pressable
                onPress={() => setIsSignup(true)}
                style={[styles.segmentButton, isSignup && styles.segmentActive]}
              >
                <Text
                  style={[
                    styles.segmentText,
                    isSignup && styles.segmentTextActive,
                  ]}
                >
                  Sign up
                </Text>
              </Pressable>
            </View>

            {isSignup ? (
              <>
                <Text style={styles.label}>Name</Text>
                <TextInput
                  placeholder="Your display name"
                  value={name}
                  onChangeText={setName}
                  style={styles.input}
                  placeholderTextColor="#8b95a7"
                />
                <Text style={styles.label}>Mobile number</Text>
                <TextInput
                  placeholder="Unique mobile ID"
                  value={mobileNumber}
                  onChangeText={setMobileNumber}
                  style={styles.input}
                  keyboardType="phone-pad"
                  placeholderTextColor="#8b95a7"
                />
              </>
            ) : null}

            <Text style={styles.label}>Email</Text>
            <TextInput
              placeholder="you@example.com"
              value={email}
              onChangeText={setEmail}
              style={styles.input}
              autoCapitalize="none"
              keyboardType="email-address"
              placeholderTextColor="#8b95a7"
            />
            <Text style={styles.label}>Password</Text>
            <TextInput
              placeholder="Your password"
              value={password}
              onChangeText={setPassword}
              style={styles.input}
              secureTextEntry
              placeholderTextColor="#8b95a7"
            />

            <Pressable
              disabled={loading}
              onPress={isSignup ? handleSignup : handleLogin}
              style={[styles.primaryButton, loading && styles.buttonDisabled]}
            >
              {loading ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={styles.primaryButtonText}>
                  {isSignup ? "Create account" : "Enter ChatMe"}
                </Text>
              )}
            </Pressable>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    );
  }

  return (
    <View style={styles.screen}>
      <View style={styles.topBar}>
        <View>
          <Text style={styles.kicker}>Welcome back</Text>
          <Text style={styles.title}>{profile?.name || user.email}</Text>
          <Text style={styles.mobileTag}>
            ID: {profile?.mobileNumber || "loading..."}
          </Text>
        </View>
        <Pressable onPress={handleLogout} style={styles.ghostButton}>
          <Text style={styles.ghostText}>Sign out</Text>
        </Pressable>
      </View>

      <View style={styles.startChatBox}>
        <Text style={styles.boxTitle}>Start a chat</Text>
        <View style={styles.row}>
          <TextInput
            placeholder="Receiver mobile number"
            value={newChatWith}
            onChangeText={setNewChatWith}
            style={[styles.input, styles.flexInput]}
            keyboardType="phone-pad"
            placeholderTextColor="#8b95a7"
          />
          <Pressable
            disabled={loading}
            onPress={handleCreateChat}
            style={[styles.sendButton, loading && styles.buttonDisabled]}
          >
            <Text style={styles.sendButtonText}>New</Text>
          </Pressable>
        </View>
      </View>

      <FlatList
        data={chats}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.listContent}
        renderItem={({ item }) => {
          const otherId = (item.participants || []).find(
            (id: string) => id !== user.uid,
          );
          const otherName = item.participantNames?.[otherId] || "Chat";
          const mobiles = (item.participantMobiles || []).join(" / ");

          return (
            <Pressable
              onPress={() => router.push(`/chat/${item.id}`)}
              style={styles.chatCard}
            >
              <View style={styles.avatar}>
                <Text style={styles.avatarText}>
                  {String(otherName).charAt(0).toUpperCase()}
                </Text>
              </View>
              <View style={styles.chatInfo}>
                <Text style={styles.chatTitle}>{otherName}</Text>
                <Text style={styles.chatMeta}>{mobiles || item.id}</Text>
              </View>
              <Text style={styles.chevron}>›</Text>
            </Pressable>
          );
        }}
        ListEmptyComponent={
          <View style={styles.emptyState}>
            <Text style={styles.emptyTitle}>No chats yet</Text>
            <Text style={styles.emptyText}>
              Enter a friend mobile ID to begin.
            </Text>
          </View>
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: "#f3f7fb",
    padding: 18,
    marginTop: Platform.OS === "android" ? 7 : 0,
  },
  authWrap: {
    flexGrow: 1,
    justifyContent: "center",
    paddingVertical: 24,
  },
  heroBadge: {
    alignSelf: "flex-start",
    backgroundColor: "#0f172a",
    borderRadius: 999,
    paddingHorizontal: 14,
    paddingVertical: 7,
    marginBottom: 16,
  },
  heroBadgeText: {
    color: "#fff",
    fontWeight: "800",
    letterSpacing: 0,
  },
  heroTitle: {
    color: "#111827",
    fontSize: 34,
    fontWeight: "900",
    lineHeight: 39,
    marginBottom: 10,
  },
  heroSub: {
    color: "#526071",
    fontSize: 15,
    lineHeight: 22,
    marginBottom: 22,
  },
  panel: {
    backgroundColor: "#fff",
    borderRadius: 8,
    padding: 16,
    borderWidth: 1,
    borderColor: "#dbe4ee",
  },
  segment: {
    flexDirection: "row",
    backgroundColor: "#e8eef5",
    borderRadius: 8,
    padding: 4,
    marginBottom: 16,
  },
  segmentButton: {
    flex: 1,
    alignItems: "center",
    borderRadius: 7,
    paddingVertical: 10,
  },
  segmentActive: {
    backgroundColor: "#fff",
  },
  segmentText: {
    color: "#64748b",
    fontWeight: "700",
  },
  segmentTextActive: {
    color: "#0f172a",
  },
  label: {
    color: "#344256",
    fontSize: 12,
    fontWeight: "800",
    marginBottom: 6,
    textTransform: "uppercase",
  },
  input: {
    minHeight: 48,
    borderWidth: 1,
    borderColor: "#d6e0ea",
    backgroundColor: "#fbfdff",
    paddingHorizontal: 12,
    borderRadius: 8,
    marginBottom: 12,
    color: "#111827",
  },
  primaryButton: {
    minHeight: 50,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#2563eb",
    borderRadius: 8,
    marginTop: 4,
  },
  primaryButtonText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "800",
  },
  buttonDisabled: {
    opacity: 0.65,
  },
  topBar: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    gap: 12,
    paddingTop: 12,
    marginBottom: 18,
  },
  kicker: {
    color: "#2563eb",
    fontSize: 12,
    fontWeight: "900",
    textTransform: "uppercase",
  },
  title: {
    color: "#0f172a",
    fontSize: 28,
    fontWeight: "900",
    marginTop: 2,
  },
  mobileTag: {
    color: "#526071",
    marginTop: 4,
  },
  ghostButton: {
    borderWidth: 1,
    borderColor: "#cbd5e1",
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    backgroundColor: "#fff",
  },
  ghostText: {
    color: "#0f172a",
    fontWeight: "800",
  },
  startChatBox: {
    backgroundColor: "#0f172a",
    borderRadius: 8,
    padding: 14,
    marginBottom: 16,
  },
  boxTitle: {
    color: "#fff",
    fontSize: 18,
    fontWeight: "900",
    marginBottom: 10,
  },
  row: {
    flexDirection: "row",
    gap: 10,
    alignItems: "center",
  },
  flexInput: {
    flex: 1,
    marginBottom: 0,
    backgroundColor: "#fff",
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
  listContent: {
    paddingBottom: 24,
  },
  chatCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    backgroundColor: "#fff",
    borderRadius: 8,
    padding: 12,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: "#dde6f0",
  },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#dbeafe",
  },
  avatarText: {
    color: "#1d4ed8",
    fontSize: 18,
    fontWeight: "900",
  },
  chatInfo: {
    flex: 1,
  },
  chatTitle: {
    color: "#111827",
    fontSize: 16,
    fontWeight: "900",
  },
  chatMeta: {
    color: "#64748b",
    marginTop: 3,
  },
  chevron: {
    color: "#94a3b8",
    fontSize: 28,
  },
  emptyState: {
    alignItems: "center",
    padding: 28,
    borderRadius: 8,
    backgroundColor: "#fff",
    borderWidth: 1,
    borderColor: "#dde6f0",
  },
  emptyTitle: {
    color: "#0f172a",
    fontSize: 18,
    fontWeight: "900",
    marginBottom: 4,
  },
  emptyText: {
    color: "#64748b",
    textAlign: "center",
  },
});
