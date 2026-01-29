import type { JobError, JobOutput, JobStatus, Resolution, JobInput, ProviderId } from "./types";

export type ProviderModel = {
  id: string;
  label: string;
  maxDurationSec?: number;
  supportedResolutions?: Resolution[];
};

export type ProviderJobStatus = {
  providerJobId: string;
  status: JobStatus;
  progress?: number;
  outputs?: JobOutput[];
  error?: JobError;
};

export type ProviderCapabilities = {
  supportsCancel: boolean;
  supportsSeeds: boolean;
  supportsImageInputs: boolean;
};

export interface ProviderAdapter {
  id: ProviderId;
  name: string;
  capabilities: ProviderCapabilities;
  listModels(): Promise<ProviderModel[]>;
  createJob(input: JobInput): Promise<{ providerJobId: string }>;
  getJob(providerJobId: string): Promise<ProviderJobStatus>;
  getDownloadUrl(outputId: string): Promise<string>;
  cancelJob(providerJobId: string): Promise<void>;
}
