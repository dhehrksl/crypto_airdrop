import React, { useContext } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, FlatList, ActivityIndicator, RefreshControl } from 'react-native';
import { AuthContext } from '../context/AuthContext';
import useMyAirdrops from '../hooks/useMyAirdrops';

const UserScreen = ({ navigation }) => {
  const { userInfo, logout } = useContext(AuthContext);
  const { participatedAirdrops, loading, refreshing, onRefresh } = useMyAirdrops();

  const renderAirdropItem = ({ item }) => (
    <TouchableOpacity 
      style={styles.airdropCard}
      onPress={() => navigation.navigate('Detail', { airdrop: item })}
    >
      <Text style={styles.airdropTitle} numberOfLines={1}>{item.projectName || item.title}</Text>
      <Text style={styles.airdropDate}>
        {item.is_airdrop ? '뉴스/이벤트' : '가이드'}
      </Text>
    </TouchableOpacity>
  );

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>내 정보</Text>
        <TouchableOpacity style={styles.logoutButton} onPress={logout}>
          <Text style={styles.logoutButtonText}>로그아웃</Text>
        </TouchableOpacity>
      </View>
      
      <View style={styles.infoCard}>
        <View style={styles.infoRow}>
          <Text style={styles.label}>사용자 이름</Text>
          <Text style={styles.value}>{userInfo?.username || 'N/A'}</Text>
        </View>
        <View style={[styles.infoRow, { borderBottomWidth: 0 }]}>
          <Text style={styles.label}>이메일</Text>
          <Text style={styles.value}>{userInfo?.email || 'N/A'}</Text>
        </View>
      </View>

      <Text style={styles.sectionTitle}>참여한 에어드랍</Text>
      
      {loading && !refreshing ? (
        <ActivityIndicator size="large" color="#6366F1" style={{ marginTop: 20 }} />
      ) : (
        <FlatList
          data={participatedAirdrops}
          renderItem={renderAirdropItem}
          keyExtractor={(item) => item._id}
          style={styles.list}
          contentContainerStyle={{ flexGrow: 1 }}
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <Text style={styles.emptyText}>아직 참여한 에어드랍이 없습니다.</Text>
            </View>
          }
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={['#6366F1']} />
          }
        />
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8FAFC',
    paddingTop: 60,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    marginBottom: 20,
  },
  title: {
    fontSize: 28,
    fontWeight: '800',
    color: '#1E293B',
  },
  logoutButton: {
    backgroundColor: '#FEE2E2',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 10,
  },
  logoutButtonText: {
    color: '#DC2626',
    fontSize: 14,
    fontWeight: '700',
  },
  infoCard: {
    marginHorizontal: 20,
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 20,
    marginBottom: 30,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 10,
    elevation: 3,
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  label: {
    fontSize: 16,
    color: '#64748B',
  },
  value: {
    fontSize: 16,
    color: '#1E293B',
    fontWeight: '600',
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#334155',
    paddingHorizontal: 20,
    marginBottom: 10,
  },
  list: {
    width: '100%',
    paddingHorizontal: 20,
  },
  airdropCard: {
    backgroundColor: '#FFFFFF',
    padding: 16,
    borderRadius: 12,
    marginBottom: 10,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  airdropTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: '#1E293B',
    flex: 1,
  },
  airdropDate: {
    fontSize: 12,
    color: '#94A3B8',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  emptyText: {
    fontSize: 15,
    color: '#94A3B8',
  },
});

export default UserScreen;
