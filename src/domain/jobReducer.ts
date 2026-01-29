import type { JobError, JobInput, JobOutput, JobRecord, JobStatus, ProviderId } from "./types";

export type JobAction =
  | { type: "job/create"; job: JobRecord }
  | { type: "job/update"; id: string; patch: Partial<JobRecord> }
  | { type: "job/status"; id: string; status: JobStatus; progress?: number; etaSec?: number }
  | { type: "job/output"; id: string; outputs: JobOutput[] }
  | { type: "job/error"; id: string; error: JobError }
  | { type: "job/remove"; id: string };

export const ACTIVE_STATUSES: JobStatus[] = ["queued", "in_progress", "rate_limited"];
export const TERMINAL_STATUSES: JobStatus[] = [
  "succeeded",
  "failed",
  "canceled",
  "expired",
];

export function createJobRecord(input: JobInput, providerId: ProviderId): JobRecord {
  const now = new Date().toISOString();
  return {
    id: crypto.randomUUID(),
    providerId,
    status: "queued",
    createdAt: now,
    updatedAt: now,
    input,
    outputs: [],
  };
}

export function reduceJobs(state: JobRecord[], action: JobAction): JobRecord[] {
  switch (action.type) {
    case "job/create":
      return [action.job, ...state];
    case "job/update":
      return state.map((job) =>
        job.id === action.id
          ? { ...job, ...action.patch, updatedAt: new Date().toISOString() }
          : job,
      );
    case "job/status":
      return state.map((job) =>
        job.id === action.id
          ? {
              ...job,
              status: action.status,
              progress: action.progress ?? job.progress,
              etaSec: action.etaSec ?? job.etaSec,
              updatedAt: new Date().toISOString(),
            }
          : job,
      );
    case "job/output":
      return state.map((job) =>
        job.id === action.id
          ? {
              ...job,
              outputs: [...job.outputs, ...action.outputs],
              updatedAt: new Date().toISOString(),
            }
          : job,
      );
    case "job/error":
      return state.map((job) =>
        job.id === action.id
          ? { ...job, error: action.error, updatedAt: new Date().toISOString() }
          : job,
      );
    case "job/remove":
      return state.filter((job) => job.id !== action.id);
    default:
      return state;
  }
}
