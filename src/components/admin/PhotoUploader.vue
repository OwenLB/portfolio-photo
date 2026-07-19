<template>
  <div
    class="uploader"
    :class="isDragging ? 'uploader--active' : ''"
    @dragenter.prevent="isDragging = true"
    @dragover.prevent
    @dragleave.prevent="isDragging = false"
    @drop.prevent="onDrop"
  >
    <!-- Drop zone -->
    <div class="uploader-zone">
      <svg class="uploader-icon" width="22" height="22" fill="none" stroke="currentColor" stroke-width="1.25" viewBox="0 0 24 24" aria-hidden="true">
        <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/>
        <polyline points="17 8 12 3 7 8"/>
        <line x1="12" y1="3" x2="12" y2="15"/>
      </svg>
      <p class="uploader-label">
        Déposez des fichiers ici ou
        <button type="button" @click="fileInput?.click()" class="uploader-browse">parcourir</button>
      </p>
      <p class="uploader-hint">JPG · PNG · WEBP — 20 Mo max par fichier</p>
      <input
        ref="fileInput"
        type="file"
        accept="image/jpeg,image/png,image/webp"
        multiple
        class="sr-only"
        @change="onFileSelect"
      />
    </div>

    <!-- Upload list -->
    <div v-if="uploads.length > 0" class="uploader-list">
      <div v-for="upload in uploads" :key="upload.id" class="uploader-item">
        <div class="uploader-thumb">
          <img v-if="upload.preview" :src="upload.preview" alt="" class="uploader-thumb-img" />
        </div>
        <div class="uploader-item-body">
          <div class="uploader-filename">{{ upload.filename }}</div>
          <div class="uploader-bar-track">
            <div
              class="uploader-bar-fill"
              :class="upload.status === 'error' ? 'uploader-bar-fill--error' : ''"
              :style="{ width: upload.progress + '%' }"
            />
          </div>
        </div>
        <div class="uploader-item-end">
          <span
            class="uploader-status"
            :class="{
              'uploader-status--done': upload.status === 'done',
              'uploader-status--error': upload.status === 'error',
              'uploader-status--uploading': upload.status === 'uploading',
            }"
          >
            <template v-if="upload.status === 'done'">
              <svg width="12" height="12" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><polyline points="20 6 9 17 4 12"/></svg>
            </template>
            <template v-else-if="upload.status === 'error'">
              <svg width="12" height="12" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
            </template>
            <template v-else>{{ upload.progress }}%</template>
          </span>
          <button
            v-if="upload.status !== 'uploading'"
            @click="removeUpload(upload.id)"
            class="uploader-remove"
            title="Retirer"
          >
            <svg width="11" height="11" fill="none" stroke="currentColor" stroke-width="1.8" viewBox="0 0 24 24"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
          </button>
        </div>
      </div>
    </div>

    <!-- Validate -->
    <div v-if="canValidate" class="uploader-footer">
      <span class="uploader-footer-info">
        {{ completedPhotos.length }} photo{{ completedPhotos.length > 1 ? 's' : '' }} prête{{ completedPhotos.length > 1 ? 's' : '' }}
        <template v-if="uploads.some(u => u.status === 'error')">
          · {{ uploads.filter(u => u.status === 'error').length }} erreur{{ uploads.filter(u => u.status === 'error').length > 1 ? 's' : '' }}
        </template>
      </span>
      <button type="button" @click="validate" class="uploader-validate">
        Ajouter à l'album
        <svg width="11" height="11" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><polyline points="9 18 15 12 9 6"/></svg>
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue';
import exifr from 'exifr';

interface UploadItem {
  id: string;
  filename: string;
  preview: string | null;
  progress: number;
  status: 'uploading' | 'done' | 'error';
}

const props = defineProps<{ slug: string }>();
const emit = defineEmits<{ (e: 'uploaded', photos: any[]): void }>();

const fileInput = ref<HTMLInputElement | null>(null);
const isDragging = ref(false);
const uploads = ref<UploadItem[]>([]);
const completedPhotos = ref<any[]>([]);

const allDone = computed(() =>
  uploads.value.length > 0 && uploads.value.every(u => u.status !== 'uploading'),
);
const canValidate = computed(() => allDone.value && completedPhotos.value.length > 0);

function getReactiveItem(id: string): UploadItem | undefined {
  return uploads.value.find(u => u.id === id);
}

function removeUpload(id: string) {
  uploads.value = uploads.value.filter(u => u.id !== id);
  completedPhotos.value = completedPhotos.value.filter((p: any) => p.id !== id);
}

function validate() {
  emit('uploaded', completedPhotos.value);
  uploads.value = [];
  completedPhotos.value = [];
}

function onDrop(e: DragEvent) {
  isDragging.value = false;
  const files = Array.from(e.dataTransfer?.files || []).filter(f => f.type.startsWith('image/'));
  processFiles(files);
}

function onFileSelect(e: Event) {
  const input = e.target as HTMLInputElement;
  processFiles(Array.from(input.files || []));
  input.value = '';
}

async function getImageDimensions(file: File): Promise<{ w: number; h: number }> {
  return new Promise(resolve => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => { resolve({ w: img.naturalWidth, h: img.naturalHeight }); URL.revokeObjectURL(url); };
    img.src = url;
  });
}

async function readExif(file: File): Promise<Record<string, any>> {
  const exif = await exifr.parse(file, {
    tiff: true, exif: true, gps: true,
    pick: ['Make', 'Model', 'LensModel', 'FNumber', 'ExposureTime', 'ISO', 'FocalLength', 'DateTimeOriginal'],
  }).catch(() => null);

  if (!exif) return {};

  const gps = await exifr.gps(file).catch(() => null);

  const make  = exif.Make  ? String(exif.Make).trim()  : '';
  const model = exif.Model ? String(exif.Model).trim() : '';
  const camera = (model.toLowerCase().startsWith(make.toLowerCase()) ? model : [make, model].filter(Boolean).join(' ')) || undefined;

  let shutterSpeed: string | undefined;
  if (exif.ExposureTime) {
    const t = Number(exif.ExposureTime);
    shutterSpeed = t >= 0.5 ? `${t}s` : `1/${Math.round(1 / t)}s`;
  }

  let capturedAt: string | undefined;
  if (exif.DateTimeOriginal instanceof Date) capturedAt = exif.DateTimeOriginal.toISOString();

  return {
    camera,
    lens:        exif.LensModel   ? String(exif.LensModel)                    : undefined,
    aperture:    exif.FNumber     ? `f/${exif.FNumber}`                        : undefined,
    shutterSpeed,
    iso:         exif.ISO         ? Number(exif.ISO)                           : undefined,
    focalLength: exif.FocalLength ? `${Math.round(Number(exif.FocalLength))}mm` : undefined,
    capturedAt,
    geoLat: gps?.latitude  ? Math.round(gps.latitude  * 10000) / 10000 : undefined,
    geoLng: gps?.longitude ? Math.round(gps.longitude * 10000) / 10000 : undefined,
  };
}

function generateId(): string {
  return 'img' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
}

async function processFiles(files: File[]) {
  const MAX_CONCURRENT = 5;
  const newItems: UploadItem[] = files.map(f => ({
    id: generateId(),
    filename: f.name,
    preview: URL.createObjectURL(f),
    progress: 0,
    status: 'uploading' as const,
  }));
  uploads.value.push(...newItems);

  for (let i = 0; i < files.length; i += MAX_CONCURRENT) {
    const chunk = files.slice(i, i + MAX_CONCURRENT);
    const chunkIds = newItems.slice(i, i + MAX_CONCURRENT).map(it => it.id);

    await Promise.all(chunk.map(async (file, fi) => {
      const id = chunkIds[fi];
      try {
        const [{ w, h }, presignRes, exifData] = await Promise.all([
          getImageDimensions(file),
          fetch(`/api/presign?album=${props.slug}&filename=${encodeURIComponent(file.name)}&contentType=${encodeURIComponent(file.type || 'application/octet-stream')}`),
          readExif(file),
        ]);

        if (!presignRes.ok) throw new Error('Presign failed');
        const { url: presignedUrl, publicUrl } = await presignRes.json();

        await uploadWithProgress(file, presignedUrl, (p) => {
          const it = getReactiveItem(id);
          if (it) it.progress = p;
        });

        const it = getReactiveItem(id);
        if (it) { it.progress = 100; it.status = 'done'; }

        let thumbUrl: string;
        let fullUrl: string;
        if (publicUrl) {
          const u = new URL(publicUrl);
          thumbUrl = `${u.origin}/cdn-cgi/image/width=1200,quality=78,format=webp${u.pathname}`;
          fullUrl  = `${u.origin}/cdn-cgi/image/width=4000,quality=90,format=webp${u.pathname}`;
        } else {
          const raw = presignedUrl.split('?')[0];
          thumbUrl = raw;
          fullUrl  = raw;
        }

        completedPhotos.value.push({
          id,
          filename: file.name,
          w, h,
          order: 0,
          visible: true,
          ...exifData,
          thumbUrl,
          fullUrl,
        });
      } catch (err) {
        console.error(`[PhotoUploader] Upload failed for ${file.name}:`, err);
        const it = getReactiveItem(id);
        if (it) it.status = 'error';
      }
    }));
  }
}

async function uploadWithProgress(file: File, url: string, onProgress: (p: number) => void): Promise<void> {
  if (url.includes('mock-presign')) {
    for (let p = 0; p <= 100; p += 10) { onProgress(p); await new Promise(r => setTimeout(r, 120)); }
    return;
  }
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open('PUT', url);
    xhr.setRequestHeader('Content-Type', file.type);

    let realProgressFired = false;
    let simulated = 0;
    const sim = setInterval(() => {
      if (!realProgressFired && simulated < 85) {
        simulated = Math.min(85, simulated + 4);
        onProgress(simulated);
      }
    }, 150);

    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable) {
        realProgressFired = true;
        clearInterval(sim);
        onProgress(Math.round((e.loaded / e.total) * 100));
      }
    };
    xhr.onload = () => {
      clearInterval(sim);
      xhr.status < 300 ? resolve() : reject(new Error(`HTTP ${xhr.status}`));
    };
    xhr.onerror = () => { clearInterval(sim); reject(new Error('Network error')); };
    xhr.send(file);
  });
}
</script>

<style scoped>
.uploader {
  border: 1px solid #e6e6e3;
  background: #fff;
  transition: border-color 0.15s;
}
.uploader--active {
  border-color: #a0a09c;
  background: #fafaf8;
}

/* Drop zone */
.uploader-zone {
  padding: 32px 24px;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
  text-align: center;
}
.uploader-icon {
  color: #b0b0aa;
  margin-bottom: 4px;
}
.uploader-label {
  font-size: 13px;
  color: #5a5a55;
  margin: 0;
  line-height: 1.5;
}
.uploader-browse {
  background: none;
  border: none;
  padding: 0;
  font-size: 13px;
  color: #0c0c0c;
  text-decoration: underline;
  text-underline-offset: 2px;
  cursor: pointer;
  font-family: inherit;
}
.uploader-browse:hover { opacity: 0.65; }
.uploader-hint {
  font-size: 11px;
  color: #b0b0aa;
  letter-spacing: 0.04em;
  margin: 0;
}

/* List */
.uploader-list {
  border-top: 1px solid #e6e6e3;
}
.uploader-item {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 10px 16px;
  border-bottom: 1px solid #f0f0ec;
}
.uploader-item:last-child { border-bottom: none; }

.uploader-thumb {
  width: 36px;
  height: 36px;
  background: #f0f0ec;
  flex-shrink: 0;
  overflow: hidden;
}
.uploader-thumb-img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.uploader-item-body {
  flex: 1;
  min-width: 0;
}
.uploader-filename {
  font-size: 12px;
  color: #404040;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  margin-bottom: 6px;
  font-family: 'Inter', sans-serif;
  letter-spacing: 0.01em;
}
.uploader-bar-track {
  height: 2px;
  background: #ebebea;
  border-radius: 1px;
  overflow: hidden;
}
.uploader-bar-fill {
  height: 100%;
  background: #0c0c0c;
  border-radius: 1px;
  transition: width 0.35s ease-out;
}
.uploader-bar-fill--error { background: #e53e3e; }

.uploader-item-end {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-shrink: 0;
}
.uploader-status {
  font-size: 11px;
  min-width: 28px;
  text-align: right;
  display: flex;
  align-items: center;
  justify-content: flex-end;
}
.uploader-status--uploading { color: #a0a09c; }
.uploader-status--done      { color: #38a169; }
.uploader-status--error     { color: #e53e3e; }

.uploader-remove {
  background: none;
  border: none;
  padding: 4px;
  cursor: pointer;
  color: #c8c8c4;
  line-height: 0;
  transition: color 0.15s;
}
.uploader-remove:hover { color: #e53e3e; }

/* Footer */
.uploader-footer {
  border-top: 1px solid #e6e6e3;
  padding: 10px 16px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  background: #fafaf8;
}
.uploader-footer-info {
  font-size: 11px;
  color: #909090;
  letter-spacing: 0.02em;
}
.uploader-validate {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 6px 14px;
  background: #0c0c0c;
  color: #fff;
  border: none;
  font-size: 12px;
  font-weight: 500;
  font-family: 'Inter', sans-serif;
  letter-spacing: 0.02em;
  cursor: pointer;
  transition: opacity 0.15s;
}
.uploader-validate:hover { opacity: 0.8; }
</style>
