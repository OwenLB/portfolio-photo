<template>
  <div ref="containerRef" class="relative w-full">
    <div
      v-if="layout"
      :style="{ height: layout.containerHeight + 'px', position: 'relative' }"
    >
      <div
        v-for="(box, i) in layout.boxes"
        :key="photos[i].id"
        :style="{
          position: 'absolute',
          top: box.top + 'px',
          left: box.left + 'px',
          width: box.width + 'px',
          height: box.height + 'px',
        }"
        class="overflow-hidden cursor-pointer"
        @click="openLightbox(i)"
      >
        <img
          :src="photos[i].thumbUrl"
          :alt="`Photo ${i + 1}`"
          :width="box.width"
          :height="box.height"
          loading="lazy"
          decoding="async"
          class="w-full h-full object-cover transition-transform duration-300 hover:scale-105"
        />
      </div>
    </div>

    <Lightbox
      v-if="lightboxOpen"
      :photos="photos"
      :initialIndex="lightboxIndex"
      @close="lightboxOpen = false"
    />
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue';
import justifiedLayout from 'justified-layout';
import Lightbox from './Lightbox.vue';

interface GalleryPhoto {
  id: string;
  w: number;
  h: number;
  thumbUrl: string;
  fullUrl: string;
  capturedAt?: string;
  description?: string;
  location?: string;
  geoLat?: number;
  geoLng?: number;
  camera?: string;
  lens?: string;
  aperture?: string;
  shutterSpeed?: string;
  iso?: number;
  focalLength?: string;
}

const props = defineProps<{
  photos: GalleryPhoto[];
}>();

const containerRef = ref<HTMLElement | null>(null);
const containerWidth = ref(0);
const lightboxOpen = ref(false);
const lightboxIndex = ref(0);

const isMobile = computed(() => containerWidth.value < 768);

const layout = computed(() => {
  if (!containerWidth.value || !props.photos.length) return null;
  return justifiedLayout(
    props.photos.map(p => p.w / p.h),
    {
      containerWidth: containerWidth.value,
      targetRowHeight: isMobile.value ? 180 : 300,
      boxSpacing: 4,
      containerPadding: 0,
    },
  );
});

function openLightbox(index: number) {
  lightboxIndex.value = index;
  lightboxOpen.value = true;
}

let resizeObserver: ResizeObserver | null = null;

onMounted(() => {
  if (!containerRef.value) return;
  containerWidth.value = containerRef.value.clientWidth;
  resizeObserver = new ResizeObserver(entries => {
    containerWidth.value = entries[0].contentRect.width;
  });
  resizeObserver.observe(containerRef.value);
});

onUnmounted(() => {
  resizeObserver?.disconnect();
});
</script>
