import { vi } from "vitest";

let serveHandler: (req: Request) => Promise<Response> | Response;

global.Deno = {
  serve: vi.fn((handler: (req: Request) => Promise<Response> | Response) => {
    serveHandler = handler;
    return { shutdown: vi.fn() };
  }),
  env: {
    get: vi.fn((key: string) => {
      if (key === "SUPABASE_URL") return "http://localhost:54321";
      if (key === "SUPABASE_SERVICE_ROLE_KEY") return "test-service-role-key";
      return undefined;
    }),
  },
} as any;

global.Response = class Response {
  status: number;
  headers: Headers;
  body: string;
  constructor(body: string | null, init?: ResponseInit) {
    this.status = init?.status ?? 200;
    this.headers = new Headers(init?.headers);
    this.body = body ?? "";
  }
  async json() {
    return JSON.parse(this.body);
  }
  async text() {
    return this.body;
  }
} as any;

global.Request = class Request {
  method: string;
  headers: Headers;
  body: string;
  url: string;
  constructor(url: string, init?: RequestInit) {
    this.url = url;
    this.method = init?.method ?? "GET";
    this.headers = new Headers(init?.headers);
    this.body = init?.body as string ?? "";
  }
  async json() {
    return JSON.parse(this.body);
  }
} as any;

global.Headers = class Headers {
  private map: Map<string, string> = new Map();
  constructor(init?: HeadersInit) {
    if (init) {
      if (Array.isArray(init)) {
        init.forEach(([k, v]) => this.map.set(k.toLowerCase(), v));
      } else if (init instanceof Headers) {
        init.forEach((v, k) => this.map.set(k.toLowerCase(), v));
      } else {
        Object.entries(init).forEach(([k, v]) => this.map.set(k.toLowerCase(), v));
      }
    }
  }
  get(name: string) {
    return this.map.get(name.toLowerCase()) ?? null;
  }
  set(name: string, value: string) {
    this.map.set(name.toLowerCase(), value);
  }
  has(name: string) {
    return this.map.has(name.toLowerCase());
  }
  forEach(callback: (value: string, key: string) => void) {
    this.map.forEach((v, k) => callback(v, k));
  }
  *[Symbol.iterator]() {
    yield* this.map.entries();
  }
} as any;

export function getServeHandler() {
  return serveHandler;
}