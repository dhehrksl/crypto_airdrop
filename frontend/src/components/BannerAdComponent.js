// AdMob 하단 배너.
//
// SDK가 설치되어 있고(EAS Build) Unit ID가 채워져 있으면 실제 BannerAd 렌더.
// 그 외(Expo Go, 운영 ID 미입력)는 placeholder — 광고 없음.
//
// Google AdMob 정책: 광고 영역에는 "광고" 라벨이 보여야 함. BannerAd 자체에
// "Test Ad" / 광고 표시가 들어가므로 dev에서는 라벨 중복 없음. 운영 시에도 AdMob
// 자체 표기를 따른다.

import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import {
  ADMOB_BANNER_UNIT_ID,
  requireSdk,
  getRequestOptions,
} from '../services/admobConfig';
import useAdConsent from '../hooks/useAdConsent';
import { colors } from '../constants/theme';

const Placeholder = ({ label = '광고 영역' }) => (
  <View style={styles.placeholder}>
    <Text style={styles.placeholderText}>{label}</Text>
  </View>
);

const BannerAdComponent = () => {
  const sdk = requireSdk();
  const { resolved, allowed } = useAdConsent();
  // 정책상 UMP 동의가 완료되기 전엔 광고 요청 금지. allowed=false(사용자 거부 등)도 미표시.
  if (!sdk || !ADMOB_BANNER_UNIT_ID || !resolved || !allowed) {
    return <Placeholder />;
  }
  const { BannerAd, BannerAdSize } = sdk;
  return (
    <View style={styles.container}>
      <BannerAd
        unitId={ADMOB_BANNER_UNIT_ID}
        size={BannerAdSize.ANCHORED_ADAPTIVE_BANNER}
        requestOptions={getRequestOptions()}
        onAdFailedToLoad={(err) => {
          if (__DEV__) console.log('[BannerAd] failed:', err?.message || err);
        }}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 50,
    backgroundColor: colors.bgElevated,
    borderTopWidth: 1,
    borderTopColor: colors.hairline,
  },
  placeholder: {
    alignItems: 'center',
    justifyContent: 'center',
    height: 50,
    backgroundColor: colors.bgElevated,
    borderTopWidth: 1,
    borderTopColor: colors.hairline,
  },
  placeholderText: { fontSize: 11, color: colors.textMuted },
});

export default BannerAdComponent;
