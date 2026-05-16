// AdMob 정책 준수 설정.
// 실제 통합 시: import mobileAds, { MaxAdContentRating } from 'react-native-google-mobile-ads';
// App.js 시작 시점에 initAdMob() 호출.

export const ADMOB_REQUEST_CONFIG = {
  // 자녀 대상 콘텐츠 아님 — COPPA 준수
  tagForChildDirectedTreatment: false,
  // GDPR 동의 연령 미만 사용자 아님
  tagForUnderAgeOfConsent: false,
  // 13세 이상 일반 사용자 대상 (Teen)
  maxAdContentRating: 'T',
  // 비개인화 광고 — 사용자가 광고 동의 거부 시 true로 동적 전환 권장
  requestNonPersonalizedAdsOnly: false,
};

// 실제 통합 코드 (참고용):
//
// import mobileAds, { MaxAdContentRating } from 'react-native-google-mobile-ads';
//
// export async function initAdMob() {
//   await mobileAds().setRequestConfiguration({
//     maxAdContentRating: MaxAdContentRating.T,
//     tagForChildDirectedTreatment: false,
//     tagForUnderAgeOfConsent: false,
//     testDeviceIdentifiers: __DEV__ ? ['EMULATOR'] : [],
//   });
//   await mobileAds().initialize();
// }
