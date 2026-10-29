import { describe, expect, test } from "bun:test";
import { htmlResponse, REQUEST_ID_HEADER } from "./http";

function expectSecurityHeaders(response: Response): void {
  expect(response.headers.get("cache-control")).toBe("no-store");
  expect(response.headers.get("x-content-type-options")).toBe("nosniff");
  expect(response.headers.get("x-frame-options")).toBe("DENY");
  expect(response.headers.get("referrer-policy")).toBe("no-referrer");
  expect(response.headers.get("permissions-policy")).toBe(
    "camera=(), microphone=(), geolocation=()",
  );
}

describe("htmlResponse", () => {
  test("returns correct response for basic html content", async () => {
    const html = "<html><body><h1>Hello, World!</h1></body></html>";
    const status = 200;
    const requestId = "test-req-id-123";

    const response = htmlResponse(html, status, requestId);

    expect(response.status).toBe(status);
    expect(await response.text()).toBe(html);
    expect(response.headers.get("content-type")).toBe("text/html; charset=utf-8");
    expect(response.headers.get(REQUEST_ID_HEADER)).toBe(requestId);
    expectSecurityHeaders(response);
  });

  test("handles empty string gracefully", async () => {
    const response = htmlResponse("", 204, "empty-req-id");

    expect(response.status).toBe(204);
    expect(await response.text()).toBe("");
    expect(response.headers.get("content-type")).toBe("text/html; charset=utf-8");
    expect(response.headers.get(REQUEST_ID_HEADER)).toBe("empty-req-id");
    expectSecurityHeaders(response);
  });

  test("handles different HTTP status codes", async () => {
    const response = htmlResponse("<h1>Not Found</h1>", 404, "not-found-id");

    expect(response.status).toBe(404);
    expect(await response.text()).toBe("<h1>Not Found</h1>");
    expect(response.headers.get("content-type")).toBe("text/html; charset=utf-8");
    expect(response.headers.get(REQUEST_ID_HEADER)).toBe("not-found-id");
    expectSecurityHeaders(response);
  });
});
