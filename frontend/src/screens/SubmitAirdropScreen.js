import React, { useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { submitAirdrop } from '../services/api';

const SubmitAirdropScreen = ({ navigation }) => {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [link, setLink] = useState('');
  const [category, setCategory] = useState('');
  const [chain, setChain] = useState('');
  const [endDate, setEndDate] = useState(''); // YYYY-MM-DD
  const [submitting, setSubmitting] = useState(false);

  const isValidDate = (s) => {
    if (!s) return true;
    return /^\d{4}-\d{2}-\d{2}$/.test(s) && !isNaN(new Date(s).getTime());
  };

  const handleSubmit = async () => {
    if (!title.trim() || !description.trim() || !link.trim()) {
      Alert.alert('입력 오류', '제목, 설명, 공식 링크는 필수입니다.');
      return;
    }
    if (!isValidDate(endDate)) {
      Alert.alert('입력 오류', '마감일은 YYYY-MM-DD 형식이어야 합니다.');
      return;
    }
    if (!/^https?:\/\//i.test(link.trim())) {
      Alert.alert('입력 오류', '공식 링크는 http(s):// 로 시작해야 합니다.');
      return;
    }
    try {
      setSubmitting(true);
      await submitAirdrop({
        title: title.trim(),
        description: description.trim(),
        official_link: link.trim(),
        category: category.trim() || undefined,
        chain: chain.trim() || undefined,
        end_date: endDate || undefined,
      });
      Alert.alert('제출 완료', '관리자 검토 후 공개됩니다.', [
        { text: '확인', onPress: () => navigation.goBack() },
      ]);
    } catch (e) {
      console.error('submit error:', e?.response?.data || e?.message);
      Alert.alert('오류', e?.response?.data?.msg || '제출 중 오류가 발생했습니다.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.headerBar}>
        <TouchableOpacity style={styles.closeBtn} onPress={() => navigation.goBack()}>
          <Text style={styles.closeBtnText}>✕</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>에어드랍 제보</Text>
        <View style={{ width: 32 }} />
      </View>

      <ScrollView contentContainerStyle={styles.body}>
        <Text style={styles.help}>
          진행 중인 에어드랍을 제보해주세요. 관리자가 검토 후 공개합니다. 허위/스캠 제보는 거절됩니다.
        </Text>

        <Field label="프로젝트명 *" value={title} onChange={setTitle} placeholder="예: ZK Sync Era Quest" />
        <Field
          label="설명 *"
          value={description}
          onChange={setDescription}
          placeholder="참여 방법, 보상, 일정 등을 간단히..."
          multiline
        />
        <Field
          label="공식 링크 *"
          value={link}
          onChange={setLink}
          placeholder="https://..."
          keyboardType="url"
          autoCapitalize="none"
        />
        <Field label="카테고리" value={category} onChange={setCategory} placeholder="예: DeFi, Layer2, Game" />
        <Field label="체인" value={chain} onChange={setChain} placeholder="예: Ethereum, Solana" />
        <Field
          label="마감일 (선택, YYYY-MM-DD)"
          value={endDate}
          onChange={setEndDate}
          placeholder="2026-12-31"
          keyboardType="numbers-and-punctuation"
        />

        <Text style={styles.disclaimer}>
          ⚠ 제출하신 정보는 공개됩니다. 본인이 운영하는 프로젝트가 아니라면 검증된 출처(공식 트위터, 공식 사이트 등)에서 확인한 정보만 제출해주세요.
        </Text>
      </ScrollView>

      <View style={styles.bottomBar}>
        <TouchableOpacity
          style={[styles.submitBtn, submitting && { opacity: 0.5 }]}
          onPress={handleSubmit}
          disabled={submitting}
        >
          {submitting ? <ActivityIndicator color="#FFF" /> : <Text style={styles.submitText}>제보 제출</Text>}
        </TouchableOpacity>
      </View>
    </View>
  );
};

const Field = ({ label, value, onChange, multiline, ...rest }) => (
  <View style={styles.field}>
    <Text style={styles.fieldLabel}>{label}</Text>
    <TextInput
      style={[styles.input, multiline && styles.inputMulti]}
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
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#F1F5F9',
    justifyContent: 'center',
    alignItems: 'center',
  },
  closeBtnText: { color: '#0F172A', fontWeight: '700' },
  headerTitle: { fontSize: 17, fontWeight: '800', color: '#0F172A' },
  body: { padding: 20, paddingBottom: 120 },
  help: { fontSize: 13, color: '#64748B', marginBottom: 18, lineHeight: 20 },
  field: { marginBottom: 14 },
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
  inputMulti: { minHeight: 100, textAlignVertical: 'top' },
  disclaimer: {
    fontSize: 12,
    color: '#78350F',
    backgroundColor: '#FEF3C7',
    borderRadius: 10,
    padding: 12,
    lineHeight: 18,
    marginTop: 10,
  },
  bottomBar: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 30,
    backgroundColor: '#FFFFFF',
    borderTopWidth: 1,
    borderTopColor: '#E2E8F0',
  },
  submitBtn: {
    height: 52,
    borderRadius: 14,
    backgroundColor: '#6366F1',
    justifyContent: 'center',
    alignItems: 'center',
  },
  submitText: { color: '#FFFFFF', fontWeight: '800', fontSize: 16 },
});

export default SubmitAirdropScreen;
