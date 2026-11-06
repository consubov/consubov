type TestCase = { name: string; run: () => unknown | Promise<unknown> };
type Describe = { (name: string, define: () => void): void; skip: (name: string, define: () => void) => void };

const cases: TestCase[] = [];
const beforeEachHooks: Array<() => unknown | Promise<unknown>> = [];
const afterEachHooks: Array<() => unknown | Promise<unknown>> = [];

export const describe: Describe = Object.assign(
  (_name: string, define: () => void) => define(),
  { skip: (_name: string, _define: () => void) => undefined }
);
export function it(name: string, run: () => unknown | Promise<unknown>) { cases.push({ name, run }); }
export const beforeEach = (hook: () => unknown | Promise<unknown>) => beforeEachHooks.push(hook);
export const afterEach = (hook: () => unknown | Promise<unknown>) => afterEachHooks.push(hook);

function equal(actual: unknown, expected: unknown): boolean {
  if (Object.is(actual, expected)) return true;
  if (!actual || !expected || typeof actual !== 'object' || typeof expected !== 'object') return false;
  if (Array.isArray(actual) || Array.isArray(expected)) {
    return Array.isArray(actual) && Array.isArray(expected) && actual.length === expected.length && actual.every((value, index) => equal(value, expected[index]));
  }
  const actualRecord = actual as Record<string, unknown>;
  const expectedRecord = expected as Record<string, unknown>;
  const keys = Object.keys(expectedRecord);
  return keys.length === Object.keys(actualRecord).length && keys.every(key => equal(actualRecord[key], expectedRecord[key]));
}

function matches(actual: unknown, expected: unknown): boolean {
  if (!expected || typeof expected !== 'object') return Object.is(actual, expected);
  if (!actual || typeof actual !== 'object') return false;
  if (Array.isArray(expected)) return Array.isArray(actual) && equal(actual, expected);
  return Object.entries(expected).every(([key, value]) => matches((actual as Record<string, unknown>)[key], value));
}

function fail(message: string): never { throw new Error(message); }
export function expect(actual: unknown) {
  const assertion = (check: boolean, description: string) => { if (!check) fail(description); };
  const result = {
    toBe(expected: unknown) { assertion(Object.is(actual, expected), `Expected ${String(actual)} to be ${String(expected)}.`); },
    toEqual(expected: unknown) { assertion(equal(actual, expected), 'Expected values to be deeply equal.'); },
    toContain(expected: unknown) {
      const contains = typeof actual === 'string'
        ? actual.includes(String(expected))
        : Array.isArray(actual) && actual.some(value => Object.is(value, expected));
      assertion(contains, `Expected value to contain ${String(expected)}.`);
    },
    toMatchObject(expected: unknown) { assertion(matches(actual, expected), 'Expected value to match the provided object.'); },
    toHaveLength(expected: number) { assertion((actual as { length?: number } | null)?.length === expected, `Expected length ${expected}.`); },
    toBeNull() { assertion(actual === null, `Expected ${String(actual)} to be null.`); }
  };
  return {
    ...result,
    not: { toBeNull() { assertion(actual !== null, 'Expected value not to be null.'); } },
    rejects: {
      async toBeDefined() {
        try { await actual; } catch (error) { assertion(error !== undefined, 'Expected rejection to be defined.'); return; }
        fail('Expected promise to reject.');
      },
      async toThrow(expected?: string | RegExp) {
        try { await actual; } catch (error) {
          const message = error instanceof Error ? error.message : String(error);
          if (expected instanceof RegExp) assertion(expected.test(message), `Expected rejection ${message} to match ${expected}.`);
          else if (expected) assertion(message.includes(expected), `Expected rejection ${message} to include ${expected}.`);
          return;
        }
        fail('Expected promise to reject.');
      }
    }
  };
}

declare global {
  interface Window {
    __runLocalDataBrowserTests: () => Promise<{ total: number; passed: number; failed: string[] }>;
    __localDataBrowserTests: Promise<{ total: number; passed: number; failed: string[] }>;
  }
}

window.__runLocalDataBrowserTests = async () => {
  let passed = 0;
  const failed: string[] = [];
  for (const test of cases) {
    let testError: unknown;
    try {
      for (const hook of beforeEachHooks) await hook();
      await test.run();
    } catch (error) {
      testError = error;
    } finally {
      for (const hook of afterEachHooks) {
        try { await hook(); } catch (error) { testError ??= error; }
      }
    }
    if (testError === undefined) passed++;
    else if (testError instanceof Error) {
      failed.push(`${test.name}: ${testError.name}: ${testError.message}${testError.stack ? `\n${testError.stack}` : ''}`);
    } else {
      failed.push(`${test.name}: ${String(testError)}`);
    }
  }
  return { total: cases.length, passed, failed };
};
