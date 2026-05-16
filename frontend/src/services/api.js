import axios from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';

// 핸드폰 ↔ PC 백엔드 통신용 LAN IP. PC의 Wi-Fi IP가 바뀌면 여기도 갱신해야 함.
// 본인 PC IP 확인: PowerShell에서 `ipconfig` 또는 `Get-NetIPAddress -AddressFamily IPv4`
const API_BASE_URL = 'http://172.30.1.34:3000';

const apiClient = axios.create({
  baseURL: API_BASE_URL,
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


export const getAirdrops = (sortType) => {
  return apiClient.get(`/api/airdrops?sort=${sortType}&type=airdrops`);
};

export const getNews = () => {
  return apiClient.get('/api/airdrops?type=news');
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

