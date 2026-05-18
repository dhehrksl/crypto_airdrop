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
  adminListDrafts,
  adminApproveDraft,
  adminRejectDraft,
  adminUpdateDraft,
  adminDeleteDraft,
  adminDraftFromUrl,
  adminTriggerDraftCollect,
} from '../services/api';

const AdminScreen = ({ navigation }) => {
  const [tab, setTab] = useState('drafts'); // drafts | pending | create
  const [submissions, setSubmissions] = useState([]);
  const [drafts, setDrafts] = useState([]);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [collectBusy, setCollectBusy] = useState(false);
  const [urlInput, setUrlInput] = useState('');
  const [urlBusy, setUrlBusy] = useState(false);

  // 직접 추가 폼
  const [c, setC] = useState({
    title: '', description: '', official_link: '', category: '', chain: '',
    end_date: '', trend_score: '75', is_confirmed: true,
  });

  const fetchPending = useCallback(async () => {
    try {
      setLoading(true);
      const r = await adminListSubmissions('pending');
      setSubmissions(r.data?.data || []);
    } catch (e) {
      Alert.alert('오류', e?.response?.status === 403 ? '관리자 권한이 필요합니다.' : '제보 목록을 가져오지 못했습니다.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  const fetchDrafts = useCallback(async () => {
    try {
      setLoading(true);
      const r = await adminListDrafts('pending');
      setDrafts(r.data?.data || []);
    } catch (e) {
      Alert.alert('오류', e?.response?.status === 403 ? '관리자 권한이 필요합니다.' : 'Draft 목록을 가져오지 못했습니다.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    if (tab === 'pending') fetchPending();
    else if (tab === 'drafts') fetchDrafts();
  }, [tab, fetchPending, fetchDrafts]);

  const handleApproveSubmission = (id) =>
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

  const handleRejectSubmission = (id) =>
    Alert.alert('거절', '이 제보를 거절합니다.', [
      { text: '취소', style: 'cancel' },
      {
        text: '거절',
        style: 'destructive',
        onPress: async () => {
          try { await adminRejectSubmission(id, ''); fetchPending(); }
          catch { Alert.alert('오류', '거절 처리 중 오류'); }
        },
      },
    ]);

  const handleApproveDraft = (id) =>
    Alert.alert('승인', 'AI 추출 결과로 에어드랍을 게시합니다. 게시 전 본문/단계가 정확한지 확인했나요?', [
      { text: '취소', style: 'cancel' },
      {
        text: '게시',
        onPress: async () => {
          try {
            await adminApproveDraft(id);
            fetchDrafts();
          } catch (e) {
            Alert.alert('오류', e?.response?.data?.msg || '승인 처리 중 오류');
          }
        },
      },
    ]);

  const handleRejectDraft = (id) =>
    Alert.alert('거절', '이 Draft를 거절합니다.', [
      { text: '취소', style: 'cancel' },
      {
        text: '거절',
        style: 'destructive',
        onPress: async () => {
          try { await adminRejectDraft(id, ''); fetchDrafts(); }
          catch { Alert.alert('오류', '거절 처리 중 오류'); }
        },
      },
    ]);

  const handleCollect = async () => {
    if (collectBusy) return;
    setCollectBusy(true);
    try {
      const r = await adminTriggerDraftCollect();
      const s = r.data;
      Alert.alert('수집 완료', `신규 ${s?.fresh ?? 0}건 · 저장 ${s?.stats?.saved ?? 0} · 스킵 ${s?.stats?.skipped ?? 0} · 에러 ${s?.stats?.errors ?? 0}`);
      fetchDrafts();
    } catch (e) {
      const status = e?.response?.status;
      const data = e?.response?.data;
      if (status === 429) {
        Alert.alert('쿨다운 중', `약 ${Math.ceil((data?.retryAfterSec || 0) / 60)}분 후 다시 시도해주세요.`);
      } else if (status === 409) {
        Alert.alert('이미 실행 중', '이전 수집이 끝나지 않았습니다.');
      } else {
        Alert.alert('오류', data?.msg || '수집 실패');
      }
    } finally {
      setCollectBusy(false);
    }
  };

  const handleFromUrl = async () => {
    const url = urlInput.trim();
    if (!url) return;
    if (urlBusy) return;
    setUrlBusy(true);
    try {
      const r = await adminDraftFromUrl(url);
      Alert.alert('추가 완료', `Draft에 추가되었습니다: ${r.data?.draft?.title || '제목 없음'}`);
      setUrlInput('');
      fetchDrafts();
    } catch (e) {
      const data = e?.response?.data;
      Alert.alert('실패', data?.msg || (data?.reason ? `사유: ${data.reason}` : 'URL 처리 실패'));
    } finally {
      setUrlBusy(false);
    }
  };

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
        trend_score: c.trend_score,
        is_confirmed: !!c.is_confirmed,
      });
      Alert.alert('완료', '에어드랍이 추가되었습니다.');
      setC({ title: '', description: '', official_link: '', category: '', chain: '', end_date: '', trend_score: '75', is_confirmed: true });
    } catch (e) {
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
        <TouchableOpacity style={[styles.btn, styles.approve]} onPress={() => handleApproveSubmission(s._id)}>
          <Text style={styles.btnText}>✓ 승인</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[styles.btn, styles.reject]} onPress={() => handleRejectSubmission(s._id)}>
          <Text style={styles.btnText}>✕ 거절</Text>
        </TouchableOpacity>
      </View>
    </View>
  );

  const renderDraftItem = (d) => (
    <View key={d._id} style={styles.card}>
      <View style={styles.draftHeader}>
        <Text style={styles.cardTitle} numberOfLines={2}>{d.title}</Text>
        <View style={[styles.scoreChip, { backgroundColor: d.trend_score >= 80 ? '#10B981' : d.trend_score >= 60 ? '#F59E0B' : '#EF4444' }]}>
          <Text style={styles.scoreChipText}>{d.trend_score}%</Text>
        </View>
      </View>
      <Text style={styles.cardMeta}>
        {d.source_name} · {new Date(d.collected_at).toLocaleDateString('ko-KR', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
      </Text>
      {d.is_scam_suspect && (
        <View style={styles.scamBanner}>
          <Text style={styles.scamBannerText}>⚠ AI가 스캠 의심으로 표시</Text>
        </View>
      )}
      <Text style={styles.cardDesc}>{d.description}</Text>

      {Array.isArray(d.tasks) && d.tasks.length > 0 && (
        <View style={styles.tasksBox}>
          <Text style={styles.tasksTitle}>참여 단계</Text>
          {d.tasks.map((t, i) => (
            <Text key={i} style={styles.taskItem}>{i + 1}. {t}</Text>
          ))}
        </View>
      )}

      {!!d.tokenTicker && <Text style={styles.cardField}>토큰: {d.tokenTicker}</Text>}
      {!!d.category && <Text style={styles.cardField}>카테고리: {d.category}</Text>}
      {Array.isArray(d.chain) && d.chain.length > 0 && <Text style={styles.cardField}>체인: {d.chain.join(', ')}</Text>}
      {!!d.end_date && <Text style={styles.cardField}>마감: {new Date(d.end_date).toLocaleDateString('ko-KR')}</Text>}
      <Text style={styles.cardField} numberOfLines={1}>공식: {d.official_link}</Text>
      {!!d.source_url && (
        <Text style={styles.cardField} numberOfLines={1}>출처: {d.source_url}</Text>
      )}

      <View style={styles.btnRow}>
        <TouchableOpacity style={[styles.btn, styles.approve]} onPress={() => handleApproveDraft(d._id)}>
          <Text style={styles.btnText}>✓ 게시</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[styles.btn, styles.reject]} onPress={() => handleRejectDraft(d._id)}>
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
        <TabButton label="Draft 큐레이션" active={tab === 'drafts'} onPress={() => setTab('drafts')} />
        <TabButton label="사용자 제보" active={tab === 'pending'} onPress={() => setTab('pending')} />
        <TabButton label="직접 추가" active={tab === 'create'} onPress={() => setTab('create')} />
      </View>

      {tab === 'drafts' ? (
        <ScrollView
          contentContainerStyle={{ padding: 16, paddingBottom: 60 }}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); fetchDrafts(); }} colors={['#6366F1']} />}
        >
          {/* 수집 트리거 + URL 붙여넣기 영역 */}
          <View style={styles.actionPanel}>
            <TouchableOpacity
              style={[styles.collectBtn, collectBusy && styles.btnDisabled]}
              onPress={handleCollect}
              disabled={collectBusy}
            >
              {collectBusy ? <ActivityIndicator color="#FFFFFF" /> : <Text style={styles.collectBtnText}>↻ 커뮤니티 자동 수집</Text>}
            </TouchableOpacity>
            <Text style={styles.actionHint}>Reddit/Telegram에서 7일치 게시글 → AI 추출 → 아래 목록에 추가</Text>

            <View style={styles.urlRow}>
              <TextInput
                style={styles.urlInput}
                placeholder="URL 붙여넣기 (커뮤니티 글, 공식 발표 등)"
                value={urlInput}
                onChangeText={setUrlInput}
                autoCapitalize="none"
                autoCorrect={false}
                placeholderTextColor="#94A3B8"
                editable={!urlBusy}
              />
              <TouchableOpacity
                style={[styles.urlBtn, (urlBusy || !urlInput.trim()) && styles.btnDisabled]}
                onPress={handleFromUrl}
                disabled={urlBusy || !urlInput.trim()}
              >
                {urlBusy ? <ActivityIndicator color="#FFFFFF" /> : <Text style={styles.urlBtnText}>추출</Text>}
              </TouchableOpacity>
            </View>
          </View>

          {loading ? (
            <ActivityIndicator size="large" color="#6366F1" style={{ marginTop: 30 }} />
          ) : drafts.length === 0 ? (
            <Text style={styles.empty}>대기 중인 Draft가 없습니다. 위 버튼으로 수집하거나 URL을 붙여넣어 추가하세요.</Text>
          ) : (
            drafts.map(renderDraftItem)
          )}
        </ScrollView>
      ) : tab === 'pending' ? (
        <ScrollView
          contentContainerStyle={{ padding: 16, paddingBottom: 60 }}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); fetchPending(); }} colors={['#6366F1']} />}
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
          <CFormField label="설명 *" value={c.description} onChange={(v) => setC({ ...c, description: v })} multiline />
          <CFormField label="공식 링크 *" value={c.official_link} onChange={(v) => setC({ ...c, official_link: v })} autoCapitalize="none" />
          <CFormField label="카테고리" value={c.category} onChange={(v) => setC({ ...c, category: v })} />
          <CFormField label="체인" value={c.chain} onChange={(v) => setC({ ...c, chain: v })} />
          <CFormField label="마감일 (YYYY-MM-DD)" value={c.end_date} onChange={(v) => setC({ ...c, end_date: v })} />
          <CFormField label="트렌드 지수 (0-100)" value={c.trend_score} onChange={(v) => setC({ ...c, trend_score: v.replace(/[^0-9]/g, '') })} keyboardType="number-pad" />
          <TouchableOpacity style={styles.checkRow} onPress={() => setC({ ...c, is_confirmed: !c.is_confirmed })}>
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

const TabButton = ({ label, active, onPress }) => (
  <TouchableOpacity style={[styles.tab, active && styles.tabActive]} onPress={onPress}>
    <Text style={[styles.tabText, active && styles.tabTextActive]}>{label}</Text>
  </TouchableOpacity>
);

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
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingTop: 50, paddingBottom: 12,
    borderBottomWidth: 1, borderBottomColor: '#E2E8F0', backgroundColor: '#FFFFFF',
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
  tabText: { fontSize: 13, fontWeight: '600', color: '#64748B' },
  tabTextActive: { color: '#6366F1' },
  empty: { textAlign: 'center', color: '#94A3B8', marginTop: 60, fontSize: 14, paddingHorizontal: 24 },

  actionPanel: {
    backgroundColor: '#FFFFFF', borderRadius: 12, padding: 14, marginBottom: 16,
    borderWidth: 1, borderColor: '#E2E8F0',
  },
  collectBtn: {
    height: 46, borderRadius: 10, backgroundColor: '#6366F1',
    justifyContent: 'center', alignItems: 'center',
  },
  collectBtnText: { color: '#FFFFFF', fontWeight: '800', fontSize: 15 },
  actionHint: { fontSize: 12, color: '#64748B', marginTop: 6, textAlign: 'center' },
  urlRow: { flexDirection: 'row', marginTop: 14, gap: 8 },
  urlInput: {
    flex: 1, backgroundColor: '#F8FAFC', borderWidth: 1, borderColor: '#E2E8F0',
    borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10, fontSize: 14, color: '#0F172A',
  },
  urlBtn: {
    width: 80, height: 44, borderRadius: 10, backgroundColor: '#10B981',
    justifyContent: 'center', alignItems: 'center',
  },
  urlBtnText: { color: '#FFFFFF', fontWeight: '800', fontSize: 14 },
  btnDisabled: { opacity: 0.5 },

  card: {
    backgroundColor: '#FFFFFF', borderRadius: 12, padding: 16, marginBottom: 12,
    borderWidth: 1, borderColor: '#E2E8F0',
  },
  draftHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 4 },
  scoreChip: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8, marginLeft: 8 },
  scoreChipText: { color: '#FFFFFF', fontSize: 12, fontWeight: '800' },
  cardTitle: { flex: 1, fontSize: 16, fontWeight: '800', color: '#0F172A' },
  cardMeta: { fontSize: 12, color: '#94A3B8', marginBottom: 8 },
  cardDesc: { fontSize: 14, color: '#334155', lineHeight: 20, marginBottom: 8 },
  cardField: { fontSize: 12, color: '#475569', marginTop: 2 },
  tasksBox: { backgroundColor: '#F8FAFC', borderRadius: 8, padding: 10, marginTop: 8, marginBottom: 8 },
  tasksTitle: { fontSize: 12, fontWeight: '800', color: '#475569', marginBottom: 6 },
  taskItem: { fontSize: 13, color: '#0F172A', lineHeight: 20, marginBottom: 2 },
  scamBanner: { backgroundColor: '#FEF2F2', borderRadius: 8, padding: 8, marginBottom: 8 },
  scamBannerText: { color: '#B91C1C', fontWeight: '800', fontSize: 12 },

  btnRow: { flexDirection: 'row', marginTop: 12, gap: 8 },
  btn: { flex: 1, height: 40, borderRadius: 10, justifyContent: 'center', alignItems: 'center' },
  approve: { backgroundColor: '#10B981' },
  reject: { backgroundColor: '#EF4444' },
  btnText: { color: '#FFFFFF', fontWeight: '800' },

  field: { marginBottom: 12 },
  fieldLabel: { fontSize: 13, fontWeight: '700', color: '#334155', marginBottom: 6 },
  input: {
    backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#E2E8F0',
    borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10, fontSize: 14, color: '#0F172A',
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
