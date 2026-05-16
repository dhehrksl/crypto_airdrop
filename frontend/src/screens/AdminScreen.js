import React, { useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Alert,
  RefreshControl,
  TextInput,
} from 'react-native';
import {
  adminListSubmissions,
  adminApproveSubmission,
  adminRejectSubmission,
  adminCreateAirdrop,
} from '../services/api';

const AdminScreen = ({ navigation }) => {
  const [tab, setTab] = useState('pending'); // pending | create
  const [submissions, setSubmissions] = useState([]);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  // create form
  const [c, setC] = useState({
    title: '',
    description: '',
    official_link: '',
    category: '',
    chain: '',
    end_date: '',
    trust_score: '75',
    is_confirmed: true,
  });

  const fetchPending = useCallback(async () => {
    try {
      setLoading(true);
      const r = await adminListSubmissions('pending');
      setSubmissions(r.data?.data || []);
    } catch (e) {
      console.error('list submissions:', e?.response?.data || e?.message);
      Alert.alert('오류', e?.response?.status === 403 ? '관리자 권한이 필요합니다.' : '제보 목록을 가져오지 못했습니다.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    if (tab === 'pending') fetchPending();
  }, [tab, fetchPending]);

  const handleApprove = (id) =>
    Alert.alert('승인', '이 제보를 승인하고 에어드랍 목록에 게시합니다.', [
      { text: '취소', style: 'cancel' },
      {
        text: '승인',
        onPress: async () => {
          try {
            await adminApproveSubmission(id);
            fetchPending();
          } catch (e) {
            Alert.alert('오류', '승인 처리 중 오류');
          }
        },
      },
    ]);

  const handleReject = (id) =>
    Alert.alert('거절', '이 제보를 거절합니다.', [
      { text: '취소', style: 'cancel' },
      {
        text: '거절',
        style: 'destructive',
        onPress: async () => {
          try {
            await adminRejectSubmission(id, '');
            fetchPending();
          } catch (e) {
            Alert.alert('오류', '거절 처리 중 오류');
          }
        },
      },
    ]);

  const handleCreate = async () => {
    if (!c.title.trim() || !c.description.trim() || !c.official_link.trim()) {
      Alert.alert('입력 오류', '제목/설명/링크는 필수');
      return;
    }
    try {
      await adminCreateAirdrop({
        title: c.title.trim(),
        description: c.description.trim(),
        official_link: c.official_link.trim(),
        category: c.category.trim() || undefined,
        chain: c.chain.trim() || undefined,
        end_date: c.end_date.trim() || undefined,
        trust_score: c.trust_score,
        is_confirmed: !!c.is_confirmed,
      });
      Alert.alert('완료', '에어드랍이 추가되었습니다.');
      setC({
        title: '', description: '', official_link: '', category: '', chain: '',
        end_date: '', trust_score: '75', is_confirmed: true,
      });
    } catch (e) {
      console.error('create:', e?.response?.data || e?.message);
      Alert.alert('오류', e?.response?.data?.msg || '저장 실패');
    }
  };

  const renderSubmissionItem = (s) => (
    <View key={s._id} style={styles.card}>
      <Text style={styles.cardTitle}>{s.title}</Text>
      <Text style={styles.cardMeta}>
        {s.submittedBy?.username || '익명'} · {new Date(s.createdAt).toLocaleDateString('ko-KR')}
      </Text>
      <Text style={styles.cardDesc} numberOfLines={4}>{s.description}</Text>
      {!!s.category && <Text style={styles.cardField}>카테고리: {s.category}</Text>}
      {!!s.chain && <Text style={styles.cardField}>체인: {s.chain}</Text>}
      {!!s.end_date && <Text style={styles.cardField}>마감: {new Date(s.end_date).toLocaleDateString('ko-KR')}</Text>}
      <Text style={styles.cardField}>링크: {s.official_link}</Text>
      <View style={styles.btnRow}>
        <TouchableOpacity style={[styles.btn, styles.approve]} onPress={() => handleApprove(s._id)}>
          <Text style={styles.btnText}>✓ 승인</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[styles.btn, styles.reject]} onPress={() => handleReject(s._id)}>
          <Text style={styles.btnText}>✕ 거절</Text>
        </TouchableOpacity>
      </View>
    </View>
  );

  return (
    <View style={styles.container}>
      <View style={styles.headerBar}>
        <TouchableOpacity style={styles.closeBtn} onPress={() => navigation.goBack()}>
          <Text style={styles.closeBtnText}>✕</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>관리자</Text>
        <View style={{ width: 32 }} />
      </View>

      <View style={styles.tabs}>
        <TouchableOpacity
          style={[styles.tab, tab === 'pending' && styles.tabActive]}
          onPress={() => setTab('pending')}
        >
          <Text style={[styles.tabText, tab === 'pending' && styles.tabTextActive]}>대기 중인 제보</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tab, tab === 'create' && styles.tabActive]}
          onPress={() => setTab('create')}
        >
          <Text style={[styles.tabText, tab === 'create' && styles.tabTextActive]}>직접 추가</Text>
        </TouchableOpacity>
      </View>

      {tab === 'pending' ? (
        <ScrollView
          contentContainerStyle={{ padding: 16, paddingBottom: 60 }}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => { setRefreshing(true); fetchPending(); }}
              colors={['#6366F1']}
            />
          }
        >
          {loading ? (
            <ActivityIndicator size="large" color="#6366F1" style={{ marginTop: 30 }} />
          ) : submissions.length === 0 ? (
            <Text style={styles.empty}>대기 중인 제보가 없습니다.</Text>
          ) : (
            submissions.map(renderSubmissionItem)
          )}
        </ScrollView>
      ) : (
        <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 60 }}>
          <CFormField label="제목 *" value={c.title} onChange={(v) => setC({ ...c, title: v })} />
          <CFormField
            label="설명 *"
            value={c.description}
            onChange={(v) => setC({ ...c, description: v })}
            multiline
          />
          <CFormField
            label="공식 링크 *"
            value={c.official_link}
            onChange={(v) => setC({ ...c, official_link: v })}
            autoCapitalize="none"
          />
          <CFormField label="카테고리" value={c.category} onChange={(v) => setC({ ...c, category: v })} />
          <CFormField label="체인" value={c.chain} onChange={(v) => setC({ ...c, chain: v })} />
          <CFormField
            label="마감일 (YYYY-MM-DD)"
            value={c.end_date}
            onChange={(v) => setC({ ...c, end_date: v })}
          />
          <CFormField
            label="매칭도 (0-100)"
            value={c.trust_score}
            onChange={(v) => setC({ ...c, trust_score: v.replace(/[^0-9]/g, '') })}
            keyboardType="number-pad"
          />
          <TouchableOpacity
            style={styles.checkRow}
            onPress={() => setC({ ...c, is_confirmed: !c.is_confirmed })}
          >
            <View style={[styles.checkbox, c.is_confirmed && styles.checkboxOn]}>
              {c.is_confirmed && <Text style={styles.checkmark}>✓</Text>}
            </View>
            <Text style={styles.checkLabel}>공식 확정 항목으로 표시</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.createBtn} onPress={handleCreate}>
            <Text style={styles.createBtnText}>에어드랍 추가</Text>
          </TouchableOpacity>
        </ScrollView>
      )}
    </View>
  );
};

const CFormField = ({ label, value, onChange, multiline, ...rest }) => (
  <View style={styles.field}>
    <Text style={styles.fieldLabel}>{label}</Text>
    <TextInput
      style={[styles.input, multiline && { minHeight: 90, textAlignVertical: 'top' }]}
      value={value}
      onChangeText={onChange}
      multiline={multiline}
      placeholderTextColor="#94A3B8"
      {...rest}
    />
  </View>
);

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F8FAFC' },
  headerBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: 50,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
    backgroundColor: '#FFFFFF',
  },
  closeBtn: {
    width: 32, height: 32, borderRadius: 16, backgroundColor: '#F1F5F9',
    justifyContent: 'center', alignItems: 'center',
  },
  closeBtnText: { color: '#0F172A', fontWeight: '700' },
  headerTitle: { fontSize: 17, fontWeight: '800', color: '#0F172A' },
  tabs: { flexDirection: 'row', backgroundColor: '#FFFFFF', borderBottomWidth: 1, borderBottomColor: '#E2E8F0' },
  tab: { flex: 1, paddingVertical: 14, alignItems: 'center' },
  tabActive: { borderBottomWidth: 2, borderBottomColor: '#6366F1' },
  tabText: { fontSize: 14, fontWeight: '600', color: '#64748B' },
  tabTextActive: { color: '#6366F1' },
  empty: { textAlign: 'center', color: '#94A3B8', marginTop: 60, fontSize: 14 },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  cardTitle: { fontSize: 16, fontWeight: '800', color: '#0F172A', marginBottom: 4 },
  cardMeta: { fontSize: 12, color: '#94A3B8', marginBottom: 8 },
  cardDesc: { fontSize: 14, color: '#334155', lineHeight: 20, marginBottom: 8 },
  cardField: { fontSize: 12, color: '#475569', marginTop: 2 },
  btnRow: { flexDirection: 'row', marginTop: 12, gap: 8 },
  btn: { flex: 1, height: 40, borderRadius: 10, justifyContent: 'center', alignItems: 'center' },
  approve: { backgroundColor: '#10B981' },
  reject: { backgroundColor: '#EF4444' },
  btnText: { color: '#FFFFFF', fontWeight: '800' },
  field: { marginBottom: 12 },
  fieldLabel: { fontSize: 13, fontWeight: '700', color: '#334155', marginBottom: 6 },
  input: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
    color: '#0F172A',
  },
  checkRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 16 },
  checkbox: {
    width: 22, height: 22, borderRadius: 6, borderWidth: 2, borderColor: '#94A3B8',
    marginRight: 10, justifyContent: 'center', alignItems: 'center',
  },
  checkboxOn: { backgroundColor: '#6366F1', borderColor: '#6366F1' },
  checkmark: { color: '#FFFFFF', fontWeight: '900' },
  checkLabel: { fontSize: 14, color: '#0F172A' },
  createBtn: {
    height: 52, borderRadius: 14, backgroundColor: '#6366F1',
    justifyContent: 'center', alignItems: 'center', marginTop: 8,
  },
  createBtnText: { color: '#FFFFFF', fontWeight: '800', fontSize: 16 },
});

export default AdminScreen;
