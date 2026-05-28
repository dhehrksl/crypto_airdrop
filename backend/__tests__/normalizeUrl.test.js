const { normalizeUrl } = require('../src/lib/normalizeUrl');

describe('normalizeUrl', () => {
  test('null/빈 입력 → null', () => {
    expect(normalizeUrl(null)).toBeNull();
    expect(normalizeUrl(undefined)).toBeNull();
    expect(normalizeUrl('')).toBeNull();
    expect(normalizeUrl('   ')).toBeNull();
  });

  test('잘못된 URL → 원본 그대로 반환 (caller가 fallback 가능)', () => {
    expect(normalizeUrl('not a url')).toBe('not a url');
  });

  test('http → https 승격', () => {
    expect(normalizeUrl('http://example.com/post')).toBe('https://example.com/post');
  });

  test('www. 제거 + hostname 소문자화', () => {
    expect(normalizeUrl('https://WWW.Example.COM/Post')).toBe('https://example.com/Post');
  });

  test('utm_* 트래킹 쿼리 제거', () => {
    expect(
      normalizeUrl('https://example.com/post?utm_source=tw&utm_medium=social&utm_campaign=x')
    ).toBe('https://example.com/post');
  });

  test('fbclid/gclid 등 트래킹 쿼리 제거', () => {
    expect(normalizeUrl('https://example.com/p?fbclid=abc')).toBe('https://example.com/p');
    expect(normalizeUrl('https://example.com/p?gclid=xyz&msclkid=1')).toBe('https://example.com/p');
  });

  test('의미 있는 쿼리는 보존', () => {
    expect(normalizeUrl('https://example.com/p?id=42&page=2')).toBe(
      'https://example.com/p?id=42&page=2'
    );
  });

  test('utm + 의미 있는 쿼리 혼합 → utm만 제거', () => {
    expect(normalizeUrl('https://example.com/p?id=42&utm_source=tw&page=2')).toBe(
      'https://example.com/p?id=42&page=2'
    );
  });

  test('fragment(#...) 제거', () => {
    expect(normalizeUrl('https://example.com/p#section-2')).toBe('https://example.com/p');
  });

  test('trailing slash 제거 (단, root path "/"는 유지)', () => {
    expect(normalizeUrl('https://example.com/post/')).toBe('https://example.com/post');
    expect(normalizeUrl('https://example.com/')).toBe('https://example.com/');
  });

  test('이미 정규화된 URL → idempotent (같은 결과)', () => {
    const out = normalizeUrl('https://example.com/post?id=1');
    expect(normalizeUrl(out)).toBe(out);
  });

  test('비 http(s) 프로토콜은 원본 그대로 (mailto/t.me/javascript 등)', () => {
    expect(normalizeUrl('mailto:foo@bar.com')).toBe('mailto:foo@bar.com');
    // t.me는 http(s)이지만 텔레그램 링크는 정규화해도 안전
    expect(normalizeUrl('https://t.me/some_channel/123')).toBe('https://t.me/some_channel/123');
  });

  test('동일 기사 다른 출처 URL → 같은 키로 dedup', () => {
    // 같은 글이 트래킹 파라미터/대소문자/프로토콜만 다르게 들어오는 케이스
    const a = normalizeUrl('http://www.Example.com/articles/airdrop?utm_source=A');
    const b = normalizeUrl('https://example.com/articles/airdrop/?utm_source=B&fbclid=2');
    expect(a).toBe(b);
  });
});
