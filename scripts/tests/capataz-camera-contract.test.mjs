import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import {
  assessCameraCandidate, CAMERA_SAFE_BASELINE,
  cameraContractViolations, readCameraFiles,
} from '../ci/capataz-camera-contract.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const read = (p) => readFileSync(path.join(root, p), 'utf8');
const fixture = () => ({
  camera: `navigator.mediaDevices.getUserMedia({audio:false,video:{facingMode:{ideal:"environment"}}});
canvas.toBlob(() => {}, "image/jpeg"); await onPhoto(blob);
stream.getTracks().forEach((track) => track.stop());
className="!h-[100dvh]" style={{height:"100dvh"}}
aria-label="Voltar" aria-label="Capturar foto"
data-testid="camera-fullscreen-preview"`,
  form: `const dataUrl = await prepareCapatazCameraBlob(blob);
setFotoAuditoria(dataUrl); setFotoCocho(dataUrl); setObsFoto(dataUrl);
if (auditoriaExigida && !fotoAuditoria) return false;
return exigirFotoCocho ? !!fotoCocho : true;
if (saving || photoProcessing !== null || !canSave()) return;
variant={auditoriaExigida ? "destructive" : "outline"}
Tirar foto (obrigatório)
{numAnimais} cab`,
  photo: `reader.readAsDataURL(file);
await compressImageDataUrl(original, {quality:0.68});
await checkPreview(dataUrl);`,
});
function mutate(source, key, before, after) {
  assert.ok(source[key].includes(before), `fixture missing ${before}`);
  return { ...source, [key]: source[key].replace(before, after) };
}

test('safe 2.0.58 camera contract fixture passes every invariant', () => {
  assert.deepEqual(cameraContractViolations(fixture()), []);
  assert.deepEqual(assessCameraCandidate({
    appVersion: CAMERA_SAFE_BASELINE, markerVersion: CAMERA_SAFE_BASELINE,
    releaseFloor: CAMERA_SAFE_BASELINE, files: fixture(),
  }), { safe: true, status: 'CAMERA_CONTRACT_APPROVED' });
});

test('reintroduced gallery/native file picker is blocked', () => {
  for (const form of [fixture().form + '\nGaleria',
    fixture().form + '\n<input type="file" capture="environment">']) {
    assert.ok(cameraContractViolations({ ...fixture(), form }).includes('CAM-GALLERY-FORBIDDEN'));
  }
});

test('lost camera stream, frame or preview are blocked', () => {
  for (const [key, before, after, rule] of [
    ['camera', 'navigator.mediaDevices.getUserMedia(', 'navigator.mediaDevices.getDisplayMedia(', 'CAM-IN-APP-STREAM'],
    ['camera', 'canvas.toBlob(', 'canvas.toDataURL(', 'CAM-JPEG-FRAME-DELIVERED'],
    ['camera', 'await onPhoto(blob)', 'void blob', 'CAM-JPEG-FRAME-DELIVERED'],
    ['form', 'await prepareCapatazCameraBlob(blob)', 'await prepareCapatazPhoto(blob)', 'CAM-FILEREADER-PREVIEW'],
    ['photo', 'reader.readAsDataURL(file)', 'reader.abort()', 'CAM-FILEREADER-PREVIEW'],
    ['photo', 'await checkPreview(dataUrl)', 'void dataUrl', 'CAM-FILEREADER-PREVIEW'],
  ]) {
    assert.ok(cameraContractViolations(mutate(fixture(), key, before, after)).includes(rule));
  }
});

test('missing mandatory photo, save gate or camera photo state is blocked', () => {
  for (const [before, after, rule] of [
    ['if (auditoriaExigida && !fotoAuditoria) return false', 'if (false) return false', 'CAM-MANDATORY-BEFORE-SAVE'],
    ['setFotoAuditoria(dataUrl)', 'void dataUrl', 'CAM-STATE-UPDATED'],
    ['Tirar foto (obrigatório)', 'Tirar foto (opcional)', 'CAM-OBLIGATORY-RED-BUTTON'],
    ['{numAnimais} cab', '{numAnimais || 1} cab', 'CAM-EMPTY-PASTURE-ZERO'],
  ]) {
    assert.ok(cameraContractViolations(mutate(fixture(), 'form', before, after)).includes(rule));
  }
});

test('fullscreen X/capture and stream cleanup regressions are blocked', () => {
  for (const [before, after, rule] of [
    ['!h-[100dvh]', '!h-[60dvh]', 'CAM-FULLSCREEN-TWO-CONTROLS'],
    ['height:"100dvh"', 'height:"60dvh"', 'CAM-FULLSCREEN-TWO-CONTROLS'],
    ['aria-label="Voltar"', 'aria-label="Cancelar tudo"', 'CAM-FULLSCREEN-TWO-CONTROLS'],
    ['aria-label="Capturar foto"', 'aria-label="Abrir galeria"', 'CAM-FULLSCREEN-TWO-CONTROLS'],
    ['stream.getTracks().forEach((track) => track.stop())', 'void stream', 'CAM-CLEANUP-TRACKS'],
  ]) {
    assert.ok(cameraContractViolations(mutate(fixture(), 'camera', before, after)).includes(rule));
  }
});

test('cannot release unsafe camera at or above 2.0.58', () => {
  const decision = assessCameraCandidate({
    appVersion: '2.0.59', markerVersion: '2.0.59',
    releaseFloor: CAMERA_SAFE_BASELINE, files: { ...fixture(), camera: '' },
  });
  assert.equal(decision.safe, false);
  assert.equal(decision.status, 'CAMERA_REGRESSION');
  assert.ok(decision.violations.length > 0);
});

test('legacy main must have safe release floor, cannot silently lower it', () => {
  const legacy = assessCameraCandidate({
    appVersion: '2.0.45', markerVersion: '2.0.45',
    releaseFloor: CAMERA_SAFE_BASELINE, files: { camera:'', form:'', photo:'' },
  });
  assert.deepEqual(legacy, {safe:true, status:'LEGACY_MAIN_RELEASE_BLOCKED_BY_FLOOR'});
  assert.equal(assessCameraCandidate({
    appVersion:'2.0.45', markerVersion:'2.0.45', releaseFloor:'2.0.0',
    files: {},
  }).safe, false);
});

test('real Git checkout is blocked below safe release floor or source-invalid above it', () => {
  const marker = JSON.parse(read('releases/consubov-app.json'));
  const catalog = JSON.parse(read('releases/catalog.json'));
  const version = read('apps/web/src/lib/appVersion.ts').match(/export const APP_VERSION = "([^"]+)"/)?.[1];
  const result = assessCameraCandidate({
    appVersion:version,
    markerVersion:marker.appVersion,
    releaseFloor:catalog.projects['consubov-app'].minVersion,
    files:readCameraFiles(root),
  });
  assert.equal(result.safe, true, JSON.stringify(result));
  if (result.status === 'LEGACY_MAIN_RELEASE_BLOCKED_BY_FLOOR') {
    // Main is not the latest deployed app. A release from this old checkout must be blocked by F23.
    assert.ok(catalog.projects['consubov-app'].minVersion >= CAMERA_SAFE_BASELINE);
  } else {
    assert.equal(result.status, 'CAMERA_CONTRACT_APPROVED');
  }
  console.log('[camera-contract]', result.status, 'appVersion', version);
});
