import { auth, db, serverTimestamp } from "@/firebase/config";
import { useRouter } from "expo-router";
import {
    User as FirebaseUser,
    onAuthStateChanged,
    signOut,
    updatePassword,
    updateProfile,
} from "firebase/auth";
import { doc, onSnapshot, setDoc } from "firebase/firestore";
import React, { useEffect, useState } from "react";
import {
    ActivityIndicator,
    Alert,
    KeyboardAvoidingView,
    Platform,
    Pressable,
    ScrollView,
    StyleSheet,
    Text,
    TextInput,
    View,
} from "react-native";

type Profile = {
  uid: string;
  name: string;
  email: string | null;
  mobileNumber: string;
  photoURL?: string | null;
};

const lightProfileTheme = {
  screen: "#f3f7fb",
  panel: "#fff",
  input: "#fbfdff",
  readonly: "#eef4fa",
  border: "#dbe4ee",
  title: "#0f172a",
  label: "#344256",
  subtle: "#64748b",
  accent: "#2563eb",
  avatarBg: "#0f172a",
  avatarText: "#fff",
  smallAvatarBg: "#dbeafe",
  signOutBg: "#fff1f2",
};

export default function ProfileScreen() {
  const router = useRouter();
  const [user, setUser] = useState<FirebaseUser | null>(auth.currentUser);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [name, setName] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const theme = lightProfileTheme;

  // sanitize display strings: remove literal backslash-n sequences, real newlines, and stray pluses
  const sanitize = (s?: string | null) => {
    if (!s) return "";
    return String(s)
      .replace(/\\n/g, " ")
      .replace(/\n/g, " ")
      .replace(/\+/g, " ")
      .replace(/\s+/g, " ")
      .trim();
  };

  useEffect(() => {
    return onAuthStateChanged(auth, (nextUser) => {
      setUser(nextUser);
      if (!nextUser) {
        setProfile(null);
        setName("");
        setNewPassword("");
        router.replace("/");
      }
    });
  }, [router]);

  useEffect(() => {
    if (!user) return;

    return onSnapshot(
      doc(db, "users", user.uid),
      (snap) => {
        const data = snap.exists() ? (snap.data() as Profile) : null;
        setProfile(data);
        setName(data?.name || user.displayName || "");
      },
      () => {
        setProfile(null);
      },
    );
  }, [user]);

  const handleSave = async () => {
    if (!user) return;

    const cleanName = name.trim();
    if (!cleanName) {
      Alert.alert("Name required", "Enter your display name.");
      return;
    }

    if (newPassword && newPassword.length < 6) {
      Alert.alert("Password too short", "Use at least 6 characters.");
      return;
    }

    setLoading(true);
    try {
      await updateProfile(user, {
        displayName: cleanName,
        photoURL: profile?.photoURL || user.photoURL,
      });

      await setDoc(
        doc(db, "users", user.uid),
        {
          uid: user.uid,
          name: cleanName,
          email: user.email,
          mobileNumber: profile?.mobileNumber || "",
          photoURL: profile?.photoURL || user.photoURL || null,
          updatedAt: serverTimestamp(),
        },
        { merge: true },
      );

      if (profile?.mobileNumber) {
        await setDoc(
          doc(db, "mobileNumbers", profile.mobileNumber),
          {
            uid: user.uid,
            mobileNumber: profile.mobileNumber,
            name: cleanName,
            updatedAt: serverTimestamp(),
          },
          { merge: true },
        );
      }

      if (newPassword) {
        await updatePassword(user, newPassword);
        setNewPassword("");
      }

      Alert.alert("Profile saved", "Your details were updated.");
    } catch (e) {
      Alert.alert("Profile error", e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  };

  const handleSignOut = async () => {
    setLoading(true);
    try {
      await signOut(auth);
      router.replace("/");
    } catch (e) {
      Alert.alert("Sign out error", e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  };

  if (!user) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator color={lightProfileTheme.accent} />
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      style={[styles.screen, { backgroundColor: theme.screen }]}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.header}>
          <View style={[styles.photo, { backgroundColor: theme.avatarBg }]}>
            <Text style={[styles.photoText, { color: theme.avatarText }]}>
              {sanitize(profile?.name || user.email || "U")
                .charAt(0)
                .toUpperCase()}
            </Text>
          </View>
          <View style={styles.headerText}>
            <Text style={[styles.kicker, { color: theme.accent }]}>
              Profile
            </Text>
            <Text style={[styles.title, { color: theme.title }]}>
              {sanitize(profile?.name || user.email)}
            </Text>
            <Text style={[styles.mobileTag, { color: theme.subtle }]}>
              ID: {sanitize(profile?.mobileNumber) || "loading..."}
            </Text>
          </View>
        </View>

        <View
          style={[
            styles.panel,
            { backgroundColor: theme.panel, borderColor: theme.border },
          ]}
        >
          <View style={styles.modeRow}>
            <View>
              <Text style={[styles.sectionTitle, { color: theme.title }]}>
                Account details
              </Text>
            </View>
          </View>

          <Text style={[styles.label, { color: theme.label }]}>
            Profile picture
          </Text>
          <View style={styles.photoRow}>
            <View
              style={[
                styles.smallPhoto,
                { backgroundColor: theme.smallAvatarBg },
              ]}
            >
              <Text style={[styles.smallPhotoText, { color: theme.accent }]}>
                {sanitize(profile?.name || user.email || "U")
                  .charAt(0)
                  .toUpperCase()}
              </Text>
            </View>
            <Text style={[styles.photoNote, { color: theme.subtle }]}>
              Profile picture setup is next.
            </Text>
          </View>

          <Text style={[styles.label, { color: theme.label }]}>Name</Text>
          <TextInput
            value={name}
            onChangeText={setName}
            placeholder="Your display name"
            placeholderTextColor="#8b95a7"
            style={[
              styles.input,
              {
                backgroundColor: theme.input,
                borderColor: theme.border,
                color: theme.title,
              },
            ]}
          />

          <Text style={[styles.label, { color: theme.label }]}>Email</Text>
          <TextInput
            value={user.email || ""}
            editable={false}
            style={[
              styles.input,
              styles.readonlyInput,
              {
                backgroundColor: theme.readonly,
                borderColor: theme.border,
                color: theme.subtle,
              },
            ]}
          />

          <Text style={[styles.label, { color: theme.label }]}>
            New password
          </Text>
          <TextInput
            value={"Contact rudradeb.business@gmail.com"}
            editable={false}
            style={[
              styles.input,
              styles.readonlyInput,
              {
                backgroundColor: theme.readonly,
                borderColor: theme.border,
                color: theme.subtle,
              },
            ]}
          />

          <Pressable
            disabled={loading}
            onPress={handleSave}
            style={[styles.primaryButton, loading && styles.buttonDisabled]}
          >
            {loading ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.primaryButtonText}>Save changes</Text>
            )}
          </Pressable>

          <Pressable
            disabled={loading}
            onPress={handleSignOut}
            style={[
              styles.signOutButton,
              { backgroundColor: theme.signOutBg },
              loading && styles.buttonDisabled,
            ]}
          >
            <Text style={styles.signOutText}>Sign out</Text>
          </Pressable>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: "#f3f7fb",
    marginTop: Platform.OS === "android" ? 7 : 0,
  },
  centered: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#f3f7fb",
  },
  content: {
    padding: 18,
    paddingBottom: 32,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    paddingTop: 12,
    marginBottom: 18,
  },
  photo: {
    width: 68,
    height: 68,
    borderRadius: 34,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#0f172a",
  },
  photoText: {
    color: "#fff",
    fontSize: 26,
    fontWeight: "900",
  },
  headerText: {
    flex: 1,
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
  panel: {
    backgroundColor: "#fff",
    borderRadius: 8,
    padding: 16,
    borderWidth: 1,
    borderColor: "#dbe4ee",
  },
  sectionTitle: {
    color: "#111827",
    fontSize: 18,
    fontWeight: "900",
  },
  modeRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
    marginBottom: 14,
  },
  modeHint: {
    marginTop: 3,
    fontSize: 13,
  },
  label: {
    color: "#344256",
    fontSize: 12,
    fontWeight: "800",
    marginBottom: 6,
    textTransform: "uppercase",
  },
  photoRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    minHeight: 54,
    marginBottom: 14,
  },
  smallPhoto: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#dbeafe",
  },
  smallPhotoText: {
    color: "#1d4ed8",
    fontSize: 18,
    fontWeight: "900",
  },
  photoNote: {
    flex: 1,
    color: "#64748b",
    lineHeight: 20,
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
  readonlyInput: {
    color: "#64748b",
    backgroundColor: "#eef4fa",
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
  signOutButton: {
    minHeight: 50,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "#fecaca",
    backgroundColor: "#fff1f2",
    borderRadius: 8,
    marginTop: 12,
  },
  signOutText: {
    color: "#be123c",
    fontSize: 16,
    fontWeight: "900",
  },
  buttonDisabled: {
    opacity: 0.65,
  },
});
