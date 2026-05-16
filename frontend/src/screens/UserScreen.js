import React, { useContext, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  FlatList,
  ActivityIndicator,
  RefreshControl,
  Alert,
} from 'react-native';
import { AuthContext } from '../context/AuthContext';
import useMyAirdrops from '../hooks/useMyAirdrops';
import { deleteAccount as apiDeleteAccount } from '../services/api';

const UserScreen = ({ navigation }) => {
  const { userInfo, logout } = useContext(AuthContext);
  const { participatedAirdrops, loading, refreshing, onRefresh } = useMyAirdrops();
  const [deleting, setDeleting] = useState(false);

  const handleDeleteAccount = () => {
    Alert.alert(
      '회원 탈퇴',
      '계정과 모든 개인정보(이메일, 푸시 토큰, 참여 기록 등)가 즉시 삭제됩니다. 복구할 수 없습니다. 정말 탈퇴하시겠습니까?',
      [
        { text: '취소', style: 'cancel' },
        {
          text: '탈퇴',
          style: 'destructive',
          onPress: async () => {
            try {
              setDeleting(true);
              await apiDeleteAccount();
              Alert.alert('탈퇴 완료', '계정이 삭제되었습니다.', [
                { text: '확인', onPress: () => logout() },
              ]);
            } catch (e) {
              console.error('Delete account error:', e?.response?.data || e?.message);
              Alert.alert('오류', '탈퇴 처리 중 오류가 발생했습니다. 잠시 후 다시 시도해주세요.');
            } finally {
              setDeleting(false);
            }
          },
        },
      ]
    );
  };

  const renderAirdropItem = ({ item }) => (
    <TouchableOpacity
      style={styles.airdropCard}
      onPress={() => navigation.navigate('Detail', { airdrop: item })}
    >
      <Text style={styles.airdropTitle} numberOfLines={1}>
        {item.projectName || item.title}
      </Text>
      <Text style={styles.airdropDate}>{item.is_airdrop ? '에어드랍' : '정보'}</Text>
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

      <View style={styles.linkGroup}>
        <TouchableOpacity
          style={styles.linkRow}
          onPress={() => navigation.navigate('SubmitAirdrop')}
        >
          <Text style={styles.linkLabel}>📤 에어드랍 제보하기</Text>
          <Text style={styles.chev}>›</Text>
        </TouchableOpacity>
        {userInfo?.isAdmin && (
          <TouchableOpacity
            style={styles.linkRow}
            onPress={() => navigation.navigate('Admin')}
          >
            <Text style={[styles.linkLabel, { color: '#6366F1' }]}>🛠 관리자 페이지</Text>
            <Text style={[styles.chev, { color: '#6366F1' }]}>›</Text>
          </TouchableOpacity>
        )}
        <TouchableOpacity
          style={styles.linkRow}
          onPress={() => navigation.navigate('Policy', { kind: 'privacy' })}
        >
          <Text style={styles.linkLabel}>개인정보처리방침</Text>
          <Text style={styles.chev}>›</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.linkRow}
          onPress={() => navigation.navigate('Policy', { kind: 'terms' })}
        >
          <Text style={styles.linkLabel}>서비스 이용약관</Text>
          <Text style={styles.chev}>›</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.linkRow, { borderBottomWidth: 0 }]}
          onPress={handleDeleteAccount}
          disabled={deleting}
        >
          <Text style={[styles.linkLabel, { color: '#DC2626' }]}>
            {deleting ? '처리 중...' : '회원 탈퇴'}
          </Text>
          <Text style={[styles.chev, { color: '#DC2626' }]}>›</Text>
        </TouchableOpacity>
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
  container: { flex: 1, backgroundColor: '#F8FAFC', paddingTop: 60 },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    marginBottom: 20,
  },
  title: { fontSize: 28, fontWeight: '800', color: '#1E293B' },
  logoutButton: {
    backgroundColor: '#FEE2E2',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 10,
  },
  logoutButtonText: { color: '#DC2626', fontSize: 14, fontWeight: '700' },
  infoCard: {
    marginHorizontal: 20,
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 20,
    marginBottom: 16,
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
  label: { fontSize: 16, color: '#64748B' },
  value: { fontSize: 16, color: '#1E293B', fontWeight: '600' },
  linkGroup: {
    marginHorizontal: 20,
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    marginBottom: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 10,
    elevation: 3,
  },
  linkRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  linkLabel: { fontSize: 15, fontWeight: '600', color: '#334155' },
  chev: { fontSize: 20, color: '#94A3B8' },
  sectionTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#334155',
    paddingHorizontal: 20,
    marginBottom: 10,
  },
  list: { width: '100%', paddingHorizontal: 20 },
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
  airdropTitle: { fontSize: 15, fontWeight: '600', color: '#1E293B', flex: 1 },
  airdropDate: { fontSize: 12, color: '#94A3B8' },
  emptyContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 20 },
  emptyText: { fontSize: 15, color: '#94A3B8' },
});

export default UserScreen;
