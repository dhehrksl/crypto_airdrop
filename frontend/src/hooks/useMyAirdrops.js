import { useState, useEffect, useCallback } from 'react';
import { useFocusEffect } from '@react-navigation/native';
import { getParticipatedAirdrops as fetchParticipatedAPI } from '../services/api';

const useMyAirdrops = (enabled = true) => {
  const [participatedAirdrops, setParticipatedAirdrops] = useState([]);
  const [loading, setLoading] = useState(enabled);
  const [refreshing, setRefreshing] = useState(false);

  const fetchMyAirdrops = useCallback(async () => {
    if (!enabled) {
      setParticipatedAirdrops([]);
      setLoading(false);
      setRefreshing(false);
      return;
    }
    setLoading(true);
    try {
      const response = await fetchParticipatedAPI();
      if (response.data && Array.isArray(response.data.data)) {
        setParticipatedAirdrops(response.data.data);
      } else {
        setParticipatedAirdrops([]);
      }
    } catch (error) {
      if (error?.response?.status !== 401) {
        console.error('Error fetching participated airdrops:', error);
      }
      setParticipatedAirdrops([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [enabled]);

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
