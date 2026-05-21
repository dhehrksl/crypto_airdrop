import { useState, useEffect, useCallback } from 'react';
import {
  getAirdropTracking,
  addToWatchlist as addToWatchlistAPI,
  removeFromWatchlist as removeFromWatchlistAPI,
  setTaskProgress as setTaskProgressAPI,
} from '../services/api';

// 특정 에어드랍에 대한 내 추적 상태(관심 여부 + 단계 진행) 훅.
// enabled=false(비로그인)면 네트워크 호출 없이 기본값만 반환한다.
const useAirdropTracking = (airdropId, enabled = true) => {
  const [watchlisted, setWatchlisted] = useState(false);
  const [completedTasks, setCompletedTasks] = useState([]);
  const [totalTasks, setTotalTasks] = useState(0);
  const [loading, setLoading] = useState(enabled);

  useEffect(() => {
    let cancelled = false;
    if (!enabled || !airdropId) {
      setLoading(false);
      return;
    }
    (async () => {
      setLoading(true);
      try {
        const res = await getAirdropTracking(airdropId);
        if (!cancelled && res.data) {
          setWatchlisted(!!res.data.watchlisted);
          setCompletedTasks(Array.isArray(res.data.completedTasks) ? res.data.completedTasks : []);
          setTotalTasks(res.data.totalTasks || 0);
        }
      } catch (error) {
        console.error('Error fetching airdrop tracking:', error);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [airdropId, enabled]);

  // 관심 등록/해제 — 낙관적 갱신 후 실패 시 롤백.
  const toggleWatchlist = useCallback(async () => {
    if (!enabled || !airdropId) return;
    const next = !watchlisted;
    setWatchlisted(next);
    try {
      if (next) await addToWatchlistAPI(airdropId);
      else await removeFromWatchlistAPI(airdropId);
    } catch (error) {
      console.error('Error toggling watchlist:', error);
      setWatchlisted(!next);
    }
  }, [airdropId, enabled, watchlisted]);

  // 단계 체크/해제 — 낙관적 갱신 후 서버 응답으로 동기화, 실패 시 롤백.
  const toggleTask = useCallback(
    async (index) => {
      if (!enabled || !airdropId) return;
      const completed = !completedTasks.includes(index);
      const prev = completedTasks;
      const next = completed
        ? [...completedTasks, index].sort((a, b) => a - b)
        : completedTasks.filter((i) => i !== index);
      setCompletedTasks(next);
      try {
        const res = await setTaskProgressAPI(airdropId, index, completed);
        if (res.data && Array.isArray(res.data.completedTasks)) {
          setCompletedTasks(res.data.completedTasks);
          if (typeof res.data.totalTasks === 'number') setTotalTasks(res.data.totalTasks);
        }
      } catch (error) {
        console.error('Error toggling task progress:', error);
        setCompletedTasks(prev);
      }
    },
    [airdropId, enabled, completedTasks]
  );

  return { watchlisted, completedTasks, totalTasks, loading, toggleWatchlist, toggleTask };
};

export default useAirdropTracking;
