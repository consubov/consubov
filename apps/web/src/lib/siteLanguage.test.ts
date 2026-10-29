import { describe, expect, it } from "vitest";
import { normalizeSiteLanguage, siteCopy, sitePhrase } from "./siteLanguage";

describe("public site language", () => {
  const cms = (_key: string, fallback: string) => fallback;

  it("defaults to Brazilian Portuguese", () => {
    expect(normalizeSiteLanguage(null)).toBe("pt-BR");
    expect(normalizeSiteLanguage("unknown")).toBe("pt-BR");
    expect(normalizeSiteLanguage("en-US")).toBe("en-US");
  });

  it("switches translated CMS keys without needing a translation service", () => {
    expect(siteCopy("pt-BR", "hero_subtitulo", "O FUTURO DA PECUÁRIA", cms))
      .toBe("O FUTURO DA PECUÁRIA");
    expect(siteCopy("en-US", "hero_subtitulo", "O FUTURO DA PECUÁRIA", cms))
      .toBe("THE FUTURE OF LIVESTOCK");
  });

  it("keeps images, unknown CMS content and field identifiers intact", () => {
    const remote = (_key: string, fallback: string) => fallback || "/assets/custom-photo.webp";
    expect(siteCopy("en-US", "manifesto_imagem_fundo", "", remote))
      .toBe("/assets/custom-photo.webp");
    expect(siteCopy("en-US", "unknown_key", "custom", remote)).toBe("custom");
  });

  it("translates known array labels without changing names or numbers", () => {
    expect(sitePhrase("en-US", "Pastos")).toBe("Pastures");
    expect(sitePhrase("en-US", "QR Code")).toBe("QR Code");
    expect(sitePhrase("pt-BR", "Pastos")).toBe("Pastos");
    expect(sitePhrase("en-US", "12345")).toBe("12345");
  });
});
