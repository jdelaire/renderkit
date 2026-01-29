import type { JobError, JobRecord, JobStatus } from "../domain";
import { openaiSoraProvider } from "../providers";
import { downloadVideoContent } from "./openaiVideos";

type AppStore = {
  state: {
    promptDraft: string;
    settings: {
      durationSec: number;
      resolution: { width: number; height: number };
      modelId: string;
    };
    jobs: JobRecord[];
  };
  createJob: (input: JobRecord["input"]) => JobRecord;
  patchJob: (id: string, patch: Partial<JobRecord>) => void;
  updateJobStatus: (id: string, status: JobStatus, progress?: number, etaSec?: number) => void;
  setJobError: (id: string, error: JobError) => void;
  addJobOutputs: (id: string, outputs: JobRecord["outputs"]) => void;
};

type PollState = {
  timer?: number;
  attempts: number;
};

const pollers = new Map<string, PollState>();
const pendingJobs: string[] = [];
const MAX_PARALLEL = 3;

function mapError(error: unknown): JobError {
  if (error && typeof error === "object") {
    const err = error as { status?: number; message?: string; retryAfter?: number };
    if (err.status === 401 || err.status === 403) {
      return { type: "auth", message: err.message ?? "Unauthorized" };
    }
    if (err.status === 429) {
      return {
        type: "quota",
        message: err.message ?? "Rate limited",
        retryAt: err.retryAfter ? new Date(Date.now() + err.retryAfter * 1000).toISOString() : undefined,
      };
    }
    if (err.status === 400) {
      return { type: "validation", message: err.message ?? "Invalid request" };
    }
    if (err.status && err.status >= 500) {
      return { type: "provider", message: err.message ?? "Provider unavailable" };
    }
    if (err.message?.includes("Missing OpenAI API key")) {
      return { type: "auth", message: err.message };
    }
  }

  return { type: "network", message: "Network error" };
}

function getInFlightCount(store: AppStore) {
  return store.state.jobs.filter(
    (item) =>
      item.providerJobId &&
      item.status !== "succeeded" &&
      item.status !== "failed" &&
      item.status !== "canceled" &&
      item.status !== "expired",
  ).length;
}

function getBaseInterval(startedAt?: string) {
  if (!startedAt) return 4000;
  const elapsed = Date.now() - new Date(startedAt).getTime();
  if (elapsed < 30_000) return 2000;
  if (elapsed < 120_000) return 5000;
  return 10_000;
}

function schedulePoll(store: AppStore, jobId: string, delay: number) {
  const state = pollers.get(jobId) ?? { attempts: 0 };
  if (state.timer) window.clearTimeout(state.timer);
  state.timer = window.setTimeout(() => {
    void pollJob(store, jobId);
  }, delay);
  pollers.set(jobId, state);
}

async function pollJob(store: AppStore, jobId: string) {
  const job = store.state.jobs.find((item) => item.id === jobId);
  if (!job || !job.providerJobId) {
    stopPolling(jobId);
    return;
  }

  try {
    const status = await openaiSoraProvider.getJob(job.providerJobId);
    store.updateJobStatus(job.id, status.status, status.progress, status.etaSec);
    const pollState = pollers.get(jobId);
    if (pollState) pollState.attempts = 0;

    if (status.error) {
      store.setJobError(job.id, status.error);
    }

    if (status.status === "succeeded") {
      store.addJobOutputs(job.id, [{ id: job.providerJobId, format: "mp4" }]);
      stopPolling(job.id);
      processQueue(store);
    }

    if (status.status === "failed" || status.status === "canceled" || status.status === "expired") {
      stopPolling(job.id);
      processQueue(store);
    }

    if (status.status === "queued" || status.status === "in_progress") {
      schedulePoll(store, job.id, getBaseInterval(job.startedAt));
    }
  } catch (error) {
    const mapped = mapError(error);
    store.setJobError(job.id, mapped);
    if (mapped.type === "quota") {
      store.updateJobStatus(job.id, "rate_limited");
      const retryDelay = mapped.retryAt
        ? Math.max(1000, new Date(mapped.retryAt).getTime() - Date.now())
        : 10_000;
      schedulePoll(store, job.id, retryDelay);
      return;
    }

    if (mapped.type === "network") {
      const pollState = pollers.get(jobId) ?? { attempts: 0 };
      pollState.attempts += 1;
      pollers.set(jobId, pollState);
      const base = getBaseInterval(job.startedAt);
      const delay = Math.min(base * 2 ** pollState.attempts, 30_000);
      schedulePoll(store, job.id, delay);
      return;
    }

    store.updateJobStatus(job.id, "failed");
    stopPolling(job.id);
    processQueue(store);
  }
}

function startPolling(store: AppStore, job: JobRecord) {
  if (pollers.has(job.id)) return;
  pollers.set(job.id, { attempts: 0 });
  schedulePoll(store, job.id, getBaseInterval(job.startedAt));
}

function stopPolling(jobId: string) {
  const state = pollers.get(jobId);
  if (!state) return;
  if (state.timer) window.clearTimeout(state.timer);
  pollers.delete(jobId);
}

async function startProviderJob(store: AppStore, job: JobRecord) {
  try {
    const { providerJobId } = await openaiSoraProvider.createJob(job.input);
    store.patchJob(job.id, {
      providerJobId,
      status: "queued",
      startedAt: new Date().toISOString(),
    });
    startPolling(store, { ...job, providerJobId });
  } catch (error) {
    const mapped = mapError(error);
    store.setJobError(job.id, mapped);
    store.updateJobStatus(job.id, mapped.type === "quota" ? "rate_limited" : "failed");
  }
}

function processQueue(store: AppStore) {
  while (pendingJobs.length > 0 && getInFlightCount(store) < MAX_PARALLEL) {
    const jobId = pendingJobs.shift();
    if (!jobId) continue;
    const job = store.state.jobs.find((item) => item.id === jobId);
    if (!job) continue;
    void startProviderJob(store, job);
  }
}

export async function submitGeneration(store: AppStore) {
  const prompt = store.state.promptDraft.trim();
  if (!prompt) {
    return { ok: false, error: { type: "validation", message: "Prompt is required" } };
  }

  const input = {
    prompt,
    durationSec: store.state.settings.durationSec,
    resolution: store.state.settings.resolution,
    modelId: store.state.settings.modelId,
  };

  const job = store.createJob(input);

  if (getInFlightCount(store) >= MAX_PARALLEL) {
    pendingJobs.push(job.id);
    return { ok: true, jobId: job.id, queued: true };
  }

  await startProviderJob(store, job);
  return { ok: true, jobId: job.id };
}

export async function downloadOutput(outputId: string, filename: string) {
  const blob = await downloadVideoContent(outputId);
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}

export async function retryGeneration(store: AppStore, job: JobRecord) {
  const retryJob = store.createJob(job.input);
  if (getInFlightCount(store) >= MAX_PARALLEL) {
    pendingJobs.push(retryJob.id);
    return { ok: true, jobId: retryJob.id, queued: true };
  }
  await startProviderJob(store, retryJob);
  return { ok: true, jobId: retryJob.id };
}

export async function cancelGeneration(store: AppStore, job: JobRecord) {
  stopPolling(job.id);
  store.updateJobStatus(job.id, "canceled");
  if (job.providerJobId && openaiSoraProvider.capabilities.supportsCancel) {
    try {
      await openaiSoraProvider.cancelJob(job.providerJobId);
    } catch {
      // ignore cancel errors for now
    }
  }
  processQueue(store);
}
