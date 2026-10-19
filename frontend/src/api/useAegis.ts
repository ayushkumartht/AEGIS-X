/**
 * React hooks wrapping the AEGIS API client.
 */

import { useState, useCallback } from "react";
import { runSimulation, comparePlans, explainResult } from "@/api/aegisClient";
import type { RunRequest, CompareRequest, SummaryResult, CompareResult } from "@/api/aegisClient";

interface AsyncState<T> {
  data: T | null;
  loading: boolean;
  error: string | null;
}

function useAsync<TArgs, TResult>(action: (args: TArgs) => Promise<TResult>) {
  const [state, setState] = useState<AsyncState<TResult>>({ data: null, loading: false, error: null });
  const execute = useCallback(async (args: TArgs) => {
    setState({ data: null, loading: true, error: null });
    try {
      const data = await action(args);
      setState({ data, loading: false, error: null });
      return data;
    } catch (err) {
      setState({ data: null, loading: false, error: String(err) });
      return null;
    }
  }, [action]);
  return { ...state, execute };
}

export const useRunSimulation = () =>
  useAsync((req: RunRequest) => runSimulation(req).then(r => r.summary));

export const useComparePlans = () =>
  useAsync((req: CompareRequest) => comparePlans(req));

export const useExplainResult = () =>
  useAsync(({ comparison, domain }: { comparison: CompareResult; domain: string }) =>
    explainResult(comparison, domain).then(r => r.explanation));
