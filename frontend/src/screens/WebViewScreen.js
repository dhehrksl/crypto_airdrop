import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ActivityIndicator, TouchableOpacity, Alert } from 'react-native';
import { WebView } from 'react-native-webview';

// gate: 'needs-confirm' (Alert 표시 중, WebView 미마운트) → 'confirmed' (WebView 렌더).
// 매번 표시 — 외부 사이트 진입은 자산 손실 위험이 따르므로 사용자에게 항상 경각심을 준다.

const WebViewScreen = ({ route, navigation }) => {
  const { url } = route.params;
  const [gate, setGate] = useState('needs-confirm');
  const [showBanner, setShowBanner] = useState(true);

  useEffect(() => {
    if (gate !== 'needs-confirm') return;
    Alert.alert(
      '외부 사이트 접속 안내',
      '본 페이지는 본 앱이 운영하지 않는 외부 사이트입니다.\n\n' +
        '• 지갑 연결, 시드 문구 입력, 자산 이체는 본인 판단·책임 하에 진행하세요.\n' +
        '• 도메인이 공식인지 직접 확인하세요. 피싱·스캠 사이트가 있을 수 있습니다.\n' +
        '• 본 앱은 외부 사이트의 안전성·정확성을 보장하지 않습니다.',
      [
        {
          text: '취소',
          style: 'cancel',
          onPress: () => navigation.goBack(),
        },
        {
          text: '확인하고 접속',
          onPress: () => setGate('confirmed'),
        },
      ],
      { cancelable: false, onDismiss: () => navigation.goBack() }
    );
  }, [gate, navigation]);

  if (gate !== 'confirmed') {
    return (
      <View style={styles.gateView}>
        <ActivityIndicator size="large" color="#6366F1" />
        <Text style={styles.gateText}>안전 안내 확인 후 접속됩니다.</Text>
      </View>
    );
  }

  return (
    <View style={{ flex: 1 }}>
      {showBanner && (
        <View style={styles.banner}>
          <Text style={styles.bannerText} numberOfLines={2}>
            ⚠ 외부 사이트 — 본 앱과 무관. 지갑 연결·자산 이체는 본인 책임 하에 진행하세요.
          </Text>
          <TouchableOpacity onPress={() => setShowBanner(false)} style={styles.bannerClose}>
            <Text style={styles.bannerCloseText}>✕</Text>
          </TouchableOpacity>
        </View>
      )}
      <WebView
        source={{ uri: url }}
        startInLoadingState={true}
        renderLoading={() => (
          <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
            <ActivityIndicator size="large" />
          </View>
        )}
        style={{ flex: 1 }}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  gateView: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
    paddingHorizontal: 30,
  },
  gateText: { marginTop: 16, fontSize: 14, color: '#64748B', textAlign: 'center' },
  banner: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 10,
    backgroundColor: '#FEF3C7',
    borderBottomWidth: 1,
    borderBottomColor: '#FCD34D',
  },
  bannerText: { flex: 1, fontSize: 12, color: '#92400E', lineHeight: 18, fontWeight: '600' },
  bannerClose: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#FFFFFF',
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 8,
  },
  bannerCloseText: { color: '#92400E', fontWeight: '800' },
});

export default WebViewScreen;
