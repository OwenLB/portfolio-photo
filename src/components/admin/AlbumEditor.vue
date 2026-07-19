<template>
  <div>

    <!-- Header -->
    <div class="ae-header">
      <div class="ae-header-left">
        <a href="/admin" class="ae-back">
          <svg width="12" height="12" fill="none" stroke="currentColor" stroke-width="1.8" viewBox="0 0 24 24"><polyline points="15 18 9 12 15 6"/></svg>
          Albums
        </a>
        <h1 class="ae-title">{{ localAlbum.title }}</h1>
        <p class="ae-slug">{{ localAlbum.slug }}</p>
      </div>
      <div class="ae-header-actions">
        <!-- Save status -->
        <span v-if="saveStatus !== 'idle'" class="ae-save-status" :class="`ae-save-status--${saveStatus}`">
          <svg v-if="saveStatus === 'saving'" class="ae-save-spinner" width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">
            <path d="M21 12a9 9 0 1 1-6.219-8.56"/>
          </svg>
          <svg v-else-if="saveStatus === 'saved'" width="11" height="11" fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24" aria-hidden="true">
            <polyline points="20 6 9 17 4 12"/>
          </svg>
          {{ saveStatus === 'saving' ? 'Enregistrement…' : saveStatus === 'saved' ? 'Enregistré' : 'Erreur' }}
        </span>
        <!-- Visible toggle -->
        <button @click="toggleVisible" class="ae-toggle" :class="localAlbum.visible ? 'ae-toggle--on' : 'ae-toggle--off'">
          <!-- Eye (visible) -->
          <svg v-if="localAlbum.visible" width="13" height="13" fill="none" stroke="currentColor" stroke-width="1.8" viewBox="0 0 24 24" aria-hidden="true">
            <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/>
          </svg>
          <!-- Eye-off (masqué) -->
          <svg v-else width="13" height="13" fill="none" stroke="currentColor" stroke-width="1.8" viewBox="0 0 24 24" aria-hidden="true">
            <path d="M17.94 17.94A10.07 10.07 0 0112 20c-7 0-11-8-11-8a18.45 18.45 0 015.06-5.94M9.9 4.24A9.12 9.12 0 0112 4c7 0 11 8 11 8a18.5 18.5 0 01-2.16 3.19m-6.72-1.07a3 3 0 11-4.24-4.24"/>
            <line x1="1" y1="1" x2="23" y2="23"/>
          </svg>
          {{ localAlbum.visible ? 'Visible' : 'Masqué' }}
        </button>
        <!-- Separator -->
        <span class="ae-actions-sep" />
        <!-- Delete -->
        <button @click="showDeleteConfirm = true" class="ae-btn-delete">
          <svg width="13" height="13" fill="none" stroke="currentColor" stroke-width="1.5" viewBox="0 0 24 24" aria-hidden="true">
            <polyline points="3 6 5 6 21 6"/>
            <path d="M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6"/>
            <path d="M10 11v6M14 11v6M9 6V4h6v2"/>
          </svg>
          Supprimer
        </button>
      </div>
    </div>

    <!-- Metadata -->
    <section class="ae-section">
      <h2 class="ae-section-title">Métadonnées</h2>
      <div class="ae-fields">
        <div>
          <label class="ae-label">Titre</label>
          <input v-model="localAlbum.title" type="text" class="ae-input" />
        </div>
        <div>
          <label class="ae-label">Description</label>
          <input v-model="localAlbum.description" type="text" class="ae-input" />
        </div>
      </div>
    </section>

    <!-- Upload -->
    <section class="ae-section">
      <h2 class="ae-section-title">Ajouter des photos</h2>
      <PhotoUploader :slug="localAlbum.slug" @uploaded="onPhotosUploaded" />
    </section>

    <!-- Photo grid -->
    <section>
      <div class="ae-grid-header">
        <h2 class="ae-section-title" style="margin-bottom:0">
          Photos
          <span class="ae-count">{{ localAlbum.photos.length }}</span>
        </h2>
        <div class="ae-grid-controls">
          <div class="ae-sort">
            <button
              v-for="opt in SORT_OPTIONS"
              :key="opt.value"
              class="ae-sort-btn"
              :class="{ 'ae-sort-btn--active': localAlbum.sortOrder === opt.value }"
              @click="applySortOrder(opt.value)"
            >{{ opt.label }}</button>
          </div>
          <p class="ae-grid-hint">Glissez pour réordonner · étoile = couverture</p>
        </div>
      </div>
      <PhotoGrid
        :photos="localAlbum.photos"
        :cover="localAlbum.cover"
        @reorder="onReorder"
        @toggle-visible="onTogglePhotoVisible"
        @set-cover="onSetCover"
        @delete="onDeletePhoto"
      />
    </section>

    <!-- Delete confirmation modal -->
    <div
      v-if="showDeleteConfirm"
      class="ae-modal-backdrop"
      @click.self="showDeleteConfirm = false"
    >
      <div class="ae-modal">
        <h3 class="ae-modal-title">Supprimer « {{ localAlbum.title }} » ?</h3>
        <p class="ae-modal-body">
          Cette action est irréversible. L'album et ses
          {{ localAlbum.photos.length }} photo{{ localAlbum.photos.length > 1 ? 's' : '' }}
          seront définitivement supprimés.
        </p>
        <div class="ae-modal-actions">
          <button @click="showDeleteConfirm = false" class="ae-btn-ghost">Annuler</button>
          <button @click="deleteAlbum" :disabled="deleting" class="ae-btn-danger">
            {{ deleting ? 'Suppression…' : 'Supprimer' }}
          </button>
        </div>
      </div>
    </div>

    <!-- Toast -->
    <Transition name="toast">
      <div v-if="toast" class="ae-toast">{{ toast }}</div>
    </Transition>

  </div>
</template>

<script setup lang="ts">
import { ref, watch } from 'vue';
import PhotoUploader from './PhotoUploader.vue';
import PhotoGrid from './PhotoGrid.vue';
import type { Album, Photo, AlbumSortOrder } from '../../lib/types';

const SORT_OPTIONS: { value: AlbumSortOrder; label: string }[] = [
  { value: 'date-asc',  label: 'Date ↑' },
  { value: 'date-desc', label: 'Date ↓' },
  { value: 'custom',    label: 'Personnalisé' },
];

interface PhotoWithUrls extends Photo {
  thumbUrl: string;
  fullUrl: string;
}

interface AlbumWithUrls extends Omit<Album, 'photos'> {
  photos: PhotoWithUrls[];
}

const props = defineProps<{ album: AlbumWithUrls }>();

const localAlbum = ref<AlbumWithUrls>({ ...props.album, photos: [...props.album.photos] });
const saveStatus = ref<'idle' | 'saving' | 'saved' | 'error'>('idle');
const deleting = ref(false);
const showDeleteConfirm = ref(false);
const toast = ref<string | null>(null);
let debounceTimer: ReturnType<typeof setTimeout> | null = null;

function showToast(msg: string) {
  toast.value = msg;
  setTimeout(() => { toast.value = null; }, 2500);
}

async function saveAlbum() {
  if (debounceTimer) { clearTimeout(debounceTimer); debounceTimer = null; }
  saveStatus.value = 'saving';
  try {
    const res = await fetch(`/api/albums/${localAlbum.value.slug}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(localAlbum.value),
    });
    if (!res.ok) throw new Error();
    saveStatus.value = 'saved';
    setTimeout(() => { if (saveStatus.value === 'saved') saveStatus.value = 'idle'; }, 2000);
  } catch {
    saveStatus.value = 'error';
    showToast('Erreur lors de la sauvegarde');
    setTimeout(() => { saveStatus.value = 'idle'; }, 3000);
  }
}

function debouncedSave() {
  if (debounceTimer) clearTimeout(debounceTimer);
  debounceTimer = setTimeout(() => saveAlbum(), 800);
}

// Debounce sur les champs texte uniquement
watch(
  [() => localAlbum.value.title, () => localAlbum.value.description],
  debouncedSave,
);

function toggleVisible() {
  localAlbum.value.visible = !localAlbum.value.visible;
  saveAlbum();
}

function applySortOrder(sort: AlbumSortOrder) {
  localAlbum.value.sortOrder = sort;
  if (sort !== 'custom') {
    const sorted = [...localAlbum.value.photos].sort((a, b) => {
      const ta = a.capturedAt ? new Date(a.capturedAt).getTime() : Infinity;
      const tb = b.capturedAt ? new Date(b.capturedAt).getTime() : Infinity;
      return sort === 'date-asc' ? ta - tb : tb - ta;
    });
    localAlbum.value.photos = sorted.map((p, i) => ({ ...p, order: i }));
  }
  saveAlbum();
}

function onReorder(photos: PhotoWithUrls[]) {
  localAlbum.value.sortOrder = 'custom';
  localAlbum.value.photos = photos.map((p, i) => ({ ...p, order: i }));
  saveAlbum();
}

function onTogglePhotoVisible(photoId: string) {
  const p = localAlbum.value.photos.find(ph => ph.id === photoId);
  if (p) p.visible = !p.visible;
  saveAlbum();
}

function onSetCover(photoId: string) {
  localAlbum.value.cover = photoId;
  saveAlbum();
}

async function onDeletePhoto(photoId: string) {
  if (!confirm('Supprimer cette photo ?')) return;
  try {
    const res = await fetch(`/api/albums/${localAlbum.value.slug}/photos/${photoId}`, { method: 'DELETE' });
    if (!res.ok) throw new Error();
    localAlbum.value.photos = localAlbum.value.photos.filter(p => p.id !== photoId);
    showToast('Photo supprimée');
  } catch {
    showToast('Erreur lors de la suppression');
  }
}

async function deleteAlbum() {
  deleting.value = true;
  try {
    const res = await fetch(`/api/albums/${localAlbum.value.slug}`, { method: 'DELETE' });
    if (!res.ok) throw new Error();
    // Redirect to album list after deletion
    window.location.href = '/admin';
  } catch {
    showToast('Erreur lors de la suppression');
    deleting.value = false;
    showDeleteConfirm.value = false;
  }
}

function onPhotosUploaded(newPhotos: PhotoWithUrls[]) {
  const startOrder = localAlbum.value.photos.length;
  const ordered = newPhotos.map((p, i) => ({ ...p, order: startOrder + i }));
  localAlbum.value.photos = [...localAlbum.value.photos, ...ordered];
  if (!localAlbum.value.cover && ordered.length > 0) {
    localAlbum.value.cover = ordered[0].id;
  }
  saveAlbum();
}
</script>

<style scoped>
/* ── Header ─────────────────────────────────────────────────────────────── */
.ae-header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 24px;
  margin-bottom: 36px;
  flex-wrap: wrap;
}
.ae-header-left { min-width: 0; }
.ae-back {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  font-size: 11px;
  letter-spacing: 0.04em;
  color: #909090;
  text-decoration: none;
  transition: color 0.15s;
}
.ae-back:hover { color: #0c0c0c; }
.ae-title {
  font-size: 22px;
  font-weight: 500;
  color: #0c0c0c;
  margin: 10px 0 2px;
  letter-spacing: -0.02em;
  line-height: 1.2;
}
.ae-slug {
  font-size: 11px;
  font-family: 'Inter', monospace;
  color: #b0b0aa;
  letter-spacing: 0.03em;
}

.ae-header-actions {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-shrink: 0;
}

/* Save status */
.ae-save-status {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  font-size: 11.5px;
  letter-spacing: 0.02em;
  transition: opacity 0.2s;
}
.ae-save-status--saving { color: #909090; }
.ae-save-status--saved  { color: #38a169; }
.ae-save-status--error  { color: #e53e3e; }

@keyframes ae-spin { to { transform: rotate(360deg); } }
.ae-save-spinner { animation: ae-spin 0.75s linear infinite; flex-shrink: 0; }

/* Visible toggle */
.ae-toggle {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 5px 12px 5px 9px;
  font-size: 12px;
  font-family: 'Inter', sans-serif;
  border-radius: 4px;
  cursor: pointer;
  transition: background 0.15s, color 0.15s, border-color 0.15s;
  border: 1px solid transparent;
  letter-spacing: 0.02em;
  white-space: nowrap;
}
.ae-toggle svg { flex-shrink: 0; }
.ae-toggle--on {
  background: #0c0c0c;
  color: #fff;
  border-color: #0c0c0c;
}
.ae-toggle--off {
  background: #fff;
  color: #606060;
  border-color: #e6e6e3;
}
.ae-toggle--off:hover { background: #f7f7f5; color: #404040; }

/* Separator */
.ae-actions-sep {
  width: 1px;
  height: 20px;
  background: #e6e6e3;
  flex-shrink: 0;
}

/* Delete button */
.ae-btn-delete {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 5px 12px 5px 9px;
  font-size: 12px;
  font-family: 'Inter', sans-serif;
  letter-spacing: 0.02em;
  color: #909090;
  background: #fff;
  border: 1px solid #e6e6e3;
  border-radius: 4px;
  cursor: pointer;
  transition: color 0.15s, border-color 0.15s, background 0.15s;
  white-space: nowrap;
}
.ae-btn-delete:hover {
  color: #e53e3e;
  border-color: #fca5a5;
  background: #fff5f5;
}

/* Primary button */
.ae-btn-primary {
  padding: 6px 16px;
  background: #0c0c0c;
  color: #fff;
  border: none;
  font-size: 12px;
  font-weight: 500;
  font-family: 'Inter', sans-serif;
  letter-spacing: 0.02em;
  cursor: pointer;
  transition: opacity 0.15s;
  border-radius: 4px;
}
.ae-btn-primary:hover:not(:disabled) { opacity: 0.8; }
.ae-btn-primary:disabled { opacity: 0.4; cursor: default; }


/* ── Sections ────────────────────────────────────────────────────────────── */
.ae-section {
  background: #fff;
  border: 1px solid #e6e6e3;
  padding: 20px;
  margin-bottom: 20px;
}
.ae-section-title {
  font-size: 11px;
  font-weight: 500;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: #909090;
  margin-bottom: 16px;
}
.ae-fields {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 16px;
}
@media (max-width: 640px) { .ae-fields { grid-template-columns: 1fr; } }

.ae-label {
  display: block;
  font-size: 11px;
  color: #909090;
  letter-spacing: 0.04em;
  margin-bottom: 5px;
}
.ae-input {
  width: 100%;
  border: 1px solid #e6e6e3;
  border-radius: 3px;
  padding: 7px 10px;
  font-size: 13px;
  font-family: 'Inter', sans-serif;
  color: #0c0c0c;
  background: #fff;
  transition: border-color 0.15s;
  box-sizing: border-box;
}
.ae-input:focus { outline: none; border-color: #a0a09c; }

/* Grid header */
.ae-grid-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  margin-bottom: 12px;
  flex-wrap: wrap;
}
.ae-grid-controls {
  display: flex;
  align-items: center;
  gap: 12px;
  flex-wrap: wrap;
}
.ae-count {
  margin-left: 6px;
  font-size: 10px;
  font-weight: 400;
  color: #b0b0aa;
}
.ae-grid-hint {
  font-size: 11px;
  color: #c0c0bc;
  letter-spacing: 0.02em;
}
.ae-sort {
  display: flex;
  border: 1px solid #e6e6e3;
  border-radius: 4px;
  overflow: hidden;
}
.ae-sort-btn {
  padding: 4px 10px;
  font-size: 11px;
  font-family: 'Inter', sans-serif;
  letter-spacing: 0.02em;
  background: #fff;
  color: #909090;
  border: none;
  border-right: 1px solid #e6e6e3;
  cursor: pointer;
  transition: background 0.12s, color 0.12s;
  white-space: nowrap;
}
.ae-sort-btn:last-child { border-right: none; }
.ae-sort-btn:hover:not(.ae-sort-btn--active) { background: #f7f7f5; color: #505050; }
.ae-sort-btn--active { background: #0c0c0c; color: #fff; }

/* ── Modal ───────────────────────────────────────────────────────────────── */
.ae-modal-backdrop {
  position: fixed;
  inset: 0;
  z-index: 50;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(0, 0, 0, 0.35);
  padding: 20px;
}
.ae-modal {
  background: #fff;
  border: 1px solid #e6e6e3;
  width: 100%;
  max-width: 360px;
  padding: 24px;
  box-shadow: 0 8px 32px rgba(0,0,0,0.08);
}
.ae-modal-title {
  font-size: 14px;
  font-weight: 500;
  color: #0c0c0c;
  margin-bottom: 8px;
  letter-spacing: -0.01em;
}
.ae-modal-body {
  font-size: 12.5px;
  color: #707070;
  line-height: 1.6;
  margin-bottom: 20px;
}
.ae-modal-actions {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
}
.ae-btn-ghost {
  padding: 6px 14px;
  background: none;
  border: 1px solid #e6e6e3;
  font-size: 12px;
  font-family: 'Inter', sans-serif;
  color: #606060;
  border-radius: 4px;
  cursor: pointer;
  transition: background 0.15s;
}
.ae-btn-ghost:hover { background: #f7f7f5; }
.ae-btn-danger {
  padding: 6px 14px;
  background: #0c0c0c;
  border: none;
  font-size: 12px;
  font-weight: 500;
  font-family: 'Inter', sans-serif;
  color: #fff;
  border-radius: 4px;
  cursor: pointer;
  transition: opacity 0.15s;
}
.ae-btn-danger:hover:not(:disabled) { opacity: 0.75; }
.ae-btn-danger:disabled { opacity: 0.4; }

/* ── Toast ───────────────────────────────────────────────────────────────── */
.ae-toast {
  position: fixed;
  bottom: 24px;
  right: 24px;
  background: #0c0c0c;
  color: #fff;
  font-size: 12px;
  letter-spacing: 0.02em;
  padding: 10px 16px;
  z-index: 60;
  box-shadow: 0 4px 16px rgba(0,0,0,0.15);
}
.toast-enter-active { transition: opacity 0.2s, transform 0.2s; }
.toast-leave-active { transition: opacity 0.25s, transform 0.25s; }
.toast-enter-from  { opacity: 0; transform: translateY(6px); }
.toast-leave-to    { opacity: 0; transform: translateY(6px); }
</style>
