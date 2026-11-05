import { test, expect, type Page } from "@playwright/test";

const url = "http://127.0.0.1:18182/qa-camera/photo-capture-harness.html";

async function fakeCamera(page: Page, blocked = false) {
  await page.addInitScript(({ blocked }) => {
    Object.defineProperty(navigator.mediaDevices, "getUserMedia", {
      configurable: true,
      value: async () => {
        if (blocked) throw new DOMException("Câmera sem permissão", "NotAllowedError");
        const canvas = document.createElement("canvas");
        canvas.width = 640;
        canvas.height = 480;
        const context = canvas.getContext("2d")!;
        context.fillStyle = "#334455";
        context.fillRect(0, 0, 640, 480);
        context.fillStyle = "#fafafa";
        context.fillRect(150, 100, 200, 150);
        const stream = canvas.captureStream(20);
        (window as Window & { __cameraStops?: number }).__cameraStops = 0;
        stream.getTracks().forEach((track) => {
          const stop = track.stop.bind(track);
          track.stop = () => {
            (window as Window & { __cameraStops?: number }).__cameraStops =
              ((window as Window & { __cameraStops?: number }).__cameraStops ?? 0) + 1;
            stop();
          };
        });
        return stream;
      },
    });
  }, { blocked });
}

test("botão obrigatório vermelho, sem galeria; captura câmera → miniatura → Salvar", async ({ page }) => {
  await fakeCamera(page);
  await page.goto(url);
  await expect(page.getByText(/Animais:\s*0 cab/)).toBeVisible();
  await expect(page.getByText(/galeria/i)).toHaveCount(0);
  await expect(page.locator('input[type="file"]')).toHaveCount(0);
  await page.getByPlaceholder("0").fill("3");
  const save = page.getByRole("button", { name: "Salvar Salga" });
  const open = page.getByRole("button", { name: "Tirar foto (obrigatório)" });
  await expect(open).toHaveClass(/bg-destructive/);
  await expect(save).toBeDisabled();
  await open.click();
  const cameraDialog = page.getByRole("dialog", { name: /Câmera — auditoria/ });
  await expect(cameraDialog).toBeVisible();
  await expect(page.getByRole("button", { name: "Capturar foto" })).toBeEnabled({ timeout: 12000 });
  const bounds = await cameraDialog.boundingBox();
  const viewport = page.viewportSize();
  expect(bounds).not.toBeNull();
  expect(viewport).not.toBeNull();
  expect(bounds!.x).toBeLessThanOrEqual(1);
  expect(bounds!.y).toBeLessThanOrEqual(1);
  expect(Math.abs(bounds!.width - viewport!.width)).toBeLessThanOrEqual(2);
  expect(Math.abs(bounds!.height - viewport!.height)).toBeLessThanOrEqual(2);
  await expect(cameraDialog.getByRole("button")).toHaveCount(2);
  await expect(cameraDialog.getByRole("button", { name: "Voltar" })).toBeVisible();
  await page.getByRole("button", { name: "Capturar foto" }).click();
  const preview = page.getByAltText("Foto de auditoria capturada");
  await expect(preview).toBeVisible({ timeout: 15000 });
  await expect.poll(() => preview.evaluate((img: HTMLImageElement) => img.complete && img.naturalWidth > 0)).toBe(true);
  await expect(save).toBeEnabled();
  await save.click();
  await expect.poll(() => page.evaluate(() => Boolean(window.__photoHarnessSave?.foto_auditoria_url))).toBe(true);
  const saved = await page.evaluate(() => ({
    sacos: window.__photoHarnessSave?.sacos,
    obrigatoria: window.__photoHarnessSave?.foto_auditoria_exigida,
    prefix: window.__photoHarnessSave?.foto_auditoria_url?.slice(0, 23),
  }));
  expect(saved).toEqual({ sacos: 3, obrigatoria: true, prefix: "data:image/jpeg;base64," });
});

test("câmera negada: erro explícito, sem galeria e sem salvar sem foto", async ({ page }) => {
  await fakeCamera(page, true);
  await page.goto(url);
  await page.getByPlaceholder("0").fill("4");
  await page.getByRole("button", { name: "Tirar foto (obrigatório)" }).click();
  await expect(page.getByRole("alert")).toContainText("[CAM01]");
  await expect(page.getByRole("button", { name: "Tentar novamente" })).toBeVisible();
  await expect(page.getByText(/galeria/i)).toHaveCount(0);
  await page.getByRole("button", { name: "Voltar" }).click();
  await expect(page.getByRole("button", { name: "Salvar Salga" })).toBeDisabled();
  await expect(page.getByPlaceholder("0")).toHaveValue("4");
});

test("cancelar câmera encerra vídeo e preserva os sacos", async ({ page }) => {
  await fakeCamera(page);
  await page.goto(url);
  await page.getByPlaceholder("0").fill("5");
  await page.getByRole("button", { name: "Tirar foto (obrigatório)" }).click();
  await expect(page.getByRole("button", { name: "Capturar foto" })).toBeEnabled({ timeout: 12000 });
  await page.getByRole("button", { name: "Voltar" }).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Salvar Salga" })).toBeDisabled();
  await expect(page.getByPlaceholder("0")).toHaveValue("5");
  await expect.poll(() => page.evaluate(() => (window as Window & { __cameraStops?: number }).__cameraStops ?? 0))
    .toBeGreaterThan(0);
});

test("cocho cheio exige captura da câmera", async ({ page }) => {
  await fakeCamera(page);
  await page.goto(url);
  await page.getByRole("button", { name: /Cocho Cheio/ }).click();
  const save = page.getByRole("button", { name: "Salvar Cocho Cheio" });
  await expect(save).toBeDisabled();
  const open = page.getByRole("button", { name: "Tirar foto (obrigatório)" });
  await expect(open).toHaveClass(/bg-destructive/);
  await open.click();
  await expect(page.getByRole("button", { name: "Capturar foto" })).toBeEnabled({ timeout: 12000 });
  await page.getByRole("button", { name: "Capturar foto" }).click();
  await expect(page.getByAltText("Foto do cocho capturada")).toBeVisible({ timeout: 15000 });
  await expect(save).toBeEnabled();
  await save.click();
  await expect.poll(() => page.evaluate(() => Boolean(window.__photoHarnessSave?.foto_cocho_url))).toBe(true);
  expect(await page.evaluate(() => window.__photoHarnessSave?.cocho_cheio)).toBe(true);
});
