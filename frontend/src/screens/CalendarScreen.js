import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ActivityIndicator,
  TouchableOpacity,
  FlatList,
  RefreshControl,
} from 'react-native';
import { Calendar } from 'react-native-calendars';
import { getAirdrops } from '../services/api';

const PRIMARY = '#6366F1';
const DOT_DEFAULT = '#6366F1';
const DOT_CONFIRMED = '#10B981';
const DOT_CLOSING = '#EF4444';

const toDateKey = (date) => {
  const d = new Date(date);
  // 로컬 타임존 기준으로 YYYY-MM-DD
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
};

const CalendarScreen = ({ navigation }) => {
  const [allAirdrops, setAllAirdrops] = useState([]);
  const [markedDates, setMarkedDates] = useState({});
  const [selectedDate, setSelectedDate] = useState(toDateKey(new Date()));
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const buildMarkedDates = useCallback((airdrops, selected) => {
    const today = new Date();
    const soon = new Date(Date.now() + 3 * 24 * 60 * 60 * 1000);
    const map = {};

    airdrops.forEach((a) => {
      if (!a.end_date) return;
      const dateKey = toDateKey(a.end_date);
      const endDateObj = new Date(a.end_date);

      let dotColor = DOT_DEFAULT;
      if (a.is_confirmed) dotColor = DOT_CONFIRMED;
      if (endDateObj <= soon && endDateObj >= today) dotColor = DOT_CLOSING;

      if (!map[dateKey]) {
        map[dateKey] = { marked: true, dotColor };
      }
    });

    if (selected) {
      map[selected] = {
        ...(map[selected] || {}),
        selected: true,
        selectedColor: PRIMARY,
      };
    }
    return map;
  }, []);

  const fetchAirdropsForCalendar = useCallback(
    async (isRefresh = false) => {
      if (isRefresh) setRefreshing(true);
      else setLoading(true);
      try {
        // 캘린더는 마감일 있는 진행 중 에어드랍을 충분히 받기 위해 limit=200
        const response = await getAirdrops('latest');
        const list = Array.isArray(response.data?.data) ? response.data.data : [];
        const withEnd = list.filter((a) => !!a.end_date);
        setAllAirdrops(withEnd);
        setMarkedDates(buildMarkedDates(withEnd, selectedDate));
      } catch (error) {
        console.error('Error fetching airdrops for calendar:', error.message);
        setAllAirdrops([]);
        setMarkedDates({});
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [buildMarkedDates, selectedDate]
  );

  useEffect(() => {
    fetchAirdropsForCalendar(false);
  }, [fetchAirdropsForCalendar]);

  const onDayPress = (day) => {
    setSelectedDate(day.dateString);
    setMarkedDates(buildMarkedDates(allAirdrops, day.dateString));
  };

  const selectedDateAirdrops = allAirdrops.filter(
    (a) => toDateKey(a.end_date) === selectedDate
  );

  const renderAirdropItem = ({ item }) => {
    const endDateText = new Date(item.end_date).toLocaleDateString('ko-KR', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
    return (
      <TouchableOpacity
        style={styles.airdropItem}
        onPress={() => navigation.navigate('Detail', { airdrop: item })}
        activeOpacity={0.7}
      >
        <View style={styles.itemHeader}>
          <Text style={styles.airdropItemTitle} numberOfLines={1}>
            {item.title}
          </Text>
          {item.is_confirmed && (
            <View style={styles.confirmedBadge}>
              <Text style={styles.confirmedBadgeText}>✔ 공식</Text>
            </View>
          )}
        </View>
        <Text style={styles.airdropItemDate}>마감: {endDateText}</Text>
        {!!item.category && (
          <Text style={styles.airdropItemMeta}>카테고리: {item.category}</Text>
        )}
      </TouchableOpacity>
    );
  };

  const selectedHeader = (() => {
    const d = new Date(`${selectedDate}T00:00:00`);
    if (isNaN(d.getTime())) return selectedDate;
    return d.toLocaleDateString('ko-KR', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      weekday: 'short',
    });
  })();

  return (
    <View style={styles.container}>
      <Text style={styles.headerTitle}>에어드랍 캘린더</Text>

      <Calendar
        onDayPress={onDayPress}
        markedDates={markedDates}
        theme={{
          selectedDayBackgroundColor: PRIMARY,
          selectedDayTextColor: '#ffffff',
          todayTextColor: PRIMARY,
          dotColor: PRIMARY,
          arrowColor: PRIMARY,
          monthTextColor: '#1E293B',
          textSectionTitleColor: '#64748B',
          textDayHeaderFontWeight: 'bold',
        }}
      />

      <View style={styles.legendRow}>
        <View style={styles.legendItem}>
          <View style={[styles.legendDot, { backgroundColor: DOT_CLOSING }]} />
          <Text style={styles.legendText}>3일 내 마감</Text>
        </View>
        <View style={styles.legendItem}>
          <View style={[styles.legendDot, { backgroundColor: DOT_CONFIRMED }]} />
          <Text style={styles.legendText}>공식 확정</Text>
        </View>
        <View style={styles.legendItem}>
          <View style={[styles.legendDot, { backgroundColor: DOT_DEFAULT }]} />
          <Text style={styles.legendText}>기타</Text>
        </View>
      </View>

      <Text style={styles.selectedHeader}>{selectedHeader}</Text>

      {loading ? (
        <ActivityIndicator size="large" color={PRIMARY} style={{ marginTop: 20 }} />
      ) : (
        <FlatList
          data={selectedDateAirdrops}
          renderItem={renderAirdropItem}
          keyExtractor={(item) => item._id}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => fetchAirdropsForCalendar(true)}
              colors={[PRIMARY]}
            />
          }
          ListEmptyComponent={
            <Text style={styles.emptyListText}>이 날짜에 마감되는 에어드랍이 없습니다.</Text>
          }
          style={styles.airdropList}
          contentContainerStyle={{ paddingBottom: 80 }}
        />
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8FAFC',
    paddingTop: 50,
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: '800',
    color: '#1E293B',
    paddingHorizontal: 20,
    marginBottom: 12,
  },
  legendRow: {
    flexDirection: 'row',
    paddingHorizontal: 20,
    paddingVertical: 12,
    gap: 16,
  },
  legendItem: { flexDirection: 'row', alignItems: 'center' },
  legendDot: { width: 8, height: 8, borderRadius: 4, marginRight: 6 },
  legendText: { fontSize: 12, color: '#64748B', fontWeight: '600' },
  selectedHeader: {
    fontSize: 14,
    fontWeight: '700',
    color: '#334155',
    paddingHorizontal: 20,
    marginTop: 8,
    marginBottom: 8,
  },
  airdropList: {
    flex: 1,
    width: '100%',
    paddingHorizontal: 16,
  },
  airdropItem: {
    backgroundColor: '#FFFFFF',
    padding: 16,
    borderRadius: 12,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#F1F5F9',
  },
  itemHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  airdropItemTitle: {
    flex: 1,
    fontSize: 16,
    fontWeight: '700',
    color: '#1E293B',
  },
  airdropItemDate: { fontSize: 12, color: '#64748B', marginTop: 4 },
  airdropItemMeta: { fontSize: 11, color: '#94A3B8', marginTop: 2 },
  confirmedBadge: {
    backgroundColor: '#DCFCE7',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
    marginLeft: 8,
  },
  confirmedBadgeText: { color: '#166534', fontSize: 10, fontWeight: '800' },
  emptyListText: {
    textAlign: 'center',
    marginTop: 30,
    color: '#94A3B8',
    fontSize: 13,
  },
});

export default CalendarScreen;
