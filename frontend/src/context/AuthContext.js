import React, { createContext, useState, useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as WebBrowser from 'expo-web-browser';
import { useAuthRequest } from 'expo-auth-session/providers/google';
import * as api from '../services/api'; // Import all api functions

// This is necessary for the auth session to work properly on web and some native platforms
WebBrowser.maybeCompleteAuthSession();

export const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
  const [userInfo, setUserInfo] = useState(null);
  const [userToken, setUserToken] = useState(null);
  const [isLoading, setIsLoading] = useState(true);

  // --- Google Social Login ---
  const [request, response, promptAsync] = useAuthRequest({
    // You need to create these IDs in your Google Cloud Console
    // https://docs.expo.dev/guides/authentication/#google
    expoClientId: 'YOUR_EXPO_CLIENT_ID.apps.googleusercontent.com',
    androidClientId: 'YOUR_ANDROID_CLIENT_ID.apps.googleusercontent.com',
    iosClientId: 'YOUR_IOS_CLIENT_ID.apps.googleusercontent.com',
    webClientId: 'YOUR_WEB_CLIENT_ID.apps.googleusercontent.com',
  });

  useEffect(() => {
    const handleGoogleSignIn = async () => {
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
