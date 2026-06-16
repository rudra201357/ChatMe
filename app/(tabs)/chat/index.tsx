import { useRouter } from "expo-router";
import { Pressable, StyleSheet, Text, View } from "react-native";

export default function ChatTabScreen() {
  const router = useRouter();

  return (
    <View style={styles.screen}>
      <View style={styles.panel}>
        <Text style={styles.title}>No chat selected</Text>
        <Text style={styles.subtitle}>
          Choose a receiver from Home to start messaging.
        </Text>
        <Pressable onPress={() => router.push("/")} style={styles.button}>
          <Text style={styles.buttonText}>Go Home</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#eef4fa",
    padding: 18,
  },
  panel: {
    width: "100%",
    maxWidth: 360,
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#dbe4ee",
    borderRadius: 8,
    backgroundColor: "#fff",
    padding: 18,
  },
  title: {
    color: "#111827",
    fontSize: 20,
    fontWeight: "900",
    marginBottom: 6,
  },
  subtitle: {
    color: "#64748b",
    fontSize: 14,
    lineHeight: 20,
    marginBottom: 16,
    textAlign: "center",
  },
  button: {
    minHeight: 46,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 8,
    backgroundColor: "#22c55e",
    paddingHorizontal: 18,
  },
  buttonText: {
    color: "#052e16",
    fontWeight: "900",
  },
});
