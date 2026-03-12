import { getApiBaseUrl } from "./apiBase";

type ApiErrorLike = {
  message?: string;
};

export class ApiError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

async function parseErrorMessage(res: Response) {
  try {
    const data = (await res.json()) as ApiErrorLike;
    if (data?.message && typeof data.message === "string") return data.message;
  } catch {
    // ignore
  }

  return res.statusText || "Request failed";
}

export async function apiRequest<T>(params: {
  method: "GET" | "POST" | "PATCH" | "PUT" | "DELETE";
  path: string;
  body?: unknown;
  token?: string;
  timeoutMs?: number;
}): Promise<T> {
  const url = `${getApiBaseUrl()}${params.path.startsWith("/") ? "" : "/"}${params.path}`;

  const timeoutMs = typeof params.timeoutMs === "number" && params.timeoutMs > 0 ? params.timeoutMs : 15000;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  let res: Response;
  try {
    res = await fetch(url, {
      method: params.method,
      signal: controller.signal,
      headers: {
        "Content-Type": "application/json",
        ...(params.token ? { Authorization: `Bearer ${params.token}` } : null),
      },
      body: params.body ? JSON.stringify(params.body) : undefined,
    });
  } catch (e) {
    if (e && typeof e === "object" && (e as any).name === "AbortError") {
      throw new ApiError("Tiempo de espera agotado. Revisá tu conexión e intentá de nuevo.", 408);
    }
    throw new ApiError("No se pudo conectar con el servidor.", 0);
  } finally {
    clearTimeout(timeout);
  }

  if (!res.ok) {
    const message = await parseErrorMessage(res);
    throw new ApiError(message, res.status);
  }

  return (await res.json()) as T;
}
