import { DefaultTheme, ThemeProvider } from "@react-navigation/native";
import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import React from "react";
import "react-native-reanimated";

export const unstable_settings = {
  anchor: "(tabs)",
};

// Force light theme for visibility
export default function RootLayout() {
  React.useEffect(() => {
    // enable auth persistence if AsyncStorage is installed
    (async () => {
      try {
        const mod = await import("@/firebase/config");
        if (mod && typeof mod.enableAuthPersistence === "function") {
          await mod.enableAuthPersistence();
        }
      } catch {
        // ignore
      }
    })();
  }, []);

  return (
    <ThemeProvider value={DefaultTheme}>
      <Stack>
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen
          name="modal"
          options={{ presentation: "modal", title: "Modal" }}
        />
      </Stack>
      <StatusBar style="dark" />
    </ThemeProvider>
  );
}
