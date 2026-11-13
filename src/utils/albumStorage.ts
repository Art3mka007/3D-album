import type { AlbumItem, CaptureSource, ModelType } from '../types/album';

export const ALBUM_STORAGE_KEY = 'album3d_items_v1';

export const SEED_ITEMS: AlbumItem[] = [
  {
    id: 'seed-zenit',
    title: 'Старый Зенит',
    note: 'Дедушкин плёночный фотоаппарат 1978 года с объективом Гелиос-44. Сняли на него первую семейную поездку к морю.',
    createdAt: '2026-10-14T11:30:00.000Z',
    coverUrl: 'demo:zenit',
    modelType: 'zenit',
    source: 'demo',
    accentHex: '#4A433D',
  },
  {
    id: 'seed-sneakers',
    title: 'Любимые кеды',
    note: 'Терракотовые парусиновые кеды, в которых прошёл 40 километров по осеннему Петербургу и ни разу не натёр ноги.',
    createdAt: '2026-09-28T16:15:00.000Z',
    coverUrl: 'demo:sneakers',
    modelType: 'sneakers',
    source: 'demo',
    accentHex: '#D96B43',
  },
  {
    id: 'seed-avocado',
    title: 'Авокадо-сувенир',
    note: 'Керамическая фигурка ручной работы из маленькой гончарной мастерской. Деревянная косточка вынимается.',
    createdAt: '2026-08-19T09:45:00.000Z',
    coverUrl: 'demo:avocado',
    modelType: 'avocado',
    source: 'demo',
    accentHex: '#6F8B58',
  },
];

export function cloneSeedItems(): AlbumItem[] {
  return SEED_ITEMS.map((item) => ({ ...item }));
}

export function loadAlbumItems(storage?: Pick<Storage, 'getItem' | 'setItem'> | null): AlbumItem[] {
  const targetStorage =
    storage !== undefined
      ? storage
      : typeof window !== 'undefined'
        ? window.localStorage
        : null;

  if (!targetStorage) {
    return cloneSeedItems();
  }

  try {
    const raw = targetStorage.getItem(ALBUM_STORAGE_KEY);
    if (!raw) {
      const initial = cloneSeedItems();
      targetStorage.setItem(ALBUM_STORAGE_KEY, JSON.stringify(initial));
      return initial;
    }
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) {
      return cloneSeedItems();
    }
    return parsed.filter(
      (entry): entry is AlbumItem =>
        Boolean(entry) &&
        typeof entry.id === 'string' &&
        typeof entry.title === 'string' &&
        typeof entry.note === 'string' &&
        typeof entry.createdAt === 'string' &&
        typeof entry.coverUrl === 'string' &&
        typeof entry.modelType === 'string',
    );
  } catch {
    return cloneSeedItems();
  }
}

export function saveAlbumItems(
  items: AlbumItem[],
  storage?: Pick<Storage, 'setItem'> | null,
): boolean {
  const targetStorage =
    storage !== undefined
      ? storage
      : typeof window !== 'undefined'
        ? window.localStorage
        : null;

  if (!targetStorage) return false;
  try {
    targetStorage.setItem(ALBUM_STORAGE_KEY, JSON.stringify(items));
    return true;
  } catch {
    return false;
  }
}

export function filterAlbumItems(items: AlbumItem[], query: string): AlbumItem[] {
  const normalized = query.trim().toLowerCase();
  if (!normalized) return items;
  return items.filter((item) => {
    const titleMatch = item.title.toLowerCase().includes(normalized);
    const noteMatch = item.note.toLowerCase().includes(normalized);
    return titleMatch || noteMatch;
  });
}

export interface CreateAlbumItemInput {
  title: string;
  note: string;
  coverUrl: string;
  source: CaptureSource;
  modelType?: ModelType;
  frames?: string[];
  accentHex?: string;
  nowIso?: string;
  id?: string;
}

export function createAlbumItem(input: CreateAlbumItemInput): AlbumItem {
  const trimmedTitle = input.title.trim();
  if (!trimmedTitle) {
    throw new Error('Название вещи не может быть пустым');
  }
  const nowIso = input.nowIso ?? new Date().toISOString();
  const id =
    input.id ?? `item-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;

  return {
    id,
    title: trimmedTitle,
    note: input.note.trim(),
    createdAt: nowIso,
    coverUrl: input.coverUrl,
    modelType: input.modelType ?? 'custom',
    source: input.source,
    frames: input.frames,
    accentHex: input.accentHex ?? '#D96B43',
  };
}

export function deleteAlbumItem(items: AlbumItem[], id: string): AlbumItem[] {
  return items.filter((item) => item.id !== id);
}

const RU_MONTHS = [
  'янв',
  'фев',
  'мар',
  'апр',
  'май',
  'июн',
  'июл',
  'авг',
  'сен',
  'окт',
  'ноя',
  'дек',
];

export function formatRussianDate(isoString: string): string {
  const date = new Date(isoString);
  if (Number.isNaN(date.getTime())) {
    return 'Недавно';
  }
  const day = date.getUTCDate();
  const month = RU_MONTHS[date.getUTCMonth()] ?? '';
  const year = date.getUTCFullYear();
  return `${day} ${month} ${year}`;
}

export function formatRussianCount(count: number): string {
  const abs = Math.abs(count) % 100;
  const last = abs % 10;
  if (abs > 10 && abs < 20) return `${count} вещей`;
  if (last === 1) return `${count} вещь`;
  if (last >= 2 && last <= 4) return `${count} вещи`;
  return `${count} вещей`;
}

export function calculateCaptureProgress(elapsedMs: number, durationMs = 10000): number {
  if (durationMs <= 0) return 1;
  return Math.max(0, Math.min(1, elapsedMs / durationMs));
}
