import React, { useEffect, useRef, useState } from 'react';
import { ArrowLeft, Check, ImagePlus } from 'lucide-react';
import type { CapturedDraft } from '../types/album';
import { extractFramesFromFile } from '../utils/mediaCapture';

const PROCESSING_DURATION_MS = 2200;

const ACCENT_OPTIONS = [
  { hex: '#D96B43', label: 'Терракота' },
  { hex: '#6F8B58', label: 'Шалфей' },
  { hex: '#4A433D', label: 'Графит' },
  { hex: '#C9965B', label: 'Охра' },
];

interface ProcessingScreenProps {
  draft: CapturedDraft;
  onBack: () => void;
  onSave: (data: {
    title: string;
    note: string;
    coverUrl: string;
    accentHex: string;
  }) => void;
}

export const ProcessingScreen: React.FC<ProcessingScreenProps> = ({
  draft,
  onBack,
  onSave,
}) => {
  const [stage, setStage] = useState<'generating' | 'form'>('generating');
  const [progressPct, setProgressPct] = useState(0);
  const [title, setTitle] = useState('');
  const [note, setNote] = useState('');
  const [coverUrl, setCoverUrl] = useState(draft.selectedCoverUrl);
  const [frames, setFrames] = useState<string[]>(draft.frames);
  const [accentHex, setAccentHex] = useState(draft.accentHex ?? '#D96B43');
  const [error, setError] = useState('');

  const coverFileRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    const started = performance.now();
    const interval = window.setInterval(() => {
      const elapsed = performance.now() - started;
      const pct = Math.min(100, Math.round((elapsed / PROCESSING_DURATION_MS) * 100));
      setProgressPct(pct);
      if (elapsed >= PROCESSING_DURATION_MS) {
        window.clearInterval(interval);
        setStage('form');
      }
    }, 50);

    return () => window.clearInterval(interval);
  }, []);

  const handleCoverUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const extracted = await extractFramesFromFile(file);
      if (extracted[0]) {
        setFrames((prev) => [extracted[0], ...prev]);
        setCoverUrl(extracted[0]);
      }
    } catch {
      setError('Не удалось загрузить выбранную обложку');
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) {
      setError('Введите название памятной вещи');
      return;
    }
    onSave({
      title: title.trim(),
      note: note.trim(),
      coverUrl,
      accentHex,
    });
  };

  if (stage === 'generating') {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-[#FAF8F5] px-6 text-center text-[#231E1A]">
        <div className="w-full max-w-sm rounded-2xl bg-white p-8 shadow-[0_8px_30px_rgba(35,30,26,0.06)]">
          <div className="relative mx-auto flex h-24 w-24 items-center justify-center">
            <svg
              className="h-24 w-24 animate-spin"
              style={{ animationDuration: '2.4s' }}
              viewBox="0 0 96 96"
              aria-hidden="true"
            >
              <circle
                cx="48"
                cy="48"
                r="40"
                fill="none"
                stroke="#EFE8DE"
                strokeWidth="5"
              />
              <circle
                cx="48"
                cy="48"
                r="40"
                fill="none"
                stroke="#D96B43"
                strokeWidth="5"
                strokeLinecap="round"
                strokeDasharray="160 260"
              />
            </svg>
            <span className="absolute text-sm font-bold text-[#231E1A] tabular-nums">
              {progressPct}%
            </span>
          </div>

          <h1
            className="mt-6 text-xl font-bold text-[#231E1A]"
            style={{ fontFamily: 'var(--font-display)' }}
          >
            Создаём 3D-модель
          </h1>
          <p className="mt-2 text-sm text-[#6E645B]">
            {progressPct < 40
              ? 'Выравниваем ключевые ракурсы...'
              : progressPct < 80
                ? 'Собираем объёмный силуэт и свет...'
                : 'Запекаем текстуру обложки...'}
          </p>

          <div className="mt-6 h-2 w-full overflow-hidden rounded-full bg-[#F3EDE4]">
            <div
              className="h-full rounded-full bg-[#D96B43] transition-all duration-100"
              style={{ width: `${progressPct}%` }}
            />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#FAF8F5] pb-12 text-[#231E1A]">
      <header className="mx-auto flex max-w-2xl items-center gap-3 px-4 pt-5 pb-3 sm:px-6">
        <button
          type="button"
          onClick={onBack}
          aria-label="Вернуться назад"
          className="flex h-11 w-11 items-center justify-center rounded-2xl bg-white text-[#231E1A] shadow-xs transition-colors hover:bg-[#F3EDE4]"
        >
          <ArrowLeft className="h-5 w-5" />
        </button>
        <h1
          className="text-xl font-bold text-[#231E1A] sm:text-2xl"
          style={{ fontFamily: 'var(--font-display)' }}
        >
          Сохранить в альбом
        </h1>
      </header>

      <main className="mx-auto max-w-2xl px-4 pt-2 sm:px-6">
        <form
          onSubmit={handleSubmit}
          className="space-y-5 rounded-2xl bg-white p-5 shadow-[0_6px_24px_rgba(35,30,26,0.06)] sm:p-6"
        >
          {/* Cover selection */}
          <div>
            <div className="flex items-center justify-between gap-2">
              <span className="text-sm font-semibold text-[#231E1A]">Обложка карточки</span>
              <button
                type="button"
                onClick={() => coverFileRef.current?.click()}
                className="inline-flex min-h-[36px] items-center gap-1.5 rounded-xl px-2.5 py-1 text-xs font-medium text-[#D96B43] hover:bg-[#FAF8F5]"
              >
                <ImagePlus className="h-3.5 w-3.5" aria-hidden="true" />
                <span>Заменить фото</span>
              </button>
              <input
                ref={coverFileRef}
                type="file"
                accept="image/*"
                onChange={handleCoverUpload}
                className="hidden"
              />
            </div>

            <div className="mt-2.5 overflow-hidden rounded-2xl bg-[#F3EDE4]">
              <img
                src={coverUrl}
                alt="Выбранная обложка"
                className="aspect-[4/3] w-full object-cover"
              />
            </div>

            {frames.length > 1 && (
              <div className="mt-3 flex gap-2 overflow-x-auto pb-1">
                {frames.map((frame, index) => {
                  const selected = frame === coverUrl;
                  return (
                    <button
                      key={`${index}-${frame.slice(0, 24)}`}
                      type="button"
                      onClick={() => setCoverUrl(frame)}
                      aria-label={`Выбрать кадр ${index + 1}`}
                      className={`relative h-14 w-18 shrink-0 overflow-hidden rounded-xl border-2 transition-all ${
                        selected ? 'border-[#D96B43]' : 'border-transparent opacity-75 hover:opacity-100'
                      }`}
                    >
                      <img src={frame} alt="" className="h-full w-full object-cover" />
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          {/* Title input */}
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
                if (error) setError('');
              }}
              placeholder="Например, Винтажная кружка"
              className="mt-1.5 min-h-[46px] w-full rounded-2xl border border-[#E6DFD5] bg-[#FAF8F5] px-4 text-sm text-[#231E1A] placeholder-[#9B8F84] focus:border-[#D96B43] focus:bg-white focus:outline-none"
            />
          </div>

          {/* Note textarea */}
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

          {/* Pedestal accent color */}
          <div>
            <span className="block text-sm font-semibold text-[#231E1A]">
              Оттенок рамки в 3D
            </span>
            <div className="mt-2 flex flex-wrap gap-2.5">
              {ACCENT_OPTIONS.map((opt) => {
                const active = accentHex === opt.hex;
                return (
                  <button
                    key={opt.hex}
                    type="button"
                    onClick={() => setAccentHex(opt.hex)}
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

          {error && (
            <p className="rounded-xl bg-[#FDF0EC] px-3.5 py-2.5 text-sm font-medium text-[#B84A32]">
              {error}
            </p>
          )}

          <button
            type="submit"
            data-testid="save-album-btn"
            className="min-h-[48px] w-full rounded-2xl bg-[#D96B43] px-5 py-3 text-base font-semibold text-white shadow-sm transition-colors hover:bg-[#C25832] active:scale-[0.99]"
          >
            Сохранить в альбом
          </button>
        </form>
      </main>
    </div>
  );
};
