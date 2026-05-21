import React from 'react';
import { View, Text, ScrollView, StyleSheet, TouchableOpacity } from 'react-native';
import { PRIVACY_POLICY_KO, TERMS_OF_SERVICE_KO } from '../constants/policies';
import { colors, radius } from '../constants/theme';

const PolicyScreen = ({ route, navigation }) => {
  const kind = route.params?.kind === 'terms' ? 'terms' : 'privacy';
  const title = kind === 'terms' ? '서비스 이용약관' : '개인정보처리방침';
  const body = kind === 'terms' ? TERMS_OF_SERVICE_KO : PRIVACY_POLICY_KO;

  return (
    <View style={styles.container}>
      <View style={styles.headerBar}>
        <TouchableOpacity style={styles.closeButton} onPress={() => navigation.goBack()}>
          <Text style={styles.closeButtonText}>✕</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{title}</Text>
        <View style={{ width: 32 }} />
      </View>
      <ScrollView contentContainerStyle={styles.body}>
        <Text style={styles.text}>{body}</Text>
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  headerBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: 50,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: colors.hairline,
  },
  closeButton: {
    width: 32,
    height: 32,
    borderRadius: radius.lg,
    backgroundColor: colors.surfaceAlt,
    justifyContent: 'center',
    alignItems: 'center',
  },
  closeButtonText: { fontSize: 16, fontWeight: '700', color: colors.textSecondary },
  headerTitle: { fontSize: 17, fontWeight: '800', color: colors.textPrimary },
  body: { paddingHorizontal: 20, paddingVertical: 20, paddingBottom: 60 },
  text: { fontSize: 14, lineHeight: 22, color: colors.textSecondary },
});

export default PolicyScreen;
