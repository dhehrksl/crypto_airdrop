import React, { useState, useEffect, useContext } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  RefreshControl,
  Platform,
} from 'react-native';
import * as Device from 'expo-device';
import * as Notifications from 'expo-notifications';
import { registerPushToken } from '../services/api';
import { AuthContext } from '../context/AuthContext';
import BannerAdComponent from '../components/BannerAdComponent';
import NativeAdView from '../components/NativeAdView';
import useAirdrops from '../hooks/useAirdrops';
import { colors, radius, getTrendLabel } from '../constants/theme';

const SORT_OPTIONS = [
  { key: 'latest', label: '최신순' },
  { key: 'ending_soon', label: '마감임박순' },
  { key: 'trend_score', label: '인기순' },
];

async function registerForPushNotificationsAsync(userId) {
  let token;
  if (Device.isDevice) {
    const { status: existingStatus } = await Notifications.getPermissionsAsync();
    let finalStatus = existingStatus;
    if (existingStatus !== 'granted') {
      const { status } = await Notifications.requestPermissionsAsync();
      finalStatus = status;
    }
    if (finalStatus !== 'granted') return;
    token = (await Notifications.getExpoPushTokenAsync()).data;
  }

  if (Platform.OS === 'android') {
    Notifications.setNotificationChannelAsync('default', {
      name: 'default',
      importance: Notifications.AndroidImportance.MAX,
      vibrationPattern: [0, 250, 250, 250],
      lightColor: '#7C6CF7',
    });
  }

  if (token && userId) {
    try {
      await registerPushToken(token, userId);
    } catch (error) {
      console.error('Error registering push token:', error);
    }
  }
}

const HomeScreen = ({ navigation }) => {
  const { userInfo } = useContext(AuthContext);
  const [sortType, setSortType] = useState('latest');
  const { airdrops, loading, refreshing, onRefresh } = useAirdrops(sortType);

  useEffect(() => {
    if (userInfo?.id) {
      registerForPushNotificationsAsync(userInfo.id);
    }
  }, [userInfo]);

  const handleSortChange = (newSortType) => {
    if (newSortType !== sortType) setSortType(newSortType);
  };

  const renderItem = ({ item }) => {
    if (item === 'ad') return <NativeAdView />;

    const now = Date.now();
    const endMs = item.end_date ? new Date(item.end_date).getTime() : null;
    const msToEnd = endMs ? endMs - now : null;
    const isClosingSoon = msToEnd !== null && msToEnd > 0 && msToEnd < 3 * 24 * 60 * 60 * 1000;
    const isExpired = msToEnd !== null && msToEnd <= 0;
    const countdown = (() => {
      if (msToEnd === null) return null;
      if (isExpired) return '마감됨';
      const d = Math.floor(msToEnd / (24 * 60 * 60 * 1000));
      const h = Math.floor((msToEnd % (24 * 60 * 60 * 1000)) / (60 * 60 * 1000));
      if (d > 0) return `${d}일 ${h}시간 남음`;
      const m = Math.floor((msToEnd % (60 * 60 * 1000)) / (60 * 1000));
      return `${h}시간 ${m}분 남음`;
    })();
    const tasks = Array.isArray(item.tasks) ? item.tasks : [];
    const trend = getTrendLabel(item.trend_score);

    return (
      <TouchableOpacity
        style={[styles.card, isClosingSoon && styles.cardClosingSoon]}
        onPress={() => navigation.navigate('Detail', { airdrop: item })}
        activeOpacity={0.8}
      >
        <View style={styles.header}>
          <View style={{ flex: 1, marginRight: 10 }}>
            <Text style={styles.title} numberOfLines={2}>{item.title || '제목 없음'}</Text>
            {!!item.tokenTicker && <Text style={styles.tickerText}>${item.tokenTicker}</Text>}
          </View>
          <View style={styles.badgesContainer}>
            {item.is_confirmed && (
              <View style={[styles.badge, styles.confirmedBadge]}>
                <Text style={styles.confirmedBadgeText}>✔ 공식</Text>
              </View>
            )}
            <View style={[styles.badge, { backgroundColor: trend.soft }]}>
              <Text style={[styles.trendBadgeText, { color: trend.color }]}>{trend.text}</Text>
            </View>
          </View>
        </View>

        {tasks.length > 0 ? (
          <View style={styles.tasksBox}>
            {tasks.slice(0, 3).map((t, i) => (
              <View key={i} style={styles.taskRow}>
                <Text style={styles.taskBullet}>{i + 1}</Text>
                <Text style={styles.taskText} numberOfLines={1}>{t}</Text>
              </View>
            ))}
            {tasks.length > 3 && <Text style={styles.taskMore}>외 {tasks.length - 3}단계 …</Text>}
          </View>
        ) : (
          <Text style={styles.description} numberOfLines={2}>
            {item.description || '참여 방법에 대한 상세 정보를 확인하세요.'}
          </Text>
        )}

        <View style={styles.footer}>
          <View style={styles.tagContainer}>
            {countdown && (
              <View
                style={[
                  styles.tag,
                  isExpired ? styles.expiredTag : isClosingSoon ? styles.closingSoonTag : styles.countdownTag,
                ]}
              >
                <Text
                  style={[
                    styles.tagText,
                    { color: isExpired ? colors.textMuted : isClosingSoon ? colors.warning : colors.cyan },
                  ]}
                >
                  {isClosingSoon ? '🔥 ' : '⏱ '}{countdown}
                </Text>
              </View>
            )}
            {item.category && (
              <View style={[styles.tag, styles.categoryTag]}>
                <Text style={[styles.tagText, { color: colors.accentBright }]}>{item.category}</Text>
              </View>
            )}
            {Array.isArray(item.chain) &&
              item.chain.slice(0, 2).map((ch, idx) => (
                <View key={`chain-${idx}`} style={[styles.tag, styles.chainTag]}>
                  <Text style={[styles.tagText, { color: colors.success }]}>{ch}</Text>
                </View>
              ))}
          </View>
        </View>
      </TouchableOpacity>
    );
  };

  const renderListHeader = () => (
    <>
      <View style={styles.listHeader}>
        <Text style={styles.eyebrow}>AIRDROP RADAR</Text>
        <Text style={styles.listTitle}>진행 중인 에어드랍</Text>
        <Text style={styles.listSubtitle}>AI가 분류한 진행 중 캠페인 · 정보 제공 목적</Text>
      </View>
      <View style={styles.sortContainer}>
        {SORT_OPTIONS.map((option) => (
          <TouchableOpacity
            key={option.key}
            style={[styles.sortButton, sortType === option.key && styles.sortButtonActive]}
            onPress={() => handleSortChange(option.key)}
            activeOpacity={0.8}
          >
            <Text style={[styles.sortButtonText, sortType === option.key && styles.sortButtonTextActive]}>
              {option.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>
    </>
  );

  return (
    <View style={styles.container}>
      <FlatList
        data={airdrops}
        renderItem={renderItem}
        keyExtractor={(item, index) => (item === 'ad' ? `ad-${index}` : item._id)}
        ListHeaderComponent={renderListHeader}
        contentContainerStyle={styles.listContent}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={colors.accent}
            colors={[colors.accent]}
          />
        }
        ListEmptyComponent={
          !loading && (
            <View style={styles.emptyState}>
              <Text style={styles.emptyText}>현재 표시할 에어드랍이 없습니다.</Text>
              <TouchableOpacity style={styles.retryButton} onPress={onRefresh}>
                <Text style={styles.retryButtonText}>새로고침</Text>
              </TouchableOpacity>
            </View>
          )
        }
        style={{ flex: 1 }}
      />
      {loading && !refreshing && (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={colors.accent} />
          <Text style={styles.loadingText}>최신 에어드랍 정보를 수집 중…</Text>
        </View>
      )}
      <BannerAdComponent />
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  center: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(11, 13, 20, 0.8)',
  },
  loadingText: { marginTop: 12, color: colors.textSecondary, fontSize: 14 },
  listHeader: { paddingHorizontal: 20, paddingTop: 64, paddingBottom: 12 },
  eyebrow: {
    fontSize: 11,
    fontWeight: '800',
    color: colors.accent,
    letterSpacing: 1.5,
    marginBottom: 6,
  },
  listTitle: { fontSize: 26, fontWeight: '800', color: colors.textPrimary, letterSpacing: -0.5 },
  listSubtitle: { fontSize: 13, color: colors.textMuted, marginTop: 5 },
  sortContainer: { flexDirection: 'row', paddingHorizontal: 16, paddingVertical: 12 },
  sortButton: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: radius.pill,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.hairline,
    marginHorizontal: 4,
  },
  sortButtonActive: { backgroundColor: colors.accent, borderColor: colors.accent },
  sortButtonText: { fontWeight: '700', fontSize: 13, color: colors.textSecondary },
  sortButtonTextActive: { color: colors.white },
  listContent: { paddingBottom: 24 },
  card: {
    backgroundColor: colors.surface,
    marginHorizontal: 16,
    marginVertical: 7,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.hairline,
    padding: 16,
  },
  cardClosingSoon: { borderColor: colors.warning, backgroundColor: '#1A1A1B' },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 },
  title: { fontSize: 16.5, fontWeight: '700', color: colors.textPrimary, lineHeight: 22 },
  tickerText: { fontSize: 13, fontWeight: '800', color: colors.accentBright, marginTop: 3 },
  badgesContainer: { flexDirection: 'row', alignItems: 'center' },
  badge: { paddingHorizontal: 9, paddingVertical: 5, borderRadius: radius.sm, marginLeft: 6 },
  confirmedBadge: { backgroundColor: colors.cyanSoft },
  confirmedBadgeText: { color: colors.cyan, fontSize: 11, fontWeight: '800' },
  trendBadgeText: { fontSize: 11, fontWeight: '800' },
  description: { fontSize: 13.5, color: colors.textSecondary, lineHeight: 20, marginBottom: 14 },
  tasksBox: { backgroundColor: colors.surfaceAlt, borderRadius: radius.md, padding: 11, marginBottom: 14 },
  taskRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 5 },
  taskBullet: {
    fontSize: 11,
    fontWeight: '800',
    color: colors.accent,
    backgroundColor: colors.accentSoft,
    width: 18,
    height: 18,
    borderRadius: 9,
    textAlign: 'center',
    lineHeight: 18,
    marginRight: 8,
    overflow: 'hidden',
  },
  taskText: { flex: 1, fontSize: 13, color: colors.textSecondary, lineHeight: 18 },
  taskMore: { fontSize: 11, color: colors.textMuted, fontStyle: 'italic', marginTop: 2, marginLeft: 26 },
  footer: { borderTopWidth: 1, borderTopColor: colors.hairline, paddingTop: 12 },
  tagContainer: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center' },
  tag: { paddingHorizontal: 9, paddingVertical: 5, borderRadius: radius.sm, marginRight: 6, marginBottom: 4 },
  tagText: { fontSize: 10.5, fontWeight: '700' },
  countdownTag: { backgroundColor: colors.cyanSoft },
  closingSoonTag: { backgroundColor: colors.warningSoft },
  expiredTag: { backgroundColor: colors.surfaceAlt },
  categoryTag: { backgroundColor: colors.accentSoft },
  chainTag: { backgroundColor: colors.successSoft },
  emptyState: { marginTop: 120, alignItems: 'center', paddingHorizontal: 40 },
  emptyText: { fontSize: 15, color: colors.textMuted, textAlign: 'center', marginBottom: 18 },
  retryButton: {
    backgroundColor: colors.accent,
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: radius.md,
  },
  retryButtonText: { color: colors.white, fontWeight: '700' },
});

export default HomeScreen;
