import React from 'react';
import { View, Text, StyleSheet } from 'react-native';

const NativeAdView = () => {
  return (
    <View style={styles.container}>
      <Text>네이티브 광고 없음</Text>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
    height: 250, // Example height for a native ad
    backgroundColor: '#e0e0e0',
    marginVertical: 10,
  },
});

export default NativeAdView;
