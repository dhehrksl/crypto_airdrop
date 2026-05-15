import React from 'react';
import { View, Text, StyleSheet } from 'react-native';

const BannerAdComponent = () => {
  return (
    <View style={styles.container}>
      <Text>광고 없음</Text>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
    height: 50, // Standard banner ad height
    backgroundColor: '#f0f0f0',
    marginVertical: 5,
  },
});

export default BannerAdComponent;
