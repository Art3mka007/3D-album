import React from 'react';
import { Box, Plus, Search, X } from 'lucide-react';
import type { AlbumItem } from '../types/album';
import { formatRussianCount, formatRussianDate } from '../utils/albumStorage';
import { resolveCoverUrl } from '../utils/demoCovers';
import { PWAInstallButton } from './PWAInstallButton';

interface GalleryScreenProps {
  items: AlbumItem[];
  totalCount: number;
  searchQuery: string;
  onSearchChange: (value: string) => void;
  onSelectItem: (item: AlbumItem) => void;
  onOpenCapture: () => void;
}

export const GalleryScreen: React.FC<GalleryScreenProps> = ({
  items,
  totalCount,
  searchQuery,
  onSearchChange,
  onSelectItem,
  onOpenCapture,
}) => {
  const hasSearch = searchQuery.trim().length > 0;

  return (
    <div className="min-h-screen bg-[#FAF8F5] pb-24 text-[#231E1A]">
      <header className="mx-auto max-w-6xl px-4 pt-6 pb-4 sm:px-6">
        <div className="flex items-center justify-between gap-4">
          <div className="min-w-0">
            <h1
              className="text-2xl font-bold tracking-tight text-[#231E1A] sm:text-3xl"
              style={{ fontFamily: 'var(--font-display)' }}
            >
              3D-Альбом
            </h1>
            <p className="mt-1 text-sm text-[#6E645B] tabular-nums" data-testid="album-count">
              В коллекции · {formatRussianCount(totalCount)}
            </p>
          </div>
          <PWAInstallButton />
        </div>

        <div className="relative mt-4">
          <label htmlFor="album-search" className="sr-only">
            Поиск по названию или заметке
          </label>
          <Search
            className="pointer-events-none absolute top-1/2 left-4 h-4 w-4 -translate-y-1/2 text-[#8B7F74]"
            aria-hidden="true"
          />
          <input
            id="album-search"
            type="search"
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder="Поиск по названию или заметке..."
            className="min-h-[46px] w-full rounded-2xl border border-[#E6DFD5] bg-white pr-11 pl-11 text-sm text-[#231E1A] placeholder-[#9B8F84] shadow-[0_2px_10px_rgba(35,30,26,0.03)] transition-colors focus:border-[#D96B43] focus:outline-none"
          />
          {hasSearch && (
            <button
              type="button"
              onClick={() => onSearchChange('')}
              aria-label="Очистить поиск"
              className="absolute top-1/2 right-1.5 flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-xl text-[#6E645B] hover:bg-[#FAF8F5] hover:text-[#231E1A]"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-4 sm:px-6">
        {items.length === 0 ? (
          <div className="mt-8 rounded-2xl bg-white p-8 text-center shadow-[0_4px_20px_rgba(35,30,26,0.05)]">
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-[#FAF8F5] text-[#D96B43]">
              <Box className="h-6 w-6" aria-hidden="true" />
            </div>
            <h2 className="mt-4 text-lg font-semibold text-[#231E1A]">
              {hasSearch ? 'Ничего не найдено' : 'Альбом пока пуст'}
            </h2>
            <p className="mt-1.5 text-sm text-[#6E645B]">
              {hasSearch
                ? 'Попробуйте изменить запрос или сбросить поиск.'
                : 'Нажмите кнопку «+» внизу экрана, чтобы оцифровать первую вещь.'}
            </p>
            {hasSearch ? (
              <button
                type="button"
                onClick={() => onSearchChange('')}
                className="mt-5 inline-flex min-h-[44px] items-center justify-center rounded-2xl bg-[#F3EDE4] px-5 py-2.5 text-sm font-medium text-[#231E1A] transition-colors hover:bg-[#E9E0D3]"
              >
                Сбросить поиск
              </button>
            ) : (
              <button
                type="button"
                onClick={onOpenCapture}
                className="mt-5 inline-flex min-h-[44px] items-center justify-center rounded-2xl bg-[#D96B43] px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-[#C25832]"
              >
                Добавить первую вещь
              </button>
            )}
          </div>
        ) : (
          <div
            className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3"
            data-testid="album-grid"
          >
            {items.map((item) => {
              const coverSrc = resolveCoverUrl(item.coverUrl);
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => onSelectItem(item)}
                  className="group flex flex-col overflow-hidden rounded-2xl bg-white text-left shadow-[0_4px_18px_rgba(35,30,26,0.06)] transition-transform duration-200 hover:-translate-y-0.5 active:scale-[0.99] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#D96B43]"
                >
                  <div className="relative aspect-[4/3] w-full overflow-hidden bg-[#EFE8DE]">
                    {coverSrc ? (
                      <img
                        src={coverSrc}
                        alt={item.title}
                        loading="lazy"
                        referrerPolicy="no-referrer"
                        className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-[1.03]"
                      />
                    ) : (
                      <div className="flex h-full w-full items-center justify-center bg-[#EFE8DE] text-[#8B7F74]">
                        <Box className="h-8 w-8" aria-hidden="true" />
                      </div>
                    )}
                    <span className="absolute top-3 right-3 rounded-lg bg-[#231E1A]/80 px-2 py-0.5 text-xs font-semibold tracking-wide text-white">
                      3D
                    </span>
                  </div>

                  <div className="flex flex-1 flex-col p-4">
                    <h2 className="text-lg font-semibold leading-snug text-[#231E1A]">
                      {item.title}
                    </h2>
                    <p className="mt-1 text-xs text-[#8B7F74] tabular-nums">
                      {formatRussianDate(item.createdAt)}
                    </p>
                    {item.note && (
                      <p className="mt-2 line-clamp-2 text-sm leading-relaxed text-[#5E544C]">
                        {item.note}
                      </p>
                    )}
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </main>

      <button
        type="button"
        onClick={onOpenCapture}
        aria-label="Добавить вещь"
        data-testid="fab-add"
        className="fixed right-5 bottom-6 z-30 flex h-14 w-14 items-center justify-center rounded-2xl bg-[#D96B43] text-white ring-4 ring-[#FAF8F5]/90 shadow-[0_8px_24px_rgba(217,107,67,0.38)] transition-transform duration-150 hover:bg-[#C25832] active:scale-95 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#231E1A]"
      >
        <Plus className="h-7 w-7" aria-hidden="true" />
      </button>
    </div>
  );
};
