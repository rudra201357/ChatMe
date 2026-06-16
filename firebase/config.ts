import { initializeApp } from "firebase/app";
import { getAuth, initializeAuth, type Auth } from "firebase/auth";
import { getFirestore, serverTimestamp } from "firebase/firestore";

// Firebase config loaded from environment variables
export const firebaseConfig = {
  apiKey: process.env.EXPO_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.EXPO_PUBLIC_FIREBASE_APP_ID,
};

const app = initializeApp(firebaseConfig);

function createAuth(): Auth {
  // Only initialize native AsyncStorage persistence when running in React Native
  // (detect via navigator.product === 'ReactNative'). For web or Node, fall back to getAuth.
  if (
    typeof navigator === "undefined" ||
    (navigator as any).product !== "ReactNative"
  ) {
    return getAuth(app);
  }

  try {
    // Dynamically require AsyncStorage only on React Native environments.
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const AsyncStorage =
      require("@react-native-async-storage/async-storage").default;

    class AsyncStoragePersistence {
      static type = "LOCAL";
      readonly type = "LOCAL";

      async _isAvailable() {
        return true;
      }

      async _set(key: string, value: unknown) {
        await AsyncStorage.setItem(key, JSON.stringify(value));
      }

      async _get<T>(key: string) {
        const value = await AsyncStorage.getItem(key);
        if (value == null) return null;

        try {
          return JSON.parse(value) as T;
        } catch {
          return value as T;
        }
      }

      async _remove(key: string) {
        await AsyncStorage.removeItem(key);
      }

      _addListener() {}

      _removeListener() {}
    }

    return initializeAuth(app, { persistence: AsyncStoragePersistence as any });
  } catch {
    return getAuth(app);
  }
}

export const auth = createAuth();
export const db = getFirestore(app);
export { serverTimestamp };

// Helper: path conventions
export const CHATS_COLLECTION = "chats";

export default app;
