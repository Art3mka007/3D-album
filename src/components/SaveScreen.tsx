import React, { useEffect, useState } from 'react';
import { ArrowLeft, Check, Eraser } from 'lucide-react';
import {
  PODIUM_THEMES,
  getPodiumTheme,
  type CapturedDraft,
  type CapturedViewFrame,
} from '../types/album';
import { removeBackgroundToTransparentPng } from '../utils/backgroundRemoval';

interface SaveScreenProps {
  draft: CapturedDraft;
  onBack: () => void;
  onSave: (data: {
    title: string;
    note: string;
    views: CapturedViewFrame[];
    coverUrl: string;
    accentHex: string;
  }) => void;
}

export const SaveScreen: React.FC<SaveScreenProps> = ({
  draft,
  onBack,
  onSave,
}) => {
  const [title, setTitle] = useState('');
  const [note, setNote] = useState('');
  const [accentHex, setAccentHex] = useState(draft.accentHex ?? PODIUM_THEMES[0].hex);
  const [formError, setFormError] = useState('');

  const [cutoutFrames, setCutoutFrames] = useState<CapturedViewFrame[]>(draft.frames);
  const [isRemovingBg, setIsRemovingBg] = useState(draft.source === 'camera');
  const [bgRemovedCount, setBgRemovedCount] = useState(0);
  const [sensitivity, setSensitivity] = useState(28);
  const [keepOriginalBg, setKeepOriginalBg] = useState(false);

  // Automatic in-browser background removal to transparent alpha PNGs for all 9 frames
  useEffect(() => {
    let cancelled = false;

    if (keepOriginalBg) {
      setCutoutFrames(draft.frames);
      setIsRemovingBg(false);
      return;
    }

    async function processBackgroundRemoval() {
      setIsRemovingBg(true);
      setBgRemovedCount(0);

      const processed: CapturedViewFrame[] = [];
      for (let i = 0; i < draft.frames.length; i++) {
        const frame = draft.frames[i];
        const transparentUrl = await removeBackgroundToTransparentPng(
          frame.dataUrl,
          sensitivity,
        );
        if (cancelled) return;
        processed.push({
          ...frame,
          dataUrl: transparentUrl,
        });
        setBgRemovedCount(i + 1);
      }

      if (!cancelled) {
        setCutoutFrames(processed);
        setIsRemovingBg(false);
      }
    }

    processBackgroundRemoval().catch(() => {
      if (!cancelled) {
        setCutoutFrames(draft.frames);
        setIsRemovingBg(false);
      }
    });

    return () => {
      cancelled = true;
    };
  }, [draft.frames, sensitivity, keepOriginalBg]);

  const frontCutout = cutoutFrames[0]?.dataUrl || draft.coverUrl;
  const podium = getPodiumTheme(accentHex);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) {
      setFormError('Введите название памятной вещи');
      return;
    }

    onSave({
      title: title.trim(),
      note: note.trim(),
      views: cutoutFrames,
      coverUrl: frontCutout,
      accentHex,
    });
  };

  return (
    <div className="min-h-screen bg-[#FAF8F5] pb-12 text-[#231E1A]">
      <header className="mx-auto flex max-w-2xl items-center gap-3 px-4 pt-5 pb-3 sm:px-6">
        <button
          type="button"
          onClick={onBack}
          aria-label="Вернуться в альбом"
          className="flex h-11 w-11 items-center justify-center rounded-2xl bg-white text-[#231E1A] shadow-xs transition-colors hover:bg-[#F3EDE4]"
        >
          <ArrowLeft className="h-5 w-5" />
        </button>
        <div>
          <h1
            className="text-xl font-bold text-[#231E1A] sm:text-2xl"
            style={{ fontFamily: 'var(--font-display)' }}
          >
            Сохранение в витрину
          </h1>
          <p className="text-xs text-[#6E645B]">
            {isRemovingBg
              ? `Автоматическое вырезание фона: ${bgRemovedCount}/${draft.frames.length}`
              : 'Фон вырезан — вещь готова для 2.5D-подиума'}
          </p>
        </div>
      </header>

      <main className="mx-auto max-w-2xl px-4 pt-2 sm:px-6">
        <form
          onSubmit={handleSubmit}
          className="space-y-5 rounded-2xl bg-white p-5 shadow-[0_6px_24px_rgba(35,30,26,0.06)] sm:p-6"
        >
          {/* Live cutout preview standing on selected 2.5D podium + 9-angle strip */}
          <div className="space-y-3 rounded-2xl bg-[#F3EDE4]/70 p-4">
            <div className="relative flex flex-col items-center pt-1">
              <div className="relative z-10 h-32 w-32">
                <img
                  src={frontCutout}
                  alt="Вырезанный ракурс 0° на подиуме"
                  className="h-full w-full object-contain drop-shadow-[0_8px_14px_rgba(35,30,26,0.18)]"
                />
              </div>
              <svg
                viewBox="0 0 240 48"
                className="-mt-8 h-10 w-44"
                aria-hidden="true"
              >
                <ellipse cx="120" cy="30" rx="108" ry="15" fill="#E6DDD1" />
                <path
                  d="M 24 15 L 24 25 A 96 14 0 0 0 216 25 L 216 15 Z"
                  fill={podium.sideFill}
                />
                <ellipse cx="120" cy="15" rx="96" ry="14" fill={podium.rimFill} />
                <ellipse cx="120" cy="14" rx="88" ry="11.5" fill={podium.topFill} />
                <ellipse cx="120" cy="14" rx="56" ry="7" fill="rgba(35, 30, 26, 0.22)" />
              </svg>
            </div>

            <div className="grid grid-cols-9 gap-1.5 pt-1">
              {cutoutFrames.map((frame) => (
                <div
                  key={frame.stepIndex}
                  className="overflow-hidden rounded-lg bg-white/75 p-0.5"
                  title={frame.shortLabel}
                >
                  <img
                    src={frame.dataUrl}
                    alt={frame.shortLabel}
                    className="aspect-square w-full object-contain"
                  />
                </div>
              ))}
            </div>

            {/* Optional fine-tuning for live camera captures */}
            {draft.source === 'camera' && (
              <div className="space-y-2 border-t border-[#E6DFD5] pt-2.5">
                <div className="flex items-center justify-between gap-2 text-xs">
                  <label htmlFor="cutout-sensitivity" className="font-medium text-[#5E544C]">
                    Точность вырезания фона
                  </label>
                  <button
                    type="button"
                    onClick={() => setKeepOriginalBg((v) => !v)}
                    className={`inline-flex min-h-[32px] items-center gap-1.5 rounded-lg px-2.5 py-1 text-xs font-medium transition-colors whitespace-nowrap ${
                      keepOriginalBg
                        ? 'bg-[#231E1A] text-white'
                        : 'bg-white text-[#5E544C] hover:bg-[#EFE8DE]'
                    }`}
                  >
                    <Eraser className="h-3.5 w-3.5" aria-hidden="true" />
                    <span>{keepOriginalBg ? 'Вернуть авто-вырезание' : 'Оставить исходный фон'}</span>
                  </button>
                </div>
                {!keepOriginalBg && (
                  <input
                    id="cutout-sensitivity"
                    type="range"
                    min={14}
                    max={58}
                    step={2}
                    value={sensitivity}
                    onChange={(e) => setSensitivity(Number(e.target.value))}
                    className="h-1.5 w-full cursor-pointer accent-[#D96B43]"
                  />
                )}
              </div>
            )}
          </div>

          <div>
            <label htmlFor="item-title" className="block text-sm font-semibold text-[#231E1A]">
              Название вещи
            </label>
            <input
              id="item-title"
              type="text"
              value={title}
              onChange={(e) => {
                setTitle(e.target.value);
                if (formError) setFormError('');
              }}
              placeholder="Например, Терракотовый чайник"
              className="mt-1.5 min-h-[46px] w-full rounded-2xl border border-[#E6DFD5] bg-[#FAF8F5] px-4 text-sm text-[#231E1A] placeholder-[#9B8F84] focus:border-[#D96B43] focus:bg-white focus:outline-none"
            />
          </div>

          <div>
            <label htmlFor="item-note" className="block text-sm font-semibold text-[#231E1A]">
              Заметка или воспоминание
            </label>
            <textarea
              id="item-note"
              rows={3}
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Откуда эта вещь и почему она дорога?"
              className="mt-1.5 w-full rounded-2xl border border-[#E6DFD5] bg-[#FAF8F5] px-4 py-3 text-sm text-[#231E1A] placeholder-[#9B8F84] focus:border-[#D96B43] focus:bg-white focus:outline-none"
            />
          </div>

          <div>
            <span className="block text-sm font-semibold text-[#231E1A]">
              Оттенок подиума
            </span>
            <div className="mt-2 flex flex-wrap gap-2.5">
              {PODIUM_THEMES.map((opt) => {
                const active = accentHex === opt.hex;
                return (
                  <button
                    key={opt.hex}
                    type="button"
                    onClick={() => setAccentHex(opt.hex)}
                    data-testid={`podium-option-${opt.label}`}
                    className={`inline-flex min-h-[40px] items-center gap-2 rounded-xl border px-3 py-1.5 text-xs font-medium transition-colors ${
                      active
                        ? 'border-[#231E1A] bg-[#FAF8F5] text-[#231E1A]'
                        : 'border-[#E6DFD5] bg-white text-[#6E645B] hover:bg-[#FAF8F5]'
                    }`}
                  >
                    <span
                      className="h-3.5 w-3.5 rounded-full"
                      style={{ backgroundColor: opt.hex }}
                      aria-hidden="true"
                    />
                    <span>{opt.label}</span>
                    {active && <Check className="h-3.5 w-3.5 text-[#D96B43]" aria-hidden="true" />}
                  </button>
                );
              })}
            </div>
          </div>

          {formError && (
            <p
              className="rounded-xl bg-[#FDF0EC] px-3.5 py-2.5 text-sm font-medium text-[#B84A32]"
              data-testid="save-form-error"
            >
              {formError}
            </p>
          )}

          <button
            type="submit"
            disabled={isRemovingBg}
            data-testid="save-album-btn"
            className="min-h-[48px] w-full rounded-2xl bg-[#D96B43] px-5 py-3 text-base font-semibold text-white shadow-sm transition-colors hover:bg-[#C25832] active:scale-[0.99] disabled:opacity-60"
          >
            {isRemovingBg ? 'Вырезаем фон...' : 'Сохранить в альбом'}
          </button>
        </form>
      </main>
    </div>
  );
};
