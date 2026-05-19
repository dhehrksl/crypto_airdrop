// Sentry(@sentry/react-native) 통합 래퍼.
//
// 1) DSN: app.json expo.extra.sentry.dsn 에서 읽음 (EAS Secret으로 빌드 타임 주입).
//    빈 값이면 init을 건너뜀 → 개발/Expo Go에서 노이즈 방지.
// 2) Sentry SDK는 Expo Go에서도 동작하지만 native crash는 dev-client/EAS Build 필요.
//    JS 에러는 Expo Go에서도 정상 캡쳐.
// 3) 사용법: App.js에서 `initSentry()` 호출 + `export default Sentry.wrap(App)`로 감싸기.

import Constants from 'expo-constants';
import * as Sentry from '@sentry/react-native';

const extra = Constants.expoConfig?.extra ?? Constants.manifest?.extra ?? {};
const cfg = extra.sentry || {};
const dsn = cfg.dsn || '';

let _initialized = false;

export function initSentry() {
  if (_initialized) return;
  if (!dsn) {
    if (__DEV__) console.log('[Sentry] DSN 미설정 — init 건너뜀');
    return;
  }
  try {
    Sentry.init({
      dsn,
      environment: __DEV__ ? 'development' : (cfg.environment || 'production'),
      release: cfg.release || undefined,

      // 운영은 비용 절감 위해 낮게, 개발은 100%.
      tracesSampleRate: Number(cfg.tracesSampleRate ?? (__DEV__ ? 1.0 : 0.1)),

      // dev에서는 콘솔로도 보기. 운영은 false로 노이즈 차단.
      debug: __DEV__,

      // 개인정보 자동 차단 — IP/쿠키 등 미수집.
      sendDefaultPii: false,

      beforeSend(event) {
        // 사용자 입력 페이로드(로그인/제보) 마스킹
        if (event.request) {
          delete event.request.data;
          delete event.request.cookies;
        }
        return event;
      },
    });
    _initialized = true;
    if (__DEV__) console.log('[Sentry] initialized');
  } catch (e) {
    console.warn('[Sentry] init failed:', e?.message || e);
  }
}

// App.js에서 `export default Sentry.wrap(App)`로 감싸기 위해 재노출.
// wrap()은 ErrorBoundary + Touch tracking 자동 적용. init 안 됐어도 안전(no-op).
export const wrap = Sentry.wrap;

// 명시적으로 에러를 보내고 싶을 때 사용.
export function captureException(error, context) {
  if (!_initialized) return;
  Sentry.captureException(error, context);
}
