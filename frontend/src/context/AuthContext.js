import React, { createContext, useState, useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as api from '../services/api';

export const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
  const [userInfo, setUserInfo] = useState(null);
  const [userToken, setUserToken] = useState(null);
  const [isLoading, setIsLoading] = useState(true);

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
      }}>
      {children}
    </AuthContext.Provider>
  );
};
