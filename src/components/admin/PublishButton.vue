<template>
  <div class="pb-wrap">

    <!-- Idle -->
    <div v-if="phase === 'idle'" class="pb-row">
      <button @click="publish" class="pb-btn">
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
          <path d="M22 2L11 13"/><path d="M22 2L15 22 11 13 2 9l20-7z"/>
        </svg>
        Publier le site
      </button>
    </div>

    <!-- Triggering (waiting for build hook response) -->
    <div v-else-if="phase === 'triggering'" class="pb-row">
      <svg class="pb-spinner" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">
        <path d="M21 12a9 9 0 1 1-6.219-8.56"/>
      </svg>
      <span class="pb-triggering-label">Déclenchement…</span>
    </div>

    <!-- Polling — real progress -->
    <div v-else-if="phase === 'polling'" class="pb-progress-wrap">
      <div class="pb-progress-head">
        <span class="pb-state-label">{{ stateLabel }}</span>
        <span class="pb-elapsed">{{ elapsedText }}</span>
      </div>
      <div class="pb-bar-track">
        <div class="pb-bar-fill" :style="{ width: progress + '%' }" />
      </div>
    </div>

    <!-- Error -->
    <div v-else-if="phase === 'error'" class="pb-row">
      <span class="pb-feedback pb-feedback--err">
        <svg width="12" height="12" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24" aria-hidden="true"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
        Échec du déploiement
      </span>
      <button @click="reset" class="pb-reset-btn">Réessayer</button>
    </div>

    <!-- Mock (build hook not configured) -->
    <div v-if="phase === 'mock'" class="pb-notice">
      <svg class="pb-notice-icon" width="13" height="13" fill="none" stroke="currentColor" stroke-width="1.8" viewBox="0 0 24 24" aria-hidden="true">
        <path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/>
        <line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/>
      </svg>
      <span>
        <strong>Webhook non configuré</strong> — le site n'a pas été republié.<br/>
        Configure <code class="pb-code">CF_PAGES_BUILD_HOOK</code> dans les variables d'environnement.
        <button @click="reset" class="pb-inline-reset">Fermer</button>
      </span>
    </div>

  </div>

  <!-- Toast succès -->
  <Transition name="pb-toast">
    <div v-if="toastVisible" class="pb-toast">
      <div class="pb-toast-content">
        <svg width="12" height="12" fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24" aria-hidden="true"><polyline points="20 6 9 17 4 12"/></svg>
        Site mis à jour
      </div>
      <div class="pb-toast-bar-track">
        <div class="pb-toast-bar-fill" :style="{ width: toastBarWidth + '%' }" />
      </div>
    </div>
  </Transition>

</template>

<script setup lang="ts">
import { ref, computed, onUnmounted } from 'vue';

type Phase = 'idle' | 'triggering' | 'polling' | 'error' | 'mock';

// Netlify deploy state → progress bar %
const STATE_PROGRESS: Record<string, number> = {
  enqueued:   5,
  building:   10, // animates up to 58 during this phase
  uploading:  65,
  uploaded:   75,
  processing: 85,
  ready:      100,
};

const STATE_LABELS: Record<string, string> = {
  enqueued:   'En file d\'attente…',
  building:   'Construction…',
  uploading:  'Upload en cours…',
  uploaded:   'Upload terminé…',
  processing: 'Traitement…',
  ready:      'Prêt !',
  unknown:    'En attente…',
};

const BUILD_PHASE_CAP = 58; // % max pendant la phase "building"
const DRIFT_PER_SEC   = 0.12; // progression lente pendant "building"

const phase        = ref<Phase>('idle');
const progress     = ref(0);
const deployState  = ref('');
const elapsedSec   = ref(0);
const toastVisible = ref(false);
const toastBarWidth = ref(100);

let pollTimer:    ReturnType<typeof setInterval> | null = null;
let driftTimer:   ReturnType<typeof setInterval> | null = null;
let elapsedTimer: ReturnType<typeof setInterval> | null = null;
let triggerTime   = '';

const stateLabel = computed(() =>
  STATE_LABELS[deployState.value] ?? 'En attente…'
);

const elapsedText = computed(() => {
  const m = Math.floor(elapsedSec.value / 60);
  const s = elapsedSec.value % 60;
  return m > 0
    ? `${m}m${String(s).padStart(2, '0')}s`
    : `${s}s`;
});

function clearTimers() {
  if (pollTimer)    { clearInterval(pollTimer);    pollTimer    = null; }
  if (driftTimer)   { clearInterval(driftTimer);   driftTimer   = null; }
  if (elapsedTimer) { clearInterval(elapsedTimer); elapsedTimer = null; }
}

function reset() {
  clearTimers();
  phase.value       = 'idle';
  progress.value    = 0;
  deployState.value = '';
  elapsedSec.value  = 0;
}

function triggerToast() {
  toastVisible.value  = true;
  toastBarWidth.value = 100;
  // Double rAF pour que la transition CSS parte après le premier rendu
  requestAnimationFrame(() => requestAnimationFrame(() => {
    toastBarWidth.value = 0;
  }));
  setTimeout(() => {
    toastVisible.value = false;
    reset();
  }, 3400);
}

function startElapsedTimer() {
  elapsedSec.value = 0;
  elapsedTimer = setInterval(() => { elapsedSec.value++; }, 1000);
}

function startDrift() {
  if (driftTimer) return;
  driftTimer = setInterval(() => {
    if (deployState.value === 'building' && progress.value < BUILD_PHASE_CAP) {
      progress.value = Math.min(BUILD_PHASE_CAP, progress.value + DRIFT_PER_SEC);
    } else if (deployState.value !== 'building') {
      clearInterval(driftTimer!);
      driftTimer = null;
    }
  }, 1000);
}

function applyState(state: string) {
  deployState.value = state;
  const target = STATE_PROGRESS[state];

  if (state === 'building') {
    if (progress.value < STATE_PROGRESS.building) {
      progress.value = STATE_PROGRESS.building;
    }
    startDrift();
  } else if (target !== undefined) {
    progress.value = Math.max(progress.value, target);
  }
}

async function poll() {
  try {
    const res = await fetch(`/api/deploy-status?since=${encodeURIComponent(triggerTime)}`);
    const data = await res.json();

    if (!data.configured) {
      // Pas de variables Netlify → on ne peut pas tracker
      return;
    }

    applyState(data.state);

    if (data.state === 'ready') {
      progress.value = 100;
      clearTimers();
      setTimeout(() => { triggerToast(); }, 600);
    } else if (data.state === 'error') {
      clearTimers();
      phase.value = 'error';
    }
  } catch {
    // Erreur réseau — on continue de poller
  }
}

async function publish() {
  phase.value    = 'triggering';
  progress.value = 0;

  try {
    const res = await fetch('/api/publish', { method: 'POST' });
    if (!res.ok) throw new Error();
    const data = await res.json();

    if (data.mock) {
      phase.value = 'mock';
      return;
    }

    // Build hook déclenché — on commence à tracker
    triggerTime = new Date().toISOString();
    phase.value = 'polling';
    applyState('enqueued');
    startElapsedTimer();

    // Première poll après 4s (laisser le temps à Netlify de créer le deploy)
    setTimeout(async () => {
      await poll();
      pollTimer = setInterval(poll, 5000);
    }, 4000);

  } catch {
    phase.value = 'error';
  }
}

onUnmounted(clearTimers);
</script>

<style scoped>
.pb-wrap {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.pb-row {
  display: flex;
  align-items: center;
  gap: 10px;
  flex-wrap: wrap;
}

/* Button */
.pb-btn {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  padding: 7px 14px;
  background: #0c0c0c;
  color: #fff;
  border: none;
  border-radius: 4px;
  font-size: 12px;
  font-weight: 500;
  font-family: 'Inter', sans-serif;
  letter-spacing: 0.02em;
  cursor: pointer;
  transition: opacity 0.15s;
  white-space: nowrap;
}
.pb-btn:hover { opacity: 0.8; }

/* Triggering */
.pb-triggering-label {
  font-size: 12px;
  color: #909090;
  font-family: 'Inter', sans-serif;
}

/* Progress */
.pb-progress-wrap {
  display: flex;
  flex-direction: column;
  gap: 6px;
  width: 100%;
}
.pb-progress-head {
  display: flex;
  justify-content: space-between;
  align-items: baseline;
}
.pb-state-label {
  font-size: 11.5px;
  color: #606060;
  font-family: 'Inter', sans-serif;
  letter-spacing: 0.01em;
}
.pb-elapsed {
  font-size: 10.5px;
  color: #b0b0aa;
  font-family: 'Inter', monospace;
  letter-spacing: 0.04em;
}
.pb-bar-track {
  width: 100%;
  height: 3px;
  background: #e6e6e3;
  border-radius: 2px;
  overflow: hidden;
}
.pb-bar-fill {
  height: 100%;
  background: #0c0c0c;
  border-radius: 2px;
  transition: width 0.8s ease;
}

/* Feedback */
.pb-feedback {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  font-size: 12px;
  font-family: 'Inter', sans-serif;
}
.pb-feedback--ok  { color: #38a169; }
.pb-feedback--err { color: #e53e3e; }

.pb-reset-btn {
  background: none;
  border: none;
  font-size: 11px;
  color: #909090;
  font-family: 'Inter', sans-serif;
  cursor: pointer;
  padding: 0;
  text-decoration: underline;
  text-underline-offset: 2px;
}
.pb-reset-btn:hover { color: #0c0c0c; }

/* Spinner */
@keyframes pb-spin { to { transform: rotate(360deg); } }
.pb-spinner {
  animation: pb-spin 0.75s linear infinite;
  flex-shrink: 0;
  color: #909090;
}

/* Toast */
.pb-toast {
  position: fixed;
  bottom: 24px;
  right: 24px;
  background: #0c0c0c;
  color: #fff;
  border-radius: 4px;
  overflow: hidden;
  z-index: 60;
  min-width: 160px;
  box-shadow: 0 4px 16px rgba(0,0,0,0.2);
}
.pb-toast-content {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 10px 16px 8px;
  font-size: 12px;
  font-family: 'Inter', sans-serif;
  letter-spacing: 0.02em;
  color: #fff;
}
.pb-toast-bar-track {
  height: 2px;
  background: rgba(255,255,255,0.15);
}
.pb-toast-bar-fill {
  height: 100%;
  background: #6ee7b7;
  transition: width 3s linear;
}
.pb-toast-enter-active { transition: opacity 0.2s, transform 0.2s; }
.pb-toast-leave-active { transition: opacity 0.25s, transform 0.25s; }
.pb-toast-enter-from  { opacity: 0; transform: translateY(6px); }
.pb-toast-leave-to    { opacity: 0; transform: translateY(6px); }

/* Mock notice */
.pb-notice {
  display: flex;
  align-items: flex-start;
  gap: 10px;
  background: #fffbeb;
  border: 1px solid #f6d860;
  border-radius: 4px;
  padding: 10px 14px;
  font-size: 11.5px;
  color: #78610a;
  line-height: 1.6;
}
.pb-notice-icon { flex-shrink: 0; margin-top: 2px; color: #b8860b; }
.pb-code {
  background: #fef3c7;
  padding: 1px 5px;
  border-radius: 3px;
  font-family: 'Inter', monospace;
  font-size: 10.5px;
}
.pb-inline-reset {
  background: none;
  border: none;
  font-size: 11px;
  color: #78610a;
  font-family: 'Inter', sans-serif;
  cursor: pointer;
  padding: 0;
  margin-left: 6px;
  text-decoration: underline;
  text-underline-offset: 2px;
}
</style>
