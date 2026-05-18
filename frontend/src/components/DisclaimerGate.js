import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, ActivityIndicator } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { DISCLAIMER_SHORT } from '../constants/policies';

const ACCEPT_KEY = 'disclaimer_accepted_v1';

const DisclaimerGate = ({ children, onShowPolicy }) => {
  const [accepted, setAccepted] = useState(null); // null = 미확인, true/false

  useEffect(() => {
    (async () => {
      try {
        const v = await AsyncStorage.getItem(ACCEPT_KEY);
        setAccepted(v === 'yes');
      } catch (e) {
        setAccepted(false);
      }
    })();
  }, []);

  const handleAccept = async () => {
    try {
      await AsyncStorage.setItem(ACCEPT_KEY, 'yes');
    } catch (e) {}
    setAccepted(true);
  };

  if (accepted === null) {
    return (
      <View style={styles.loader}>
        <ActivityIndicator size="large" color="#6366F1" />
      </View>
    );
  }

  if (accepted) return children;

  return (
    <View style={styles.gate}>
      <ScrollView contentContainerStyle={styles.body}>
        <Text style={styles.title}>이용 전 안내</Text>
        <Text style={styles.subtitle}>본 앱을 사용하시기 전에 다음 사항을 확인해주세요.</Text>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>📌 정보 제공의 한계</Text>
          <Text style={styles.bullet}>• {DISCLAIMER_SHORT}</Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>🛡 외부 링크 주의</Text>
          <Text style={styles.bullet}>
            • 앱이 표시하는 외부 사이트(에어드랍 공식 사이트 등)는 제3자가 운영하며, 앱은 안전성을 보장하지 않습니다.
          </Text>
          <Text style={styles.bullet}>
            • 지갑 연결, 시드 문구 입력 등은 반드시 출처를 확인한 뒤 본인 책임으로 진행하세요.
          </Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>📊 "트렌드 지수"</Text>
          <Text style={styles.bullet}>
            • 데이터상의 언급량과 발생 빈도를 기반으로 산출된 지표이며, 신뢰도나 수익률을 보증하지 않습니다.
          </Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>📜 정책</Text>
          <View style={styles.linkRow}>
            <TouchableOpacity onPress={() => onShowPolicy && onShowPolicy('privacy')}>
              <Text style={styles.link}>개인정보처리방침</Text>
            </TouchableOpacity>
            <Text style={styles.dot}>·</Text>
            <TouchableOpacity onPress={() => onShowPolicy && onShowPolicy('terms')}>
              <Text style={styles.link}>서비스 이용약관</Text>
            </TouchableOpacity>
          </View>
        </View>
      </ScrollView>

      <View style={styles.bottomBar}>
        <TouchableOpacity style={styles.acceptButton} onPress={handleAccept}>
          <Text style={styles.acceptText}>위 내용에 동의하고 시작</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  loader: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#F8FAFC' },
  gate: { flex: 1, backgroundColor: '#FFFFFF' },
  body: { paddingHorizontal: 20, paddingTop: 70, paddingBottom: 120 },
  title: { fontSize: 24, fontWeight: '800', color: '#0F172A', marginBottom: 8 },
  subtitle: { fontSize: 14, color: '#64748B', marginBottom: 24, lineHeight: 20 },
  section: { marginBottom: 20 },
  sectionTitle: { fontSize: 16, fontWeight: '700', color: '#1E293B', marginBottom: 8 },
  bullet: { fontSize: 14, color: '#475569', lineHeight: 22, marginBottom: 6 },
  linkRow: { flexDirection: 'row', alignItems: 'center', marginTop: 4 },
  link: { fontSize: 14, color: '#6366F1', fontWeight: '700', textDecorationLine: 'underline' },
  dot: { fontSize: 14, color: '#94A3B8', marginHorizontal: 10 },
  bottomBar: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 32,
    backgroundColor: '#FFFFFF',
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
  },
  acceptButton: {
    backgroundColor: '#6366F1',
    height: 56,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
  },
  acceptText: { color: '#FFFFFF', fontSize: 17, fontWeight: '700' },
});

export default DisclaimerGate;
