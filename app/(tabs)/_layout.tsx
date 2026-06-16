import { Tabs } from "expo-router";
import React, { useEffect, useState } from "react";

import { HapticTab } from "@/components/haptic-tab";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { auth, db } from "@/firebase/config";
import { onAuthStateChanged } from "firebase/auth";
import { collection, onSnapshot, query, where } from "firebase/firestore";

export default function TabLayout() {
  const [signedIn, setSignedIn] = useState<boolean>(false);
  const [userId, setUserId] = useState<string | null>(null);
  const [unreadTotal, setUnreadTotal] = useState(0);

  const tabBarStyle = signedIn
    ? {
        display: "none" as const,
      }
    : {
        display: "none" as const,
      };

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (u) => {
      setSignedIn(!!u);
      setUserId(u?.uid ?? null);
    });
    return unsub;
  }, []);

  useEffect(() => {
    if (!userId) {
      setUnreadTotal(0);
      return;
    }

    const chatsQuery = query(
      collection(db, "chats"),
      where("participants", "array-contains", userId),
    );

    return onSnapshot(
      chatsQuery,
      (snap) => {
        let total = 0;
        snap.forEach((chatDoc) => {
          const data = chatDoc.data();
          const count = data.unreadCounts?.[userId];
          if (typeof count === "number") total += count;
        });
        setUnreadTotal(total);
      },
      () => {
        setUnreadTotal(0);
      },
    );
  }, [userId]);

  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: "#22c55e",
        tabBarInactiveTintColor: "#94a3b8",
        headerShown: false,
        tabBarButton: HapticTab,
        tabBarStyle,
        tabBarLabelStyle: {
          fontSize: 12,
          fontWeight: "800",
        },
        tabBarHideOnKeyboard: true,
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: "Home",
          tabBarBadge:
            unreadTotal > 0
              ? unreadTotal > 99
                ? "99+"
                : unreadTotal
              : undefined,
          tabBarIcon: ({ color }) => (
            <IconSymbol size={28} name="house.fill" color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="chat"
        options={{
          href: null,
          tabBarIcon: ({ color }) => (
            <IconSymbol size={28} name="paperplane.fill" color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          href: null,
        }}
      />
      <Tabs.Screen
        name="explore"
        options={{
          href: null,
        }}
      />
    </Tabs>
  );
}
