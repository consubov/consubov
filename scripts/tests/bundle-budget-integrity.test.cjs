const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const checker = path.resolve(__dirname, '../check-web-bundle-budget.mjs');
const sampleBudget = { maxTotalBytes: 100, maxTotalGzipBytes: 80, maxLargestAssetBytes: 60 };
const sampleReport = {
  generatedAt: '2026-10-13T00:00:00.000Z',
  totals: { files: 2, bytes: 100, gzipBytes: 80 },
  largest: [
    { file: 'assets/main.js', bytes: 60, gzipBytes: 48 },
    { file: 'assets/style.css', bytes: 40, gzipBytes: 32 },
  ],
};

function runCase({ budget = sampleBudget, report = sampleReport, rawBudget, rawReport, missing } = {}) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'consubov-bundle-'));
  try {
    const scripts = path.join(dir, 'scripts');
    const web = path.join(dir, 'apps', 'web');
    fs.mkdirSync(scripts, { recursive: true });
    fs.mkdirSync(path.join(web, 'dist'), { recursive: true });
    fs.copyFileSync(checker, path.join(scripts, 'check-web-bundle-budget.mjs'));
    if (missing !== 'budget') fs.writeFileSync(path.join(scripts, 'web-bundle-budget.json'), rawBudget ?? JSON.stringify(budget));
    if (missing !== 'report') fs.writeFileSync(path.join(web, 'dist', 'bundle-report.json'), rawReport ?? JSON.stringify(report));
    const result = spawnSync(process.execPath, [path.join(scripts, 'check-web-bundle-budget.mjs')], {
      cwd: web, encoding: 'utf8', timeout: 10000,
    });
    assert.ifError(result.error);
    return result;
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
}

function invalid(options) {
  const result = runCase(options);
  assert.equal(result.status, 1, result.stdout + result.stderr);
  assert.match(result.stderr, /\[bundle:budget\] invalid input:/);
  assert.doesNotMatch(result.stdout, /"actual"/);
}

test('bundle metrics equal to every limit pass', () => {
  const result = runCase();
  assert.equal(result.status, 0, result.stderr);
  assert.deepEqual(JSON.parse(result.stdout.slice('[bundle:budget] '.length)).actual,
    { totalBytes: 100, totalGzipBytes: 80, largestAssetBytes: 60 });
});

test('valid metrics inside limits pass even when gzip exceeds tiny raw assets', () => {
  const result = runCase({ report: {
    totals: { files: 2, bytes: 2, gzipBytes: 42 },
    largest: [{ file: 'assets/a.js', bytes: 1, gzipBytes: 21 }, { file: 'assets/b.css', bytes: 1, gzipBytes: 21 }],
  } });
  assert.equal(result.status, 0, result.stderr);
});

test('largest measurement is the true maximum across unsorted entries', () => {
  const report = structuredClone(sampleReport); report.largest.reverse();
  const result = runCase({ report });
  assert.equal(result.status, 0, result.stderr);
  assert.equal(JSON.parse(result.stdout.slice('[bundle:budget] '.length)).actual.largestAssetBytes, 60);
});

for (const [name, change, expected] of [
  ['raw total', x => { x.totals.bytes = 101; x.largest[1].bytes = 41; }, /raw total 101 > 100/],
  ['gzip total', x => { x.totals.gzipBytes = 81; x.largest[1].gzipBytes = 33; }, /gzip total 81 > 80/],
  ['largest asset', x => { x.largest[0].bytes = 61; x.largest[1].bytes = 39; }, /largest asset 61 > 60/],
]) test(`actual ${name} regression fails`, () => {
  const report = structuredClone(sampleReport); change(report);
  const result = runCase({ report });
  assert.equal(result.status, 1, result.stdout + result.stderr);
  assert.match(result.stderr, /regressão detectada/); assert.match(result.stderr, expected);
});

test('oversized later asset cannot be hidden by first entry', () => {
  const report = structuredClone(sampleReport); report.largest.reverse();
  const result = runCase({ report, budget: { ...sampleBudget, maxLargestAssetBytes: 59 } });
  assert.equal(result.status, 1, result.stdout + result.stderr);
  assert.match(result.stderr, /largest asset 60 > 59/);
});

test('truncated largest cannot hide an oversized asset', () => {
  const report = structuredClone(sampleReport); report.largest.shift();
  invalid({ report, budget: { ...sampleBudget, maxLargestAssetBytes: 59 } });
});

function top20Report(files) {
  return { totals: { files, bytes: files * 4, gzipBytes: files * 2 },
    largest: Array.from({ length: 20 }, (_, i) => ({ file: `assets/part-${i}.js`, bytes: 4, gzipBytes: 2 })),
  };
}

for (const files of [20, 21]) test(`valid producer list for ${files} files passes`, () => {
  const result = runCase({ report: top20Report(files) });
  assert.equal(result.status, 0, result.stderr);
});

for (const key of ['bytes', 'gzipBytes']) {
  test(`complete largest list requires exact ${key} total`, () => {
    const report = structuredClone(sampleReport); report.totals[key]++;
    invalid({ report });
  });
  test(`omitted asset requires positive ${key} contribution`, () => {
    const report = top20Report(21); report.totals[key] = key === 'bytes' ? 80 : 40;
    invalid({ report });
  });
}

test('largest longer than producer top20 is rejected', () => {
  const report = top20Report(21);
  report.largest.push({ file: 'assets/extra.js', bytes: 4, gzipBytes: 2 });
  invalid({ report });
});

const invalidNumbers = [
  ['missing', undefined], ['null', null], ['string', '60'], ['zero', 0], ['negative', -1],
  ['fraction', 1.5], ['unsafe integer', 9007199254740992], ['boolean', true], ['array', []], ['object', {}],
];
for (const key of ['maxTotalBytes', 'maxTotalGzipBytes', 'maxLargestAssetBytes']) {
  for (const [name, value] of invalidNumbers) test(`invalid budget ${key}: ${name}`, () => {
    invalid({ budget: { ...sampleBudget, [key]: value } });
  });
}
for (const key of ['files', 'bytes', 'gzipBytes']) {
  for (const [name, value] of invalidNumbers) test(`invalid report totals.${key}: ${name}`, () => {
    const report = structuredClone(sampleReport); report.totals[key] = value;
    invalid({ report });
  });
}
for (const key of ['bytes', 'gzipBytes']) {
  for (const [name, value] of invalidNumbers) test(`invalid later asset ${key}: ${name}`, () => {
    const report = structuredClone(sampleReport); report.largest[1][key] = value;
    invalid({ report });
  });
}
for (const [name, value] of [['null', null], ['array', []], ['string', 'invalid'], ['boolean', false]]) {
  for (const key of ['budget', 'report']) test(`${key} shape rejects ${name}`, () => invalid({ [key]: value }));
  test(`totals shape rejects ${name}`, () => invalid({ report: { ...sampleReport, totals: value } }));
}
for (const [name, value] of [['missing', undefined], ['null', null], ['empty', []], ['object', {}], ['string', 'invalid']]) {
  test(`largest rejects ${name}`, () => invalid({ report: { ...sampleReport, largest: value } }));
}
for (const [name, value] of [['null', null], ['array', []], ['string', 'invalid']]) {
  test(`largest row rejects ${name}`, () => {
    const report = structuredClone(sampleReport); report.largest[1] = value;
    invalid({ report });
  });
}
for (const [name, value] of [['missing', undefined], ['null', null], ['empty', ''], ['whitespace', ' '], ['number', 1]]) {
  test(`asset filename rejects ${name}`, () => {
    const report = structuredClone(sampleReport); report.largest[1].file = value;
    invalid({ report });
  });
}
for (const [name, change] of [
  ['missing totals', x => { delete x.totals; }],
  ['too many listed files', x => { x.totals.files = 1; }],
  ['listed raw sum exceeds total', x => { x.totals.bytes = 99; }],
  ['listed gzip sum exceeds total', x => { x.totals.gzipBytes = 79; }],
  ['file count exceeds raw byte count', x => { x.totals.files = 101; }],
  ['file count exceeds gzip byte count', x => { x.totals.files = 81; }],
  ['duplicate asset filename', x => { x.largest[1].file = x.largest[0].file; }],
]) test(`impossible report rejects ${name}`, () => {
  const report = structuredClone(sampleReport); change(report);
  invalid({ report });
});
for (const key of ['budget', 'report']) {
  test(`malformed ${key} JSON fails closed`, () => invalid({ [key === 'budget' ? 'rawBudget' : 'rawReport']: '{' }));
  test(`missing ${key} file fails closed`, () => invalid({ missing: key }));
  test(`nonfinite ${key} numeric representation fails closed`, () => invalid({
    [key === 'budget' ? 'rawBudget' : 'rawReport']: JSON.stringify(key === 'budget' ? sampleBudget : sampleReport)
      .replace(key === 'budget' ? '"maxTotalBytes":100' : '"bytes":100', key === 'budget' ? '"maxTotalBytes":1e999' : '"bytes":1e999'),
  }));
}
