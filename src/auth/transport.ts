/** Only the four operations required by this first-login workflow are reachable. */
export function createAuthTransport(
  baseUrl: string,
  fetcher: typeof fetch = fetch,
  timeoutMs = 15_000,
) {
  const controllers = new Set<AbortController>();
  const transport: typeof fetch = async (input, init) => {
    // SDK uses string URLs. Do not admit Request objects with hidden method/body.
    if (typeof input !== "string" && !(input instanceof URL))
      throw new Error("Auth operation unavailable");
    const url = new URL(typeof input === "string" ? input : input.href);
    const method = (init?.method ?? "GET").toUpperCase();
    const route = url.pathname.slice("/auth/v1".length);
    const allowed =
      url.origin === baseUrl &&
      url.pathname.startsWith("/auth/v1/") &&
      ((method === "POST" &&
        route === "/otp" &&
        [...url.searchParams.keys()].length === 1 &&
        url.searchParams.get("redirect_to") ===
          "http://127.0.0.1:5174/auth/callback") ||
        (method === "POST" &&
          route === "/token" &&
          url.search === "?grant_type=pkce") ||
        (method === "GET" && route === "/user" && !url.search) ||
        (method === "POST" &&
          route === "/logout" &&
          url.search === "?scope=local"));
    if (!allowed || url.username || url.password || url.hash)
      throw new Error("Auth operation unavailable");
    const controller = new AbortController();
    controllers.add(controller);
    const abort = () => controller.abort();
    init?.signal?.addEventListener("abort", abort, { once: true });
    if (init?.signal?.aborted) controller.abort();
    const timer = setTimeout(abort, timeoutMs);
    const bounded = async <T>(operation: Promise<T>): Promise<T> => {
      let rejectAbort: () => void = () => {};
      const stopped = new Promise<never>((_, reject) => {
        rejectAbort = () => reject(new Error("Auth request unavailable"));
      });
      controller.signal.addEventListener("abort", rejectAbort, { once: true });
      if (controller.signal.aborted) rejectAbort();
      try {
        return await Promise.race([operation, stopped]);
      } finally {
        controller.signal.removeEventListener("abort", rejectAbort);
      }
    };
    let reader: ReadableStreamDefaultReader<Uint8Array> | undefined;
    try {
      const response = await bounded(
        fetcher(input, {
          ...init,
          signal: controller.signal,
          credentials: "omit",
          cache: "no-store",
          redirect: "error",
          referrerPolicy: "no-referrer",
        }),
      );
      reader = response.body?.getReader();
      const chunks: Uint8Array[] = [];
      let size = 0;
      if (reader) {
        for (;;) {
          const chunk = await bounded(reader.read());
          if (chunk.done) break;
          size += chunk.value.byteLength;
          if (size > 512 * 1024) throw new Error("Auth response unavailable");
          chunks.push(chunk.value);
        }
      }
      const body = new Uint8Array(size);
      let offset = 0;
      for (const chunk of chunks) {
        body.set(chunk, offset);
        offset += chunk.byteLength;
      }
      return new Response(
        [204, 205, 304].includes(response.status) ? null : body,
        { status: response.status, headers: response.headers },
      );
    } catch {
      controller.abort();
      void reader?.cancel().catch(() => {});
      throw new Error("Auth request unavailable");
    } finally {
      clearTimeout(timer);
      init?.signal?.removeEventListener("abort", abort);
      controllers.delete(controller);
    }
  };
  return {
    fetch: transport,
    abort() {
      for (const controller of controllers) controller.abort();
    },
  };
}
