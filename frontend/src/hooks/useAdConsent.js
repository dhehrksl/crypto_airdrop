// 광고 컴포넌트가 동의 게이트를 따르도록 하는 hook.
// requestConsent가 resolve되기 전엔 resolved=false → 컴포넌트는 광고 미표시.
// resolve 후 canRequestAds=false면 (사용자 거부) 광고 미표시.
//
// 단순 polling이 아니라 admobConfig의 listener로 push 받음 → 불필요한 리렌더 없음.

import { useEffect, useState } from 'react';
import {
  isConsentResolved,
  canRequestAds,
  onConsentChange,
} from '../services/admobConfig';

export default function useAdConsent() {
  const [resolved, setResolved] = useState(isConsentResolved());
  const [allowed, setAllowed] = useState(canRequestAds());

  useEffect(() => {
    const unsub = onConsentChange((snap) => {
      setResolved(snap.resolved);
      setAllowed(snap.canRequestAds);
    });
    return unsub;
  }, []);

  return { resolved, allowed };
}
