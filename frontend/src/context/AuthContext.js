import React, { createContext, useState, useEffect } from 'react';
import { Alert } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Constants from 'expo-constants';
import * as WebBrowser from 'expo-web-browser';
import { useAuthRequest } from 'expo-auth-session/providers/google';
import * as api from '../services/api'; // Import all api functions

// This is necessary for the auth session to work properly on web and some native platforms
WebBrowser.maybeCompleteAuthSession();

// Google OAuth 클라이언트 ID — app.json의 expo.extra.google.* 또는 env에서 주입.
// 미설정 시 useAuthRequest는 호출하되 promptAsync는 비활성화 (이메일 회원가입에 영향 X).
const GOOGLE_CFG = (Constants.expoConfig?.extra ?? Constants.manifest?.extra ?? {}).google ?? {};
const GOOGLE_READY = ['expoClientId', 'androidClientId', 'iosClientId', 'webClientId'].some(
  (k) => GOOGLE_CFG[k]
);

export const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
  const [userInfo, setUserInfo] = useState(null);
  const [userToken, setUserToken] = useState(null);
  const [isLoading, setIsLoading] = useState(true);

  // --- Google Social Login ---
  // Hooks 규칙 상 항상 호출. 더미가 아닌 실제 값이 있을 때만 promptAsync 작동.
  const [request, response, promptAsync] = useAuthRequest({
    expoClientId: GOOGLE_CFG.expoClientId,
    androidClientId: GOOGLE_CFG.androidClientId,
    iosClientId: GOOGLE_CFG.iosClientId,
    webClientId: GOOGLE_CFG.webClientId,
  });

  useEffect(() => {
    const handleGoogleSignIn = async () => {
      if (!GOOGLE_READY) return;
      if (response?.type === 'success') {
        const { id_token } = response.params;
        setIsLoading(true);
        try {
          const { data } = await api.googleTokenSignIn(id_token);
          await setAuthData(data);
        } catch (e) {
          console.error(`Google Sign-In error: ${e}`);
          // Optionally, show an alert to the user
        } finally {
          setIsLoading(false);
        }
      }
    };
    handleGoogleSignIn();
  }, [response]);

  const googleLogin = () => {
    if (!GOOGLE_READY) {
      Alert.alert('알림', 'Google 로그인이 아직 설정되지 않았습니다. 이메일로 가입해주세요.');
      return;
    }
    promptAsync();
  };
  // --- End Google Social Login ---

  // Helper function to set user data
  const setAuthData = async (data) => {
    setUserInfo(data.user);
    setUserToken(data.token);
    await AsyncStorage.setItem('userInfo', JSON.stringify(data.user));
    await AsyncStorage.setItem('userToken', data.token);
  };

  const register = async (username, email, password) => {
    setIsLoading(true);
    try {
      const { data } = await api.register(username, email, password);
      await setAuthData(data);
    } catch (e) {
      console.error(`Register error: ${e}`);
      throw e;
    } finally {
      setIsLoading(false);
    }
  };

  const login = async (email, password) => {
    setIsLoading(true);
    try {
      const { data } = await api.login(email, password);
      await setAuthData(data);
    } catch (e) {
      console.error(`Login error: ${e}`);
      throw e;
    } finally {
      setIsLoading(false);
    }
  };

  const logout = async () => {
    setIsLoading(true);
    setUserToken(null);
    setUserInfo(null);
    await AsyncStorage.removeItem('userToken');
    await AsyncStorage.removeItem('userInfo');
    setIsLoading(false);
  };

  const isLoggedIn = async () => {
    try {
      setIsLoading(true);
      let token = await AsyncStorage.getItem('userToken');
      let user = await AsyncStorage.getItem('userInfo');
      if (token && user) {
        setUserToken(token);
        setUserInfo(JSON.parse(user));
      }
    } catch (e) {
      console.error(`isLoggedIn error: ${e}`);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    isLoggedIn();
  }, []);

  // 백엔드가 401을 반환하면(만료/무효 토큰) 자동으로 로그아웃 상태로 전환.
  useEffect(() => {
    api.setUnauthorizedHandler(() => {
      setUserToken(null);
      setUserInfo(null);
    });
    return () => api.setUnauthorizedHandler(null);
  }, []);

  return (
    <AuthContext.Provider
      value={{
        isLoading,
        userInfo,
        userToken,
        register,
        login,
        logout,
        googleLogin, // Expose googleLogin function
      }}>
      {children}
    </AuthContext.Provider>
  );
};
