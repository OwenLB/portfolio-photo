<template>
  <Teleport to="body">
    <div class="lightbox" ref="lightboxRef" tabindex="-1">

      <!-- Close -->
      <button class="lb-close" @click="$emit('close')" aria-label="Fermer">
        <svg width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
          <path d="M18 6L6 18M6 6l12 12"/>
        </svg>
      </button>

      <!-- Counter -->
      <div class="lb-counter">
        {{ currentIndex + 1 }} <span class="lb-counter-sep">/</span> {{ photos.length }}
      </div>

      <!-- Zoom level badge -->
      <Transition name="zoom-fade">
        <div v-if="isZoomed" class="lb-zoom-badge">{{ scale.toFixed(1) }}×</div>
      </Transition>

      <!-- Prev — hidden when zoomed -->
      <button
        v-if="currentIndex > 0 && !isZoomed"
        class="lb-nav lb-nav-prev"
        @click="prev"
        aria-label="Précédent"
      >
        <svg width="28" height="28" fill="none" stroke="currentColor" stroke-width="1.5" viewBox="0 0 24 24">
          <path d="M15 19l-7-7 7-7"/>
        </svg>
      </button>

      <!-- Stage -->
      <div
        class="lb-stage"
        :class="{ 'is-zoomed': isZoomed }"
        ref="stageRef"
        @wheel.prevent="onWheel"
        @dblclick="onDblClick"
        @touchstart.passive="onTouchStart"
        @touchmove="onTouchMove"
        @touchend.passive="onTouchEnd"
      >
        <!-- Single layer: handles both swipe drag (scale=1) and zoom+pan (scale>1) -->
        <div class="lb-transform-layer" :style="layerStyle">
          <Transition :name="transitionName">
            <div class="lb-frame" :key="currentIndex" @click.self="onBackdropClick">
              <img
                :src="displaySrc"
                :class="['lb-img', { 'lb-img--loading': !fullLoaded }]"
                :alt="currentPhoto.description || `Photo ${currentIndex + 1}`"
                draggable="false"
              />
            </div>
          </Transition>
        </div>
      </div>

      <!-- Next — hidden when zoomed -->
      <button
        v-if="currentIndex < photos.length - 1 && !isZoomed"
        class="lb-nav lb-nav-next"
        @click="next"
        aria-label="Suivant"
      >
        <svg width="28" height="28" fill="none" stroke="currentColor" stroke-width="1.5" viewBox="0 0 24 24">
          <path d="M9 5l7 7-7 7"/>
        </svg>
      </button>

      <!-- Bottom bar — opacity reduced when zoomed, fixed height to prevent layout shift -->
      <div class="lb-bottom" :class="{ 'is-zoomed': isZoomed }">
        <div class="lb-dots" v-if="photos.length <= 20">
          <button
            v-for="(_, i) in photos"
            :key="i"
            class="lb-dot"
            :class="{ active: i === currentIndex }"
            @click="goTo(i)"
            :aria-label="`Photo ${i + 1}`"
          />
        </div>

        <!-- Description + EXIF — always in DOM, opacity transition only -->
        <div class="lb-info" :style="{ opacity: hasInfo ? 1 : 0 }">
          <p v-if="currentPhoto.description" class="lb-desc">
            {{ currentPhoto.description }}
          </p>
          <div v-if="hasExif" class="lb-exif">
            <!-- Ligne 1 : équipement -->
            <div v-if="currentPhoto.camera || currentPhoto.lens || currentPhoto.location" class="lb-exif-row lb-exif-equipment">
              <span v-if="currentPhoto.location" class="lb-exif-location">
                <svg width="9" height="9" fill="currentColor" viewBox="0 0 24 24"><path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z"/></svg>
                {{ currentPhoto.location }}
              </span>
              <span v-if="currentPhoto.camera" class="lb-exif-camera">
                <svg width="11" height="11" fill="none" stroke="currentColor" stroke-width="1.5" viewBox="0 0 24 24"><path d="M23 19a2 2 0 01-2 2H3a2 2 0 01-2-2V8a2 2 0 012-2h4l2-3h6l2 3h4a2 2 0 012 2z"/><circle cx="12" cy="13" r="4"/></svg>
                {{ currentPhoto.camera }}
              </span>
              <span v-if="currentPhoto.lens" class="lb-exif-lens">{{ currentPhoto.lens }}</span>
            </div>
            <!-- Ligne 2 : réglages + date + dimensions -->
            <div class="lb-exif-row lb-exif-details">
              <div class="lb-exif-settings">
                <span v-if="currentPhoto.aperture" class="lb-exif-value">{{ currentPhoto.aperture }}</span>
                <span v-if="currentPhoto.shutterSpeed" class="lb-exif-value">{{ currentPhoto.shutterSpeed }}</span>
                <span v-if="currentPhoto.iso" class="lb-exif-value">ISO {{ currentPhoto.iso }}</span>
                <span v-if="currentPhoto.focalLength" class="lb-exif-value">{{ currentPhoto.focalLength }}</span>
              </div>
              <div class="lb-exif-right">
                <span v-if="currentPhoto.capturedAt" class="lb-exif-date">{{ formatDate(currentPhoto.capturedAt) }}</span>
                <span v-if="currentPhoto.w && currentPhoto.h" class="lb-exif-dim">{{ currentPhoto.w }} × {{ currentPhoto.h }}</span>
              </div>
            </div>
          </div>
        </div>
      </div>

    </div>
  </Teleport>
</template>

<script setup lang="ts">
import { ref, computed, watch, onMounted, onUnmounted } from 'vue';

interface Photo {
  id: string;
  thumbUrl: string;
  fullUrl: string;
  w?: number;
  h?: number;
  capturedAt?: string;
  description?: string;
  location?: string;
  camera?: string;
  lens?: string;
  aperture?: string;
  shutterSpeed?: string;
  iso?: number;
  focalLength?: string;
}

const props = defineProps<{
  photos: Photo[];
  initialIndex: number;
}>();

const emit = defineEmits<{ (e: 'close'): void }>();

// ── Refs ─────────────────────────────────────────────────────────────────────

const lightboxRef = ref<HTMLElement | null>(null);
const stageRef    = ref<HTMLElement | null>(null);
const currentIndex = ref(props.initialIndex);
const direction    = ref<1 | -1>(1);

// ── Zoom state ────────────────────────────────────────────────────────────────

const scale  = ref(1);
const panX   = ref(0);
const panY   = ref(0);
const isZoomed = computed(() => scale.value > 1.02);

const MAX_SCALE = 5;   // max zoom level

// Clamp pan so the image never reveals empty space beyond stage edges.
// Approximation: treats the stage as fully covered at scale=1.
function clampPan(px: number, py: number, s: number) {
  const el = stageRef.value;
  if (!el) return { x: px, y: py };
  const maxX = (el.clientWidth  * (s - 1)) / 2;
  const maxY = (el.clientHeight * (s - 1)) / 2;
  return {
    x: Math.max(-maxX, Math.min(maxX, px)),
    y: Math.max(-maxY, Math.min(maxY, py)),
  };
}

function resetZoom() {
  scale.value = 1;
  panX.value  = 0;
  panY.value  = 0;
}

// Reset zoom whenever the photo changes
watch(() => currentIndex.value, resetZoom);

// ── Touch state ───────────────────────────────────────────────────────────────

const isTouching     = ref(false);
const touchStartX    = ref(0);
const touchStartY    = ref(0);
const touchDeltaX    = ref(0);
const panStartX      = ref(0);
const panStartY      = ref(0);

const isPinching     = ref(false);
const pinchStartDist = ref(0);
const pinchStartScale = ref(1);
const pinchMidX      = ref(0);  // mid-point of pinch relative to stage center
const pinchMidY      = ref(0);

const lastTapTime    = ref(0);

// ── Combined transform layer ───────────────────────────────────────────────────

const transitionName = computed(() =>
  direction.value === 1 ? 'slide-next' : 'slide-prev'
);
const currentPhoto = computed(() => props.photos[currentIndex.value]);

// ── Progressive loading ───────────────────────────────────────────────────────
// Show the thumb (already in browser cache from the grid) immediately,
// then swap silently to the full-res image once it's downloaded.

const fullLoaded = ref(false);
const displaySrc = computed(() =>
  fullLoaded.value ? currentPhoto.value.fullUrl : currentPhoto.value.thumbUrl
);

watch(
  () => currentIndex.value,
  () => {
    fullLoaded.value = false;
    const img = new Image();
    img.onload = () => { fullLoaded.value = true; };
    img.src = currentPhoto.value.fullUrl;
  },
  { immediate: true },
);

const layerStyle = computed(() => {
  if (isZoomed.value) {
    // Zoom + pan mode
    const live = isPinching.value || isTouching.value;
    return {
      transform: `translate(${panX.value}px, ${panY.value}px) scale(${scale.value})`,
      transition: live ? 'none' : 'transform 0.18s ease',
    };
  }

  // Swipe drag (rubber-band resistance)
  if (isTouching.value && touchDeltaX.value !== 0) {
    let dx = touchDeltaX.value;
    if ((dx > 0 && currentIndex.value === 0) ||
        (dx < 0 && currentIndex.value === props.photos.length - 1)) {
      dx *= 0.2;
    }
    return { transform: `translateX(${dx}px)`, transition: 'none' };
  }

  return {};
});

// ── EXIF helpers ──────────────────────────────────────────────────────────────

const hasExif = computed(() => {
  const p = currentPhoto.value;
  return !!(p.location || p.camera || p.aperture || p.shutterSpeed || p.iso || p.focalLength || p.capturedAt || (p.w && p.h));
});
const hasInfo = computed(() =>
  !!(currentPhoto.value.description || hasExif.value)
);

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('fr-FR', {
    day: 'numeric', month: 'long', year: 'numeric',
  });
}

// ── Navigation ────────────────────────────────────────────────────────────────

function goTo(i: number) {
  if (i === currentIndex.value) return;
  direction.value = i > currentIndex.value ? 1 : -1;
  currentIndex.value = i;
}
function prev() {
  if (currentIndex.value > 0) { direction.value = -1; currentIndex.value--; }
}
function next() {
  if (currentIndex.value < props.photos.length - 1) { direction.value = 1; currentIndex.value++; }
}

// ── Wheel zoom (desktop) ──────────────────────────────────────────────────────

function onWheel(e: WheelEvent) {
  const el = stageRef.value;
  if (!el) return;

  // Zoom factor: ~12% per scroll step
  const factor   = e.deltaY < 0 ? 1.12 : 1 / 1.12;
  const newScale = Math.max(1, Math.min(MAX_SCALE, scale.value * factor));
  if (Math.abs(newScale - scale.value) < 0.001) return;

  // Zoom toward cursor position (relative to stage center)
  const rect  = el.getBoundingClientRect();
  const cx    = e.clientX - rect.left  - rect.width  / 2;
  const cy    = e.clientY - rect.top   - rect.height / 2;

  // Formula: keep the point under cursor fixed during zoom
  const ratio   = newScale / scale.value;
  const newPanX = cx - (cx - panX.value) * ratio;
  const newPanY = cy - (cy - panY.value) * ratio;
  const clamped = clampPan(newPanX, newPanY, newScale);

  scale.value = newScale;
  panX.value  = clamped.x;
  panY.value  = clamped.y;
}

// ── Double-click / double-tap zoom ────────────────────────────────────────────

function zoomToPoint(cx: number, cy: number, targetScale: number) {
  const ratio   = targetScale / scale.value;
  const newPanX = cx - (cx - panX.value) * ratio;
  const newPanY = cy - (cy - panY.value) * ratio;
  const clamped = clampPan(newPanX, newPanY, targetScale);
  scale.value = targetScale;
  panX.value  = clamped.x;
  panY.value  = clamped.y;
}

function onDblClick(e: MouseEvent) {
  if (isZoomed.value) {
    resetZoom();
  } else {
    const el = stageRef.value;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const cx = e.clientX - rect.left  - rect.width  / 2;
    const cy = e.clientY - rect.top   - rect.height / 2;
    zoomToPoint(cx, cy, 2.5);
  }
}

// ── Touch: pinch helpers ──────────────────────────────────────────────────────

function pinchDist(e: TouchEvent): number {
  const dx = e.touches[1].clientX - e.touches[0].clientX;
  const dy = e.touches[1].clientY - e.touches[0].clientY;
  return Math.hypot(dx, dy);
}

function stageMid(e: TouchEvent): { x: number; y: number } {
  const el   = stageRef.value!;
  const rect = el.getBoundingClientRect();
  return {
    x: (e.touches[0].clientX + e.touches[1].clientX) / 2 - rect.left  - rect.width  / 2,
    y: (e.touches[0].clientY + e.touches[1].clientY) / 2 - rect.top   - rect.height / 2,
  };
}

// ── Touch handlers ────────────────────────────────────────────────────────────

function onTouchStart(e: TouchEvent) {
  if (e.touches.length === 2) {
    // Pinch start
    isPinching.value       = true;
    isTouching.value       = false;
    pinchStartDist.value   = pinchDist(e);
    pinchStartScale.value  = scale.value;
    const mid              = stageMid(e);
    pinchMidX.value        = mid.x;
    pinchMidY.value        = mid.y;
    return;
  }

  // Single touch — detect double-tap
  const now = Date.now();
  const tx  = e.touches[0].clientX;
  const ty  = e.touches[0].clientY;

  if (lastTapTime.value > 0 && now - lastTapTime.value < 300) {
    // Double-tap
    lastTapTime.value = 0;
    if (isZoomed.value) {
      resetZoom();
    } else {
      const el   = stageRef.value;
      if (!el) return;
      const rect = el.getBoundingClientRect();
      const cx   = tx - rect.left  - rect.width  / 2;
      const cy   = ty - rect.top   - rect.height / 2;
      zoomToPoint(cx, cy, 2.5);
    }
    return;
  }
  lastTapTime.value = now;

  isTouching.value  = true;
  touchStartX.value = tx;
  touchStartY.value = ty;
  touchDeltaX.value = 0;
  panStartX.value   = panX.value;
  panStartY.value   = panY.value;
}

function onTouchMove(e: TouchEvent) {
  // Prevent browser scroll / native pinch-zoom
  if (e.cancelable) e.preventDefault();

  if (isPinching.value && e.touches.length === 2) {
    const dist     = pinchDist(e);
    const newScale = Math.max(1, Math.min(MAX_SCALE,
      pinchStartScale.value * (dist / pinchStartDist.value)
    ));
    // Zoom toward the original pinch mid-point
    const ratio   = newScale / scale.value;
    const newPanX = pinchMidX.value - (pinchMidX.value - panX.value) * ratio;
    const newPanY = pinchMidY.value - (pinchMidY.value - panY.value) * ratio;
    const clamped = clampPan(newPanX, newPanY, newScale);
    scale.value = newScale;
    panX.value  = clamped.x;
    panY.value  = clamped.y;
    return;
  }

  if (!isTouching.value) return;

  const dx = e.touches[0].clientX - touchStartX.value;
  const dy = e.touches[0].clientY - touchStartY.value;

  if (isZoomed.value) {
    // Pan the image
    const clamped = clampPan(panStartX.value + dx, panStartY.value + dy, scale.value);
    panX.value = clamped.x;
    panY.value = clamped.y;
  } else {
    // Swipe navigation
    touchDeltaX.value = dx;
  }
}

function onTouchEnd() {
  if (isPinching.value) {
    isPinching.value = false;
    if (scale.value < 1.08) resetZoom(); // snap back if barely zoomed
    return;
  }

  if (!isTouching.value) return;
  isTouching.value = false;

  if (!isZoomed.value) {
    const dx        = touchDeltaX.value;
    touchDeltaX.value = 0;
    const threshold = window.innerWidth * 0.2;
    if (dx < -threshold) next();
    else if (dx > threshold) prev();
  }
  touchDeltaX.value = 0;
}

// ── Backdrop click ────────────────────────────────────────────────────────────

function onBackdropClick() {
  if (isZoomed.value) {
    resetZoom();
  } else {
    emit('close');
  }
}

// ── Keyboard ──────────────────────────────────────────────────────────────────

function onKeyDown(e: KeyboardEvent) {
  if (e.key === 'ArrowLeft')  { resetZoom(); prev(); }
  else if (e.key === 'ArrowRight') { resetZoom(); next(); }
  else if (e.key === 'Escape') emit('close');
  else if (e.key === '+' || e.key === '=') {
    // Keyboard zoom in (centered)
    const newScale = Math.min(MAX_SCALE, scale.value * 1.3);
    const clamped  = clampPan(panX.value, panY.value, newScale);
    scale.value    = newScale;
    panX.value     = clamped.x;
    panY.value     = clamped.y;
  }
  else if (e.key === '-') {
    const newScale = Math.max(1, scale.value / 1.3);
    if (newScale <= 1.02) { resetZoom(); return; }
    const clamped = clampPan(panX.value, panY.value, newScale);
    scale.value   = newScale;
    panX.value    = clamped.x;
    panY.value    = clamped.y;
  }
}

onMounted(() => {
  document.addEventListener('keydown', onKeyDown);
  lightboxRef.value?.focus();
  document.body.style.overflow = 'hidden';
});
onUnmounted(() => {
  document.removeEventListener('keydown', onKeyDown);
  document.body.style.overflow = '';
});
</script>

<style scoped>
/* ── Shell ──────────────────────────────────────────────────────────────────── */
.lightbox {
  position: fixed;
  inset: 0;
  z-index: 50;
  background: rgba(4, 4, 4, 0.97);
  display: flex;
  flex-direction: column;
  outline: none;
  touch-action: none; /* we handle all gestures ourselves */
}

/* ── Stage ──────────────────────────────────────────────────────────────────── */
.lb-stage {
  flex: 1;
  min-height: 0;
  position: relative;
  overflow: hidden;
  cursor: default;
}
.lb-stage.is-zoomed         { cursor: grab; }
.lb-stage.is-zoomed:active  { cursor: grabbing; }

/* Transform layer: handles both swipe drag and zoom+pan */
.lb-transform-layer {
  position: absolute;
  inset: 0;
  transform-origin: center center;
  /* Default smooth spring back after swipe release */
  transition: transform 0.35s cubic-bezier(0.4, 0, 0.2, 1);
  will-change: transform;
}

.lb-frame {
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 56px 88px 20px;
}

.lb-img {
  max-width: 100%;
  max-height: 100%;
  object-fit: contain;
  user-select: none;
  -webkit-user-drag: none;
  image-rendering: auto;
  transition: filter 0.3s ease;
}
/* Thumb is blurred slightly while the full-res loads */
.lb-img--loading {
  filter: blur(8px);
  transform: scale(1.02); /* hide blur edge artefacts */
}

/* ── Slide transitions ──────────────────────────────────────────────────────── */
.slide-next-enter-from  { transform: translateX(100%); }
.slide-next-leave-to    { transform: translateX(-100%); }
.slide-prev-enter-from  { transform: translateX(-100%); }
.slide-prev-leave-to    { transform: translateX(100%); }

.slide-next-enter-active,
.slide-next-leave-active,
.slide-prev-enter-active,
.slide-prev-leave-active {
  transition: transform 0.42s cubic-bezier(0.4, 0, 0.2, 1);
}

/* ── Bottom bar — fixed height, never changes ───────────────────────────────── */
.lb-bottom {
  flex-shrink: 0;
  height: 100px;
  overflow: hidden;
  background: rgba(4, 4, 4, 0.97);
  border-top: 1px solid rgba(255, 255, 255, 0.05);
  padding: 10px 96px 12px;
  display: flex;
  flex-direction: column;
  gap: 6px;
  transition: opacity 0.2s ease;
}
.lb-bottom.is-zoomed {
  opacity: 0;
  pointer-events: none;
}

/* ── Dots ───────────────────────────────────────────────────────────────────── */
.lb-dots {
  display: flex;
  justify-content: center;
  gap: 6px;
  align-items: center;
}
.lb-dot {
  width: 5px; height: 5px;
  border-radius: 50%;
  background: rgba(255,255,255,0.18);
  border: none; padding: 0;
  cursor: pointer;
  transition: background 0.2s, transform 0.2s;
}
.lb-dot.active { background: white; transform: scale(1.3); }
.lb-dot:hover  { background: rgba(255,255,255,0.5); }

/* ── Info: always in DOM, opacity-only transition ───────────────────────────── */
.lb-info {
  display: flex;
  flex-direction: column;
  gap: 4px;
  transition: opacity 0.2s ease;
}
.lb-desc {
  font-size: 12px;
  color: rgba(255, 255, 255, 0.6);
  font-style: italic;
  line-height: 1.4;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.lb-exif {
  display: flex;
  flex-direction: column;
  gap: 4px;
  overflow: hidden;
}
.lb-exif-row {
  display: flex;
  align-items: center;
  gap: 10px;
  overflow: hidden;
}

/* Ligne 1 : équipement */
.lb-exif-equipment { gap: 8px; }
.lb-exif-location {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  font-size: 11px;
  color: rgba(255, 255, 255, 0.4);
  white-space: nowrap;
  flex-shrink: 0;
}
.lb-exif-camera {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  font-size: 11px;
  color: rgba(255, 255, 255, 0.55);
  white-space: nowrap;
  flex-shrink: 0;
}
.lb-exif-camera svg { flex-shrink: 0; }
.lb-exif-lens {
  font-size: 11px;
  color: rgba(255, 255, 255, 0.32);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

/* Ligne 2 : réglages + date/dimensions */
.lb-exif-details {
  justify-content: space-between;
}
.lb-exif-settings {
  display: flex;
  align-items: center;
  gap: 10px;
}
.lb-exif-value {
  font-size: 11px;
  letter-spacing: 0.05em;
  color: rgba(255, 255, 255, 0.32);
  white-space: nowrap;
}
.lb-exif-right {
  display: flex;
  align-items: center;
  gap: 10px;
  flex-shrink: 0;
}
.lb-exif-date {
  font-size: 10px;
  color: rgba(255, 255, 255, 0.22);
  white-space: nowrap;
}
.lb-exif-dim {
  font-size: 10px;
  letter-spacing: 0.04em;
  color: rgba(255, 255, 255, 0.18);
  white-space: nowrap;
}

/* ── Zoom badge ─────────────────────────────────────────────────────────────── */
.lb-zoom-badge {
  position: absolute;
  bottom: 112px;
  right: 20px;
  z-index: 20;
  font-size: 10px;
  letter-spacing: 0.1em;
  color: rgba(255, 255, 255, 0.35);
  background: rgba(0, 0, 0, 0.4);
  padding: 3px 7px;
  border-radius: 10px;
  pointer-events: none;
  backdrop-filter: blur(4px);
}
.zoom-fade-enter-active { transition: opacity 0.2s ease; }
.zoom-fade-leave-active { transition: opacity 0.3s ease; }
.zoom-fade-enter-from,
.zoom-fade-leave-to     { opacity: 0; }

/* ── Floating controls ──────────────────────────────────────────────────────── */
.lb-close {
  position: absolute;
  top: 12px; right: 12px;
  z-index: 200;
  padding: 16px;
  color: rgba(255,255,255,0.45);
  background: none; border: none;
  cursor: pointer;
  transition: color 0.15s;
  line-height: 0;
  pointer-events: auto;
}
.lb-close:hover { color: white; }

.lb-counter {
  position: absolute;
  top: 24px; left: 50%;
  transform: translateX(-50%);
  z-index: 20;
  font-size: 11px;
  letter-spacing: 0.12em;
  color: rgba(255,255,255,0.28);
  pointer-events: none;
}
.lb-counter-sep { margin: 0 4px; opacity: 0.4; }

.lb-nav {
  position: absolute;
  top: 0; bottom: 100px;
  z-index: 20;
  display: flex;
  align-items: center;
  padding: 0 16px;
  color: rgba(255,255,255,0.3);
  background: none; border: none;
  cursor: pointer;
  transition: color 0.15s;
  line-height: 0;
}
.lb-nav:hover  { color: white; }
.lb-nav-prev   { left: 0; }
.lb-nav-next   { right: 0; }

/* ── Mobile ─────────────────────────────────────────────────────────────────── */
@media (max-width: 768px) {
  .lb-frame  { padding: 40px 12px 12px; }
  .lb-bottom { padding: 10px 20px 12px; height: 96px; }
  .lb-nav    { display: none; }
  .lb-zoom-badge { bottom: 108px; }
}
</style>
