// AdMob 광고 단위 ID + 정책 설정.
// 실제 광고 표시는 react-native-google-mobile-ads 통합 + EAS Build 필요.
// 현재 BannerAdComponent/NativeAdView는 placeholder — SDK 연결 시 이 모듈에서 ID 읽도록 사용.

import { Platform } from 'react-native';
import Constants from 'expo-constants';

const extra = Constants.expoConfig?.extra ?? Constants.manifest?.extra ?? {};
const cfg = extra.admob || {};

// Google AdMob 공식 테스트 ID — dev 빌드에서만 사용. 운영에 노출되면 정책 위반.
const TEST_IDS = {
  bannerAndroid: 'ca-app-pub-3940256099942544/6300978111',
  bannerIos: 'ca-app-pub-3940256099942544/2934735716',
  nativeAndroid: 'ca-app-pub-3940256099942544/2247696110',
  nativeIos: 'ca-app-pub-3940256099942544/3986624511',
};

function pick(key) {
  if (__DEV__) return TEST_IDS[key];
  // 운영: app.json의 expo.extra.admob에서 읽기. 비어있으면 광고 안 띄움.
  if (Platform.OS === 'android') return cfg[`${key.replace(/Ios|Android/, '')}Android`] || '';
  if (Platform.OS === 'ios') return cfg[`${key.replace(/Ios|Android/, '')}Ios`] || '';
  return '';
}

export const ADMOB_BANNER_UNIT_ID = pick(Platform.OS === 'android' ? 'bannerAndroid' : 'bannerIos');
export const ADMOB_NATIVE_UNIT_ID = pick(Platform.OS === 'android' ? 'nativeAndroid' : 'nativeIos');

export const ADMOB_REQUEST_CONFIG = {
  // 자녀 대상 콘텐츠 아님 — COPPA 준수
  tagForChildDirectedTreatment: false,
  // GDPR 동의 연령 미만 사용자 아님
  tagForUnderAgeOfConsent: false,
  // 13세 이상 일반 사용자 대상 (Teen) — 암호화폐 콘텐츠라 일반 등급으로 한정
  maxAdContentRating: 'T',
  // 사용자가 추적 동의 거부 시 true로 동적 전환 (UMP 통합 필요)
  requestNonPersonalizedAdsOnly: false,
};

// react-native-google-mobile-ads 통합 시 호출용 — App.js 최상위에서 1회.
// 실제 통합 코드:
//
//   import mobileAds, { MaxAdContentRating } from 'react-native-google-mobile-ads';
//   import { ADMOB_REQUEST_CONFIG } from './services/admobConfig';
//
//   export async function initAdMob() {
//     await mobileAds().setRequestConfiguration({
//       maxAdContentRating: MaxAdContentRating.T,
//       tagForChildDirectedTreatment: ADMOB_REQUEST_CONFIG.tagForChildDirectedTreatment,
//       tagForUnderAgeOfConsent: ADMOB_REQUEST_CONFIG.tagForUnderAgeOfConsent,
//       testDeviceIdentifiers: __DEV__ ? ['EMULATOR'] : [],
//     });
//     await mobileAds().initialize();
//   }
