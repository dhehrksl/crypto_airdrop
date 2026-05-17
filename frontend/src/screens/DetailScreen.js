import React, { useState, useContext, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Alert, ActivityIndicator } from 'react-native';
import BannerAdComponent from '../components/BannerAdComponent';
import { AuthContext } from '../context/AuthContext';
import { markAsParticipated, unmarkAsParticipated, getMarketPrice } from '../services/api';
import { DISCLAIMER_SHORT } from '../constants/policies';

const DetailScreen = ({ route, navigation }) => {
  const { airdrop: initialAirdrop } = route.params;
  const { userInfo } = useContext(AuthContext);
  
  const [airdrop, setAirdrop] = useState(initialAirdrop);
  const [expanded, setExpanded] = useState(false);
  const [isParticipated, setIsParticipated] = useState(false);
  const [priceData, setPriceData] = useState(null);
  const [priceLoading, setPriceLoading] = useState(false);

  useEffect(() => {
    if (userInfo && airdrop.participatedBy) {
      setIsParticipated(airdrop.participatedBy.includes(userInfo.id));
    }
  }, [userInfo, airdrop.participatedBy]);

  useEffect(() => {
    const fetchPrice = async () => {
      const ticker = airdrop.tokenTicker || (airdrop.projectName ? airdrop.projectName.toLowerCase().replace(/\s+/g, '-') : null);
      if (!ticker) return;
      setPriceLoading(true);
      try {
        const response = await getMarketPrice(ticker);
        // 백엔드가 ticker→coin id 매핑 실패 시 { unsupported: true } 반환 — 정상 시나리오로 처리
        if (response.data && !response.data.unsupported) {
          setPriceData(response.data);
        } else {
          setPriceData(null);
        }
      } catch (error) {
        // 404/502 등 실제 에러도 사용자에게 노출하지 않음 (가격은 부가 정보)
        setPriceData(null);
      } finally {
        setPriceLoading(false);
      }
    };
    fetchPrice();
  }, [airdrop.tokenTicker, airdrop.projectName]);

  const handleToggleParticipation = async () => {
    if (!userInfo) {
      Alert.alert("로그인 필요", "이 기능을 사용하려면 로그인이 필요합니다.");
      return;
    }

    try {
      let updatedAirdrop;
      if (isParticipated) {
        const response = await unmarkAsParticipated(airdrop._id);
        updatedAirdrop = response.data;
      } else {
        const response = await markAsParticipated(airdrop._id);
        updatedAirdrop = response.data;
      }
      setAirdrop(updatedAirdrop);
      setIsParticipated(updatedAirdrop.participatedBy.includes(userInfo.id));
    } catch (error) {
      console.error("Failed to update participation status:", error);
      Alert.alert("오류", "참여 상태를 업데이트하는 데 실패했습니다.");
    }
  };

  const handleOpenWebView = () => {
    if (airdrop.official_link) {
      navigation.navigate('WebView', {
        url: airdrop.official_link,
        title: airdrop.title || airdrop.projectName
      });
    } else {
      Alert.alert('오류', '참여 링크를 찾을 수 없습니다.');
    }
  };

  const getScoreColor = (score) => {
    if (score >= 90) return '#10B981';
    if (score >= 80) return '#F59E0B';
    return '#EF4444';
  };

  const endDate = airdrop.end_date 
    ? new Date(airdrop.end_date).toLocaleString('ko-KR', { 
        year: 'numeric', 
        month: 'long', 
        day: 'numeric', 
        hour: '2-digit', 
        minute: '2-digit', 
        hour12: false // 24시간 형식
      }) 
    : '미정';
  const isClosingSoon = airdrop.end_date && new Date(airdrop.end_date) < new Date(Date.now() + 3 * 24 * 60 * 60 * 1000);

  const description = airdrop.description || '상세 정보가 없습니다.';
  const isLongDescription = description.length > 100;
  
  const title = airdrop.projectName || airdrop.title || '제목 없음';

  return (
    <View style={styles.mainContainer}>
      <ScrollView style={styles.container} contentContainerStyle={styles.scrollContent}>
        <View style={styles.heroSection}>
          <TouchableOpacity
            style={styles.closeButton}
            onPress={() => navigation.goBack()}
          >
            <Text style={styles.closeButtonText}>✕</Text>
          </TouchableOpacity>
          {airdrop.is_airdrop ? (
            <View style={[styles.scoreCircle, { borderColor: getScoreColor(airdrop.trust_score) }]}>
              <Text style={[styles.scoreValue, { color: getScoreColor(airdrop.trust_score) }]}>{airdrop.trust_score || 0}</Text>
              <Text style={styles.scoreLabel}>AI 매칭도</Text>
            </View>
          ) : (
            <View style={[styles.scoreCircle, styles.newsBadge]}>
              <Text style={styles.newsBadgeText}>NEWS</Text>
            </View>
          )}
          <Text style={styles.title}>{title}</Text>
          
          {(airdrop.tokenTicker || airdrop.projectName) && (
            <View style={styles.priceContainer}>
              {priceLoading ? (
                <ActivityIndicator size="small" color="#64748B" />
              ) : priceData && priceData.usd ? (
                <>
                  <Text style={styles.priceValue}>${priceData.usd.toLocaleString()}</Text>
                  <Text style={[
                    styles.priceChange,
                    priceData.usd_24h_change >= 0 ? styles.priceChangePositive : styles.priceChangeNegative
                  ]}>
                    {priceData.usd_24h_change?.toFixed(2)}% (24h)
                  </Text>
                </>
              ) : (
                <Text style={styles.noPriceText}>가격 정보 없음</Text>
              )}
            </View>
          )}

          <View style={styles.badgeRow}>
            {airdrop.is_confirmed && (
              <View style={[styles.sourceBadge, styles.confirmedBadge]}>
                <Text style={[styles.sourceBadgeText, styles.confirmedBadgeText]}>✔ 공식 확정</Text>
              </View>
            )}
            {Array.isArray(airdrop.source) && airdrop.source.map((s, i) => (
              <View key={i} style={styles.sourceBadge}>
                <Text style={styles.sourceBadgeText}>{s}</Text>
              </View>
            ))}
          </View>
        </View>

        <View style={styles.contentCard}>
          {airdrop.end_date && (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>🗓️ 주요 일정</Text>
              <View style={[styles.infoCard, isClosingSoon && styles.closingSoonInfoCard]}>
                <Text style={styles.infoCardLabel}>마감일</Text>
                <Text style={[styles.infoCardValue, isClosingSoon && { color: '#C2410C' }]}>
                  {endDate}
                  {isClosingSoon && " (🔥 마감 임박)"}
                </Text>
              </View>
            </View>
          )}

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>{airdrop.is_airdrop ? '📋 참여 방법' : '📝 뉴스 요약'}</Text>
            <View style={styles.descriptionBox}>
              <Text 
                style={styles.description}
                numberOfLines={expanded ? undefined : 4}
              >
                {airdrop.is_airdrop && airdrop.tasks && airdrop.tasks.length > 0
                  ? airdrop.tasks.join('\n\n')
                  : description}
              </Text>
              {isLongDescription && (
                <TouchableOpacity 
                  onPress={() => setExpanded(!expanded)}
                  style={styles.expandButton}
                >
                  <Text style={styles.expandButtonText}>
                    {expanded ? '간략히 보기' : '... 더보기'}
                  </Text>
                </TouchableOpacity>
              )}
            </View>
          </View>

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>🔗 공식 링크</Text>
            <TouchableOpacity
              style={styles.linkCard}
              onPress={handleOpenWebView}
            >
              <Text style={styles.linkUrl} numberOfLines={1}>{airdrop.official_link || airdrop.guideUrl}</Text>
              <Text style={styles.linkHint}>탭하여 열기</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.disclaimerBox}>
            <Text style={styles.disclaimerText}>⚠ {DISCLAIMER_SHORT}</Text>
          </View>
        </View>
      </ScrollView>

      <BannerAdComponent />

      {airdrop.is_airdrop ? (
        <View style={styles.bottomBar}>
          <TouchableOpacity
            style={[styles.participationButton, isParticipated && styles.participatedButton]}
            onPress={handleToggleParticipation}
          >
            <Text style={[styles.participationButtonText, isParticipated && styles.participatedButtonText]}>
              {isParticipated ? '✔ 참여 완료' : '참여 완료로 표시'}
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.mainButton}
            onPress={handleOpenWebView}
          >
            <Text style={styles.mainButtonText}>참여하러 가기</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <View style={styles.bottomBar}>
          <TouchableOpacity
            style={[styles.mainButton, styles.fullWidthButton]}
            onPress={handleOpenWebView}
          >
            <Text style={styles.mainButtonText}>원문 보기</Text>
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  mainContainer: { flex: 1, backgroundColor: '#F8FAFC' },
  container: { flex: 1 },
  scrollContent: { paddingBottom: 120 },
  heroSection: {
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    paddingVertical: 40,
    paddingHorizontal: 20,
    borderBottomLeftRadius: 32,
    borderBottomRightRadius: 32,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.05,
    shadowRadius: 12,
    elevation: 5,
  },
  closeButton: {
    position: 'absolute',
    top: 20,
    left: 20,
    backgroundColor: 'rgba(0,0,0,0.1)',
    borderRadius: 15,
    width: 30,
    height: 30,
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 10,
  },
  closeButtonText: { color: '#FFFFFF', fontWeight: 'bold', fontSize: 16 },
  scoreCircle: {
    width: 100,
    height: 100,
    borderRadius: 50,
    borderWidth: 6,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 20,
    backgroundColor: '#FFFFFF',
  },
  scoreValue: { fontSize: 28, fontWeight: '900' },
  scoreLabel: { fontSize: 10, color: '#94A3B8', fontWeight: '700', textTransform: 'uppercase' },
  newsBadge: { borderColor: '#6366F1', backgroundColor: '#EEF2FF' },
  newsBadgeText: { fontSize: 18, fontWeight: '900', color: '#4338CA', letterSpacing: 1 },
  fullWidthButton: { flex: 1, marginLeft: 0 },
  title: { fontSize: 24, fontWeight: '800', color: '#1E293B', textAlign: 'center', marginBottom: 8, lineHeight: 32 },
  priceContainer: {
    flexDirection: 'row',
    alignItems: 'baseline',
    marginTop: 4,
    marginBottom: 16,
  },
  priceValue: { fontSize: 20, fontWeight: '700', color: '#1E293B', marginRight: 8 },
  priceChange: { fontSize: 14, fontWeight: '600' },
  priceChangePositive: { color: '#10B981' },
  priceChangeNegative: { color: '#EF4444' },
  noPriceText: { fontSize: 14, color: '#64748B' },
  badgeRow: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center' },
  sourceBadge: {
    backgroundColor: '#F1F5F9',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
    margin: 4,
  },
  sourceBadgeText: { fontSize: 12, color: '#64748B', fontWeight: '600' },
  confirmedBadge: { backgroundColor: '#DCFCE7' },
  confirmedBadgeText: { color: '#166534' },
  contentCard: { padding: 20, marginTop: 10 },
  section: { marginBottom: 32 },
  sectionTitle: { fontSize: 18, fontWeight: '700', color: '#334155', marginBottom: 16 },
  infoCard: {
    backgroundColor: '#FFFFFF',
    padding: 20,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#F1F5F9',
  },
  closingSoonInfoCard: { borderColor: '#F97316', backgroundColor: '#FFF7ED' },
  infoCardLabel: { fontSize: 12, color: '#94A3B8', marginBottom: 4 },
  infoCardValue: { fontSize: 16, fontWeight: '700', color: '#1E293B' },
  descriptionBox: {
    backgroundColor: '#FFFFFF',
    padding: 20,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#F1F5F9',
  },
  description: { fontSize: 16, lineHeight: 26, color: '#475569' },
  expandButton: { marginTop: 8, alignSelf: 'flex-start' },
  expandButtonText: { color: '#6366F1', fontWeight: '700', fontSize: 14 },
  linkCard: {
    backgroundColor: '#FFFFFF',
    padding: 16,
    borderRadius: 16,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  linkUrl: { fontSize: 14, color: '#6366F1', fontWeight: '600', flex: 1, marginRight: 10 },
  linkHint: { fontSize: 12, color: '#94A3B8', fontWeight: '500' },
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
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  participationButton: {
    backgroundColor: '#E0E7FF',
    height: 56,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 20,
  },
  participatedButton: { backgroundColor: '#166534' },
  participationButtonText: { color: '#4338CA', fontSize: 16, fontWeight: '700' },
  participatedButtonText: { color: '#FFFFFF' },
  mainButton: {
    backgroundColor: '#6366F1',
    height: 56,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
    flex: 1,
    marginLeft: 10,
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
    marginTop: 8,
    borderWidth: 1,
    borderColor: '#FCD34D',
  },
  disclaimerText: { fontSize: 12, lineHeight: 18, color: '#78350F' },
});

export default DetailScreen;
