import React from 'react';
import { View, ActivityIndicator } from 'react-native';
import { WebView } from 'react-native-webview';

const WebViewScreen = ({ route }) => {
  const { url } = route.params;

  const renderLoading = () => (
    <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
      <ActivityIndicator size="large" />
    </View>
  );

  return (
    <WebView
      source={{ uri: url }}
      startInLoadingState={true}
      renderLoading={renderLoading}
      style={{ flex: 1 }}
    />
  );
};

export default WebViewScreen;
