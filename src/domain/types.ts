export type ProviderId = string;

export type JobStatus =
  | "queued"
  | "in_progress"
  | "succeeded"
  | "failed"
  | "canceled"
  | "rate_limited"
  | "expired";

export type Resolution = {
  width: number;
  height: number;
  label?: string;
};

export type JobInput = {
  prompt: string;
  durationSec: number;
  resolution: Resolution;
  modelId: string;
  params?: Record<string, unknown>;
};

export type JobOutput = {
  id: string;
  format: string;
  sizeBytes?: number;
  url?: string;
  checksum?: string;
};

export type JobError = {
  type:
    | "auth"
    | "quota"
    | "validation"
    | "provider"
    | "network"
    | "job_failed"
    | "unknown";
  message: string;
  retryAt?: string;
};

export type JobRecord = {
  id: string;
  providerId: ProviderId;
  providerJobId?: string;
  status: JobStatus;
  createdAt: string;
  updatedAt: string;
  startedAt?: string;
  completedAt?: string;
  input: JobInput;
  outputs: JobOutput[];
  error?: JobError;
  progress?: number;
  etaSec?: number;
};
