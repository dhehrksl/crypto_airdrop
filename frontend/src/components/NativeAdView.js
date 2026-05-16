// 네이티브 광고 컴포넌트. BannerAdComponent와 동일한 정책이 적용됩니다.
// BannerAdComponent.js 상단 주석 참고.

import React from 'react';
import { View, Text, StyleSheet } from 'react-native';

const NativeAdView = () => {
  return (
    <View style={styles.container}>
      <Text style={styles.adLabel}>광고</Text>
      <Text style={styles.placeholderText}>네이티브 광고 영역</Text>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
    height: 120,
    backgroundColor: '#F1F5F9',
    marginVertical: 8,
    marginHorizontal: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  // Google AdMob 정책상 광고 영역에는 "광고/Ad/Sponsored" 라벨을 명확히 표시해야 함.
  adLabel: {
    position: 'absolute',
    top: 8,
    left: 8,
    fontSize: 10,
    fontWeight: '700',
    color: '#64748B',
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    overflow: 'hidden',
  },
  placeholderText: { fontSize: 11, color: '#94A3B8' },
});

export default NativeAdView;
