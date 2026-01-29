import { computed, reactive, watch } from "vue";
import {
  ACTIVE_STATUSES,
  TERMINAL_STATUSES,
  createJobRecord,
  reduceJobs,
  type JobAction,
  type JobError,
  type JobInput,
  type JobRecord,
  type JobStatus,
} from "../domain";
import { getOpenAIKey, getOpenAIKeySource, setOpenAIKey } from "../network/openaiClient";
import { loadState, saveState } from "../persist/storage";

export type AppSettings = {
  providerId: string;
  modelId: string;
  durationSec: number;
  resolution: { width: number; height: number; label?: string };
};

export type AppState = {
  jobs: JobRecord[];
  settings: AppSettings;
  promptDraft: string;
  apiKey: string | null;
  apiKeySource: "env" | "local" | "session" | "none";
};

const envKey = getOpenAIKey();
const keySource = getOpenAIKeySource();

const initialState: AppState = {
  jobs: [],
  settings: {
    providerId: "openai-sora",
    modelId: "sora-2",
    durationSec: 8,
    resolution: { width: 1280, height: 720, label: "720p" },
  },
  promptDraft: "",
  apiKey: envKey,
  apiKeySource: envKey ? keySource : "none",
};

const state = reactive<AppState>({ ...initialState });
let persistenceStarted = false;
let saveTimer: number | undefined;

function dispatch(action: JobAction) {
  state.jobs = reduceJobs(state.jobs, action);
}

function createJob(input: JobInput) {
  const job = createJobRecord(input, state.settings.providerId);
  dispatch({ type: "job/create", job });
  return job;
}

function updateJobStatus(id: string, status: JobStatus, progress?: number, etaSec?: number) {
  dispatch({ type: "job/status", id, status, progress, etaSec });
}

function setJobError(id: string, error: JobError) {
  dispatch({ type: "job/error", id, error });
}

function addJobOutputs(id: string, outputs: JobRecord["outputs"]) {
  dispatch({ type: "job/output", id, outputs });
}

function patchJob(id: string, patch: Partial<JobRecord>) {
  dispatch({ type: "job/update", id, patch });
}

function setPromptDraft(value: string) {
  state.promptDraft = value;
}

function setDurationSec(value: number) {
  state.settings.durationSec = value;
}

function setResolution(value: AppSettings["resolution"]) {
  state.settings.resolution = value;
}

function setModelId(value: string) {
  state.settings.modelId = value;
}

function setProviderId(value: string) {
  state.settings.providerId = value;
}

function setApiKey(value: string | null, persist = false) {
  setOpenAIKey(value, persist);
  state.apiKey = getOpenAIKey();
  state.apiKeySource = getOpenAIKeySource();
}

function clearHistory() {
  state.jobs = state.jobs.filter((job) => !TERMINAL_STATUSES.includes(job.status));
}

const queue = computed(() =>
  state.jobs.filter((job) => ACTIVE_STATUSES.includes(job.status)),
);

const history = computed(() =>
  state.jobs.filter((job) => TERMINAL_STATUSES.includes(job.status)),
);

const activeCount = computed(() => queue.value.length);
const hasApiKey = computed(() => Boolean(state.apiKey));

export function useAppStore() {
  return {
    state,
    queue,
    history,
    activeCount,
    hasApiKey,
    createJob,
    updateJobStatus,
    setJobError,
    addJobOutputs,
    patchJob,
    setPromptDraft,
    setDurationSec,
    setResolution,
    setModelId,
    setProviderId,
    setApiKey,
    clearHistory,
  };
}

export async function hydrateStore() {
  const persisted = await loadState();
  if (persisted.settings) {
    state.settings = { ...state.settings, ...persisted.settings };
  }
  if (persisted.jobs) {
    state.jobs = persisted.jobs;
  }
  if (typeof persisted.promptDraft === "string") {
    state.promptDraft = persisted.promptDraft;
  }
}

export function startPersistence() {
  if (persistenceStarted) return;
  persistenceStarted = true;

  const scheduleSave = () => {
    if (saveTimer) window.clearTimeout(saveTimer);
    saveTimer = window.setTimeout(() => {
      void saveState({
        settings: state.settings,
        jobs: state.jobs,
        promptDraft: state.promptDraft,
      });
    }, 500);
  };

  watch(
    () => [state.settings, state.jobs, state.promptDraft],
    () => scheduleSave(),
    { deep: true },
  );
}
