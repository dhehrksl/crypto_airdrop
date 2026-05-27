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
import useWatchlist from '../hooks/useWatchlist';
import { deleteAccount as apiDeleteAccount } from '../services/api';
import { colors, radius } from '../constants/theme';

// 마감까지 남은 시간을 사람이 읽는 문자열로. urgent = 3일 이내.
function formatCountdown(endDate) {
  if (!endDate) return null;
  const ms = new Date(endDate).getTime() - Date.now();
  if (ms <= 0) return { text: '마감됨', urgent: false, expired: true };
  const d = Math.floor(ms / 86400000);
  const h = Math.floor((ms % 86400000) / 3600000);
  return {
    text: d > 0 ? `${d}일 ${h}시간 남음` : `${h}시간 남음`,
    urgent: ms < 3 * 86400000,
    expired: false,
  };
}

const UserScreen = ({ navigation }) => {
  const { userInfo, logout } = useContext(AuthContext);
  const {
    participatedAirdrops,
    loading,
    refreshing,
    onRefresh: refreshParticipated,
  } = useMyAirdrops(!!userInfo);
  const { watchlist, onRefresh: refreshWatchlist } = useWatchlist(!!userInfo);
  const [deleting, setDeleting] = useState(false);

  const onRefresh = () => {
    refreshParticipated();
    refreshWatchlist();
  };

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

  // 참여/관심 공용 카드 — 진행률 + 마감 카운트다운 표시
  const renderTrackedCard = (item) => {
    const tasks = Array.isArray(item.tasks) ? item.tasks : [];
    const completed = item.tracking?.completedTasks?.length || 0;
    const countdown = formatCountdown(item.end_date);
    return (
      <TouchableOpacity
        key={item._id}
        style={styles.airdropCard}
        onPress={() => navigation.navigate('Detail', { airdrop: item })}
        activeOpacity={0.8}
      >
        <View style={{ flex: 1 }}>
          <Text style={styles.airdropTitle} numberOfLines={1}>
            {item.projectName || item.title}
          </Text>
          <View style={styles.metaRow}>
            {tasks.length > 0 && (
              <Text style={styles.progressBadge}>
                진행 {completed}/{tasks.length}
              </Text>
            )}
            {countdown && (
              <Text
                style={[
                  styles.countdownBadge,
                  countdown.expired
                    ? styles.countdownExpired
                    : countdown.urgent && styles.countdownUrgent,
                ]}
              >
                {countdown.expired ? '마감됨' : `⏱ ${countdown.text}`}
              </Text>
            )}
          </View>
        </View>
        <Text style={styles.chev}>›</Text>
      </TouchableOpacity>
    );
  };

  const listHeader = (
    <>
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
          <Text style={styles.linkLabel}>📤  에어드랍 제보하기</Text>
          <Text style={styles.chev}>›</Text>
        </TouchableOpacity>
        {userInfo?.isAdmin && (
          <TouchableOpacity
            style={styles.linkRow}
            onPress={() => navigation.navigate('Admin')}
          >
            <Text style={[styles.linkLabel, { color: colors.accentBright }]}>🛠  관리자 페이지</Text>
            <Text style={[styles.chev, { color: colors.accentBright }]}>›</Text>
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
          <Text style={[styles.linkLabel, { color: colors.danger }]}>
            {deleting ? '처리 중...' : '회원 탈퇴'}
          </Text>
          <Text style={[styles.chev, { color: colors.danger }]}>›</Text>
        </TouchableOpacity>
      </View>

      <Text style={styles.sectionTitle}>⭐  관심 목록</Text>
      <View style={styles.sectionBody}>
        {watchlist.length > 0 ? (
          watchlist.map((item) => renderTrackedCard(item))
        ) : (
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyText}>관심 등록한 에어드랍이 없습니다.</Text>
          </View>
        )}
      </View>

      <Text style={styles.sectionTitle}>✅  참여한 에어드랍</Text>
    </>
  );

  return (
    <View style={styles.container}>
      {loading && !refreshing ? (
        <>
          {listHeader}
          <ActivityIndicator size="large" color={colors.accent} style={{ marginTop: 20 }} />
        </>
      ) : (
        <FlatList
          data={participatedAirdrops}
          renderItem={({ item }) => renderTrackedCard(item)}
          keyExtractor={(item) => item._id}
          ListHeaderComponent={listHeader}
          contentContainerStyle={styles.listContent}
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <Text style={styles.emptyText}>아직 참여한 에어드랍이 없습니다.</Text>
            </View>
          }
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor={colors.accent}
              colors={[colors.accent]}
            />
          }
        />
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg, paddingTop: 60 },
  listContent: { paddingBottom: 32 },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    marginBottom: 20,
  },
  title: { fontSize: 27, fontWeight: '800', color: colors.textPrimary },
  logoutButton: {
    backgroundColor: colors.dangerSoft,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: radius.md,
  },
  logoutButtonText: { color: colors.danger, fontSize: 13, fontWeight: '700' },
  infoCard: {
    marginHorizontal: 20,
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: 18,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: colors.hairline,
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: colors.hairline,
  },
  label: { fontSize: 15, color: colors.textSecondary },
  value: { fontSize: 15, color: colors.textPrimary, fontWeight: '600' },
  linkGroup: {
    marginHorizontal: 20,
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    marginBottom: 24,
    borderWidth: 1,
    borderColor: colors.hairline,
  },
  linkRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 15,
    borderBottomWidth: 1,
    borderBottomColor: colors.hairline,
  },
  linkLabel: { fontSize: 15, fontWeight: '600', color: colors.textPrimary },
  chev: { fontSize: 20, color: colors.textMuted },
  sectionTitle: {
    fontSize: 19,
    fontWeight: '800',
    color: colors.textPrimary,
    paddingHorizontal: 20,
    marginBottom: 12,
  },
  sectionBody: { marginBottom: 24 },
  airdropCard: {
    backgroundColor: colors.surface,
    padding: 16,
    borderRadius: radius.md,
    marginBottom: 10,
    marginHorizontal: 20,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.hairline,
  },
  airdropTitle: { fontSize: 15, fontWeight: '700', color: colors.textPrimary, marginBottom: 7 },
  metaRow: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap' },
  progressBadge: {
    fontSize: 11.5,
    fontWeight: '800',
    color: colors.accentBright,
    backgroundColor: colors.accentSoft,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: radius.sm,
    marginRight: 6,
    overflow: 'hidden',
  },
  countdownBadge: {
    fontSize: 11.5,
    fontWeight: '700',
    color: colors.cyan,
    backgroundColor: colors.cyanSoft,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: radius.sm,
    overflow: 'hidden',
  },
  countdownUrgent: { color: colors.warning, backgroundColor: colors.warningSoft },
  countdownExpired: { color: colors.textMuted, backgroundColor: colors.surfaceAlt },
  emptyContainer: { justifyContent: 'center', alignItems: 'center', padding: 24 },
  emptyText: { fontSize: 14, color: colors.textMuted },
});

export default UserScreen;
