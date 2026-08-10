import React, { useState, useEffect, ReactNode } from 'react';
import { Lockdown404View } from './Lockdown404View';

export function GlobalLockdownGuard({ children }: { children: ReactNode }) {
  const [isLocked, setIsLocked] = useState(false);

  const checkStatus = async () => {
    try {
      const res = await fetch('/api/system/status');
      if (res.ok) {
        const data = await res.json();
        setIsLocked(!!data.isLocked);
      }
    } catch (err) {
      // ignore
    }
  };

  useEffect(() => {
    checkStatus();
    const interval = setInterval(checkStatus, 2500);
    return () => clearInterval(interval);
  }, []);

  if (isLocked) {
    return <Lockdown404View onUnlock={checkStatus} />;
  }

  return <>{children}</>;
}
