/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useEffect, useMemo, useState } from 'react';
import { CaptureScreen } from './components/CaptureScreen';
import { GalleryScreen } from './components/GalleryScreen';
import { OfflineIndicator } from './components/OfflineIndicator';
import { ProcessingScreen } from './components/ProcessingScreen';
import { ViewerScreen } from './components/ViewerScreen';
import type { AlbumItem, AppScreen, CapturedDraft } from './types/album';
import {
  createAlbumItem,
  deleteAlbumItem,
  filterAlbumItems,
  loadAlbumItems,
  saveAlbumItems,
} from './utils/albumStorage';

export default function App() {
  const [items, setItems] = useState<AlbumItem[]>(() => loadAlbumItems());
  const [screen, setScreen] = useState<AppScreen>('gallery');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedItemId, setSelectedItemId] = useState<string | null>(null);
  const [streamPromise, setStreamPromise] = useState<Promise<MediaStream> | null>(null);
  const [draft, setDraft] = useState<CapturedDraft | null>(null);

  useEffect(() => {
    saveAlbumItems(items);
  }, [items]);

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
        video: { facingMode: 'environment' },
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
    setScreen('processing');
  };

  const handleSaveItem = (form: {
    title: string;
    note: string;
    coverUrl: string;
    accentHex: string;
  }) => {
    if (!draft) return;
    const newItem = createAlbumItem({
      title: form.title,
      note: form.note,
      coverUrl: form.coverUrl,
      source: draft.source,
      modelType: 'custom',
      frames: draft.frames,
      accentHex: form.accentHex,
    });
    setItems((prev) => [newItem, ...prev]);
    setDraft(null);
    setScreen('gallery');
  };

  const handleDeleteItem = (id: string) => {
    setItems((prev) => deleteAlbumItem(prev, id));
    setSelectedItemId(null);
    setScreen('gallery');
  };

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

      {screen === 'processing' && draft && (
        <ProcessingScreen
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
