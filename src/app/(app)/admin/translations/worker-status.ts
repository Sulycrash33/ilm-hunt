export interface TranslationWorkerStatus {
  observedAt: string;
  httpStatus: number;
  claimed: number;
  written: number;
  rateLimited: number;
  failed: number;
}
