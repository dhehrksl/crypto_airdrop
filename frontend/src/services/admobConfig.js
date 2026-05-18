// AdMob 통합 — react-native-google-mobile-ads 래퍼.
//
// 1) 광고 단위 ID: dev 빌드는 항상 Google 테스트 ID (운영 ID 노출 시 정책 위반).
//    production은 app.json expo.extra.admob.* 에서 읽음. 비어있으면 광고 미표시.
// 2) SDK는 Expo Go에서 동작 X — EAS Build/dev-client 필요. 미설치 환경에서는
//    requireSdk()가 null을 반환하고 BannerAdComponent가 placeholder로 fallback.
// 3) UMP(EU 동의 UI)는 미구현. NPA 토글은 setNpa()로 동적 전환 가능 — 한국 PIPA
//    동의 UI를 별도 도입하면 거기서 호출.

import { Platform } from 'react-native';
import Constants from 'expo-constants';

const extra = Constants.expoConfig?.extra ?? Constants.manifest?.extra ?? {};
const cfg = extra.admob || {};

// Google AdMob 공식 테스트 ID (https://developers.google.com/admob/android/test-ads)
// dev 빌드에서만 사용. 운영 노출 시 정책 위반 → 계정 정지 위험.
const TEST_IDS = {
  bannerAndroid: 'ca-app-pub-3940256099942544/6300978111',
  bannerIos: 'ca-app-pub-3940256099942544/2934735716',
  // Native advanced는 RN 통합이 별도 작업이라 본 앱은 banner로 통일.
  // 피드 중간 슬롯은 MEDIUM_RECTANGLE 배너 사용.
  rectAndroid: 'ca-app-pub-3940256099942544/6300978111', // banner와 동일 — 테스트 환경
  rectIos: 'ca-app-pub-3940256099942544/2934735716',
};

function pickId(key) {
  if (__DEV__) return TEST_IDS[key];
  const isAndroid = Platform.OS === 'android';
  // app.json extra.admob에서 적절한 키 선택
  if (key === 'bannerAndroid' || key === 'bannerIos') {
    return (isAndroid ? cfg.bannerAndroid : cfg.bannerIos) || '';
  }
  if (key === 'rectAndroid' || key === 'rectIos') {
    // 별도 rect Unit이 없으면 banner Unit으로 fallback
    return (isAndroid ? (cfg.rectAndroid || cfg.bannerAndroid) : (cfg.rectIos || cfg.bannerIos)) || '';
  }
  return '';
}

export const ADMOB_BANNER_UNIT_ID = pickId(Platform.OS === 'android' ? 'bannerAndroid' : 'bannerIos');
export const ADMOB_RECT_UNIT_ID = pickId(Platform.OS === 'android' ? 'rectAndroid' : 'rectIos');

// SDK가 실제 설치되어 있을 때만 import. Expo Go에서는 null 반환 → 컴포넌트 placeholder fallback.
let _sdkModule = null;
let _sdkLoadAttempted = false;
export function requireSdk() {
  if (_sdkLoadAttempted) return _sdkModule;
  _sdkLoadAttempted = true;
  try {
    _sdkModule = require('react-native-google-mobile-ads');
  } catch (e) {
    if (__DEV__) console.log('[AdMob] SDK not available (Expo Go?) — using placeholder');
    _sdkModule = null;
  }
  return _sdkModule;
}

// 초기화 — App.js 최상위에서 1회. SDK 없으면 no-op.
let _initialized = false;
export async function initAdMob() {
  if (_initialized) return;
  const sdk = requireSdk();
  if (!sdk) return;
  try {
    const { default: mobileAds, MaxAdContentRating } = sdk;
    await mobileAds().setRequestConfiguration({
      maxAdContentRating: MaxAdContentRating.T,         // 13세 이상 일반
      tagForChildDirectedTreatment: false,              // COPPA: 자녀 대상 아님
      tagForUnderAgeOfConsent: false,                   // GDPR 동의 연령 미만 아님
      testDeviceIdentifiers: __DEV__ ? ['EMULATOR'] : [],
    });
    await mobileAds().initialize();
    _initialized = true;
    if (__DEV__) console.log('[AdMob] initialized');
  } catch (e) {
    console.warn('[AdMob] initialize failed:', e?.message || e);
  }
}

// NPA(non-personalized ads) 토글 — 동의 거부 사용자에 대해 BannerAd에 requestOptions로 전달.
let _npaEnabled = false;
export function setNpa(enabled) {
  _npaEnabled = !!enabled;
}
export function getRequestOptions() {
  return _npaEnabled ? { requestNonPersonalizedAdsOnly: true } : {};
}
