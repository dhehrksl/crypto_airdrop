import React, { useEffect, useContext } from 'react';
import { View, ActivityIndicator, StyleSheet } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs'; // New import
import { Ionicons } from '@expo/vector-icons'; // For icons

import { AuthProvider, AuthContext } from './src/context/AuthContext';
import { initAdMob } from './src/services/admobConfig';
import HomeScreen from './src/screens/HomeScreen';
import DetailScreen from './src/screens/DetailScreen';
import WebViewScreen from './src/screens/WebViewScreen';
import LoginScreen from './src/screens/LoginScreen';
import RegisterScreen from './src/screens/RegisterScreen';
import UserScreen from './src/screens/UserScreen';
import CalendarScreen from './src/screens/CalendarScreen'; // New import
import NewsScreen from './src/screens/NewsScreen'; // New import
import NewsDetailScreen from './src/screens/NewsDetailScreen';
import PolicyScreen from './src/screens/PolicyScreen';
import SubmitAirdropScreen from './src/screens/SubmitAirdropScreen';
import AdminScreen from './src/screens/AdminScreen';
import DisclaimerGate from './src/components/DisclaimerGate';

const Stack = createNativeStackNavigator();
const Tab = createBottomTabNavigator(); // New Tab Navigator


const AppTabs = () => {
  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        tabBarIcon: ({ focused, color, size }) => {
          let iconName;

          if (route.name === 'HomeTab') {
            iconName = focused ? 'home' : 'home-outline';
          } else if (route.name === 'CalendarTab') {
            iconName = focused ? 'calendar' : 'calendar-outline';
          } else if (route.name === 'NewsTab') {
            iconName = focused ? 'newspaper' : 'newspaper-outline';
          } else if (route.name === 'UserTab') {
            iconName = focused ? 'person' : 'person-outline';
          }
          // You can return any component that you like here!
          return <Ionicons name={iconName} size={size} color={color} />;
        },
        tabBarActiveTintColor: '#6366F1',
        tabBarInactiveTintColor: 'gray',
        headerShown: false,
      })}
    >
      <Tab.Screen name="HomeTab" component={HomeScreen} options={{ title: '에어드랍' }} />
      <Tab.Screen name="NewsTab" component={NewsScreen} options={{ title: '뉴스' }} />
      <Tab.Screen name="CalendarTab" component={CalendarScreen} options={{ title: '캘린더' }} />
      <Tab.Screen name="UserTab" component={UserScreen} options={{ title: '내 정보' }} />
    </Tab.Navigator>
  );
};


const AppNav = () => {
  const { isLoading, userToken, userInfo } = useContext(AuthContext);

  useEffect(() => {
    // This effect runs when the user is authenticated
    if (userToken) {
      // The push notification registration logic that was here
      // has been moved to HomeScreen to ensure it runs after login
      // and has access to the user ID if needed for backend association.
      console.log("User is authenticated. Ready for main app logic.");
    }
  }, [userToken, userInfo]);

  if (isLoading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size={'large'} />
      </View>
    );
  }

  return (
    <NavigationContainer>
      {userToken !== null ? (
        // Main App Stack
        <Stack.Navigator>
            <Stack.Screen 
              name="MainTabs" // This will be our tab navigator
              component={AppTabs} 
              options={{ headerShown: false }}
            />
            <Stack.Screen
              name="Detail"
              component={DetailScreen}
              options={{
                headerShown: false,
                presentation: 'modal',
              }}
            />
            <Stack.Screen
              name="NewsDetail"
              component={NewsDetailScreen}
              options={{
                headerShown: false,
                presentation: 'modal',
              }}
            />
            <Stack.Screen
              name="Policy"
              component={PolicyScreen}
              options={{ headerShown: false, presentation: 'modal' }}
            />
            <Stack.Screen
              name="SubmitAirdrop"
              component={SubmitAirdropScreen}
              options={{ headerShown: false, presentation: 'modal' }}
            />
            <Stack.Screen
              name="Admin"
              component={AdminScreen}
              options={{ headerShown: false, presentation: 'modal' }}
            />
            <Stack.Screen
              name="WebView"
              component={WebViewScreen}
              options={({ route }) => ({
                title: route.params?.title || '웹 페이지',
                presentation: 'modal',
                headerBackTitle: '닫기',
              })}
            />
        </Stack.Navigator>
      ) : (
        // Auth Stack
        <Stack.Navigator>
          <Stack.Screen
            name="Login"
            component={LoginScreen}
            options={{ headerShown: false }}
          />
          <Stack.Screen
            name="Register"
            component={RegisterScreen}
            options={{ headerShown: false }}
          />
          <Stack.Screen
            name="Policy"
            component={PolicyScreen}
            options={{ headerShown: false, presentation: 'modal' }}
          />
        </Stack.Navigator>
      )}
    </NavigationContainer>
  );
}

const styles = StyleSheet.create({
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center'
  }
});

export default function App() {
  // AdMob SDK 초기화 — 앱 마운트 시 1회. SDK 미설치(Expo Go) 환경에서는 no-op.
  useEffect(() => {
    initAdMob();
  }, []);

  return (
    <AuthProvider>
      <DisclaimerGate>
        <AppNav />
      </DisclaimerGate>
    </AuthProvider>
  );
}
