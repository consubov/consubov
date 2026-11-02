import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

/** Compares source bytes without executing an Edge function or calling production. */
export function compareEdgeSource(published, candidate) {
  if (typeof published !== 'string' || typeof candidate !== 'string' ||
      published.trim().length === 0 || candidate.trim().length === 0) {
    throw new Error('Both nonempty Edge sources are required');
  }
  const digest = (value) => createHash('sha256').update(value, 'utf8').digest('hex');
  const publishedSha256 = digest(published);
  const candidateSha256 = digest(candidate);
  return {
    identical: publishedSha256 === candidateSha256,
    publishedSha256,
    candidateSha256,
    publishedLines: published.split('\n').length,
    candidateLines: candidate.split('\n').length,
  };
}

export async function checkEdgeDrift(publishedPath, candidatePath) {
  if (!publishedPath || !candidatePath) throw new Error('Supply published and candidate source paths');
  const [published, candidate] = await Promise.all([
    readFile(publishedPath, 'utf8'), readFile(candidatePath, 'utf8'),
  ]);
  return compareEdgeSource(published, candidate);
}

const isEntry = process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isEntry) {
  try {
    const result = await checkEdgeDrift(process.argv[2], process.argv[3]);
    const { publishedSha256, candidateSha256, publishedLines, candidateLines } = result;
    console.log(JSON.stringify({
      status: result.identical ? 'IDENTICAL_ONLY_NOT_QA_APPROVED' : 'DRIFT_NO_GO',
      publishedSha256, candidateSha256, publishedLines, candidateLines,
    }));
    // A difference always requires explicit reconciliation and release QA.
    process.exitCode = result.identical ? 0 : 2;
  } catch (error) {
    console.error('PREFLIGHT_ERROR:', error instanceof Error ? error.message : String(error));
    process.exitCode = 2;
  }
}
