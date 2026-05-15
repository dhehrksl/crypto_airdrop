import { useState, useEffect, useCallback } from 'react';
import { useFocusEffect } from '@react-navigation/native';
import { getParticipatedAirdrops as fetchParticipatedAPI } from '../services/api';

const useMyAirdrops = () => {
  const [participatedAirdrops, setParticipatedAirdrops] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchMyAirdrops = useCallback(async () => {
    setLoading(true);
    try {
      const response = await fetchParticipatedAPI();
      if (response.data && Array.isArray(response.data.data)) {
        setParticipatedAirdrops(response.data.data);
      } else {
        console.error('Unexpected data format:', response.data);
        setParticipatedAirdrops([]);
      }
    } catch (error) {
      console.error('Error fetching participated airdrops:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  // useFocusEffect to refetch data every time the screen comes into focus
  useFocusEffect(
    useCallback(() => {
      fetchMyAirdrops();
    }, [fetchMyAirdrops])
  );

  const onRefresh = () => {
    setRefreshing(true);
    fetchMyAirdrops();
  };

  return { participatedAirdrops, loading, refreshing, onRefresh };
};

export default useMyAirdrops;
