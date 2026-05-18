import React, { useState, useEffect, useCallback, useContext } from 'react';
import { 
  View, 
  Text, 
  FlatList, 
  TouchableOpacity, 
  StyleSheet, 
  ActivityIndicator,
  RefreshControl,
  Platform
} from 'react-native';
import * as Device from 'expo-device';
import * as Notifications from 'expo-notifications';
import { getAirdrops, registerPushToken } from '../services/api';
import { AuthContext } from '../context/AuthContext';
import BannerAdComponent from '../components/BannerAdComponent';
import NativeAdView from '../components/NativeAdView';

const SORT_OPTIONS = [
  { key: 'latest', label: '최신순' },
  { key: 'ending_soon', label: '마감임박순' },
  { key: 'trend_score', label: '트렌드순' },
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
    if (finalStatus !== 'granted') {
      console.log('Failed to get push token for push notification!');
      return;
    }
    token = (await Notifications.getExpoPushTokenAsync()).data;
    console.log('Expo Push Token:', token);
  } else {
    console.log('Must use physical device for Push Notifications');
  }

  if (Platform.OS === 'android') {
    Notifications.setNotificationChannelAsync('default', {
      name: 'default',
      importance: Notifications.AndroidImportance.MAX,
      vibrationPattern: [0, 250, 250, 250],
      lightColor: '#FF231F7C',
    });
  }

  if (token && userId) {
    try {
      await registerPushToken(token, userId);
      console.log('Push token registered successfully for user:', userId);
    } catch (error) {
      console.error('Error registering push token:', error);
    }
  }
}

import useAirdrops from '../hooks/useAirdrops';

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
    if (newSortType !== sortType) {
      setSortType(newSortType);
    }
  };

  const renderItem = ({ item, index }) => {
    if (item === 'ad') {
      return (
        <NativeAdView />
      );
    }

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

    return (
      <TouchableOpacity
        style={[styles.card, isClosingSoon && styles.cardClosingSoon]}
        onPress={() => navigation.navigate('Detail', { airdrop: item })}
        activeOpacity={0.7}
      >
        <View style={styles.cardContent}>
          <View style={styles.header}>
            <View style={{ flex: 1, marginRight: 10 }}>
              <Text style={styles.title} numberOfLines={2}>{item.title || '제목 없음'}</Text>
              {!!item.tokenTicker && (
                <Text style={styles.tickerText}>${item.tokenTicker}</Text>
              )}
            </View>
            <View style={styles.badgesContainer}>
              {item.is_confirmed && (
                <View style={[styles.badge, styles.confirmedBadge]}>
                  <Text style={styles.badgeText}>✔ 공식</Text>
                </View>
              )}
              <View style={[styles.badge, { backgroundColor: getScoreColor(Number(item.trend_score) || 0) }]}>
                <Text style={styles.badgeText}>{item.trend_score || 0}%</Text>
              </View>
            </View>
          </View>

          {tasks.length > 0 ? (
            <View style={styles.tasksBox}>
              {tasks.slice(0, 3).map((t, i) => (
                <View key={i} style={styles.taskRow}>
                  <Text style={styles.taskBullet}>{i + 1}.</Text>
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
                <View style={[styles.tag, isExpired ? styles.expiredTag : isClosingSoon ? styles.closingSoonTag : styles.countdownTag]}>
                  <Text style={[styles.tagText, { color: isExpired ? '#64748B' : isClosingSoon ? '#C2410C' : '#0369A1' }]}>
                    {isClosingSoon ? '🔥 ' : '⏱ '}{countdown}
                  </Text>
                </View>
              )}
              {item.category && (
                <View style={[styles.tag, styles.categoryTag]}>
                  <Text style={[styles.tagText, { color: '#4338CA' }]}>{item.category}</Text>
                </View>
              )}
              {Array.isArray(item.chain) && item.chain.slice(0, 2).map((ch, idx) => (
                <View key={`chain-${idx}`} style={[styles.tag, styles.chainTag]}>
                  <Text style={[styles.tagText, { color: '#065F46' }]}>{ch}</Text>
                </View>
              ))}
            </View>
          </View>
        </View>
      </TouchableOpacity>
    );
  };

  const getScoreColor = (score) => {
    if (score >= 90) return '#10B981'; // Success Green
    if (score >= 80) return '#F59E0B'; // Warning Orange
    return '#94A3B8'; // Neutral Gray (Trend index doesn't have "Error")
  };

  const renderListHeader = () => (
    <>
      <View style={styles.listHeader}>
        <View style={styles.titleRow}>
          <Text style={styles.listTitle}>최근 에어드랍</Text>
        </View>
        <Text style={styles.listSubtitle}>AI가 분류한 진행 중 캠페인 (정보 제공 목적)</Text>
      </View>
      <View style={styles.sortContainer}>
        {SORT_OPTIONS.map((option) => (
          <TouchableOpacity
            key={option.key}
            style={[styles.sortButton, sortType === option.key && styles.sortButtonActive]}
            onPress={() => handleSortChange(option.key)}
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
        keyExtractor={(item, index) => item === 'ad' ? `ad-${index}` : item._id}
        ListHeaderComponent={renderListHeader}
        contentContainerStyle={styles.listContent}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={['#6366F1']} />
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
          <ActivityIndicator size="large" color="#6366F1" />
          <Text style={styles.loadingText}>최신 에어드랍 정보를 수집 중...</Text>
        </View>
      )}
      <BannerAdComponent />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8FAFC',
  },
  center: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(248, 250, 252, 0.7)',
  },
  loadingText: {
    marginTop: 10,
    color: '#64748B',
    fontSize: 14,
  },
  listHeader: {
    paddingHorizontal: 20,
    paddingTop: 40, // Adjust for status bar
    paddingBottom: 10,
  },
  titleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  listTitle: {
    fontSize: 24,
    fontWeight: '800',
    color: '#1E293B',
    letterSpacing: -0.5,
  },
  listSubtitle: {
    fontSize: 14,
    color: '#64748B',
    marginTop: 4,
  },
  sortContainer: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9'
  },
  sortButton: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    marginHorizontal: 4,
  },
  sortButtonActive: {
    backgroundColor: '#6366F1',
    borderColor: '#6366F1',
  },
  sortButtonText: {
    fontWeight: '600',
    color: '#475569',
  },
  sortButtonTextActive: {
    color: '#FFFFFF',
  },
  listContent: {
    paddingBottom: 20,
  },
  card: {
    backgroundColor: '#FFFFFF',
    marginHorizontal: 16,
    marginVertical: 8,
    borderRadius: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.05,
    shadowRadius: 12,
    elevation: 3,
    borderWidth: 1,
    borderColor: '#F1F5F9',
  },
  cardClosingSoon: {
    borderColor: '#F97316',
    backgroundColor: '#FFF7ED',
  },
  cardContent: {
    padding: 16,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  title: {
    fontSize: 17,
    fontWeight: '700',
    color: '#0F172A',
    flex: 1,
    marginRight: 10,
  },
  badgesContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  badge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    marginLeft: 6,
  },
  confirmedBadge: {
    backgroundColor: '#E0F2FE', // Light blue
  },
  badgeText: {
    color: '#0C4A6E',
    fontSize: 12,
    fontWeight: '800',
  },
  description: {
    fontSize: 14,
    color: '#475569',
    lineHeight: 20,
    marginBottom: 16,
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
    paddingTop: 12,
  },
  tagContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
  },
  tag: {
    backgroundColor: '#F1F5F9',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    marginRight: 6,
    marginBottom: 4,
  },
  tagText: {
    fontSize: 10,
    color: '#64748B',
    fontWeight: '600',
  },
  closingSoonTag: {
    backgroundColor: '#FFE4E6',
  },
  countdownTag: {
    backgroundColor: '#E0F2FE',
  },
  expiredTag: {
    backgroundColor: '#F1F5F9',
  },
  chainTag: {
    backgroundColor: '#D1FAE5',
  },
  tickerText: {
    fontSize: 13,
    fontWeight: '800',
    color: '#6366F1',
    marginTop: 2,
  },
  tasksBox: {
    backgroundColor: '#F8FAFC',
    borderRadius: 8,
    padding: 10,
    marginBottom: 12,
  },
  taskRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 4,
  },
  taskBullet: {
    fontSize: 13,
    fontWeight: '800',
    color: '#6366F1',
    width: 18,
  },
  taskText: {
    flex: 1,
    fontSize: 13,
    color: '#334155',
    lineHeight: 18,
  },
  taskMore: {
    fontSize: 11,
    color: '#94A3B8',
    fontStyle: 'italic',
    marginTop: 4,
    marginLeft: 18,
  },
  categoryTag: {
    backgroundColor: '#EEF2FF',
  },
  date: {
    fontSize: 11,
    color: '#94A3B8',
    fontWeight: '500',
  },
  emptyState: {
    marginTop: 100,
    alignItems: 'center',
    paddingHorizontal: 40,
  },
  emptyText: {
    fontSize: 16,
    color: '#94A3B8',
    textAlign: 'center',
    marginBottom: 20,
  },
  retryButton: {
    backgroundColor: '#6366F1',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 10,
  },
  retryButtonText: {
    color: '#FFFFFF',
    fontWeight: '700',
  },
  adContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: '#F8FAFC',
  }
});

export default HomeScreen;
