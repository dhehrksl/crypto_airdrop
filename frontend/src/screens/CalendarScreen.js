import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, ActivityIndicator, TouchableOpacity, FlatList } from 'react-native';
import { Calendar, DateData } from 'react-native-calendars';
import axios from 'axios';

const API_BASE_URL = 'http://172.23.249.92:3000'; // Replace with your backend IP

const CalendarScreen = () => {
  const [markedDates, setMarkedDates] = useState({});
  const [selectedDateAirdrops, setSelectedDateAirdrops] = useState([]);
  const [loading, setLoading] = useState(true);
  const [currentMonth, setCurrentMonth] = useState('');

  useEffect(() => {
    fetchAirdropsForCalendar();
  }, []);

  const fetchAirdropsForCalendar = async (month = new Date().toISOString().slice(0, 7)) => {
    setLoading(true);
    try {
      // For simplicity, fetching all airdrops. In a real app, you'd fetch by month/date range.
      const response = await axios.get(`${API_BASE_URL}/api/airdrops`); 
      const airdrops = response.data.data;

      const newMarkedDates = {};
      airdrops.forEach(airdrop => {
        if (airdrop.end_date) {
          const date = new Date(airdrop.end_date).toISOString().slice(0, 10);
          newMarkedDates[date] = { selected: true, marked: true, dotColor: 'red' };
        }
      });
      setMarkedDates(newMarkedDates);
      setLoading(false);
    } catch (error) {
      console.error('Error fetching airdrops for calendar:', error);
      setLoading(false);
    }
  };

  const onDayPress = (day) => {
    // Filter airdrops for the selected date
    // This requires having all airdrops available or fetching specifically for the day
    // For this example, we'll re-fetch all and filter in memory
    setLoading(true);
    axios.get(`${API_BASE_URL}/api/airdrops`)
      .then(response => {
        const airdrops = response.data.data;
        const filteredAirdrops = airdrops.filter(airdrop => {
          if (!airdrop.end_date) return false;
          const endDate = new Date(airdrop.end_date).toISOString().slice(0, 10);
          return endDate === day.dateString;
        });
        setSelectedDateAirdrops(filteredAirdrops);
        setLoading(false);
      })
      .catch(error => {
        console.error('Error fetching airdrops for selected day:', error);
        setLoading(false);
      });
  };

  const renderAirdropItem = ({ item }) => (
    <TouchableOpacity style={styles.airdropItem} onPress={() => {/* navigate to detail */}}>
      <Text style={styles.airdropItemTitle}>{item.title}</Text>
      <Text style={styles.airdropItemDate}>마감: {new Date(item.end_date).toLocaleDateString()}</Text>
    </TouchableOpacity>
  );

  return (
    <View style={styles.container}>
      <Text style={styles.headerTitle}>에어드랍 캘린더</Text>
      <Calendar
        onDayPress={onDayPress}
        markedDates={markedDates}
        theme={{
          selectedDayBackgroundColor: '#6366F1',
          selectedDayTextColor: '#ffffff',
          todayTextColor: '#6366F1',
          dotColor: '#6366F1',
          arrowColor: '#6366F1',
          monthTextColor: '#1E293B',
          textSectionTitleColor: '#64748B',
          textDayHeaderFontWeight: 'bold',
        }}
        onMonthChange={(month) => {
            setCurrentMonth(month.dateString); // Update current month for potential future optimizations
        }}
      />
      
      {loading ? (
        <ActivityIndicator size="large" color="#6366F1" style={{ marginTop: 20 }} />
      ) : (
        <FlatList
          data={selectedDateAirdrops}
          renderItem={renderAirdropItem}
          keyExtractor={(item) => item._id}
          ListEmptyComponent={<Text style={styles.emptyListText}>선택된 날짜에 에어드랍이 없습니다.</Text>}
          style={styles.airdropList}
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
    fontSize: 28,
    fontWeight: '800',
    color: '#1E293B',
    textAlign: 'center',
    marginBottom: 20,
  },
  airdropList: {
    marginTop: 20,
    width: '100%',
    paddingHorizontal: 20,
  },
  airdropItem: {
    backgroundColor: '#FFFFFF',
    padding: 15,
    borderRadius: 10,
    marginBottom: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 5,
    elevation: 2,
  },
  airdropItemTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1E293B',
  },
  airdropItemDate: {
    fontSize: 12,
    color: '#64748B',
    marginTop: 5,
  },
  emptyListText: {
    textAlign: 'center',
    marginTop: 20,
    color: '#64748B',
  },
});

export default CalendarScreen;
