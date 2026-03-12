import React from "react";
import { SafeAreaView, StyleSheet, View, type ViewStyle } from "react-native";
import { colors } from "../theme/colors";
import { AnimatedBackdrop } from "./AnimatedBackdrop";

export function Screen(props: { children: React.ReactNode; style?: ViewStyle }) {
  return (
    <SafeAreaView style={styles.safe}>
      <AnimatedBackdrop />
      <View style={[styles.content, props.style]}>{props.children}</View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: colors.bg,
  },
  content: {
    flex: 1,
    padding: 16,
  },
});
