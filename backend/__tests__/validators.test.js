const {
  isValidEmail,
  validatePassword,
  validateUsername,
} = require('../controllers/_validators');

describe('isValidEmail', () => {
  test.each([
    ['user@example.com', true],
    ['a.b+tag@sub.example.co.kr', true],
    ['x@y.io', true],
  ])('accepts valid email %s', (input, expected) => {
    expect(isValidEmail(input)).toBe(expected);
  });

  test.each([
    ['', false],
    ['notanemail', false],
    ['missing@tld', false],          // TLD 없음
    ['two@@signs.com', false],
    ['space in@email.com', false],
    ['user@example.c', false],       // TLD 1자
    [null, false],
    [undefined, false],
    [123, false],
  ])('rejects invalid email %p', (input, expected) => {
    expect(isValidEmail(input)).toBe(expected);
  });

  test('rejects emails over 254 chars (RFC 5321 한도)', () => {
    const local = 'a'.repeat(250);
    expect(isValidEmail(`${local}@b.com`)).toBe(false);
  });
});

describe('validatePassword', () => {
  test('accepts password with 8+ chars, letter and digit', () => {
    expect(validatePassword('abcd1234')).toEqual({ ok: true });
    expect(validatePassword('Strong9Pass')).toEqual({ ok: true });
  });

  test('rejects < 8 chars with too_short', () => {
    expect(validatePassword('a1b2c')).toEqual({ ok: false, error: 'too_short' });
    expect(validatePassword('')).toEqual({ ok: false, error: 'too_short' });
  });

  test('rejects no letter with no_letter', () => {
    expect(validatePassword('12345678')).toEqual({ ok: false, error: 'no_letter' });
  });

  test('rejects no digit with no_digit', () => {
    expect(validatePassword('abcdefgh')).toEqual({ ok: false, error: 'no_digit' });
  });

  test('rejects non-string', () => {
    expect(validatePassword(null)).toEqual({ ok: false, error: 'too_short' });
    expect(validatePassword(undefined)).toEqual({ ok: false, error: 'too_short' });
    expect(validatePassword(12345678)).toEqual({ ok: false, error: 'too_short' });
  });
});

describe('validateUsername', () => {
  test('accepts 3-20 char alnum + _ + -', () => {
    expect(validateUsername('abc')).toEqual({ ok: true });
    expect(validateUsername('user_name-1')).toEqual({ ok: true });
    expect(validateUsername('a'.repeat(20))).toEqual({ ok: true });
  });

  test('rejects < 3 chars with too_short', () => {
    expect(validateUsername('ab')).toEqual({ ok: false, error: 'too_short' });
    expect(validateUsername('')).toEqual({ ok: false, error: 'too_short' });
  });

  test('rejects > 20 chars with too_long', () => {
    expect(validateUsername('a'.repeat(21))).toEqual({ ok: false, error: 'too_long' });
  });

  test('rejects invalid chars (spaces, special, unicode)', () => {
    expect(validateUsername('with space')).toEqual({ ok: false, error: 'invalid_chars' });
    expect(validateUsername('user@name')).toEqual({ ok: false, error: 'invalid_chars' });
    expect(validateUsername('한글사용자')).toEqual({ ok: false, error: 'invalid_chars' });
    expect(validateUsername('user.name')).toEqual({ ok: false, error: 'invalid_chars' });
  });

  test('rejects non-string', () => {
    expect(validateUsername(null)).toEqual({ ok: false, error: 'invalid_chars' });
    expect(validateUsername(undefined)).toEqual({ ok: false, error: 'invalid_chars' });
    expect(validateUsername(123)).toEqual({ ok: false, error: 'invalid_chars' });
  });
});
