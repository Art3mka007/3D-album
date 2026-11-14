/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useEffect, useMemo, useState } from 'react';
import { CaptureScreen } from './components/CaptureScreen';
import { GalleryScreen } from './components/GalleryScreen';
import { OfflineIndicator } from './components/OfflineIndicator';
import { SaveScreen } from './components/SaveScreen';
import { ViewerScreen } from './components/ViewerScreen';
import type { AlbumItem, AppScreen, CapturedDraft, CapturedViewFrame } from './types/album';
import {
  SEED_TEMPLATES,
  createAlbumItem,
  deleteAlbumItem,
  filterAlbumItems,
} from './utils/albumStorage';
import { dbDeleteItem, dbGetAllItems, dbPutItem, dbPutManyItems } from './utils/db';
import { generateSeedItemViews } from './utils/demoStudio';

export default function App() {
  const [items, setItems] = useState<AlbumItem[]>([]);
  const [isLoaded, setIsLoaded] = useState(false);
  const [screen, setScreen] = useState<AppScreen>('gallery');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedItemId, setSelectedItemId] = useState<string | null>(null);
  const [streamPromise, setStreamPromise] = useState<Promise<MediaStream> | null>(null);
  const [draft, setDraft] = useState<CapturedDraft | null>(null);

  // Load items from IndexedDB; seed 3 demo items with 9 crisp studio views if empty
  useEffect(() => {
    let cancelled = false;

    async function initDb() {
      const existing = await dbGetAllItems();
      if (cancelled) return;

      if (existing.length > 0) {
        setItems(existing);
        setIsLoaded(true);
        return;
      }

      const seeded: AlbumItem[] = SEED_TEMPLATES.map((tpl) => {
        const views = generateSeedItemViews(tpl.id);
        return {
          ...tpl,
          coverUrl: views[0]?.dataUrl ?? '',
          views,
        };
      });
      await dbPutManyItems(seeded);
      if (cancelled) return;
      setItems(seeded);
      setIsLoaded(true);
    }

    initDb();
    return () => {
      cancelled = true;
    };
  }, []);

  const filteredItems = useMemo(
    () => filterAlbumItems(items, searchQuery),
    [items, searchQuery],
  );

  const selectedItem = useMemo(
    () => items.find((item) => item.id === selectedItemId) ?? null,
    [items, selectedItemId],
  );

  // Trigger getUserMedia directly inside the user's click handler on FAB "+"
  const handleOpenCapture = () => {
    if (
      typeof navigator !== 'undefined' &&
      navigator.mediaDevices &&
      typeof navigator.mediaDevices.getUserMedia === 'function'
    ) {
      const promise = navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment', width: { ideal: 1920 }, height: { ideal: 1080 } },
        audio: false,
      });
      setStreamPromise(promise);
    } else {
      setStreamPromise(null);
    }
    setScreen('capture');
  };

  const handleCaptureComplete = (captured: CapturedDraft) => {
    setDraft(captured);
    setStreamPromise(null);
    setScreen('save');
  };

  const handleSaveItem = async (form: {
    title: string;
    note: string;
    views: CapturedViewFrame[];
    coverUrl: string;
    accentHex: string;
  }) => {
    if (!draft) return;
    const newItem = createAlbumItem({
      title: form.title,
      note: form.note,
      views: form.views,
      coverUrl: form.coverUrl,
      source: draft.source,
      accentHex: form.accentHex,
    });
    setItems((prev) => [newItem, ...prev]);
    await dbPutItem(newItem);
    setDraft(null);
    setScreen('gallery');
  };

  const handleDeleteItem = async (id: string) => {
    setItems((prev) => deleteAlbumItem(prev, id));
    await dbDeleteItem(id);
    setSelectedItemId(null);
    setScreen('gallery');
  };

  if (!isLoaded) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#FAF8F5] text-sm text-[#6E645B]">
        Загрузка коллекции...
      </div>
    );
  }

  return (
    <>
      {screen === 'gallery' && (
        <GalleryScreen
          items={filteredItems}
          totalCount={items.length}
          searchQuery={searchQuery}
          onSearchChange={setSearchQuery}
          onSelectItem={(item) => {
            setSelectedItemId(item.id);
            setScreen('viewer');
          }}
          onOpenCapture={handleOpenCapture}
        />
      )}

      {screen === 'capture' && (
        <CaptureScreen
          initialStreamPromise={streamPromise}
          onCancel={() => {
            setStreamPromise(null);
            setScreen('gallery');
          }}
          onComplete={handleCaptureComplete}
        />
      )}

      {screen === 'save' && draft && (
        <SaveScreen
          draft={draft}
          onBack={() => {
            setDraft(null);
            setScreen('gallery');
          }}
          onSave={handleSaveItem}
        />
      )}

      {screen === 'viewer' && selectedItem && (
        <ViewerScreen
          item={selectedItem}
          onBack={() => {
            setSelectedItemId(null);
            setScreen('gallery');
          }}
          onDelete={handleDeleteItem}
        />
      )}

      <OfflineIndicator />
    </>
  );
}
