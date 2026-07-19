<template>
  <div
    v-if="localPhotos.length === 0"
    class="py-14 text-center border border-dashed border-gray-200 rounded-sm"
  >
    <p class="text-xs text-gray-400 tracking-wide">Aucune photo — ajoutez-en ci-dessus.</p>
  </div>

  <draggable
    v-else
    v-model="localPhotos"
    tag="div"
    item-key="id"
    class="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 gap-1.5"
    :animation="180"
    ghost-class="opacity-20"
    @end="onDragEnd"
  >
    <template #item="{ element: photo }">
      <div class="relative group aspect-square bg-gray-100 overflow-hidden">
        <!-- Thumbnail -->
        <img
          :src="photo.thumbUrl"
          :alt="photo.filename"
          loading="lazy"
          class="w-full h-full object-cover transition-opacity duration-200"
          :class="!photo.visible ? 'opacity-30' : ''"
        />

        <!-- Cover badge -->
        <div
          v-if="photo.id === cover"
          class="absolute top-1.5 left-1.5 bg-white/95 text-gray-900 text-[9px] font-medium tracking-[0.08em] uppercase px-1.5 py-0.5 leading-none"
        >
          Cover
        </div>

        <!-- Hidden badge -->
        <div
          v-if="!photo.visible"
          class="absolute bottom-1.5 left-1.5 bg-black/60 text-white/70 text-[9px] font-medium tracking-[0.06em] uppercase px-1.5 py-0.5 leading-none"
        >
          Masqué
        </div>

        <!-- Hover actions -->
        <div
          class="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity duration-150 flex items-end justify-center gap-0.5 pb-2"
        >
          <!-- Set cover -->
          <button
            @click="$emit('set-cover', photo.id)"
            :class="photo.id === cover ? 'text-white' : 'text-white/50 hover:text-white'"
            class="p-2 transition-colors"
            title="Définir comme couverture"
          >
            <svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
              <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/>
            </svg>
          </button>

          <!-- Toggle visible -->
          <button
            @click="$emit('toggle-visible', photo.id)"
            class="p-2 text-white/50 hover:text-white transition-colors"
            :title="photo.visible ? 'Masquer' : 'Afficher'"
          >
            <!-- Eye -->
            <svg v-if="photo.visible" width="13" height="13" fill="none" stroke="currentColor" stroke-width="1.8" viewBox="0 0 24 24" aria-hidden="true">
              <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/>
            </svg>
            <!-- Eye off -->
            <svg v-else width="13" height="13" fill="none" stroke="currentColor" stroke-width="1.8" viewBox="0 0 24 24" aria-hidden="true">
              <path d="M17.94 17.94A10.07 10.07 0 0112 20c-7 0-11-8-11-8a18.45 18.45 0 015.06-5.94M9.9 4.24A9.12 9.12 0 0112 4c7 0 11 8 11 8a18.5 18.5 0 01-2.16 3.19m-6.72-1.07a3 3 0 11-4.24-4.24"/>
              <line x1="1" y1="1" x2="23" y2="23"/>
            </svg>
          </button>

          <!-- Delete -->
          <button
            @click="$emit('delete', photo.id)"
            class="p-2 text-white/50 hover:text-red-400 transition-colors"
            title="Supprimer"
          >
            <svg width="13" height="13" fill="none" stroke="currentColor" stroke-width="1.8" viewBox="0 0 24 24" aria-hidden="true">
              <polyline points="3 6 5 6 21 6"/>
              <path d="M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6"/>
              <path d="M10 11v6M14 11v6"/>
              <path d="M9 6V4h6v2"/>
            </svg>
          </button>
        </div>
      </div>
    </template>
  </draggable>
</template>

<script setup lang="ts">
import { ref, watch } from 'vue';
import draggable from 'vuedraggable';
import type { Photo } from '../../lib/types';

interface PhotoWithUrls extends Photo {
  thumbUrl: string;
  fullUrl: string;
}

const props = defineProps<{
  photos: PhotoWithUrls[];
  cover: string;
}>();

const emit = defineEmits<{
  (e: 'reorder', photos: PhotoWithUrls[]): void;
  (e: 'toggle-visible', id: string): void;
  (e: 'set-cover', id: string): void;
  (e: 'delete', id: string): void;
}>();

const localPhotos = ref<PhotoWithUrls[]>([...props.photos].sort((a, b) => a.order - b.order));

watch(() => props.photos, (val) => {
  localPhotos.value = [...val].sort((a, b) => a.order - b.order);
}, { deep: true });

function onDragEnd() {
  emit('reorder', localPhotos.value);
}
</script>
