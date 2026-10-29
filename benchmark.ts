const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

async function simulateSequential(items: any[]) {
  const start = performance.now();
  for (const item of items) {
    await delay(50); // simulate 50ms network request
  }
  return performance.now() - start;
}

async function simulateParallel(items: any[]) {
  const start = performance.now();
  await Promise.all(items.map(async (item) => {
    await delay(50);
  }));
  return performance.now() - start;
}

async function runBenchmark() {
  const items = Array.from({ length: 20 }, (_, i) => i);
  console.log(`Benchmarking with ${items.length} items (50ms simulated delay per request)...`);

  const seqTime = await simulateSequential(items);
  console.log(`Sequential time: ${seqTime.toFixed(2)} ms`);

  const parTime = await simulateParallel(items);
  console.log(`Parallel time: ${parTime.toFixed(2)} ms`);

  console.log(`Speedup: ${(seqTime / parTime).toFixed(2)}x`);
}

runBenchmark();
