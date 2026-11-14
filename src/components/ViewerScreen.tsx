import React, { useCallback, useState } from 'react';
import {
  ArrowLeft,
  ChevronDown,
  ChevronUp,
  Layers,
  MoveHorizontal,
  Trash2,
} from 'lucide-react';
import type { AlbumItem, CameraPreset } from '../types/album';
import { formatRussianDate } from '../utils/albumStorage';
import { ShowcaseStage } from './ShowcaseStage';

const ORBIT_PRESETS: Array<{ id: Exclude<CameraPreset, 'top'>; label: string }> = [
  { id: 'front', label: 'Спереди' },
  { id: 'right', label: 'Справа' },
  { id: 'back', label: 'Сзади' },
  { id: 'left', label: 'Слева' },
];

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
  const [sheetExpanded, setSheetExpanded] = useState(true);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [requestedPreset, setRequestedPreset] = useState<CameraPreset>('front');
  const [presetVersion, setPresetVersion] = useState(0);
  const [activePreset, setActivePreset] = useState<CameraPreset | null>('front');
  const [topActive, setTopActive] = useState(false);

  const handleSelectPreset = (preset: CameraPreset) => {
    setRequestedPreset(preset);
    setPresetVersion((v) => v + 1);
  };

  const handleActiveStateChange = useCallback(
    (state: {
      topActive: boolean;
      activeDeg: number;
      activePreset: CameraPreset | null;
    }) => {
      setTopActive(state.topActive);
      setActivePreset(state.activePreset);
    },
    [],
  );

  return (
    <div className="fixed inset-0 z-40 flex flex-col overflow-hidden bg-[#F3EDE4] text-[#231E1A]">
      {/* Top Bar */}
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

        <div className="flex items-center gap-1.5 text-xs font-medium text-[#5E544C] whitespace-nowrap shrink-0">
          <MoveHorizontal className="h-3.5 w-3.5 text-[#D96B43]" aria-hidden="true" />
          <span>Свайп для вращения</span>
        </div>
      </header>

      {/* Main 2.5D Showcase Stage */}
      <div className="relative flex min-h-0 flex-1 items-center justify-center px-4 pb-1">
        <ShowcaseStage
          item={item}
          requestedPreset={requestedPreset}
          presetVersion={presetVersion}
          onActiveStateChange={handleActiveStateChange}
        />
      </div>

      {/* Bottom dock: [Спереди][Справа][Сзади][Слева] + separate [Сверху] button + collapsible info sheet */}
      <div className="relative z-10 mt-auto flex flex-col items-center">
        <div className="mb-2.5 flex max-w-[96vw] items-center gap-2">
          <nav
            aria-label="Круговые ракурсы"
            className="flex items-center gap-1 rounded-2xl bg-white p-1 shadow-sm"
          >
            {ORBIT_PRESETS.map((preset) => {
              const active = !topActive && activePreset === preset.id;
              return (
                <button
                  key={preset.id}
                  type="button"
                  onClick={() => handleSelectPreset(preset.id)}
                  data-testid={`preset-btn-${preset.id}`}
                  aria-pressed={active}
                  className={`min-h-[40px] rounded-xl px-2.5 py-1.5 text-xs font-medium transition-colors whitespace-nowrap shrink-0 sm:px-3.5 ${
                    active
                      ? 'bg-[#D96B43] text-white'
                      : 'text-[#5E544C] hover:bg-[#FAF8F5] hover:text-[#231E1A]'
                  }`}
                >
                  {preset.label}
                </button>
              );
            })}
          </nav>

          <button
            type="button"
            onClick={() => handleSelectPreset('top')}
            data-testid="preset-btn-top"
            aria-pressed={topActive}
            className={`flex min-h-[48px] items-center gap-1.5 rounded-2xl px-3.5 py-2 text-xs font-semibold shadow-sm transition-colors whitespace-nowrap shrink-0 ${
              topActive
                ? 'bg-[#231E1A] text-white'
                : 'bg-white text-[#231E1A] hover:bg-[#FAF8F5]'
            }`}
          >
            <Layers className={`h-3.5 w-3.5 shrink-0 ${topActive ? 'text-[#E88A66]' : 'text-[#D96B43]'}`} aria-hidden="true" />
            <span>Сверху</span>
          </button>
        </div>

        <section
          aria-label="Описание вещи"
          className="w-full max-w-2xl rounded-t-3xl bg-white px-5 pt-2.5 pb-6 shadow-[0_-8px_30px_rgba(35,30,26,0.12)]"
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
                {formatRussianDate(item.createdAt)} · {item.views.length} ракурсов · 2.5D-витрина
              </p>
            </div>
          </div>

          {sheetExpanded && (
            <div className="mt-3 space-y-4">
              {item.note && (
                <p className="text-sm leading-relaxed text-[#574E46]">{item.note}</p>
              )}

              {!confirmDelete ? (
                <div className="flex items-center justify-end pt-1">
                  <button
                    type="button"
                    onClick={() => setConfirmDelete(true)}
                    className="flex min-h-[44px] w-full items-center justify-center gap-2 rounded-2xl border border-[#E6DFD5] bg-[#FAF8F5] px-4 py-2.5 text-sm font-medium text-[#B84A32] transition-colors hover:bg-[#FDF0EC] whitespace-nowrap sm:w-auto"
                  >
                    <Trash2 className="h-4 w-4 shrink-0" aria-hidden="true" />
                    <span>Удалить из альбома</span>
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
      </div>
    </div>
  );
};
