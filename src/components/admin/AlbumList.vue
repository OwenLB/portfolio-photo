<template>
  <div>
    <div v-if="localAlbums.length > 0" class="border border-gray-200 rounded-md overflow-hidden">
      <table class="w-full text-sm">
        <thead class="bg-gray-50 border-b border-gray-200">
          <tr>
            <th class="w-8 px-3 py-3"></th>
            <th class="text-left px-4 py-3 font-medium text-gray-600">Album</th>
            <th class="text-left px-4 py-3 font-medium text-gray-600 hidden sm:table-cell">Photos</th>
            <th class="text-left px-4 py-3 font-medium text-gray-600 hidden md:table-cell">Créé</th>
            <th class="text-center px-4 py-3 font-medium text-gray-600">Visible</th>
            <th class="px-4 py-3"></th>
          </tr>
        </thead>
        <draggable
          v-model="localAlbums"
          tag="tbody"
          item-key="slug"
          handle=".drag-handle"
          @end="onReorder"
          class="divide-y divide-gray-200"
        >
          <template #item="{ element: album }">
            <tr class="bg-white hover:bg-gray-50 transition-colors group">
              <td class="px-3 py-3">
                <span class="drag-handle cursor-grab active:cursor-grabbing text-gray-300 hover:text-gray-500 transition-colors flex items-center justify-center" title="Réordonner">
                  <svg width="12" height="12" viewBox="0 0 12 12" fill="currentColor">
                    <circle cx="4" cy="2" r="1"/><circle cx="8" cy="2" r="1"/>
                    <circle cx="4" cy="6" r="1"/><circle cx="8" cy="6" r="1"/>
                    <circle cx="4" cy="10" r="1"/><circle cx="8" cy="10" r="1"/>
                  </svg>
                </span>
              </td>
              <td class="px-4 py-3">
                <a :href="`/admin/album/${album.slug}`" class="font-medium text-gray-900 hover:underline">
                  {{ album.title }}
                </a>
                <div class="text-xs text-gray-400 font-mono mt-0.5">{{ album.slug }}</div>
              </td>
              <td class="px-4 py-3 text-gray-500 hidden sm:table-cell">{{ album.photoCount }}</td>
              <td class="px-4 py-3 text-gray-500 hidden md:table-cell">
                {{ new Date(album.createdAt).toLocaleDateString('fr-FR') }}
              </td>
              <td class="px-4 py-3 text-center">
                <button
                  @click="toggleVisible(album)"
                  :class="album.visible ? 'bg-gray-900' : 'bg-gray-200'"
                  class="relative inline-flex h-5 w-9 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-gray-400 focus:ring-offset-1"
                  :aria-label="album.visible ? 'Masquer' : 'Afficher'"
                >
                  <span
                    :class="album.visible ? 'translate-x-5' : 'translate-x-1'"
                    class="inline-block h-3.5 w-3.5 transform rounded-full bg-white transition-transform shadow-sm"
                  />
                </button>
              </td>
              <td class="px-4 py-3 text-right">
                <div class="flex items-center justify-end gap-1">
                  <a
                    :href="`/admin/album/${album.slug}`"
                    class="text-xs text-gray-500 hover:text-gray-900 transition-colors px-2 py-1 rounded hover:bg-gray-100"
                  >
                    Gérer →
                  </a>
                  <button
                    @click="confirmDelete(album)"
                    :disabled="deletingSlug === album.slug"
                    class="p-1.5 rounded text-gray-300 hover:text-red-500 hover:bg-red-50 transition-colors opacity-0 group-hover:opacity-100 disabled:opacity-50"
                    title="Supprimer l'album"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" class="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                      <path stroke-linecap="round" stroke-linejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                    </svg>
                  </button>
                </div>
              </td>
            </tr>
          </template>
        </draggable>
      </table>
    </div>

    <div v-else class="text-center py-16 text-gray-400 border border-dashed border-gray-300 rounded-md">
      <p class="text-sm">Aucun album. <a href="/admin/album/new" class="underline text-gray-600">Créer le premier</a></p>
    </div>

    <!-- Delete confirmation modal -->
    <div
      v-if="albumToDelete"
      class="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4"
      @click.self="albumToDelete = null"
    >
      <div class="bg-white rounded-lg shadow-xl w-full max-w-sm p-6">
        <h3 class="text-base font-semibold text-gray-900 mb-2">Supprimer « {{ albumToDelete.title }} » ?</h3>
        <p class="text-sm text-gray-500 mb-5">
          Cette action est <strong>irréversible</strong>. L'album et toutes ses photos
          ({{ albumToDelete.photoCount }} fichier{{ albumToDelete.photoCount > 1 ? 's' : '' }}) seront
          définitivement supprimés de R2.
        </p>
        <div class="flex justify-end gap-3">
          <button
            @click="albumToDelete = null"
            class="px-4 py-1.5 text-sm border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50 transition-colors"
          >
            Annuler
          </button>
          <button
            @click="executeDelete"
            :disabled="deletingSlug === albumToDelete?.slug"
            class="px-4 py-1.5 text-sm bg-red-600 text-white rounded-md hover:bg-red-700 transition-colors disabled:opacity-50"
          >
            {{ deletingSlug === albumToDelete?.slug ? 'Suppression…' : 'Supprimer définitivement' }}
          </button>
        </div>
      </div>
    </div>

    <div
      v-if="toast"
      class="fixed bottom-6 right-6 bg-gray-900 text-white text-sm px-4 py-2.5 rounded-md shadow-lg z-50 animate-fade-in"
    >
      {{ toast }}
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue';
import draggable from 'vuedraggable';
import type { AlbumSummary } from '../../lib/types';

const props = defineProps<{ albums: AlbumSummary[] }>();

const localAlbums = ref<AlbumSummary[]>([...props.albums]);
const toast = ref<string | null>(null);
const albumToDelete = ref<AlbumSummary | null>(null);
const deletingSlug = ref<string | null>(null);

function showToast(msg: string) {
  toast.value = msg;
  setTimeout(() => { toast.value = null; }, 2500);
}

async function onReorder() {
  try {
    await fetch('/api/albums', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ slugs: localAlbums.value.map(a => a.slug) }),
    });
    showToast('Ordre sauvegardé');
  } catch {
    showToast('Erreur lors de la sauvegarde');
  }
}

async function toggleVisible(album: AlbumSummary) {
  const newVal = !album.visible;
  album.visible = newVal;
  try {
    await fetch(`/api/albums/${album.slug}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ visible: newVal }),
    });
    showToast(newVal ? `"${album.title}" est maintenant visible` : `"${album.title}" masqué`);
  } catch {
    album.visible = !newVal;
    showToast('Erreur lors de la mise à jour');
  }
}

function confirmDelete(album: AlbumSummary) {
  albumToDelete.value = album;
}

async function executeDelete() {
  const album = albumToDelete.value;
  if (!album) return;
  deletingSlug.value = album.slug;
  try {
    const res = await fetch(`/api/albums/${album.slug}`, { method: 'DELETE' });
    if (!res.ok) throw new Error();
    localAlbums.value = localAlbums.value.filter(a => a.slug !== album.slug);
    albumToDelete.value = null;
    showToast(`Album "${album.title}" supprimé`);
  } catch {
    showToast('Erreur lors de la suppression');
  } finally {
    deletingSlug.value = null;
  }
}
</script>
