import { describe, test } from "vitest";

describe("Benchmark OndeUsarGerente loops vs Promise.all (simulation)", () => {
    const retirosMudados = Array.from({ length: 50 }).map((_, i) => ({ id: `retiro-${i}` }));
    const mockUpdate = async () => new Promise(resolve => setTimeout(resolve, 5));

    test("Sequential vs Concurrent", async () => {
        const startSeq = Date.now();
        for (const r of retirosMudados) {
            await mockUpdate();
        }
        const endSeq = Date.now();

        const startConc = Date.now();
        await Promise.all(retirosMudados.map(async (r) => {
            await mockUpdate();
        }));
        const endConc = Date.now();

        console.log(`Sequential took: ${endSeq - startSeq}ms`);
        console.log(`Concurrent took: ${endConc - startConc}ms`);
    });
});
