import React, { useEffect, useState } from 'react';
import { WifiOff } from 'lucide-react';

export const OfflineIndicator: React.FC = () => {
  const [isOnline, setIsOnline] = useState(
    typeof navigator !== 'undefined' ? navigator.onLine : true,
  );

  useEffect(() => {
    const onOnline = () => setIsOnline(true);
    const onOffline = () => setIsOnline(false);

    window.addEventListener('online', onOnline);
    window.addEventListener('offline', onOffline);

    return () => {
      window.removeEventListener('online', onOnline);
      window.removeEventListener('offline', onOffline);
    };
  }, []);

  if (isOnline) return null;

  return (
    <div
      role="status"
      className="fixed bottom-4 left-4 z-40 flex items-center gap-2 rounded-2xl bg-[#231E1A] px-3.5 py-2 text-xs font-medium text-white shadow-lg"
    >
      <WifiOff className="h-3.5 w-3.5 text-[#E88A66]" aria-hidden="true" />
      <span>Офлайн-режим — коллекция доступна локально</span>
    </div>
  );
};
