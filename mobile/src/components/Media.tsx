import React, { useState } from "react";
import { Image, View, Text } from "react-native";
import { Ionicons } from "@expo/vector-icons";
export function Media({
  uri,
  name = "",
  size = 52,
  cover = false,
}: {
  uri?: string;
  name?: string;
  size?: number;
  cover?: boolean;
}) {
  const [failed, setFailed] = useState<string | null>(null);
  const shape = {
    width: size,
    height: cover ? size * 1.45 : size,
    borderRadius: cover ? 12 : size / 2,
  };
  return (
    <View
      style={{
        ...shape,
        backgroundColor: "#24221D",
        borderWidth: 1,
        borderColor: "rgba(232,199,124,.22)",
        overflow: "hidden",
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      {uri && failed !== uri ? (
        <Image
          accessibilityLabel={name}
          source={{ uri }}
          onError={() => setFailed(uri)}
          resizeMode="cover"
          style={shape}
        />
      ) : cover ? (
        <Ionicons name="albums-outline" color="#E8C77C" size={size * 0.4} />
      ) : (
        <Text
          style={{
            color: "#E8C77C",
            fontFamily: "Cairo_700Bold",
            fontSize: size * 0.35,
          }}
        >
          {name.trim().slice(0, 1) || "✦"}
        </Text>
      )}
    </View>
  );
}
