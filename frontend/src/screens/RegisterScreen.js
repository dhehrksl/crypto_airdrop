import React, { useState, useContext } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, Alert, ActivityIndicator, ScrollView } from 'react-native';
import { AuthContext } from '../context/AuthContext';

const RegisterScreen = ({ navigation }) => {
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [agreeTerms, setAgreeTerms] = useState(false);
  const [agreePrivacy, setAgreePrivacy] = useState(false);
  const [agreeAge, setAgreeAge] = useState(false);
  const { register } = useContext(AuthContext);

  // 백엔드 검증과 동일 규칙을 클라이언트에서 먼저 — 한글 사용자명 등 거절 사유를 즉시 안내
  const validateInputs = () => {
    const u = username.trim();
    const e = email.trim();
    if (!u || !e || !password) return '모든 필드를 입력해주세요.';
    if (u.length < 3 || u.length > 20) return '사용자명은 3~20자여야 합니다.';
    if (!/^[a-zA-Z0-9_-]+$/.test(u)) return '사용자명은 영문/숫자/언더스코어(_)/하이픈(-)만 사용 가능합니다.';
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(e)) return '이메일 형식이 올바르지 않습니다.';
    if (password.length < 8) return '비밀번호는 최소 8자여야 합니다.';
    if (!/[a-zA-Z]/.test(password) || !/\d/.test(password)) return '비밀번호는 영문과 숫자를 모두 포함해야 합니다.';
    return null;
  };

  const handleRegister = async () => {
    if (!agreeTerms || !agreePrivacy || !agreeAge) {
      Alert.alert('동의 필요', '서비스 이용약관·개인정보처리방침에 동의하고 만 14세 이상임을 확인해주세요.');
      return;
    }
    const validationError = validateInputs();
    if (validationError) {
      Alert.alert('입력 오류', validationError);
      return;
    }
    setIsLoading(true);
    try {
      await register(username.trim(), email.trim(), password);
    } catch (error) {
      // 네트워크 실패(서버 미기동/IP 불일치) vs 서버 거절(4xx)을 구분해 안내
      let errorMessage;
      if (error.response?.data?.msg) {
        errorMessage = error.response.data.msg;
      } else if (error.code === 'ECONNABORTED') {
        errorMessage = '서버 응답 시간이 초과되었습니다. 백엔드가 실행 중인지 확인해주세요.';
      } else if (error.message === 'Network Error') {
        errorMessage = '서버에 연결할 수 없습니다. 백엔드 주소(app.json의 expo.extra.backendUrl)와 같은 네트워크 여부를 확인해주세요.';
      } else {
        errorMessage = '회원가입에 실패했습니다. 다시 시도해주세요.';
      }
      Alert.alert('회원가입 실패', errorMessage);
    } finally {
      setIsLoading(false);
    }
  };

  const renderConsentRow = (checked, setChecked, label, linkTarget) => (
    <View style={styles.consentRow}>
      <TouchableOpacity
        style={[styles.checkbox, checked && styles.checkboxOn]}
        onPress={() => setChecked(!checked)}
        disabled={isLoading}
      >
        {checked && <Text style={styles.checkmark}>✓</Text>}
      </TouchableOpacity>
      <Text style={styles.consentLabel}>{label}</Text>
      {linkTarget && (
        <TouchableOpacity
          onPress={() => navigation.navigate('Policy', { kind: linkTarget })}
          disabled={isLoading}
        >
          <Text style={styles.consentLink}>보기</Text>
        </TouchableOpacity>
      )}
    </View>
  );

  return (
    <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
      <Text style={styles.title}>Create Account</Text>
      <Text style={styles.subtitle}>Start your airdrop journey</Text>

      <TextInput
        style={styles.input}
        placeholder="사용자명 (영문/숫자/_/-, 3~20자)"
        value={username}
        onChangeText={setUsername}
        autoCapitalize="none"
        autoCorrect={false}
      />
      <TextInput
        style={styles.input}
        placeholder="이메일"
        value={email}
        onChangeText={setEmail}
        keyboardType="email-address"
        autoCapitalize="none"
        autoCorrect={false}
      />
      <TextInput
        style={styles.input}
        placeholder="비밀번호 (영문+숫자 포함, 8자 이상)"
        value={password}
        onChangeText={setPassword}
        secureTextEntry
        autoCapitalize="none"
      />

      <View style={styles.consentBlock}>
        {renderConsentRow(agreeTerms, setAgreeTerms, '서비스 이용약관 동의 (필수)', 'terms')}
        {renderConsentRow(agreePrivacy, setAgreePrivacy, '개인정보처리방침 동의 (필수)', 'privacy')}
        {renderConsentRow(agreeAge, setAgreeAge, '만 14세 이상입니다 (필수)', null)}
      </View>

      <TouchableOpacity style={styles.button} onPress={handleRegister} disabled={isLoading}>
        {isLoading ? (
          <ActivityIndicator color="#FFFFFF" />
        ) : (
          <Text style={styles.buttonText}>Sign Up</Text>
        )}
      </TouchableOpacity>

      <View style={styles.footer}>
        <Text style={styles.footerText}>Already have an account?</Text>
        <TouchableOpacity onPress={() => navigation.navigate('Login')} disabled={isLoading}>
          <Text style={styles.link}>Log In</Text>
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flexGrow: 1,
    justifyContent: 'center',
    paddingHorizontal: 30,
    paddingVertical: 40,
    backgroundColor: '#F8FAFC',
  },
  consentBlock: {
    marginTop: 8,
    marginBottom: 16,
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  consentRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 8 },
  checkbox: {
    width: 22, height: 22, borderRadius: 6, borderWidth: 2, borderColor: '#94A3B8',
    justifyContent: 'center', alignItems: 'center', marginRight: 10,
  },
  checkboxOn: { backgroundColor: '#6366F1', borderColor: '#6366F1' },
  checkmark: { color: '#FFFFFF', fontWeight: '900' },
  consentLabel: { flex: 1, fontSize: 13, color: '#0F172A' },
  consentLink: { fontSize: 13, color: '#6366F1', fontWeight: '700', textDecorationLine: 'underline' },
  title: {
    fontSize: 32,
    fontWeight: '800',
    color: '#1E293B',
    textAlign: 'center',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    color: '#64748B',
    textAlign: 'center',
    marginBottom: 40,
  },
  input: {
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 20,
    height: 50,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    fontSize: 16,
    marginBottom: 16,
  },
  button: {
    backgroundColor: '#6366F1',
    height: 50,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 10,
  },
  buttonText: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '700',
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginTop: 20,
  },
  footerText: {
    fontSize: 14,
    color: '#64748B',
  },
  link: {
    fontSize: 14,
    color: '#6366F1',
    fontWeight: '700',
    marginLeft: 5,
  },
});

export default RegisterScreen;
