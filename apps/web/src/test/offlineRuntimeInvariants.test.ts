import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { act, renderHook } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  screenCacheKey,
  useResumeRefresh,
} from "@/lib/screenCache";

const testDir = path.dirname(fileURLToPath(import.meta.url));

function collectSourceFiles(directory: string): string[] {
  if (!fs.existsSync(directory)) return [];

  return fs.readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const fullPath = path.join(directory, entry.name);
    if (entry.isDirectory()) return collectSourceFiles(fullPath);
    return /\.(ts|tsx)$/.test(entry.name) ? [fullPath] : [];
  });
}

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
  Object.defineProperty(document, "visibilityState", {
    configurable: true,
    value: "visible",
  });
});

describe("invariantes de cache Gerente/Admin", () => {
  it("a chave do cache distingue filtros diferentes", () => {
    expect(
      screenCacheKey("gerente", ["fazenda-1", "retiro-1", 9, 2026]),
    ).not.toBe(
      screenCacheKey("gerente", ["fazenda-1", "retiro-1", 10, 2026]),
    );
  });

  it("refresh ao retomar só ocorre depois de 5 minutos em segundo plano", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-01-01T12:00:00Z"));

    let visibility: DocumentVisibilityState = "visible";
    Object.defineProperty(document, "visibilityState", {
      configurable: true,
      get: () => visibility,
    });

    const refresh = vi.fn();
    const { unmount } = renderHook(() => useResumeRefresh(refresh));

    act(() => {
      visibility = "hidden";
      document.dispatchEvent(new Event("visibilitychange"));
    });

    act(() => {
      vi.advanceTimersByTime(5 * 60 * 1000 - 1);
      visibility = "visible";
      document.dispatchEvent(new Event("visibilitychange"));
    });
    expect(refresh).not.toHaveBeenCalled();

    act(() => {
      visibility = "hidden";
      document.dispatchEvent(new Event("visibilitychange"));
      vi.advanceTimersByTime(5 * 60 * 1000);
      visibility = "visible";
      document.dispatchEvent(new Event("visibilitychange"));
    });
    expect(refresh).toHaveBeenCalledTimes(1);

    unmount();
  });

  it("arquivos do Capataz não importam screenCache", () => {
    const srcRoot = path.resolve(testDir, "..");
    const candidates = collectSourceFiles(srcRoot).filter((file) => {
      const relative = path.relative(srcRoot, file).split("\\").join("/");
      return /(^|\/)capataz(\/|$)/i.test(relative) || /Capataz/.test(path.basename(file));
    });

    expect(candidates.length).toBeGreaterThan(0);

    const offenders = candidates
      .filter((file) => /screenCache/.test(fs.readFileSync(file, "utf8")))
      .map((file) => path.relative(srcRoot, file).split("\\").join("/"));

    expect(offenders).toEqual([]);
  });
});

describe("invariantes de atualização e sincronização", () => {
  it("service worker preserva a regra de não auto-reload após background/cold start", () => {
    const source = fs.readFileSync(
      path.resolve(testDir, "../lib/swRegistration.ts"),
      "utf8",
    );

    expect(source).toMatch(/const COLD_START_WINDOW_MS\s*=\s*15000/);
    expect(source).toMatch(
      /document\.visibilityState\s*===\s*"hidden"\)\s*wentToBackground\s*=\s*true/,
    );
    expect(source).toMatch(
      /return\s+!wentToBackground\s*&&\s*Date\.now\(\)\s*-\s*pageLoadedAt\s*<\s*COLD_START_WINDOW_MS/,
    );
    expect(source).toMatch(
      /if\s*\(!userRequestedUpdate\s*&&\s*!isColdStart\(\)\)\s*\{[\s\S]{0,260}?notifyListeners\(true\);[\s\S]{0,80}?return;/,
    );
  });

  it("Mais Arrobas mantém reenvio idempotente e recuperação de código de lote", () => {
    const source = fs.readFileSync(
      path.resolve(testDir, "../lib/maisArrobasQueue.ts"),
      "utf8",
    );

    expect(source).toMatch(
      /upsert\(op\.row,\s*\{\s*onConflict:\s*"id",\s*ignoreDuplicates:\s*true\s*\}\)/,
    );
    expect(source).toContain('text.includes("23505")');
    expect(source).toContain(
      'text.includes("lotes_pecuarista_pecuarista_codigo_key")',
    );
    expect(source).toContain("const nextCode = nextMaLoteCodigo(used);");
    expect(source).toMatch(
      /row:\s*\{\s*\.\.\.op\.row,\s*codigo:\s*nextCode\s*\}/,
    );
  });
});
