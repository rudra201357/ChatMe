Firebase setup for ChatMe (basic)

1. Create a Firebase project at https://console.firebase.google.com/

2. Enable Authentication > Sign-in method > Email/Password (or enable Anonymous if you also want that)

3. Enable Firestore (in Native mode)

4. Project config
   - Go to Project settings and copy the web app config values (apiKey, authDomain, projectId, ...)
   - Paste them into `firebase/config.ts` replacing the placeholder values

5) Install AsyncStorage for persistent auth (React Native)

```bash
npm install @react-native-async-storage/async-storage
# or
yarn add @react-native-async-storage/async-storage
```

The project already attempts to use AsyncStorage if installed. If you prefer to add persistence manually, use the snippet below.

```js
import { initializeAuth, getReactNativePersistence } from "firebase/auth";
// For @react-native-async-storage/async-storage v3:
import { createAsyncStorage } from "@react-native-async-storage/async-storage";
const appStorage = createAsyncStorage("app");
const persistence = getReactNativePersistence(appStorage);

// For v2:
// import ReactNativeAsyncStorage from '@react-native-async-storage/async-storage';
// const persistence = getReactNativePersistence(ReactNativeAsyncStorage);

const auth = initializeAuth(app, { persistence });
```

If you prefer the repository helper, the project exports `enableAuthPersistence()` from `firebase/config.ts` which will
attempt to enable AsyncStorage persistence at runtime. Call it once at app startup (for example in `app/_layout.tsx`).

5. Firestore security rules (basic example)

```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /users/{userId} {
      allow read: if request.auth != null;
      allow create, update: if request.auth != null && request.auth.uid == userId;
    }

    match /mobileNumbers/{mobileNumber} {
      allow read: if request.auth != null;
      allow create: if request.auth != null
        && request.resource.data.uid == request.auth.uid
        && request.resource.data.mobileNumber == mobileNumber;
      allow update, delete: if false;
    }

    match /chats/{chatId} {
      allow read: if request.auth != null
        && request.auth.uid in resource.data.participants;
      allow create: if request.auth != null
        && request.auth.uid in request.resource.data.participants
        && request.resource.data.participants.size() == 2;
      allow update: if request.auth != null
        && request.auth.uid in resource.data.participants
        && request.resource.data.participants == resource.data.participants;

      match /messages/{messageId} {
        allow read: if request.auth != null
          && request.auth.uid in get(/databases/$(database)/documents/chats/$(chatId)).data.participants;
        allow create: if request.auth != null
          && request.auth.uid in get(/databases/$(database)/documents/chats/$(chatId)).data.participants
          && request.resource.data.senderId == request.auth.uid;
        allow update: if request.auth != null
          && request.auth.uid in get(/databases/$(database)/documents/chats/$(chatId)).data.participants;
      }
    }
  }
}
```

6. How the data is structured
   - `users/{userId}`: { uid, name, email, mobileNumber, createdAt }
   - `mobileNumbers/{mobileNumber}`: { uid, mobileNumber, name, createdAt } used as the unique public chat ID lookup
   - `chats/{sortedUid1_sortedUid2}`: { participants: [uid1, uid2], participantMobiles, participantNames, createdAt, updatedAt }
   - `chats/{chatId}/messages/{messageId}`: { text, senderId, createdAt, read }

7. Notes

- Sign up with Email/Password from the app. Each account must add a unique mobile number, and chats are started with that mobile number instead of the generated Firebase UID.
- This demo only handles text messages and a simple read flag per message.
