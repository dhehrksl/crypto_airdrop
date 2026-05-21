import React, { useEffect, useContext } from 'react';
import { View, ActivityIndicator, StyleSheet } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { NavigationContainer, DarkTheme } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Ionicons } from '@expo/vector-icons';

import { AuthProvider, AuthContext } from './src/context/AuthContext';
import { initAdMob, requestConsent } from './src/services/admobConfig';
import { initSentry, wrap as sentryWrap } from './src/services/sentryConfig';
import { colors } from './src/constants/theme';

// React Navigation 다크 테마 — DarkTheme을 펼쳐 fonts 등 필수 키를 유지하고 색상만 교체.
const navTheme = {
  ...DarkTheme,
  colors: {
    ...DarkTheme.colors,
    primary: colors.accent,
    background: colors.bg,
    card: colors.bgElevated,
    text: colors.textPrimary,
    border: colors.hairline,
    notification: colors.accent,
  },
};

// Sentry는 가능한 한 일찍 초기화되어야 부팅 단계의 에러도 잡힌다.
initSentry();
import HomeScreen from './src/screens/HomeScreen';
import DetailScreen from './src/screens/DetailScreen';
import WebViewScreen from './src/screens/WebViewScreen';
import LoginScreen from './src/screens/LoginScreen';
import RegisterScreen from './src/screens/RegisterScreen';
import UserScreen from './src/screens/UserScreen';
import CalendarScreen from './src/screens/CalendarScreen';
import PolicyScreen from './src/screens/PolicyScreen';
import SubmitAirdropScreen from './src/screens/SubmitAirdropScreen';
import AdminScreen from './src/screens/AdminScreen';
import DisclaimerGate from './src/components/DisclaimerGate';

const Stack = createNativeStackNavigator();
const Tab = createBottomTabNavigator();

const AppTabs = () => {
  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        tabBarIcon: ({ focused, color, size }) => {
          let iconName;
          if (route.name === 'HomeTab') {
            iconName = focused ? 'rocket' : 'rocket-outline';
          } else if (route.name === 'CalendarTab') {
            iconName = focused ? 'calendar' : 'calendar-outline';
          } else if (route.name === 'UserTab') {
            iconName = focused ? 'person' : 'person-outline';
          }
          return <Ionicons name={iconName} size={size} color={color} />;
        },
        tabBarActiveTintColor: colors.accent,
        tabBarInactiveTintColor: colors.textMuted,
        tabBarStyle: {
          backgroundColor: colors.bgElevated,
          borderTopColor: colors.hairline,
          borderTopWidth: 1,
          height: 88,
          paddingTop: 6,
          paddingBottom: 28,
        },
        tabBarLabelStyle: { fontSize: 11, fontWeight: '700' },
        headerShown: false,
      })}
    >
      <Tab.Screen name="HomeTab" component={HomeScreen} options={{ title: '에어드랍' }} />
      <Tab.Screen name="CalendarTab" component={CalendarScreen} options={{ title: '캘린더' }} />
      <Tab.Screen name="UserTab" component={UserScreen} options={{ title: '내 정보' }} />
    </Tab.Navigator>
  );
};

const AppNav = () => {
  const { isLoading, userToken } = useContext(AuthContext);

  if (isLoading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size={'large'} color={colors.accent} />
      </View>
    );
  }

  const modalOptions = {
    headerShown: false,
    presentation: 'modal',
    contentStyle: { backgroundColor: colors.bg },
  };

  return (
    <NavigationContainer theme={navTheme}>
      {userToken !== null ? (
        <Stack.Navigator screenOptions={{ contentStyle: { backgroundColor: colors.bg } }}>
          <Stack.Screen name="MainTabs" component={AppTabs} options={{ headerShown: false }} />
          <Stack.Screen name="Detail" component={DetailScreen} options={modalOptions} />
          <Stack.Screen name="Policy" component={PolicyScreen} options={modalOptions} />
          <Stack.Screen name="SubmitAirdrop" component={SubmitAirdropScreen} options={modalOptions} />
          <Stack.Screen name="Admin" component={AdminScreen} options={modalOptions} />
          <Stack.Screen
            name="WebView"
            component={WebViewScreen}
            options={{
              presentation: 'modal',
              headerShown: false,
              contentStyle: { backgroundColor: colors.bg },
            }}
          />
        </Stack.Navigator>
      ) : (
        <Stack.Navigator screenOptions={{ contentStyle: { backgroundColor: colors.bg } }}>
          <Stack.Screen name="Login" component={LoginScreen} options={{ headerShown: false }} />
          <Stack.Screen name="Register" component={RegisterScreen} options={{ headerShown: false }} />
          <Stack.Screen name="Policy" component={PolicyScreen} options={modalOptions} />
        </Stack.Navigator>
      )}
    </NavigationContainer>
  );
};

const styles = StyleSheet.create({
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.bg,
  },
});

function App() {
  // AdMob SDK 초기화 + UMP 동의 흐름 — 앱 마운트 시 1회.
  useEffect(() => {
    (async () => {
      await initAdMob();
      await requestConsent();
    })();
  }, []);

  return (
    <AuthProvider>
      <StatusBar style="light" />
      <DisclaimerGate>
        <AppNav />
      </DisclaimerGate>
    </AuthProvider>
  );
}

// Sentry.wrap — ErrorBoundary + Touch tracking 자동 적용. DSN 미설정이면 no-op으로 통과.
export default sentryWrap(App);
