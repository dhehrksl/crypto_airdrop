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
import useNews from '../hooks/useNews';
import BannerAdComponent from '../components/BannerAdComponent';
import NativeAdView from '../components/NativeAdView';

const NewsScreen = ({ navigation }) => {
  const { news, loading, refreshing, onRefresh } = useNews();

  const renderItem = ({ item, index }) => {
    if (item === 'ad') {
      return <NativeAdView />;
    }

    const createdDate = item.created_at ? new Date(item.created_at).toLocaleDateString('ko-KR', { year: 'numeric', month: 'long', day: 'numeric' }) : 'N/A';

    return (
      <TouchableOpacity 
        style={styles.card}
        onPress={() => navigation.navigate('NewsDetail', { news: item })}
        activeOpacity={0.7}
      >
        <View style={styles.cardContent}>
          <Text style={styles.title} numberOfLines={2}>{item.title || '제목 없음'}</Text>
          <Text style={styles.description} numberOfLines={3}>
            {item.description || '상세 정보를 확인하세요.'}
          </Text>
          <View style={styles.footer}>
            <Text style={styles.date}>{createdDate} · {item.source?.[0] || '알 수 없음'}</Text>
          </View>
        </View>
      </TouchableOpacity>
    );
  };

  const renderListHeader = () => (
    <View style={styles.listHeader}>
      <Text style={styles.listTitle}>최근 뉴스</Text>
      <Text style={styles.listSubtitle}>제3자 출처의 암호화폐 뉴스를 AI로 번역해 제공합니다</Text>
    </View>
  );

  return (
    <View style={styles.container}>
      <FlatList
        data={news}
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
              <Text style={styles.emptyText}>현재 표시할 뉴스가 없습니다.</Text>
            </View>
          )
        }
      />
       {loading && !refreshing && (
        <View style={styles.center}>
          <ActivityIndicator size="large" color="#6366F1" />
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
  listHeader: {
    paddingHorizontal: 20,
    paddingTop: 40,
    paddingBottom: 20,
  },
  listTitle: {
    fontSize: 24,
    fontWeight: '800',
    color: '#1E293B',
  },
  listSubtitle: {
    fontSize: 14,
    color: '#64748B',
    marginTop: 4,
  },
  listContent: {
    paddingBottom: 20,
  },
  card: {
    backgroundColor: '#FFFFFF',
    marginHorizontal: 16,
    marginVertical: 8,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#F1F5F9',
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
  },
  cardContent: {
    padding: 16,
  },
  title: {
    fontSize: 17,
    fontWeight: '700',
    color: '#0F172A',
    marginBottom: 8,
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
  date: {
    fontSize: 12,
    color: '#94A3B8',
  },
  linkButton: {
    backgroundColor: '#EEF2FF',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
  },
  linkButtonText: {
    fontSize: 12,
    color: '#6366F1',
    fontWeight: '700',
  },
  emptyState: {
    marginTop: 100,
    alignItems: 'center',
  },
  emptyText: {
    fontSize: 14,
    color: '#94A3B8',
  },
});

export default NewsScreen;
