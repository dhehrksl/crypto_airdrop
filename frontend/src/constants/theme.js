// 다크 프리미엄 디자인 토큰 — 모든 화면이 이 팔레트를 공유한다.
// 색상을 화면마다 하드코딩하지 말고 여기서 import.

export const colors = {
  // 배경 — 가장 깊은 곳부터
  bg: '#0B0D14',          // 앱 배경
  bgElevated: '#10131C',  // 헤더 / 탭바 등 살짝 올라온 영역
  surface: '#161A24',     // 카드
  surfaceAlt: '#1E2331',  // 입력창 / 카드 내부 중첩
  surfaceHover: '#232838',

  // 경계선
  hairline: '#262C3B',
  hairlineStrong: '#333B4F',

  // 텍스트
  textPrimary: '#EEF0F6',
  textSecondary: '#9AA3BC',
  textMuted: '#616A82',

  // 액센트
  accent: '#7C6CF7',       // 메인 보라
  accentBright: '#9A8CFF',
  accentSoft: '#1B1A30',   // 보라 틴트 배경
  cyan: '#34D8E6',
  cyanSoft: '#0E262B',

  // 상태색
  success: '#33D69A',
  successSoft: '#0F261F',
  warning: '#F4B73D',
  warningSoft: '#2A2413',
  danger: '#F26C72',
  dangerSoft: '#2A171A',

  white: '#FFFFFF',
  black: '#000000',
};

export const radius = { sm: 8, md: 12, lg: 16, xl: 20, pill: 999 };

export const spacing = { xs: 4, sm: 8, md: 12, lg: 16, xl: 20, xxl: 28 };

// 에어드랍 활동도(trend_score)를 숫자 대신 비수치 라벨로 — 수익률·신뢰도 오인 방지.
// 라벨은 "소셜 언급량/활동도"만 뜻하며 투자 가치를 함의하지 않는다.
export function getTrendLabel(score) {
  const s = Number(score) || 0;
  if (s >= 85) return { text: '🔥 활발', color: colors.accent, soft: colors.accentSoft };
  if (s >= 60) return { text: '주목', color: colors.cyan, soft: colors.cyanSoft };
  return { text: '신규', color: colors.textMuted, soft: colors.surfaceAlt };
}
