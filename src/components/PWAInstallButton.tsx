import React, { useState } from 'react';
import { Download, Share, X } from 'lucide-react';
import { usePWAInstall } from '../hooks/usePWAInstall';

export const PWAInstallButton: React.FC = () => {
  const { isInstallable, isInstalled, isIOS, install } = usePWAInstall();
  const [showIOSGuide, setShowIOSGuide] = useState(false);

  if (isInstalled) {
    return null;
  }

  if (isInstallable) {
    return (
      <button
        type="button"
        onClick={install}
        className="inline-flex min-h-[44px] items-center gap-2 rounded-2xl bg-[#231E1A] px-4 py-2 text-sm font-medium text-white shadow-sm transition-colors hover:bg-[#3A322C] active:scale-[0.98] whitespace-nowrap shrink-0"
      >
        <Download className="h-4 w-4 shrink-0" aria-hidden="true" />
        <span>Установить</span>
      </button>
    );
  }

  if (isIOS) {
    return (
      <>
        <button
          type="button"
          onClick={() => setShowIOSGuide(true)}
          className="inline-flex min-h-[44px] items-center gap-2 rounded-2xl border border-[#E6DFD5] bg-white px-3.5 py-2 text-sm font-medium text-[#231E1A] shadow-xs transition-colors hover:bg-[#F5EFE7] whitespace-nowrap shrink-0"
        >
          <Share className="h-4 w-4 text-[#D96B43] shrink-0" aria-hidden="true" />
          <span>На экран Домой</span>
        </button>

        {showIOSGuide && (
          <div
            className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-[#231E1A]/45 p-4"
            role="dialog"
            aria-modal="true"
            aria-labelledby="ios-install-title"
          >
            <div className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-xl">
              <div className="flex items-start justify-between gap-4">
                <h3 id="ios-install-title" className="text-lg font-semibold text-[#231E1A]">
                  Установка на iPhone / iPad
                </h3>
                <button
                  type="button"
                  onClick={() => setShowIOSGuide(false)}
                  aria-label="Закрыть инструкцию"
                  className="flex h-11 w-11 items-center justify-center rounded-xl text-[#6E645B] hover:bg-[#FAF8F5]"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>
              <ol className="mt-3 space-y-2.5 text-sm leading-relaxed text-[#574E46]">
                <li>1. Нажмите кнопку «Поделиться» в нижней панели Safari.</li>
                <li>2. Прокрутите вниз и выберите «На экран «Домой»».</li>
              </ol>
              <button
                type="button"
                onClick={() => setShowIOSGuide(false)}
                className="mt-5 min-h-[44px] w-full rounded-2xl bg-[#D96B43] px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-[#C25832]"
              >
                Понятно
              </button>
            </div>
          </div>
        )}
      </>
    );
  }

  return null;
};
