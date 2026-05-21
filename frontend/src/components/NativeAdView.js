// 피드 중간 광고 슬롯. RN의 "Native Advanced" 광고는 별도 큰 통합 작업이라,
// 본 앱은 MEDIUM_RECTANGLE 배너로 슬롯을 채워 같은 정책 헤더와 fallback을 공유한다.
// 향후 Native Advanced로 교체 시에도 이 컴포넌트 내부만 바꾸면 됨.

import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import {
  ADMOB_RECT_UNIT_ID,
  requireSdk,
  getRequestOptions,
} from '../services/admobConfig';
import useAdConsent from '../hooks/useAdConsent';
import { colors, radius } from '../constants/theme';

const Placeholder = () => (
  <View style={styles.container}>
    <Text style={styles.adLabel}>광고</Text>
    <Text style={styles.placeholderText}>광고 영역</Text>
  </View>
);

const NativeAdView = () => {
  const sdk = requireSdk();
  const { resolved, allowed } = useAdConsent();
  if (!sdk || !ADMOB_RECT_UNIT_ID || !resolved || !allowed) {
    return <Placeholder />;
  }
  const { BannerAd, BannerAdSize } = sdk;
  return (
    <View style={styles.adWrap}>
      <Text style={styles.adLabel}>광고</Text>
      <BannerAd
        unitId={ADMOB_RECT_UNIT_ID}
        size={BannerAdSize.MEDIUM_RECTANGLE}
        requestOptions={getRequestOptions()}
        onAdFailedToLoad={(err) => {
          if (__DEV__) console.log('[NativeAdView] failed:', err?.message || err);
        }}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
    height: 120,
    backgroundColor: colors.surface,
    marginVertical: 8,
    marginHorizontal: 16,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.hairline,
  },
  adWrap: {
    alignItems: 'center',
    justifyContent: 'center',
    marginVertical: 8,
    marginHorizontal: 16,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.hairline,
    overflow: 'hidden',
    paddingTop: 18,
    backgroundColor: colors.surface,
  },
  // Google AdMob 정책상 광고 영역에는 "광고/Ad/Sponsored" 라벨을 명확히 표시.
  adLabel: {
    position: 'absolute',
    top: 8,
    left: 8,
    fontSize: 10,
    fontWeight: '700',
    color: colors.textSecondary,
    backgroundColor: colors.surfaceAlt,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    overflow: 'hidden',
    zIndex: 2,
  },
  placeholderText: { fontSize: 11, color: colors.textMuted },
});

export default NativeAdView;
