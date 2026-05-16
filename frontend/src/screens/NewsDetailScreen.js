import React from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Alert } from 'react-native';
import BannerAdComponent from '../components/BannerAdComponent';
import { DISCLAIMER_SHORT } from '../constants/policies';

const NewsDetailScreen = ({ route, navigation }) => {
  const { news } = route.params;

  const publishedDate = news.created_at
    ? new Date(news.created_at).toLocaleString('ko-KR', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        hour12: false,
      })
    : '날짜 미상';

  const handleOpenWebView = () => {
    if (news.official_link) {
      navigation.navigate('WebView', {
        url: news.official_link,
        title: news.title || '기사 원문',
      });
    } else {
      Alert.alert('오류', '원문 링크를 찾을 수 없습니다.');
    }
  };

  return (
    <View style={styles.mainContainer}>
      <ScrollView style={styles.container} contentContainerStyle={styles.scrollContent}>
        <View style={styles.headerBar}>
          <TouchableOpacity style={styles.closeButton} onPress={() => navigation.goBack()}>
            <Text style={styles.closeButtonText}>✕</Text>
          </TouchableOpacity>
          <View style={styles.newsTag}>
            <Text style={styles.newsTagText}>NEWS</Text>
          </View>
        </View>

        <View style={styles.contentBox}>
          <Text style={styles.title}>{news.title || '제목 없음'}</Text>

          <View style={styles.metaRow}>
            <Text style={styles.metaText}>{publishedDate}</Text>
            <Text style={styles.metaDot}>·</Text>
            <Text style={styles.metaText}>{news.source?.[0] || '출처 미상'}</Text>
          </View>

          <View style={styles.divider} />

          <Text style={styles.body}>
            {news.description || '본문 요약이 없습니다. 원문을 확인하세요.'}
          </Text>

          <View style={styles.disclaimerBox}>
            <Text style={styles.disclaimerText}>⚠ {DISCLAIMER_SHORT}</Text>
          </View>
        </View>
      </ScrollView>

      <BannerAdComponent />

      <View style={styles.bottomBar}>
        <TouchableOpacity style={styles.mainButton} onPress={handleOpenWebView}>
          <Text style={styles.mainButtonText}>원문 보기</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  mainContainer: { flex: 1, backgroundColor: '#F8FAFC' },
  container: { flex: 1 },
  scrollContent: { paddingBottom: 120 },
  headerBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingTop: 50,
    paddingBottom: 16,
  },
  closeButton: {
    backgroundColor: 'rgba(15, 23, 42, 0.08)',
    borderRadius: 15,
    width: 32,
    height: 32,
    justifyContent: 'center',
    alignItems: 'center',
  },
  closeButtonText: { color: '#0F172A', fontWeight: 'bold', fontSize: 14 },
  newsTag: {
    backgroundColor: '#EEF2FF',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
  },
  newsTagText: { color: '#4338CA', fontWeight: '800', fontSize: 11, letterSpacing: 1 },
  contentBox: { paddingHorizontal: 20, paddingTop: 8 },
  title: {
    fontSize: 24,
    fontWeight: '800',
    color: '#0F172A',
    lineHeight: 32,
    marginBottom: 16,
  },
  metaRow: { flexDirection: 'row', alignItems: 'center' },
  metaText: { fontSize: 13, color: '#64748B', fontWeight: '500' },
  metaDot: { fontSize: 13, color: '#94A3B8', marginHorizontal: 8 },
  divider: {
    height: 1,
    backgroundColor: '#E2E8F0',
    marginVertical: 24,
  },
  body: {
    fontSize: 16,
    lineHeight: 28,
    color: '#334155',
  },
  bottomBar: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 32,
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
  },
  mainButton: {
    backgroundColor: '#6366F1',
    height: 56,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#6366F1',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.2,
    shadowRadius: 16,
    elevation: 8,
  },
  mainButtonText: { color: '#FFFFFF', fontSize: 18, fontWeight: '700' },
  disclaimerBox: {
    backgroundColor: '#FEF3C7',
    borderRadius: 12,
    padding: 14,
    marginTop: 24,
    borderWidth: 1,
    borderColor: '#FCD34D',
  },
  disclaimerText: { fontSize: 12, lineHeight: 18, color: '#78350F' },
});

export default NewsDetailScreen;
