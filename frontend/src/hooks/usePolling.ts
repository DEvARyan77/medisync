import { useCallback, useEffect, useState } from "react";
import { errorMessage } from "../api/client";

// Fetches data now and every `intervalMs` (live updates until Socket.io in Phase 4).
export function usePolling<T>(fetcher: () => Promise<T>, intervalMs = 10000, deps: unknown[] = []) {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState("");

  // eslint-disable-next-line react-hooks/exhaustive-deps
  const load = useCallback(fetcher, deps);

  const refresh = useCallback(async () => {
    try {
      setData(await load());
      setError("");
    } catch (err) {
      setError(errorMessage(err));
    }
  }, [load]);

  useEffect(() => {
    refresh();
    const id = setInterval(refresh, intervalMs);
    return () => clearInterval(id);
  }, [refresh, intervalMs]);

  return { data, error, refresh };
}
