import { useState, useEffect, useCallback } from 'react';
import { getAirdrops as fetchAirdropsAPI } from '../services/api';

const useAirdrops = (sortType) => {
  const [airdrops, setAirdrops] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchAirdrops = useCallback(async () => {
    setLoading(true);
    try {
      const response = await fetchAirdropsAPI(sortType);
      if (response.data && Array.isArray(response.data.data)) {
        const rawData = response.data.data;
        const dataWithAds = [];
        rawData.forEach((item, index) => {
          dataWithAds.push(item);
          if ((index + 1) % 5 === 0) {
            dataWithAds.push('ad');
          }
        });
        setAirdrops(dataWithAds);
      } else {
        console.error('Unexpected data format:', response.data);
        setAirdrops([]);
      }
    } catch (error) {
      console.error('Error fetching airdrops:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [sortType]);

  useEffect(() => {
    fetchAirdrops();
  }, [fetchAirdrops]);

  const onRefresh = () => {
    setRefreshing(true);
    fetchAirdrops();
  };

  return { airdrops, loading, refreshing, onRefresh };
};

export default useAirdrops;
