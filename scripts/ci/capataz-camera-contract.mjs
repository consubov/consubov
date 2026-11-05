import { readFileSync } from 'node:fs';
import path from 'node:path';

export const CAMERA_SAFE_BASELINE = '2.0.58';

export function compareSemver(left, right) {
  const parse = (value) => {
    if (typeof value !== 'string' || !/^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/.test(value)) return null;
    return value.split('.').map(Number);
  };
  const a = parse(left);
  const b = parse(right);
  if (!a || !b) return null;
  for (let i = 0; i < 3; i += 1) {
    if (a[i] !== b[i]) return a[i] > b[i] ? 1 : -1;
  }
  return 0;
}

export function cameraContractViolations({ camera = '', form = '', photo = '' } = {}) {
  const violations = [];
  const requireRule = (id, value) => { if (!value) violations.push(id); };
  const forbiddenNativePicker = /(?:\bgaleria\b|<input\b[^>]*type\s*=\s*(?:["']file["']|\{["']file["']\})|\bcapture\s*=\s*["']environment["'])/i;
  requireRule('CAM-GALLERY-FORBIDDEN', !forbiddenNativePicker.test(form) && !forbiddenNativePicker.test(camera));
  requireRule('CAM-IN-APP-STREAM', /navigator\.mediaDevices\.getUserMedia\s*\(/.test(camera)
    && /facingMode:\s*\{\s*ideal:\s*["']environment["']/.test(camera));
  requireRule('CAM-JPEG-FRAME-DELIVERED', /canvas\.toBlob\s*\(/.test(camera)
    && /["']image\/jpeg["']/.test(camera) && /await\s+onPhoto\(blob\)/.test(camera));
  requireRule('CAM-FILEREADER-PREVIEW', /await\s+prepareCapatazCameraBlob\(blob\)/.test(form)
    && /reader\.readAsDataURL\(file\)/.test(photo)
    && /await\s+compressImageDataUrl\(original,/.test(photo)
    && /await\s+checkPreview\(dataUrl\)/.test(photo));
  requireRule('CAM-STATE-UPDATED', /setFotoAuditoria\(dataUrl\)/.test(form)
    && /setFotoCocho\(dataUrl\)/.test(form)
    && /setObsFoto\(dataUrl\)/.test(form));
  requireRule('CAM-MANDATORY-BEFORE-SAVE', /if\s*\(auditoriaExigida\s*&&\s*!fotoAuditoria\)\s*return\s+false/.test(form)
    && /return\s+exigirFotoCocho\s*\?\s*!!fotoCocho\s*:\s*true/.test(form)
    && /if\s*\(saving\s*\|\|\s*photoProcessing\s*!==\s*null\s*\|\|\s*!canSave\(\)\)\s*return/.test(form));
  requireRule('CAM-OBLIGATORY-RED-BUTTON', /Tirar foto \(obrigatório\)/.test(form)
    && /variant=\{(?:auditoriaExigida|exigirFotoCocho)\s*\?\s*["']destructive["']/.test(form));
  requireRule('CAM-FULLSCREEN-TWO-CONTROLS', /!h-\[100dvh\]/.test(camera)
    && /height:\s*["']100dvh["']/.test(camera)
    && /aria-label=["']Voltar["']/.test(camera)
    && /aria-label=["']Capturar foto["']/.test(camera)
    && /data-testid=["']camera-fullscreen-preview["']/.test(camera));
  requireRule('CAM-CLEANUP-TRACKS', /getTracks\(\)\.forEach\(\(track\)\s*=>\s*track\.stop\(\)\)/.test(camera));
  requireRule('CAM-EMPTY-PASTURE-ZERO', /\{numAnimais\}\s*cab/.test(form));
  return violations;
}

const cameraFiles = [
  'apps/web/src/components/capataz/CapatazCameraCapture.tsx',
  'apps/web/src/components/capataz/SalgaForm.tsx',
  'apps/web/src/lib/capatazPhoto.ts',
];

export function readCameraFiles(root) {
  const [camera, form, photo] = cameraFiles.map((file) => {
    try { return readFileSync(path.join(root, file), 'utf8'); }
    catch { return ''; }
  });
  return { camera, form, photo };
}

/**
 * The Git main is older than the verified 2.0.58 deployment. Do NOT force a
 * red CI just because main has yet to reconcile the already-published camera.
 * While stale, the release catalog floor MUST prevent publishing old code.
 * When a candidate reaches the safe baseline, require the real camera source.
 */
export function assessCameraCandidate({ appVersion, markerVersion, releaseFloor, files }) {
  const markerCmp = compareSemver(markerVersion, appVersion);
  const floorCmp = compareSemver(releaseFloor, CAMERA_SAFE_BASELINE);
  const appCmp = compareSemver(appVersion, CAMERA_SAFE_BASELINE);
  if (markerCmp === null || markerCmp !== 0 || floorCmp === null || floorCmp < 0 || appCmp === null) {
    return { safe: false, status: 'CAMERA_RELEASE_METADATA_INVALID' };
  }
  if (appCmp < 0) {
    return { safe: true, status: 'LEGACY_MAIN_RELEASE_BLOCKED_BY_FLOOR' };
  }
  const violations = cameraContractViolations(files);
  return violations.length ? { safe: false, status: 'CAMERA_REGRESSION', violations }
    : { safe: true, status: 'CAMERA_CONTRACT_APPROVED' };
}
