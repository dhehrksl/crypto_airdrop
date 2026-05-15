import { useState, useEffect, useCallback } from 'react';
import { getNews as fetchNewsAPI } from '../services/api';

const useNews = () => {
  const [news, setNews] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchNews = useCallback(async () => {
    setLoading(true);
    try {
      const response = await fetchNewsAPI();
      if (response.data && Array.isArray(response.data.data)) {
        const rawData = response.data.data;
        const dataWithAds = [];
        rawData.forEach((item, index) => {
          dataWithAds.push(item);
          if ((index + 1) % 5 === 0) {
            dataWithAds.push('ad');
          }
        });
        setNews(dataWithAds);
      } else {
        console.error('Unexpected data format:', response.data);
        setNews([]);
      }
    } catch (error) {
      console.error('Error fetching news:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchNews();
  }, [fetchNews]);

  const onRefresh = () => {
    setRefreshing(true);
    fetchNews();
  };

  return { news, loading, refreshing, onRefresh };
};

export default useNews;
