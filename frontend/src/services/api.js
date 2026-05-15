import axios from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';

const API_BASE_URL = 'http://172.23.249.92:3000'; // This should be managed better, e.g., via environment variables.

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

export const getGuaranteedAirdrops = () => {
  return apiClient.get('/api/guaranteed-airdrops');
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

