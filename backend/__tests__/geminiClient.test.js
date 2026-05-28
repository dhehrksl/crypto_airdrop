// geminiClient의 multi-model fallback 동작 검증.
// GoogleGenerativeAI 자체를 mock으로 대체해 모델별 응답을 시나리오로 제어.

process.env.GEMINI_API_KEY = 'test-key';

const mockGenerateContent = jest.fn();
const mockGetGenerativeModel = jest.fn(({ model }) => ({
  generateContent: (prompt, opts) => mockGenerateContent(model, prompt, opts),
}));

jest.mock('@google/generative-ai', () => ({
  GoogleGenerativeAI: jest.fn().mockImplementation(() => ({
    getGenerativeModel: mockGetGenerativeModel,
  })),
}));

function quotaError(code = '429') {
  return new Error(`[GoogleGenerativeAI Error]: Error fetching ... [${code} Too Many Requests]`);
}

function freshClient(envModels) {
  // 모듈 캐시 + _modelCache 리셋 — 각 테스트가 독립적이도록.
  if (envModels !== undefined) {
    process.env.GEMINI_MODELS = envModels;
  } else {
    delete process.env.GEMINI_MODELS;
  }
  jest.resetModules();
  mockGenerateContent.mockReset();
  return require('../src/services/geminiClient');
}

describe('geminiClient.generateContent — fallback 동작', () => {
  test('첫 모델 성공 → 그대로 반환, fallback 안 함', async () => {
    const client = freshClient('model-A,model-B');
    mockGenerateContent.mockResolvedValueOnce({ response: { text: () => '{"ok":true}' } });

    const { result, modelUsed } = await client.generateContent('prompt', {});

    expect(modelUsed).toBe('model-A');
    expect(mockGenerateContent).toHaveBeenCalledTimes(1);
    expect(await result.response.text()).toBe('{"ok":true}');
  });

  test('첫 모델 429 → 두번째 모델로 fallback 성공', async () => {
    const client = freshClient('model-A,model-B,model-C');
    mockGenerateContent
      .mockRejectedValueOnce(quotaError('429'))
      .mockResolvedValueOnce({ response: { text: () => 'ok-from-B' } });

    const { modelUsed } = await client.generateContent('prompt');

    expect(modelUsed).toBe('model-B');
    expect(mockGenerateContent).toHaveBeenCalledTimes(2);
    expect(mockGenerateContent.mock.calls[0][0]).toBe('model-A');
    expect(mockGenerateContent.mock.calls[1][0]).toBe('model-B');
  });

  test('첫·둘 다 quota → 세번째 성공', async () => {
    const client = freshClient('model-A,model-B,model-C');
    mockGenerateContent
      .mockRejectedValueOnce(new Error('RESOURCE_EXHAUSTED on this project'))
      .mockRejectedValueOnce(quotaError('429'))
      .mockResolvedValueOnce({ response: { text: () => 'ok' } });

    const { modelUsed } = await client.generateContent('prompt');

    expect(modelUsed).toBe('model-C');
    expect(mockGenerateContent).toHaveBeenCalledTimes(3);
  });

  test('503 overloaded → fallback', async () => {
    const client = freshClient('model-A,model-B');
    mockGenerateContent
      .mockRejectedValueOnce(new Error('Server is overloaded — [503 Service Unavailable]'))
      .mockResolvedValueOnce({ response: { text: () => 'ok' } });

    const { modelUsed } = await client.generateContent('prompt');
    expect(modelUsed).toBe('model-B');
  });

  test('모든 모델 quota 소진 → exhausted throw', async () => {
    const client = freshClient('model-A,model-B');
    mockGenerateContent
      .mockRejectedValueOnce(quotaError('429'))
      .mockRejectedValueOnce(quotaError('429'));

    await expect(client.generateContent('prompt')).rejects.toThrow(/All Gemini models exhausted/);
    expect(mockGenerateContent).toHaveBeenCalledTimes(2);
  });

  test('fallback 부적격 에러(400) → 즉시 throw (다음 모델 시도 안 함)', async () => {
    const client = freshClient('model-A,model-B');
    mockGenerateContent.mockRejectedValueOnce(new Error('Invalid request: [400 Bad Request]'));

    await expect(client.generateContent('prompt')).rejects.toThrow(/400/);
    expect(mockGenerateContent).toHaveBeenCalledTimes(1); // model-B는 시도 안 함
  });

  test('env 미설정 시 DEFAULT_MODELS 사용', async () => {
    const client = freshClient(); // GEMINI_MODELS 삭제
    mockGenerateContent.mockResolvedValueOnce({ response: { text: () => 'ok' } });

    const { modelUsed } = await client.generateContent('prompt');
    expect(client._internal.DEFAULT_MODELS).toContain(modelUsed);
    expect(modelUsed).toBe(client._internal.DEFAULT_MODELS[0]);
  });
});

describe('geminiClient._internal.isFallbackEligibleError', () => {
  const { _internal } = require('../src/services/geminiClient');
  test.each([
    ['429 rate limit', new Error('[429 Too Many Requests]'), true],
    ['RESOURCE_EXHAUSTED', new Error('RESOURCE_EXHAUSTED'), true],
    ['quota in message', new Error('Daily quota exceeded'), true],
    ['503 overloaded', new Error('[503] overloaded'), true],
    ['overloaded text', new Error('Model is currently overloaded'), true],
    ['400 bad request', new Error('[400 Bad Request]'), false],
    ['401 unauth', new Error('[401 Unauthorized]'), false],
    ['random error', new Error('Something else'), false],
    ['null', null, false],
  ])('%s → %s', (_label, err, expected) => {
    expect(_internal.isFallbackEligibleError(err)).toBe(expected);
  });
});
