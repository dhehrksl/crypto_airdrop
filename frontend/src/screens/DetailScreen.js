import React, { useState, useContext, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Alert, ActivityIndicator } from 'react-native';
import BannerAdComponent from '../components/BannerAdComponent';
import { AuthContext } from '../context/AuthContext';
import { markAsParticipated, unmarkAsParticipated, getMarketPrice } from '../services/api';
import { DISCLAIMER_SHORT } from '../constants/policies';
import { colors, radius, getTrendLabel } from '../constants/theme';
import useAirdropTracking from '../hooks/useAirdropTracking';

const DetailScreen = ({ route, navigation }) => {
  const { airdrop: initialAirdrop } = route.params;
  const { userInfo } = useContext(AuthContext);

  const [airdrop, setAirdrop] = useState(initialAirdrop);
  const [expanded, setExpanded] = useState(false);
  const [isParticipated, setIsParticipated] = useState(false);
  const [priceData, setPriceData] = useState(null);
  const [priceLoading, setPriceLoading] = useState(false);

  // 관심 목록 + 단계별 진행 추적 (로그인 사용자만)
  const { watchlisted, completedTasks, toggleWatchlist, toggleTask } = useAirdropTracking(
    airdrop._id,
    !!userInfo
  );

  useEffect(() => {
    if (userInfo && airdrop.participatedBy) {
      setIsParticipated(airdrop.participatedBy.includes(userInfo.id));
    }
  }, [userInfo, airdrop.participatedBy]);

  useEffect(() => {
    const fetchPrice = async () => {
      const ticker =
        airdrop.tokenTicker ||
        (airdrop.projectName ? airdrop.projectName.toLowerCase().replace(/\s+/g, '-') : null);
      if (!ticker) return;
      setPriceLoading(true);
      try {
        const response = await getMarketPrice(ticker);
        if (response.data && !response.data.unsupported) setPriceData(response.data);
        else setPriceData(null);
      } catch (error) {
        setPriceData(null);
      } finally {
        setPriceLoading(false);
      }
    };
    fetchPrice();
  }, [airdrop.tokenTicker, airdrop.projectName]);

  const handleToggleParticipation = async () => {
    if (!userInfo) {
      Alert.alert('로그인 필요', '이 기능을 사용하려면 로그인이 필요합니다.');
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
      Alert.alert('오류', '참여 상태를 업데이트하는 데 실패했습니다.');
    }
  };

  const handleOpenWebView = () => {
    if (airdrop.official_link) {
      Alert.alert(
        '외부 사이트 이동',
        '정보 확인을 위해 외부 사이트로 이동합니다. 에어드랍 참여 시 절대로 개인키나 시드 구문을 공유하지 마십시오. 사기 및 해킹에 주의하시기 바랍니다.',
        [
          { text: '취소', style: 'cancel' },
          {
            text: '이동',
            onPress: () =>
              navigation.navigate('WebView', {
                url: airdrop.official_link,
                title: airdrop.title || airdrop.projectName,
              }),
          },
        ]
      );
    } else {
      Alert.alert('오류', '참여 링크를 찾을 수 없습니다.');
    }
  };

  const endDate = airdrop.end_date
    ? new Date(airdrop.end_date).toLocaleString('ko-KR', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        hour12: false,
      })
    : '미정';
  const isClosingSoon =
    airdrop.end_date && new Date(airdrop.end_date) < new Date(Date.now() + 3 * 24 * 60 * 60 * 1000);

  const description = airdrop.description || '상세 정보가 없습니다.';
  const isLongDescription = description.length > 100;
  const title = airdrop.projectName || airdrop.title || '제목 없음';
  const trend = getTrendLabel(airdrop.trend_score);

  const tasksArr = Array.isArray(airdrop.tasks) ? airdrop.tasks : [];
  const hasTasks = tasksArr.length > 0;

  return (
    <View style={styles.mainContainer}>
      <ScrollView style={styles.container} contentContainerStyle={styles.scrollContent}>
        <View style={styles.heroSection}>
          <View style={styles.heroTopRow}>
            <TouchableOpacity style={styles.iconButton} onPress={() => navigation.goBack()}>
              <Text style={styles.iconButtonText}>✕</Text>
            </TouchableOpacity>
            {userInfo && (
              <TouchableOpacity
                style={[styles.watchButton, watchlisted && styles.watchButtonActive]}
                onPress={toggleWatchlist}
                activeOpacity={0.8}
              >
                <Text style={[styles.watchButtonText, watchlisted && styles.watchButtonTextActive]}>
                  {watchlisted ? '★ 관심' : '☆ 관심'}
                </Text>
              </TouchableOpacity>
            )}
          </View>

          <View style={[styles.trendChip, { backgroundColor: trend.soft }]}>
            <Text style={[styles.trendChipText, { color: trend.color }]}>{trend.text}</Text>
          </View>

          <Text style={styles.title}>{title}</Text>

          {(airdrop.tokenTicker || airdrop.projectName) && (
            <View style={styles.priceContainer}>
              {priceLoading ? (
                <ActivityIndicator size="small" color={colors.textMuted} />
              ) : priceData && priceData.usd ? (
                <>
                  <Text style={styles.priceValue}>${priceData.usd.toLocaleString()}</Text>
                  <Text
                    style={[
                      styles.priceChange,
                      priceData.usd_24h_change >= 0
                        ? styles.priceChangePositive
                        : styles.priceChangeNegative,
                    ]}
                  >
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
                <Text style={[styles.sourceBadgeText, { color: colors.cyan }]}>✔ 공식 확정</Text>
              </View>
            )}
            {Array.isArray(airdrop.source) &&
              airdrop.source.map((s, i) => (
                <View key={i} style={styles.sourceBadge}>
                  <Text style={styles.sourceBadgeText}>{s}</Text>
                </View>
              ))}
          </View>
        </View>

        <View style={styles.contentCard}>
          {airdrop.end_date && (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>🗓️  주요 일정</Text>
              <View style={[styles.infoCard, isClosingSoon && styles.closingSoonInfoCard]}>
                <Text style={styles.infoCardLabel}>마감일</Text>
                <Text style={[styles.infoCardValue, isClosingSoon && { color: colors.warning }]}>
                  {endDate}
                  {isClosingSoon && '  (🔥 마감 임박)'}
                </Text>
              </View>
            </View>
          )}

          <View style={styles.section}>
            <View style={styles.sectionHeaderRow}>
              <Text style={styles.sectionTitle}>📋  참여 방법</Text>
              {hasTasks && userInfo && (
                <Text style={styles.progressText}>
                  {completedTasks.length}/{tasksArr.length} 완료
                </Text>
              )}
            </View>
            <View style={styles.descriptionBox}>
              {hasTasks ? (
                <>
                  {tasksArr.map((t, i) => {
                    const done = completedTasks.includes(i);
                    return (
                      <TouchableOpacity
                        key={i}
                        style={[styles.taskRow, i === tasksArr.length - 1 && styles.taskRowLast]}
                        onPress={() => toggleTask(i)}
                        disabled={!userInfo}
                        activeOpacity={0.7}
                      >
                        <View style={[styles.checkbox, done && styles.checkboxDone]}>
                          {done && <Text style={styles.checkmark}>✓</Text>}
                        </View>
                        <Text style={[styles.taskText, done && styles.taskTextDone]}>{t}</Text>
                      </TouchableOpacity>
                    );
                  })}
                  {!userInfo && (
                    <Text style={styles.loginHint}>
                      로그인하면 단계별로 진행 상황을 체크할 수 있습니다.
                    </Text>
                  )}
                </>
              ) : (
                <>
                  <Text style={styles.description} numberOfLines={expanded ? undefined : 4}>
                    {description}
                  </Text>
                  {isLongDescription && (
                    <TouchableOpacity onPress={() => setExpanded(!expanded)} style={styles.expandButton}>
                      <Text style={styles.expandButtonText}>
                        {expanded ? '간략히 보기' : '... 더보기'}
                      </Text>
                    </TouchableOpacity>
                  )}
                </>
              )}
            </View>
          </View>

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>🔗  공식 링크</Text>
            <TouchableOpacity style={styles.linkCard} onPress={handleOpenWebView} activeOpacity={0.8}>
              <Text style={styles.linkUrl} numberOfLines={1}>
                {airdrop.official_link || '링크 없음'}
              </Text>
              <Text style={styles.linkHint}>탭하여 열기 ›</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.disclaimerBox}>
            <Text style={styles.disclaimerText}>⚠  {DISCLAIMER_SHORT}</Text>
          </View>
        </View>
      </ScrollView>

      <BannerAdComponent />

      <View style={styles.bottomBar}>
        <TouchableOpacity
          style={[styles.participationButton, isParticipated && styles.participatedButton]}
          onPress={handleToggleParticipation}
          activeOpacity={0.85}
        >
          <Text style={[styles.participationButtonText, isParticipated && styles.participatedButtonText]}>
            {isParticipated ? '✔ 참여 완료' : '참여 완료로 표시'}
          </Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.mainButton} onPress={handleOpenWebView} activeOpacity={0.85}>
          <Text style={styles.mainButtonText}>참여하러 가기</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  mainContainer: { flex: 1, backgroundColor: colors.bg },
  container: { flex: 1 },
  scrollContent: { paddingBottom: 130 },
  heroSection: {
    backgroundColor: colors.bgElevated,
    alignItems: 'center',
    paddingTop: 56,
    paddingBottom: 32,
    paddingHorizontal: 20,
    borderBottomWidth: 1,
    borderBottomColor: colors.hairline,
  },
  heroTopRow: {
    position: 'absolute',
    top: 52,
    left: 16,
    right: 16,
    flexDirection: 'row',
    justifyContent: 'space-between',
    zIndex: 10,
  },
  iconButton: {
    backgroundColor: colors.surfaceAlt,
    borderRadius: 16,
    width: 32,
    height: 32,
    justifyContent: 'center',
    alignItems: 'center',
  },
  iconButtonText: { color: colors.textSecondary, fontWeight: '800', fontSize: 14 },
  watchButton: {
    backgroundColor: colors.surfaceAlt,
    borderRadius: 16,
    height: 32,
    paddingHorizontal: 14,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.hairline,
  },
  watchButtonActive: { backgroundColor: colors.accentSoft, borderColor: colors.accent },
  watchButtonText: { color: colors.textSecondary, fontWeight: '700', fontSize: 13 },
  watchButtonTextActive: { color: colors.accentBright },
  trendChip: {
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: radius.pill,
    marginTop: 28,
    marginBottom: 16,
  },
  trendChipText: { fontSize: 13, fontWeight: '800' },
  title: {
    fontSize: 24,
    fontWeight: '800',
    color: colors.textPrimary,
    textAlign: 'center',
    lineHeight: 32,
  },
  priceContainer: { flexDirection: 'row', alignItems: 'baseline', marginTop: 10 },
  priceValue: { fontSize: 20, fontWeight: '800', color: colors.textPrimary, marginRight: 8 },
  priceChange: { fontSize: 14, fontWeight: '700' },
  priceChangePositive: { color: colors.success },
  priceChangeNegative: { color: colors.danger },
  noPriceText: { fontSize: 14, color: colors.textMuted },
  badgeRow: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', marginTop: 16 },
  sourceBadge: {
    backgroundColor: colors.surfaceAlt,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: radius.pill,
    margin: 4,
  },
  sourceBadgeText: { fontSize: 12, color: colors.textSecondary, fontWeight: '700' },
  confirmedBadge: { backgroundColor: colors.cyanSoft },
  contentCard: { padding: 20 },
  section: { marginBottom: 28 },
  sectionHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 14,
  },
  sectionTitle: { fontSize: 17, fontWeight: '800', color: colors.textPrimary },
  progressText: { fontSize: 13, fontWeight: '800', color: colors.accentBright },
  infoCard: {
    backgroundColor: colors.surface,
    padding: 18,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.hairline,
  },
  closingSoonInfoCard: { borderColor: colors.warning, backgroundColor: '#1A1813' },
  infoCardLabel: { fontSize: 12, color: colors.textMuted, marginBottom: 5, fontWeight: '600' },
  infoCardValue: { fontSize: 15.5, fontWeight: '700', color: colors.textPrimary },
  descriptionBox: {
    backgroundColor: colors.surface,
    padding: 18,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.hairline,
  },
  description: { fontSize: 15, lineHeight: 25, color: colors.textSecondary },
  expandButton: { marginTop: 10, alignSelf: 'flex-start' },
  expandButtonText: { color: colors.accentBright, fontWeight: '700', fontSize: 14 },
  taskRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingVertical: 11,
    borderBottomWidth: 1,
    borderBottomColor: colors.hairline,
  },
  taskRowLast: { borderBottomWidth: 0, paddingBottom: 2 },
  checkbox: {
    width: 22,
    height: 22,
    borderRadius: 7,
    borderWidth: 2,
    borderColor: colors.hairlineStrong,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
    marginTop: 1,
  },
  checkboxDone: { backgroundColor: colors.accent, borderColor: colors.accent },
  checkmark: { color: colors.white, fontSize: 13, fontWeight: '900' },
  taskText: { flex: 1, fontSize: 14.5, lineHeight: 22, color: colors.textSecondary },
  taskTextDone: { color: colors.textMuted, textDecorationLine: 'line-through' },
  loginHint: { fontSize: 13, color: colors.textMuted, marginTop: 12, lineHeight: 18 },
  linkCard: {
    backgroundColor: colors.surface,
    padding: 16,
    borderRadius: radius.lg,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.hairline,
  },
  linkUrl: { fontSize: 13.5, color: colors.accentBright, fontWeight: '600', flex: 1, marginRight: 10 },
  linkHint: { fontSize: 12, color: colors.textMuted, fontWeight: '600' },
  disclaimerBox: {
    backgroundColor: colors.warningSoft,
    borderRadius: radius.md,
    padding: 14,
    borderWidth: 1,
    borderColor: 'rgba(244, 183, 61, 0.25)',
  },
  disclaimerText: { fontSize: 12, lineHeight: 18, color: colors.warning },
  bottomBar: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: colors.bgElevated,
    paddingHorizontal: 20,
    paddingTop: 14,
    paddingBottom: 30,
    borderTopWidth: 1,
    borderTopColor: colors.hairline,
    flexDirection: 'row',
    alignItems: 'center',
  },
  participationButton: {
    backgroundColor: colors.surfaceAlt,
    height: 54,
    borderRadius: radius.md,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 18,
    borderWidth: 1,
    borderColor: colors.hairline,
  },
  participatedButton: { backgroundColor: colors.successSoft, borderColor: colors.success },
  participationButtonText: { color: colors.textSecondary, fontSize: 14, fontWeight: '700' },
  participatedButtonText: { color: colors.success },
  mainButton: {
    backgroundColor: colors.accent,
    height: 54,
    borderRadius: radius.md,
    justifyContent: 'center',
    alignItems: 'center',
    flex: 1,
    marginLeft: 10,
  },
  mainButtonText: { color: colors.white, fontSize: 16, fontWeight: '800' },
});

export default DetailScreen;
