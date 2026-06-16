import { initializeApp } from "firebase/app";
import { getAuth, initializeAuth } from "firebase/auth";
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

export const auth = getAuth(app);

/**
 * Enable persistent auth using @react-native-async-storage/async-storage.
 * Call this once at app startup (for example in `app/_layout.tsx`).
 */
export async function enableAuthPersistence() {
  try {
    // @ts-ignore (optional dependency)
    const asyncPkg = await import("@react-native-async-storage/async-storage");
    // Build a small AsyncStorage-backed persistence object as a safe fallback.
    // This avoids relying on the internal 'firebase/auth/react-native' path which
    // may not be exported by all SDK versions.
    const AsyncStorage = (asyncPkg as any).default || (asyncPkg as any);
    if (AsyncStorage) {
      const simplePersistence = {
        // Firebase only needs an object with async get/set/remove methods
        async get(key: string) {
          return await AsyncStorage.getItem(key);
        },
        async set(key: string, value: string) {
          await AsyncStorage.setItem(key, value);
        },
        async remove(key: string) {
          await AsyncStorage.removeItem(key);
        },
      } as any;

      try {
        return initializeAuth(app, { persistence: simplePersistence });
      } catch (e) {
        // Some firebase versions expect a specific persistence wrapper; if initializeAuth
        // rejects, fall back to memory persistence.
        console.debug("initializeAuth with simplePersistence failed", e);
      }
    }
  } catch (err) {
    // async-storage not available or failed to initialize — fall back to memory persistence
    console.warn(
      "AsyncStorage persistence unavailable, auth will use memory persistence",
      err,
    );
  }
  return auth;
}
export const db = getFirestore(app);
export { serverTimestamp };

// Helper: path conventions
export const CHATS_COLLECTION = "chats";

export default app;
