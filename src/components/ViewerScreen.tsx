import React, { useState } from 'react';
import {
  ArrowLeft,
  ChevronDown,
  ChevronUp,
  Compass,
  Glasses,
  Trash2,
} from 'lucide-react';
import { ViewerCanvas } from '../three/ViewerCanvas';
import type { AlbumItem } from '../types/album';
import { formatRussianDate } from '../utils/albumStorage';

interface ViewerScreenProps {
  item: AlbumItem;
  onBack: () => void;
  onDelete: (id: string) => void;
}

export const ViewerScreen: React.FC<ViewerScreenProps> = ({
  item,
  onBack,
  onDelete,
}) => {
  const [gyroEnabled, setGyroEnabled] = useState(false);
  const [gyroNotice, setGyroNotice] = useState('');
  const [vrMode, setVrMode] = useState(false);
  const [sheetExpanded, setSheetExpanded] = useState(true);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const handleToggleGyro = async () => {
    setGyroNotice('');
    if (gyroEnabled) {
      setGyroEnabled(false);
      return;
    }

    // Request iOS 13+ DeviceOrientation permission inside user click gesture
    const DeviceOrientationEvt = window.DeviceOrientationEvent as unknown as {
      requestPermission?: () => Promise<'granted' | 'denied'>;
    };

    if (DeviceOrientationEvt && typeof DeviceOrientationEvt.requestPermission === 'function') {
      try {
        const res = await DeviceOrientationEvt.requestPermission();
        if (res !== 'granted') {
          setGyroNotice('Доступ к гироскопу отклонён');
          return;
        }
      } catch {
        setGyroNotice('Не удалось активировать гироскоп');
        return;
      }
    } else if (!('DeviceOrientationEvent' in window)) {
      setGyroNotice('Датчик наклона не обнаружен');
    }

    setGyroEnabled(true);
  };

  return (
    <div className="fixed inset-0 z-40 flex flex-col overflow-hidden bg-[#F3EDE4] text-[#231E1A]">
      {/* 3D Canvas takes full viewport */}
      <div className="absolute inset-0">
        <ViewerCanvas item={item} gyroEnabled={gyroEnabled} vrMode={vrMode} />
      </div>

      {/* VR Split-Screen Overlay */}
      {vrMode && (
        <div className="pointer-events-none fixed inset-0 z-20 flex">
          <div className="relative h-full w-1/2 border-r-2 border-[#231E1A]/80" />
          <div className="relative h-full w-1/2" />
          <div className="pointer-events-auto fixed top-4 left-1/2 z-30 -translate-x-1/2">
            <button
              type="button"
              onClick={() => setVrMode(false)}
              className="flex min-h-[44px] items-center gap-2 rounded-2xl bg-[#231E1A] px-4 py-2 text-sm font-semibold text-white shadow-lg"
            >
              <Glasses className="h-4 w-4 text-[#E88A66]" aria-hidden="true" />
              <span>Выйти из VR</span>
            </button>
          </div>
        </div>
      )}

      {/* Top Bar (hidden in VR mode for clean stereo view) */}
      {!vrMode && (
        <header className="relative z-10 flex items-center justify-between gap-2 px-4 pt-4">
          <button
            type="button"
            onClick={onBack}
            aria-label="Вернуться в альбом"
            className="flex min-h-[44px] items-center gap-1.5 rounded-2xl bg-white px-3.5 py-2 text-sm font-medium text-[#231E1A] shadow-sm transition-colors hover:bg-[#FAF8F5] whitespace-nowrap shrink-0"
          >
            <ArrowLeft className="h-4 w-4 shrink-0" aria-hidden="true" />
            <span>Назад</span>
          </button>

          <button
            type="button"
            onClick={handleToggleGyro}
            aria-pressed={gyroEnabled}
            className={`flex min-h-[44px] items-center gap-2 rounded-2xl px-3.5 py-2 text-sm font-medium shadow-sm transition-colors whitespace-nowrap shrink-0 ${
              gyroEnabled
                ? 'bg-[#D96B43] text-white'
                : 'bg-white text-[#231E1A] hover:bg-[#FAF8F5]'
            }`}
          >
            <Compass className="h-4 w-4 shrink-0" aria-hidden="true" />
            <span>Гироскоп</span>
          </button>
        </header>
      )}

      {!vrMode && gyroNotice && (
        <div className="relative z-10 mx-auto mt-2 rounded-xl bg-white px-3 py-1.5 text-xs font-medium text-[#6E645B] shadow-sm">
          {gyroNotice}
        </div>
      )}

      {/* Bottom Sheet (no backdrop-blur over WebGL canvas) */}
      {!vrMode && (
        <section
          aria-label="Описание вещи"
          className="relative z-10 mt-auto mx-auto w-full max-w-2xl rounded-t-3xl bg-white px-5 pt-3 pb-6 shadow-[0_-8px_30px_rgba(35,30,26,0.12)]"
        >
          <button
            type="button"
            onClick={() => setSheetExpanded((v) => !v)}
            aria-expanded={sheetExpanded}
            aria-label={sheetExpanded ? 'Свернуть панель' : 'Развернуть панель'}
            className="mx-auto flex h-8 w-24 items-center justify-center rounded-full text-[#8B7F74] hover:bg-[#FAF8F5]"
          >
            {sheetExpanded ? (
              <ChevronDown className="h-5 w-5" />
            ) : (
              <ChevronUp className="h-5 w-5" />
            )}
          </button>

          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <h1
                className="truncate text-xl font-bold text-[#231E1A]"
                style={{ fontFamily: 'var(--font-display)' }}
              >
                {item.title}
              </h1>
              <p className="mt-0.5 text-xs text-[#8B7F74] tabular-nums">
                {formatRussianDate(item.createdAt)} · Вращайте одним пальцем, масштаб двумя
              </p>
            </div>
          </div>

          {sheetExpanded && (
            <div className="mt-3 space-y-4">
              {item.note && (
                <p className="text-sm leading-relaxed text-[#574E46]">{item.note}</p>
              )}

              {!confirmDelete ? (
                <div className="flex flex-wrap items-center gap-2.5 pt-1">
                  <button
                    type="button"
                    onClick={() => setVrMode(true)}
                    className="flex min-h-[44px] flex-1 items-center justify-center gap-2 rounded-2xl bg-[#231E1A] px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-[#3A322C] whitespace-nowrap"
                  >
                    <Glasses className="h-4 w-4 text-[#E88A66] shrink-0" aria-hidden="true" />
                    <span>Режим VR / Cardboard</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setConfirmDelete(true)}
                    className="flex min-h-[44px] items-center justify-center gap-2 rounded-2xl border border-[#E6DFD5] bg-[#FAF8F5] px-4 py-2.5 text-sm font-medium text-[#B84A32] transition-colors hover:bg-[#FDF0EC] whitespace-nowrap"
                  >
                    <Trash2 className="h-4 w-4 shrink-0" aria-hidden="true" />
                    <span>Удалить</span>
                  </button>
                </div>
              ) : (
                <div
                  role="alertdialog"
                  aria-label="Подтверждение удаления"
                  className="rounded-2xl border border-[#F0CFC4] bg-[#FDF6F3] p-3.5"
                >
                  <p className="text-sm font-medium text-[#231E1A]">
                    Удалить «{item.title}» из альбома?
                  </p>
                  <div className="mt-3 flex gap-2.5">
                    <button
                      type="button"
                      onClick={() => setConfirmDelete(false)}
                      className="min-h-[44px] flex-1 rounded-xl border border-[#E6DFD5] bg-white px-3 py-2 text-sm font-medium text-[#231E1A]"
                    >
                      Отмена
                    </button>
                    <button
                      type="button"
                      onClick={() => onDelete(item.id)}
                      className="min-h-[44px] flex-1 rounded-xl bg-[#B84A32] px-3 py-2 text-sm font-semibold text-white hover:bg-[#9E3C26]"
                    >
                      Подтвердить
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}
        </section>
      )}
    </div>
  );
};
