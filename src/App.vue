<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from "vue";
import { useAppStore } from "./state/store";
import { cancelGeneration, downloadOutput, retryGeneration, submitGeneration } from "./network/jobManager";
import { getProxyBaseUrl } from "./network/openaiClient";

const store = useAppStore();
const durations = [4, 8, 12];
const providers = [{ id: "openai-sora", label: "OpenAI Sora 2" }];
const baseResolutions = [
  { label: "1280×720 (landscape)", width: 1280, height: 720 },
  { label: "720×1280 (portrait)", width: 720, height: 1280 },
];
const proResolutions = [
  { label: "1792×1024 (landscape)", width: 1792, height: 1024 },
  { label: "1024×1792 (portrait)", width: 1024, height: 1792 },
];
const models = [
  { id: "sora-2", label: "Sora 2" },
  { id: "sora-2-pro", label: "Sora 2 Pro" },
];

const activeCount = computed(() => store.activeCount.value);
const historyCount = computed(() => store.history.value.length);
const hasApiKey = computed(() => store.hasApiKey.value);
const apiKeySource = computed(() => store.state.apiKeySource);
const proxyEnabled = Boolean(getProxyBaseUrl());
const showKeyPanel = ref(false);
const keyDraft = ref("");
const rememberKey = ref(false);
const promptRef = ref<HTMLTextAreaElement | null>(null);
const promptDraft = computed({
  get: () => store.state.promptDraft,
  set: (value) => store.setPromptDraft(value),
});
const durationSec = computed({
  get: () => store.state.settings.durationSec,
  set: (value) => store.setDurationSec(value),
});
const modelId = computed({
  get: () => store.state.settings.modelId,
  set: (value) => store.setModelId(value),
});
const providerId = computed({
  get: () => store.state.settings.providerId,
  set: (value) => store.setProviderId(value),
});
const availableResolutions = computed(() =>
  modelId.value === "sora-2-pro"
    ? [...baseResolutions, ...proResolutions]
    : baseResolutions,
);
const resolutionKey = computed({
  get: () =>
    `${store.state.settings.resolution.width}x${store.state.settings.resolution.height}`,
  set: (value) => {
    const match = availableResolutions.value.find(
      (resolution) => `${resolution.width}x${resolution.height}` === value,
    );
    if (match) {
      store.setResolution(match);
    }
  },
});
const queue = computed(() => store.queue.value);
const history = computed(() => store.history.value);
const canGenerate = computed(
  () => Boolean(promptDraft.value.trim()) && (hasApiKey.value || proxyEnabled),
);
const canClearHistory = computed(() => history.value.length > 0);

async function handleGenerate() {
  if (!canGenerate.value) return;
  await submitGeneration(store);
}

async function handleDownload(outputId: string) {
  const filename = `renderkit-${outputId}.mp4`;
  await downloadOutput(outputId, filename);
}

async function handleRetry(jobId: string) {
  const job = store.state.jobs.find((item) => item.id === jobId);
  if (!job) return;
  await retryGeneration(store, job);
}

async function handleCancel(jobId: string) {
  const job = store.state.jobs.find((item) => item.id === jobId);
  if (!job) return;
  await cancelGeneration(store, job);
}

function handleClearHistory() {
  if (!canClearHistory.value) return;
  store.clearHistory();
}

function toggleKeyPanel() {
  showKeyPanel.value = !showKeyPanel.value;
  if (showKeyPanel.value) {
    keyDraft.value = "";
    rememberKey.value = false;
  }
}

function saveLocalKey() {
  store.setApiKey(keyDraft.value, rememberKey.value);
  showKeyPanel.value = false;
}

function clearLocalKey() {
  store.setApiKey(null);
}

function handleKeydown(event: KeyboardEvent) {
  const isMeta = event.metaKey || event.ctrlKey;
  if (isMeta && event.key.toLowerCase() === "k") {
    event.preventDefault();
    promptRef.value?.focus();
  }
  if (isMeta && event.key === "Enter") {
    event.preventDefault();
    void handleGenerate();
  }
  if (isMeta && event.key.toLowerCase() === "l") {
    event.preventDefault();
    toggleKeyPanel();
  }
  if (event.key === "Escape" && showKeyPanel.value) {
    showKeyPanel.value = false;
  }
}

watch(modelId, () => {
  const currentKey = resolutionKey.value;
  const match = availableResolutions.value.find(
    (resolution) => `${resolution.width}x${resolution.height}` === currentKey,
  );
  if (!match) {
    store.setResolution(availableResolutions.value[0]);
  }
});

onMounted(() => {
  window.addEventListener("keydown", handleKeydown);
});

onBeforeUnmount(() => {
  window.removeEventListener("keydown", handleKeydown);
});
</script>

<template>
  <div class="app">
    <header class="topbar">
      <div class="brand">renderkit</div>
      <div class="status">
        <select v-model="providerId" class="control pill-select">
          <option v-for="provider in providers" :key="provider.id" :value="provider.id">
            {{ provider.label }}
          </option>
        </select>
        <button class="ghost" type="button" @click="toggleKeyPanel">
          {{
            hasApiKey
              ? apiKeySource === "env"
                ? "Key loaded (env)"
                : apiKeySource === "local"
                  ? "Key saved (local)"
                  : "Key saved (session)"
              : proxyEnabled
                ? "Proxy enabled"
                : "Add API key"
          }}
        </button>
      </div>
    </header>
    <section v-if="showKeyPanel" class="panel key-panel">
      <div class="panel-header">
        <h2>API Key</h2>
        <span class="hint">Stored in this browser (session by default)</span>
      </div>
      <div class="field">
        <label>OpenAI API key</label>
        <input
          v-model="keyDraft"
          class="control"
          type="password"
          placeholder="sk-..."
        />
      </div>
      <label class="checkbox">
        <input v-model="rememberKey" type="checkbox" />
        Remember on this device (localStorage)
      </label>
      <div class="actions">
        <button class="ghost" type="button" @click="clearLocalKey">Clear local</button>
        <button class="primary" type="button" :disabled="!keyDraft.trim()" @click="saveLocalKey">
          Save key
        </button>
      </div>
    </section>
    <main class="grid">
      <section class="panel">
        <div class="panel-header">
          <h2>Prompt</h2>
          <span class="hint">Cmd/Ctrl+K</span>
        </div>
        <textarea
          v-model="promptDraft"
          ref="promptRef"
          class="prompt"
          placeholder="Describe the video to generate..."
        ></textarea>
        <div class="actions">
          <button class="primary" type="button" :disabled="!canGenerate" @click="handleGenerate">
            Generate
          </button>
        </div>
      </section>
      <section class="panel">
        <div class="panel-header">
          <h2>Parameters</h2>
          <span class="hint">Defaults</span>
        </div>
        <div class="field">
          <label>Duration</label>
          <select v-model.number="durationSec" class="control">
            <option v-for="seconds in durations" :key="seconds" :value="seconds">
              {{ seconds }}s
            </option>
          </select>
        </div>
        <div class="field">
          <label>Resolution</label>
          <select v-model="resolutionKey" class="control">
            <option
              v-for="resolution in availableResolutions"
              :key="resolution.label"
              :value="`${resolution.width}x${resolution.height}`"
            >
              {{ resolution.label }}
            </option>
          </select>
        </div>
        <div class="field">
          <label>Model</label>
          <select v-model="modelId" class="control">
            <option v-for="model in models" :key="model.id" :value="model.id">
              {{ model.label }}
            </option>
          </select>
        </div>
      </section>
      <section class="panel stack">
        <div class="panel-header">
          <h2>Queue</h2>
          <span class="hint">{{ activeCount }} active</span>
        </div>
        <div v-if="queue.length === 0" class="empty">No active jobs.</div>
        <div v-else class="job-list">
          <div v-for="job in queue" :key="job.id" class="job">
            <div class="job-top">
              <span class="job-title">{{ job.input.prompt }}</span>
              <span class="job-status">{{ job.status }}</span>
            </div>
            <div class="job-meta">
              <span>{{ job.input.durationSec }}s</span>
              <span>{{ job.input.resolution.width }}×{{ job.input.resolution.height }}</span>
              <span>{{ job.input.modelId }}</span>
            </div>
            <div v-if="job.progress !== undefined" class="job-progress">
              <div class="job-progress-bar" :style="{ width: `${job.progress * 100}%` }"></div>
            </div>
            <div class="job-actions">
              <button class="ghost" type="button" @click="handleCancel(job.id)">Cancel</button>
            </div>
            <div v-if="job.error" class="job-error">{{ job.error.message }}</div>
          </div>
        </div>
        <div class="panel-header">
          <h2>History</h2>
          <div class="hint-row">
            <span class="hint">{{ historyCount }} total</span>
            <button class="ghost small" type="button" :disabled="!canClearHistory" @click="handleClearHistory">
              Clear
            </button>
          </div>
        </div>
        <div v-if="history.length === 0" class="empty">No completed jobs yet.</div>
        <div v-else class="job-list">
          <div v-for="job in history" :key="job.id" class="job">
            <div class="job-top">
              <span class="job-title">{{ job.input.prompt }}</span>
              <span class="job-status">{{ job.status }}</span>
            </div>
            <div class="job-meta">
              <span>{{ job.input.durationSec }}s</span>
              <span>{{ job.input.resolution.width }}×{{ job.input.resolution.height }}</span>
              <span>{{ job.input.modelId }}</span>
            </div>
            <div v-if="job.outputs.length" class="job-actions">
              <button
                v-for="output in job.outputs"
                :key="output.id"
                type="button"
                class="ghost"
                @click="handleDownload(output.id)"
              >
                Download
              </button>
            </div>
            <div v-else class="job-actions">
              <button class="ghost" type="button" @click="handleRetry(job.id)">Retry</button>
            </div>
            <div v-if="job.error" class="job-error">{{ job.error.message }}</div>
            <div v-if="job.error?.retryAt" class="job-meta">
              <span>Retry after {{ new Date(job.error.retryAt).toLocaleTimeString() }}</span>
            </div>
          </div>
        </div>
      </section>
    </main>
  </div>
</template>
