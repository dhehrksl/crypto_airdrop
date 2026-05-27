import axios from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';
import Constants from 'expo-constants';

// API base URL 결정 우선순위:
//   1) app.json → expo.extra.backendUrl (명시 오버라이드)
//   2) Web — 현재 페이지 호스트 + backendPort
//   3) Expo Go — Metro debuggerHost(=PC LAN IP) 자동 추출
//   4) Android 에뮬레이터 → 10.0.2.2, 그 외 → localhost
// PC IP가 바뀔 때마다 코드를 고칠 필요가 없도록 자동 감지가 기본값.
function resolveApiBaseUrl() {
  const extra =
    Constants.expoConfig?.extra ??
    Constants.manifest2?.extra?.expoClient?.extra ??
    Constants.manifest?.extra ??
    {};

  if (extra.backendUrl) return String(extra.backendUrl).replace(/\/+$/, '');

  const PORT = extra.backendPort || 3000;

  if (Platform.OS === 'web' && typeof window !== 'undefined' && window.location) {
    return `${window.location.protocol}//${window.location.hostname}:${PORT}`;
  }

  const hostCandidate =
    Constants.expoConfig?.hostUri ||
    Constants.expoGoConfig?.debuggerHost ||
    Constants.manifest2?.extra?.expoGo?.debuggerHost ||
    Constants.manifest?.debuggerHost ||
    '';
  const host = String(hostCandidate).split(':')[0];
  if (host) return `http://${host}:${PORT}`;

  if (Platform.OS === 'android') return `http://10.0.2.2:${PORT}`;
  return `http://localhost:${PORT}`;
}

export const API_BASE_URL = resolveApiBaseUrl();
if (__DEV__) console.log('[api] baseURL =', API_BASE_URL);

const apiClient = axios.create({
  baseURL: API_BASE_URL,
  timeout: 15000,
});

// Add a request interceptor to include the token in headers
apiClient.interceptors.request.use(
  async (config) => {
    const userToken = await AsyncStorage.getItem('userToken');
    if (userToken) {
      config.headers.Authorization = `Bearer ${userToken}`;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// 401 응답 자동 처리 — 만료/무효 토큰을 정리하고 AuthContext에 알린다.
let unauthorizedHandler = null;
export const setUnauthorizedHandler = (cb) => {
  unauthorizedHandler = cb;
};

apiClient.interceptors.response.use(
  (res) => res,
  async (error) => {
    if (error?.response?.status === 401) {
      await AsyncStorage.removeItem('userToken');
      await AsyncStorage.removeItem('userInfo');
      if (unauthorizedHandler) unauthorizedHandler();
    }
    return Promise.reject(error);
  }
);


export const getAirdrops = (sortType) => {
  return apiClient.get(`/api/airdrops?sort=${sortType}&type=airdrops`);
};

export const registerPushToken = (token, userId) => {
    return apiClient.post('/api/users/push-token', { token, userId });
};

// --- User Participation API Calls ---

export const getParticipatedAirdrops = () => {
  return apiClient.get('/api/user/airdrops/participated');
};

export const markAsParticipated = (airdropId) => {
  return apiClient.post(`/api/user/airdrops/${airdropId}/participate`);
};

export const unmarkAsParticipated = (airdropId) => {
  return apiClient.delete(`/api/user/airdrops/${airdropId}/participate`);
};

export const deleteAccount = () => {
  return apiClient.delete('/api/user/account');
};

// --- 관심 목록 / 단계별 진행 추적 (airdrop-tracking-toolkit) ---

export const getWatchlist = () => {
  return apiClient.get('/api/user/airdrops/watchlist');
};

export const addToWatchlist = (airdropId) => {
  return apiClient.post(`/api/user/airdrops/${airdropId}/watchlist`);
};

export const removeFromWatchlist = (airdropId) => {
  return apiClient.delete(`/api/user/airdrops/${airdropId}/watchlist`);
};

export const getAirdropTracking = (airdropId) => {
  return apiClient.get(`/api/user/airdrops/${airdropId}/tracking`);
};

export const setTaskProgress = (airdropId, index, completed) => {
  return apiClient.put(`/api/user/airdrops/${airdropId}/tasks/${index}`, { completed });
};

// --- 제보 (사용자) ---
export const submitAirdrop = (payload) => apiClient.post('/api/submissions', payload);
export const getMySubmissions = () => apiClient.get('/api/submissions/mine');

// --- 관리자 ---
export const adminListSubmissions = (status) =>
  apiClient.get('/api/admin/submissions' + (status ? `?status=${status}` : ''));
export const adminApproveSubmission = (id, note) =>
  apiClient.post(`/api/admin/submissions/${id}/approve`, { note });
export const adminRejectSubmission = (id, note) =>
  apiClient.post(`/api/admin/submissions/${id}/reject`, { note });
export const adminCreateAirdrop = (payload) => apiClient.post('/api/admin/airdrops', payload);
export const adminUpdateAirdrop = (id, payload) => apiClient.put(`/api/admin/airdrops/${id}`, payload);
export const adminDeleteAirdrop = (id) => apiClient.delete(`/api/admin/airdrops/${id}`);

// --- 관리자 Draft 큐레이션 (커뮤니티 수집 → AI 추출 → 승인/거절) ---
export const adminListDrafts = (status = 'pending') =>
  apiClient.get(`/api/admin/drafts?status=${encodeURIComponent(status)}`);
export const adminUpdateDraft = (id, payload) => apiClient.patch(`/api/admin/drafts/${id}`, payload);
export const adminApproveDraft = (id, note) => apiClient.post(`/api/admin/drafts/${id}/approve`, { note });
export const adminRejectDraft = (id, note) => apiClient.post(`/api/admin/drafts/${id}/reject`, { note });
export const adminDeleteDraft = (id) => apiClient.delete(`/api/admin/drafts/${id}`);
export const adminDraftFromUrl = (url, source_label) =>
  apiClient.post('/api/admin/drafts/from-url', { url, source_label }, { timeout: 60000 });
export const adminTriggerDraftCollect = () =>
  apiClient.post('/api/admin/drafts/collect', {}, { timeout: 120000 });

// --- Auth API Calls ---

export const login = (email, password) => {
  return apiClient.post('/api/auth/login', { email, password });
};

export const register = (username, email, password) => {
  return apiClient.post('/api/auth/register', { username, email, password });
};

export const googleTokenSignIn = (idToken) => {
  return apiClient.post('/api/auth/google/token-signin', { idToken });
};

// --- Market Data API Calls ---

export const getMarketPrice = (coinId) => {
  return apiClient.get(`/api/market/price?coinId=${coinId}`);
};

