import {
  CAPTURE_STEPS,
  type AlbumItem,
  type CaptureSource,
  type CapturedViewFrame,
} from '../types/album';

export interface SeedItemTemplate {
  id: 'seed-zenit' | 'seed-sneakers' | 'seed-avocado';
  title: string;
  note: string;
  createdAt: string;
  source: CaptureSource;
  accentHex: string;
}

export const SEED_TEMPLATES: SeedItemTemplate[] = [
  {
    id: 'seed-zenit',
    title: 'Старый Зенит',
    note: 'Дедушкин плёночный фотоаппарат 1978 года с объективом Гелиос-44. Сняли на него первую семейную поездку к морю.',
    createdAt: '2026-10-14T11:30:00.000Z',
    source: 'demo',
    accentHex: '#4A433D',
  },
  {
    id: 'seed-sneakers',
    title: 'Любимые кеды',
    note: 'Терракотовые парусиновые кеды, в которых прошёл 40 километров по осеннему Петербургу и ни разу не натёр ноги.',
    createdAt: '2026-09-28T16:15:00.000Z',
    source: 'demo',
    accentHex: '#D96B43',
  },
  {
    id: 'seed-avocado',
    title: 'Авокадо-сувенир',
    note: 'Керамическая фигурка ручной работы из маленькой гончарной мастерской. Деревянная косточка вынимается.',
    createdAt: '2026-08-19T09:45:00.000Z',
    source: 'demo',
    accentHex: '#6F8B58',
  },
];

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
  views: CapturedViewFrame[];
  coverUrl?: string;
  source: CaptureSource;
  accentHex?: string;
  nowIso?: string;
  id?: string;
}

export function createAlbumItem(input: CreateAlbumItemInput): AlbumItem {
  const trimmedTitle = input.title.trim();
  if (!trimmedTitle) {
    throw new Error('Название вещи не может быть пустым');
  }
  if (!input.views || input.views.length === 0) {
    throw new Error('Необходимо минимум 1 фото ракурса');
  }
  const nowIso = input.nowIso ?? new Date().toISOString();
  const id =
    input.id ?? `item-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;

  // Cover always defaults to 0° (front view)
  const frontCoverUrl = input.views[0]?.dataUrl || input.coverUrl || '';

  return {
    id,
    title: trimmedTitle,
    note: input.note.trim(),
    createdAt: nowIso,
    coverUrl: frontCoverUrl,
    views: input.views,
    source: input.source,
    accentHex: input.accentHex ?? '#D96B43',
  };
}

export function deleteAlbumItem(items: AlbumItem[], id: string): AlbumItem[] {
  return items.filter((item) => item.id !== id);
}

export function getCaptureStepMeta(stepIndex: number) {
  const clamped = Math.max(0, Math.min(CAPTURE_STEPS.length - 1, stepIndex));
  return CAPTURE_STEPS[clamped];
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
