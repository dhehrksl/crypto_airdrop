import React from 'react';
import { View, Text, FlatList, TouchableOpacity, StyleSheet, ActivityIndicator, RefreshControl } from 'react-native';
import useGuaranteedAirdrops from '../hooks/useGuaranteedAirdrops';
import BannerAdComponent from '../components/BannerAdComponent';

const GuaranteedScreen = ({ navigation }) => {
  const { guaranteedAirdrops, loading, refreshing, onRefresh } = useGuaranteedAirdrops();

  const renderItem = ({ item }) => {
    return (
      <TouchableOpacity 
        style={styles.card}
        // Navigate to a new detail screen for guaranteed airdrops, or reuse DetailScreen if applicable
        // For now, let's just log it. We can implement navigation later.
        onPress={() => console.log('Navigate to detail for:', item.projectName)}
        activeOpacity={0.7}
      >
        <View style={styles.cardContent}>
          <View style={styles.header}>
            <Text style={styles.title}>{item.projectName}</Text>
            <View style={[styles.badge, styles.difficultyBadge]}>
              <Text style={styles.badgeText}>{item.difficulty}</Text>
            </View>
          </View>
          <Text style={styles.description} numberOfLines={2}>{item.description}</Text>
          <View style={styles.tags}>
            <View style={styles.tag}><Text style={styles.tagText}>{item.chain}</Text></View>
            <View style={styles.tag}><Text style={styles.tagText}>{item.category}</Text></View>
          </View>
        </View>
      </TouchableOpacity>
    );
  };

  const renderListHeader = () => (
    <View style={styles.listHeader}>
      <Text style={styles.listTitle}>확정 에어드랍 가이드</Text>
      <Text style={styles.listSubtitle}>토큰 없는 프로토콜에 참여하여 미래의 보상을 받으세요.</Text>
    </View>
  );

  return (
    <View style={styles.container}>
      <FlatList
        data={guaranteedAirdrops}
        renderItem={renderItem}
        keyExtractor={(item) => item._id}
        ListHeaderComponent={renderListHeader}
        contentContainerStyle={styles.listContent}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={['#4F46E5']} />
        }
        ListEmptyComponent={
          !loading && (
            <View style={styles.emptyState}>
              <Text style={styles.emptyText}>현재 표시할 에어드랍 가이드가 없습니다.</Text>
            </View>
          )
        }
      />
       {loading && !refreshing && (
        <View style={styles.center}>
          <ActivityIndicator size="large" color="#4F46E5" />
        </View>
      )}
      <BannerAdComponent />
    </View>
  );
};

// Add appropriate styles, borrowing from NewsScreen and HomeScreen
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
    borderColor: '#E2E8F0',
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
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
    fontSize: 18,
    fontWeight: '700',
    color: '#111827',
  },
  description: {
    fontSize: 14,
    color: '#4B5563',
    lineHeight: 20,
    marginBottom: 12,
  },
  tags: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  tag: {
    backgroundColor: '#E0E7FF',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    marginRight: 8,
    marginBottom: 8,
  },
  tagText: {
    color: '#4338CA',
    fontSize: 11,
    fontWeight: '600',
  },
  badge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  difficultyBadge: {
    backgroundColor: '#DBEAFE',
  },
  badgeText: {
    color: '#1E40AF',
    fontSize: 12,
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

export default GuaranteedScreen;
