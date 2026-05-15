import { useState, useEffect, useCallback } from 'react';
import { getGuaranteedAirdrops as fetchGuaranteedAirdropsAPI } from '../services/api';

const useGuaranteedAirdrops = () => {
  const [guaranteedAirdrops, setGuaranteedAirdrops] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchGuaranteedAirdrops = useCallback(async () => {
    setLoading(true);
    try {
      const response = await fetchGuaranteedAirdropsAPI();
      if (response.data && Array.isArray(response.data.data)) {
        setGuaranteedAirdrops(response.data.data);
      } else {
        console.error('Unexpected data format:', response.data);
        setGuaranteedAirdrops([]);
      }
    } catch (error) {
      console.error('Error fetching guaranteed airdrops:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchGuaranteedAirdrops();
  }, [fetchGuaranteedAirdrops]);

  const onRefresh = () => {
    setRefreshing(true);
    fetchGuaranteedAirdrops();
  };

  return { guaranteedAirdrops, loading, refreshing, onRefresh };
};

export default useGuaranteedAirdrops;
