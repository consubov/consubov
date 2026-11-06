import { act, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { MapaData, PastoMapaData } from "@/hooks/useMapaData";
import MapaViewer, { clearMapImageMemoryCache } from "./MapaViewer";

const imageUrl = "https://example.supabase.co/storage/v1/object/public/mapas/farm-1/map.png";

function makePasto(overrides: Partial<PastoMapaData> = {}): PastoMapaData {
  return {
    id: "pm-1", pasto_id: "p-1", coordenadas: [[20, 30], [300, 30], [300, 250], [20, 250]],
    cor: "#16a34a", pasto_nome: "Retiro Sede", num_animais: 30,
    peso_medio_kg: 320, categoria: "Recria 2", sexo: "M",
    consumo_medio: null, status_consumo: null, ultima_movimentacao: null,
    ultima_salga: null, data_fim_carencia: null, label_offset_x: 0,
    label_offset_y: 0, label_rotation: 0,
    ...overrides,
  };
}

function makeMapa(image: string, pastos: PastoMapaData[] = []): MapaData {
  return { id: "m-1", fazenda_id: "f-1", imagem_url: image, pastos, linhas: [], elementos: [] };
}

const loadedImages: Array<{
  source: string;
  load: () => void;
  fail: () => void;
}> = [];

beforeEach(() => {
  clearMapImageMemoryCache();
  loadedImages.length = 0;
  class ImageProbe {
    naturalWidth = 2400;
    naturalHeight = 1200;
    onload: ((event: Event) => void) | null = null;
    onerror: ((event: Event) => void) | null = null;
    set src(source: string) {
      loadedImages.push({
        source,
        load: () => this.onload?.(new Event("load")),
        fail: () => this.onerror?.(new Event("error")),
      });
    }
  }
  vi.stubGlobal("Image", ImageProbe);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("MapaViewer — base image and pasture pins", () => {
  it("shows a real farm image even before any polygons have been drawn", async () => {
    const { container } = render(<MapaViewer mapa={makeMapa(imageUrl)} onPastoClick={vi.fn()} />);
    expect(loadedImages).toHaveLength(1);
    await act(async () => { loadedImages[0].load(); });

    await waitFor(() => {
      const image = container.querySelector('svg image[href="' + imageUrl + '"]');
      expect(image).toBeTruthy();
      expect(image?.getAttribute("width")).toBe("2400");
      expect(image?.getAttribute("height")).toBe("1200");
    });
    expect(screen.queryByText("Nenhum pasto desenhado no mapa.")).not.toBeInTheDocument();
  });

  it("reuses a previously loaded map image in RAM when revisiting with the same account", async () => {
    const { unmount } = render(<MapaViewer mapa={makeMapa(imageUrl)} cacheScope="capataz-A" onPastoClick={vi.fn()} />);
    await act(async () => { loadedImages[0].load(); });
    unmount();
    const { container } = render(<MapaViewer mapa={makeMapa(imageUrl)} cacheScope="capataz-A" onPastoClick={vi.fn()} />);
    await waitFor(() => expect(container.querySelector("svg image")).toBeTruthy());
    expect(loadedImages).toHaveLength(1);
  });

  it("never reuses the prior account's in-memory map image", async () => {
    const { unmount } = render(<MapaViewer mapa={makeMapa(imageUrl)} cacheScope="capataz-A" onPastoClick={vi.fn()} />);
    await act(async () => { loadedImages[0].load(); });
    unmount();
    render(<MapaViewer mapa={makeMapa(imageUrl)} cacheScope="capataz-B" onPastoClick={vi.fn()} />);
    expect(loadedImages).toHaveLength(2);
  });

  it("renders a built-in SVG cattle silhouette instead of dead legacy image URLs", () => {
    const pasto = makePasto();
    const { container } = render(<MapaViewer mapa={makeMapa("", [pasto])} onPastoClick={vi.fn()} />);
    const pin = container.querySelector('g[role="img"][aria-label*="animais"]');
    expect(pin).toBeTruthy();
    expect(pin?.querySelector("image")).toBeNull();
    expect(pin?.querySelectorAll("path").length).toBeGreaterThan(0);
    expect(container.innerHTML).not.toContain("/__l5e/");
  });

  it("exposes an image failure and preserves the polygons as fallback", async () => {
    const pasto = makePasto();
    const { container } = render(<MapaViewer mapa={makeMapa(imageUrl, [pasto])} onPastoClick={vi.fn()} />);
    await act(async () => { loadedImages[0].fail(); });
    expect(screen.getByRole("alert")).toHaveTextContent(/imagem/i);
    expect(container.querySelectorAll("polygon")).toHaveLength(1);
  });

  it("never hangs on a degenerate polygon and still renders a valid background", async () => {
    const invalidPasto = makePasto({ coordenadas: [[5, 5], [5, 5], [5, 5]] });
    const { container } = render(<MapaViewer mapa={makeMapa(imageUrl, [invalidPasto])} onPastoClick={vi.fn()} />);
    await act(async () => { loadedImages[0].load(); });
    expect(container.querySelector('svg image[href="' + imageUrl + '"]')).toBeTruthy();
    expect(container.querySelectorAll('g[role="img"][aria-label*="animais"]')).toHaveLength(0);
  });

  it("ignores a late image from a previous map and keeps the new map active", async () => {
    const { container, rerender } = render(<MapaViewer mapa={makeMapa(imageUrl)} onPastoClick={vi.fn()} />);
    rerender(<MapaViewer mapa={{ ...makeMapa("https://example.supabase.co/storage/v1/object/public/mapas/new.png"), id: "m-2" }} onPastoClick={vi.fn()} />);
    expect(loadedImages).toHaveLength(2);
    await act(async () => { loadedImages[0].load(); loadedImages[1].load(); });
    await waitFor(() => expect(container.querySelector('svg image[href$="/new.png"]')).toBeTruthy());
    expect(container.querySelector('svg image[href="' + imageUrl + '"]')).toBeNull();
  });
});
