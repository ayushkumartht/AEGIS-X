/**
 * AEGIS-X typed API client.
 */

const BASE_URL = import.meta.env.VITE_API_URL ?? "http://localhost:8000";

export interface SummaryResult {
  mean: number; std: number;
  p05: number; p10: number; p50: number; p90: number; p95: number;
  worst: number; best: number; resilience: number;
}

export interface RunRequest {
  domain: string;
  scenario: Record<string, unknown>;
  plan: Record<string, unknown>;
  n_samples?: number;
  seed?: number;
}

export interface CompareRequest {
  domain: string;
  scenario: Record<string, unknown>;
  plans: Record<string, Record<string, unknown>>;
  n_samples?: number;
  seed?: number;
}

export type CompareResult = Record<string, SummaryResult>;

async function post<T>(path: string, body: unknown): Promise<T> {
  const res = await fetch(`${BASE_URL}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`AEGIS API ${res.status}: ${await res.text()}`);
  return res.json() as Promise<T>;
}

export const runSimulation = (req: RunRequest) =>
  post<{ summary: SummaryResult }>("/api/run", req);

export const comparePlans = (req: CompareRequest) =>
  post<CompareResult>("/api/compare", req);

export const explainResult = (comparison: CompareResult, domain: string) =>
  post<{ explanation: string }>("/api/explain", { comparison, domain });
