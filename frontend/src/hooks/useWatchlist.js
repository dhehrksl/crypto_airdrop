import { useState, useCallback } from 'react';
import { useFocusEffect } from '@react-navigation/native';
import { getWatchlist as fetchWatchlistAPI } from '../services/api';

// 내 관심 목록(워치리스트) 조회 훅. 화면 포커스마다 갱신.
const useWatchlist = (enabled = true) => {
  const [watchlist, setWatchlist] = useState([]);
  const [loading, setLoading] = useState(enabled);
  const [refreshing, setRefreshing] = useState(false);

  const fetchWatchlist = useCallback(async () => {
    if (!enabled) {
      setWatchlist([]);
      setLoading(false);
      setRefreshing(false);
      return;
    }
    setLoading(true);
    try {
      const response = await fetchWatchlistAPI();
      if (response.data && Array.isArray(response.data.data)) {
        setWatchlist(response.data.data);
      } else {
        setWatchlist([]);
      }
    } catch (error) {
      if (error?.response?.status !== 401) {
        console.error('Error fetching watchlist:', error);
      }
      setWatchlist([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [enabled]);

  useFocusEffect(
    useCallback(() => {
      fetchWatchlist();
    }, [fetchWatchlist])
  );

  const onRefresh = () => {
    setRefreshing(true);
    fetchWatchlist();
  };

  return { watchlist, loading, refreshing, onRefresh };
};

export default useWatchlist;
