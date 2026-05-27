/** Whether a failed request is worth retrying (network blips, 5xx). */
export function isTransientFetchError(error: unknown): boolean {
  if (error == null) return false;

  if (error instanceof DOMException) {
    return error.name === "AbortError" || error.name === "TimeoutError";
  }

  if (error instanceof TypeError) return true;

  const record = typeof error === "object" ? (error as Record<string, unknown>) : null;
  const message = String(record?.message ?? error).toLowerCase();
  if (
    message.includes("failed to fetch") ||
    message.includes("network") ||
    message.includes("load failed") ||
    message.includes("networkerror")
  ) {
    return true;
  }

  const status = Number(record?.status ?? record?.statusCode);
  if (Number.isFinite(status) && status >= 500 && status < 600) return true;

  return false;
}

export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

const DEFAULT_RETRY_DELAYS_MS = [0, 500, 1500] as const;

/**
 * Runs `fn` up to `attempts` times. Waits `delaysMs[attempt]` before each attempt after the first.
 * Re-throws the last error when retries are exhausted or the error is not transient.
 */
export async function retryOnTransientFetchError<T>(
  fn: () => Promise<T>,
  options?: { attempts?: number; delaysMs?: readonly number[] },
): Promise<T> {
  const attempts = options?.attempts ?? 3;
  const delaysMs = options?.delaysMs ?? DEFAULT_RETRY_DELAYS_MS;
  let lastError: unknown;

  for (let attempt = 0; attempt < attempts; attempt++) {
    const delay = delaysMs[attempt] ?? delaysMs[delaysMs.length - 1] ?? 0;
    if (attempt > 0 && delay > 0) await sleep(delay);

    try {
      return await fn();
    } catch (e) {
      lastError = e;
      const isLast = attempt === attempts - 1;
      if (!isTransientFetchError(e) || isLast) throw e;
      console.error(`[fetch-retry] attempt ${attempt + 1}/${attempts} failed`, e);
    }
  }

  throw lastError;
}
