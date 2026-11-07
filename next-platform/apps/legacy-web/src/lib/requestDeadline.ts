/** Bounded read requests: a stalled fetch must never trap a screen in loading. */
export class RequestTimeoutError extends Error {
  constructor() {
    super("Tempo limite da consulta excedido.");
    this.name = "RequestTimeoutError";
  }
}

export class RequestCancelledError extends Error {
  constructor() {
    super("Consulta cancelada.");
    this.name = "RequestCancelledError";
  }
}

export async function runWithDeadline<T>(
  request: (signal: AbortSignal) => PromiseLike<T>,
  options: { signal?: AbortSignal; timeoutMs: number },
): Promise<T> {
  const { signal, timeoutMs } = options;
  if (signal?.aborted) throw new RequestCancelledError();

  const controller = new AbortController();
  let timer: ReturnType<typeof setTimeout> | undefined;
  let handleCancel: (() => void) | undefined;

  const cancelled = new Promise<never>((_, reject) => {
    handleCancel = () => {
      controller.abort();
      reject(new RequestCancelledError());
    };
    signal?.addEventListener("abort", handleCancel, { once: true });
  });
  const deadline = new Promise<never>((_, reject) => {
    timer = setTimeout(() => {
      // Reject first so a fetch AbortError cannot mask the timeout reason.
      reject(new RequestTimeoutError());
      controller.abort();
    }, timeoutMs);
  });

  try {
    return await Promise.race([
      Promise.resolve().then(() => request(controller.signal)),
      cancelled,
      deadline,
    ]);
  } finally {
    if (timer !== undefined) clearTimeout(timer);
    if (signal && handleCancel) signal.removeEventListener("abort", handleCancel);
  }
}
