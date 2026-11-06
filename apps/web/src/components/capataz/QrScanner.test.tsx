import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import QrScanner from "./QrScanner";

const readerMocks = vi.hoisted(() => ({ decode: vi.fn(), stop: vi.fn() }));
vi.mock("@zxing/browser", () => ({
  BrowserQRCodeReader: class {
    decodeFromVideoElement = readerMocks.decode;
  },
}));

describe("QrScanner - leitura nativa e fallback offline", () => {
  const track = { stop: vi.fn() };
  const getUserMedia = vi.fn();
  const onScan = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    Object.defineProperty(navigator, "mediaDevices", {
      configurable: true,
      value: { getUserMedia },
    });
    getUserMedia.mockResolvedValue({ getTracks: () => [track] });
    readerMocks.decode.mockResolvedValue({ stop: readerMocks.stop });
    Object.defineProperty(HTMLVideoElement.prototype, "readyState", {
      configurable: true,
      get: () => 4,
    });
    vi.spyOn(HTMLMediaElement.prototype, "play").mockResolvedValue(undefined);
    vi.spyOn(HTMLMediaElement.prototype, "pause").mockImplementation(() => {});
    vi.spyOn(HTMLMediaElement.prototype, "load").mockImplementation(() => {});
  });

  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  const start = () => {
    render(<QrScanner onScan={onScan} onBack={vi.fn()} onManualSelect={vi.fn()} />);
    fireEvent.click(screen.getByRole("button", { name: /ESCANEAR QR CODE/i }));
  };

  it("uses ZXing if the browser advertises BarcodeDetector but its constructor fails", async () => {
    vi.stubGlobal("BarcodeDetector", class {
      constructor() { throw new Error("QR detector not supported"); }
    });
    start();
    await waitFor(() => expect(readerMocks.decode).toHaveBeenCalledTimes(1));
    expect(getUserMedia).toHaveBeenCalledTimes(1);
  });

  it("falls back to ZXing after repeated native detector errors", async () => {
    const detect = vi.fn().mockRejectedValue(new Error("native detector broken"));
    vi.stubGlobal("BarcodeDetector", class {
      detect = detect;
    });
    start();
    await waitFor(() => expect(readerMocks.decode).toHaveBeenCalledTimes(1), { timeout: 1800 });
    expect(detect).toHaveBeenCalledTimes(3);
  });

  it("retains native scanning when a transient failure recovers", async () => {
    const qr = "550e8400-e29b-41d4-a716-446655440000";
    const detect = vi.fn()
      .mockRejectedValueOnce(new Error("frame failed"))
      .mockResolvedValueOnce([{ rawValue: qr }]);
    vi.stubGlobal("BarcodeDetector", class {
      detect = detect;
    });
    start();
    await waitFor(() => expect(onScan).toHaveBeenCalledWith(qr), { timeout: 1300 });
    expect(readerMocks.decode).not.toHaveBeenCalled();
    expect(track.stop).toHaveBeenCalled();
  });
});
