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
import { getAirdrops, registerPushToken } from '../services/api';
import { AuthContext } from '../context/AuthContext';
import BannerAdComponent from '../components/BannerAdComponent';
import NativeAdView from '../components/NativeAdView';

const SORT_OPTIONS = [
  { key: 'latest', label: '최신순' },
  { key: 'ending_soon', label: '마감임박순' },
  { key: 'trust_score', label: '신뢰도순' },
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

    const isClosingSoon = item.end_date && new Date(item.end_date) < new Date(Date.now() + 3 * 24 * 60 * 60 * 1000);
    const endDate = item.end_date ? new Date(item.end_date).toLocaleDateString('ko-KR', { year: 'numeric', month: 'long', day: 'numeric' }) : '미정';

    return (
      <TouchableOpacity 
        style={[styles.card, isClosingSoon && styles.cardClosingSoon]}
        onPress={() => navigation.navigate('Detail', { airdrop: item })}
        activeOpacity={0.7}
      >
        <View style={styles.cardContent}>
          <View style={styles.header}>
            <Text style={styles.title} numberOfLines={1}>{item.title || '제목 없음'}</Text>
            <View style={styles.badgesContainer}>
              {item.is_confirmed && (
                <View style={[styles.badge, styles.confirmedBadge]}>
                  <Text style={styles.badgeText}>✔ 공식</Text>
                </View>
              )}
              <View style={[styles.badge, { backgroundColor: getScoreColor(Number(item.trust_score) || 0) }]}>
                <Text style={styles.badgeText}>{item.trust_score || 0}%</Text>
              </View>
            </View>
          </View>
          <Text style={styles.description} numberOfLines={2}>
            {item.description || '참여 방법에 대한 상세 정보를 확인하세요.'}
          </Text>
          <View style={styles.footer}>
            <View style={styles.tagContainer}>
              {isClosingSoon && (
                <View style={[styles.tag, styles.closingSoonTag]}>
                  <Text style={[styles.tagText, { color: '#C2410C' }]}>🔥 마감 임박</Text>
                </View>
              )}
              {item.source && item.source.map((s, idx) => (
                <View key={idx} style={styles.tag}>
                  <Text style={styles.tagText}>{s}</Text>
                </View>
              ))}
            </View>
            <Text style={[styles.date, isClosingSoon && { color: '#EF4444', fontWeight: '700' }]}>
              종료: {endDate}
            </Text>
          </View>
        </View>
      </TouchableOpacity>
    );
  };

  const getScoreColor = (score) => {
    if (score >= 90) return '#10B981'; // Success Green
    if (score >= 80) return '#F59E0B'; // Warning Orange
    return '#EF4444'; // Error Red
  };

  const renderListHeader = () => (
    <>
      <View style={styles.listHeader}>
        <View style={styles.titleRow}>
          <Text style={styles.listTitle}>최근 에어드랍</Text>
        </View>
        <Text style={styles.listSubtitle}>AI가 분석한 고신뢰 프로젝트</Text>
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
