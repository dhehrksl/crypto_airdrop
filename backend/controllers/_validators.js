// 컨트롤러 공통 입력 검증 헬퍼.
// 라이브러리 없이 정규식+길이 기반 — 현재 검증 케이스 적어 YAGNI.

// RFC 5322 단순화 (실무에서 충분히 안전한 패턴)
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

function isValidEmail(s) {
  if (typeof s !== 'string') return false;
  if (s.length > 254) return false; // RFC 5321 한도
  return EMAIL_REGEX.test(s);
}

// 비밀번호 강도: 최소 8자, 영문 1자+, 숫자 1자+ 동시 만족.
// 반환: { ok: boolean, error?: 'too_short' | 'no_letter' | 'no_digit' }
function validatePassword(s) {
  if (typeof s !== 'string' || s.length < 8) return { ok: false, error: 'too_short' };
  if (!/[a-zA-Z]/.test(s)) return { ok: false, error: 'no_letter' };
  if (!/\d/.test(s)) return { ok: false, error: 'no_digit' };
  return { ok: true };
}

// 사용자명: 3-20자, 영숫자 + `_` + `-` 만 허용 (lowercase 처리 후).
// 반환: { ok: boolean, error?: 'too_short' | 'too_long' | 'invalid_chars' }
const USERNAME_REGEX = /^[a-zA-Z0-9_-]+$/;
function validateUsername(s) {
  if (typeof s !== 'string') return { ok: false, error: 'invalid_chars' };
  if (s.length < 3) return { ok: false, error: 'too_short' };
  if (s.length > 20) return { ok: false, error: 'too_long' };
  if (!USERNAME_REGEX.test(s)) return { ok: false, error: 'invalid_chars' };
  return { ok: true };
}

module.exports = { isValidEmail, validatePassword, validateUsername };
