import type { ProviderAdapter, ProviderCapabilities, ProviderJobStatus } from "../domain";
import { createVideo, retrieveVideo } from "../network/openaiVideos";

const capabilities: ProviderCapabilities = {
  supportsCancel: false,
  supportsSeeds: false,
  supportsImageInputs: false,
};

function mapStatus(status: string): ProviderJobStatus["status"] {
  switch (status) {
    case "completed":
      return "succeeded";
    case "failed":
      return "failed";
    case "in_progress":
      return "in_progress";
    case "queued":
    case "pending":
      return "queued";
    default:
      return "queued";
  }
}

export const openaiSoraProvider: ProviderAdapter = {
  id: "openai-sora",
  name: "OpenAI Sora 2",
  capabilities,
  async listModels() {
    return [
      { id: "sora-2", label: "Sora 2" },
      { id: "sora-2-pro", label: "Sora 2 Pro" },
    ];
  },
  async createJob(input) {
    const response = await createVideo({
      prompt: input.prompt,
      model: input.modelId,
      seconds: input.durationSec,
      size: `${input.resolution.width}x${input.resolution.height}`,
    });
    return { providerJobId: response.id };
  },
  async getJob(providerJobId) {
    const response = await retrieveVideo(providerJobId);
    return {
      providerJobId: response.id,
      status: mapStatus(response.status),
      progress: typeof response.progress === "number" ? response.progress / 100 : undefined,
      error: response.error
        ? {
            type: "provider",
            message: response.error.message ?? "Provider error",
          }
        : undefined,
    };
  },
  async getDownloadUrl() {
    throw new Error("Not implemented");
  },
  async cancelJob() {
    throw new Error("Not implemented");
  },
};
