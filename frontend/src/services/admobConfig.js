// AdMob 통합 — react-native-google-mobile-ads 래퍼.
//
// 1) 광고 단위 ID: dev 빌드는 항상 Google 테스트 ID (운영 ID 노출 시 정책 위반).
//    production은 app.json expo.extra.admob.* 에서 읽음. 비어있으면 광고 미표시.
// 2) SDK는 Expo Go에서 동작 X — EAS Build/dev-client 필요. 미설치 환경에서는
//    requireSdk()가 null을 반환하고 BannerAdComponent가 placeholder로 fallback.
// 3) UMP(User Messaging Platform) 통합 — requestConsent()에서 GDPR/CCPA 동의 폼
//    자동 처리. 동의 결과에 따라 NPA 토글 + canRequestAds() 게이트 노출.
//    PIPA(한국) 동의는 DisclaimerGate에서 별도로 처리됨.

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

// ===== UMP (User Messaging Platform) =====
// GDPR(EEA/UK) + CCPA(미국) 동의 흐름. SDK가 자동으로 지역 감지 → 필요 시 폼 표시.
// 결과를 _canRequestAds에 저장 → 광고 컴포넌트가 게이트 체크.
//
// 호출 시점: App.js에서 initAdMob() 직후 1회. dev에서는 debugEea=true로 강제 EEA 시험 가능.
//
// 정책상 동의를 받기 전에 광고 요청을 보내면 안 됨 → 컴포넌트는 canRequestAds()가
// true가 되기 전엔 렌더링 보류.

let _canRequestAds = false;
let _consentResolved = false;     // requestConsent가 한 번이라도 완료됐는지
let _consentInFlight = null;      // 중복 호출 방지용 promise

const _consentListeners = new Set();
function _notifyConsent() {
  const snap = { resolved: _consentResolved, canRequestAds: _canRequestAds, npa: _npaEnabled };
  for (const cb of _consentListeners) {
    try { cb(snap); } catch (e) { if (__DEV__) console.log('[UMP] listener error:', e?.message || e); }
  }
}

// 광고 컴포넌트에서 구독 — resolved 시점에 재렌더 트리거. unsubscribe 함수 반환.
export function onConsentChange(cb) {
  _consentListeners.add(cb);
  // 이미 resolved 상태로 마운트된 경우에도 즉시 통지 (한 번)
  if (_consentResolved) {
    try { cb({ resolved: true, canRequestAds: _canRequestAds, npa: _npaEnabled }); } catch {}
  }
  return () => _consentListeners.delete(cb);
}

export function canRequestAds() {
  return _canRequestAds;
}
export function isConsentResolved() {
  return _consentResolved;
}

export async function requestConsent({ debugEea = false } = {}) {
  if (_consentInFlight) return _consentInFlight;
  const sdk = requireSdk();
  if (!sdk) {
    _consentResolved = true;
    _canRequestAds = false;
    return { canRequestAds: false, npa: true, reason: 'no-sdk' };
  }
  const { AdsConsent, AdsConsentDebugGeography, AdsConsentStatus } = sdk;
  if (!AdsConsent) {
    // 구버전 SDK — UMP 모듈 없음. 광고는 NPA로 안전 fallback.
    _consentResolved = true;
    _canRequestAds = true;
    _npaEnabled = true;
    if (__DEV__) console.log('[UMP] AdsConsent 모듈 없음 — NPA로 폴백');
    return { canRequestAds: true, npa: true, reason: 'no-ump-module' };
  }

  _consentInFlight = (async () => {
    try {
      // gatherConsent: requestInfoUpdate + showForm(필요 시)을 한 번에. v14 권장 API.
      const params = {};
      if (__DEV__ && debugEea && AdsConsentDebugGeography) {
        params.debugGeography = AdsConsentDebugGeography.EEA;
      }
      const result = await AdsConsent.gatherConsent(params);
      // result: { status: AdsConsentStatus, canRequestAds: boolean (v14+) }
      const canRequest =
        typeof result?.canRequestAds === 'boolean'
          ? result.canRequestAds
          : result?.status !== AdsConsentStatus?.REQUIRED;
      _canRequestAds = !!canRequest;
      // 미동의(또는 부분 동의)는 NPA로 폴백 — REQUIRED 아닌 OBTAINED/NOT_REQUIRED만 개인화 허용.
      _npaEnabled = result?.status === AdsConsentStatus?.REQUIRED;
      _consentResolved = true;
      if (__DEV__) console.log('[UMP] resolved:', { status: result?.status, canRequest, npa: _npaEnabled });
      return { canRequestAds: _canRequestAds, npa: _npaEnabled, status: result?.status };
    } catch (e) {
      // 폼 표시 실패 등 — 보수적으로 NPA만 허용 (광고는 띄우되 개인화 X).
      _consentResolved = true;
      _canRequestAds = true;
      _npaEnabled = true;
      if (__DEV__) console.log('[UMP] gatherConsent failed → NPA fallback:', e?.message || e);
      return { canRequestAds: true, npa: true, reason: 'error', error: e?.message };
    } finally {
      _consentInFlight = null;
      _notifyConsent();
    }
  })();

  return _consentInFlight;
}

// 디버그/QA용 — 다음 부팅에서 폼이 다시 떠야 할 때.
export async function resetConsent() {
  const sdk = requireSdk();
  if (!sdk?.AdsConsent) return;
  try {
    await sdk.AdsConsent.reset();
    _canRequestAds = false;
    _consentResolved = false;
    _npaEnabled = false;
  } catch (e) {
    if (__DEV__) console.log('[UMP] reset failed:', e?.message || e);
  }
}
