// AdMob 광고 컴포넌트.
//
// 실제 AdMob 연동 전 정책 체크리스트:
//   1) react-native-google-mobile-ads 설치 (Expo Bare 또는 EAS Build 필요)
//   2) AdMob 콘솔에서 광고 단위 ID 발급
//   3) app.json / app.config.js 에 plugins 등록 + 광고 ID 환경변수
//   4) 초기화 시 다음 설정 적용:
//        - maxAdContentRating: 'T'         // 13세 이상 일반 — 자녀 대상 앱이 아님
//        - tagForChildDirectedTreatment: false  // COPPA: 13세 미만 대상 아님
//        - tagForUnderAgeOfConsent: false       // GDPR 동의 연령 미만 사용자 아님
//        - testDeviceIdentifiers: 개발 빌드에서만 설정
//   5) 비개인화 광고(NPA): GDPR/한국 개인정보보호법 준수를 위해
//        - 사용자가 광고 동의 거부 시 requestNonPersonalizedAdsOnly = true
//        - UMP(User Messaging Platform) 또는 자체 동의 UI 필요
//   6) Google AdMob 콘텐츠 정책에 따라 다음 카테고리 차단 권장:
//        - HG_NOT_FAMILY_SAFE (성인)
//        - 가상자산 거래·ICO 광고 (한국 지역 규제)
//      → AdMob 콘솔 "차단된 카테고리" 에서 설정

import React from 'react';
import { View, Text, StyleSheet } from 'react-native';

// TODO: AdMob SDK 통합 후 BannerAd 컴포넌트로 교체
const BannerAdComponent = () => {
  return (
    <View style={styles.container}>
      <Text style={styles.placeholderText}>광고 영역</Text>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
    height: 50,
    backgroundColor: '#F1F5F9',
    marginVertical: 5,
  },
  placeholderText: { fontSize: 11, color: '#94A3B8' },
});

export default BannerAdComponent;
