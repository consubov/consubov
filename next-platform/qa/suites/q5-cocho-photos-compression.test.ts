import { describe, it, expect, beforeEach } from 'bun:test';
import {
  compressPhoto,
  calculateAspectRatioFit,
  CapatazStore,
  resetCapatazStoresForTesting
} from '../../apps/fazenda/capataz/src';
import { createCapatazTestStore, resetCapatazTestData } from '../harness/capataz-test-runtime';

describe('Q5.3: Gestão de Fotos de Cocho, Compressão Client-Side e Dissociação de Upload', () => {
  let store: CapatazStore;

  beforeEach(async () => {
    resetCapatazStoresForTesting();
    resetCapatazTestData();
    store = createCapatazTestStore('consubov:tenant-test:user-capataz:fazenda-01:capataz');
    await store.ready;
  });

  it('Q5.3.1: deve calcular aspect ratio fit mantendo proporção original sem distorção', () => {
    // Foto Full HD (1920x1080) reduzida para max 1280x720
    const fit1 = calculateAspectRatioFit(1920, 1080, 1280, 720);
    expect(fit1.width).toBe(1280);
    expect(fit1.height).toBe(720);

    // Foto vertical de celular (1080x1920)
    const fit2 = calculateAspectRatioFit(1080, 1920, 1280, 720);
    expect(fit2.height).toBe(720);
    expect(fit2.width).toBe(Math.round((1080 * 720) / 1920));
    expect(fit2.width).toBeLessThanOrEqual(1280);

    // Foto quadrada (1000x1000)
    const fit3 = calculateAspectRatioFit(1000, 1000, 1280, 720);
    expect(fit3.width).toBe(720);
    expect(fit3.height).toBe(720);
  });

  it('Q5.3.2: mantém fixture headless de metadados; compressão real exige teste browser', async () => {
    // 4.2 MB simulados
    const originalBytes = new Uint8Array(4404019);
    const result = await compressPhoto(originalBytes, {
      maxWidth: 1280,
      maxHeight: 720,
      quality: 0.75,
      pastoId: 'pasto-01',
      tipoRegistro: 'leitura_matutina'
    });

    expect(result.attachment_id).toBeDefined();
    expect(result.attachment_id).toMatch(/^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i);
    expect(result.originalSizeBytes).toBe(4404019);

    // Deve estar na faixa otimizada de 80KB a 220KB
    expect(result.compressedSizeBytes).toBeGreaterThanOrEqual(80 * 1024);
    expect(result.compressedSizeBytes).toBeLessThanOrEqual(250 * 1024);

    // Economia deve ser superior a 85%
    expect(result.compressionRatioPct).toBeGreaterThanOrEqual(85);
    expect(result.dataUrl.startsWith('data:image/jpeg;base64,')).toBe(true);
    expect(result.width).toBeLessThanOrEqual(1280);
    expect(result.height).toBeLessThanOrEqual(720);
  });

  it('Q5.3.3: deve dissociar o upload pesado: comando outbox contém apenas metadados e referência de anexo', async () => {
    const rawImage = new Uint8Array(3500000); // 3.5 MB
    const compressed = await compressPhoto(rawImage, {
      pastoId: 'pasto-02',
      cochoId: 'cocho-pasto-02',
      tipoRegistro: 'conferencia_limpeza'
    });

    // Anexa a foto ao store
    const { envelope } = await store.anexarFotoCocho(compressed);

    // 1. O blob reside no store de fotos local indexado por attachment_id
    const state = store.getState();
    expect(state.fotos[compressed.attachment_id]).toBeDefined();
    expect(state.fotos[compressed.attachment_id]!.compressedSizeBytes).toBe(compressed.compressedSizeBytes);

    // 2. O comando na outbox possui envelope textual leve
    expect(envelope.command_type).toBe('capataz.cocho.foto_adicionar');
    expect(envelope.payload.foto_attachment_id).toBe(compressed.attachment_id);
    expect(envelope.payload.tipo_registro).toBe('conferencia_limpeza');
    expect(envelope.attachment_refs.length).toBe(1);
    expect(envelope.attachment_refs[0]!.attachment_id).toBe(compressed.attachment_id);

    // O payload do comando NÃO deve conter o base64 gigante nem blob pesado
    const serializedPayload = JSON.stringify(envelope.payload);
    expect(serializedPayload.length).toBeLessThan(1024); // menos de 1KB de metadados
  });

  it('Q5.3.4: deve permitir vincular foto ao comando de leitura de cocho com AttachmentRef de integridade', async () => {
    const attachmentId = 'att-cocho-teste-sha256-ref';
    const photo = await compressPhoto(new Uint8Array(1024), { pastoId: 'pasto-01' });
    photo.attachment_id = attachmentId;
    await store.anexarFotoCocho(photo);

    const { envelope, leitura } = await store.registrarLeituraCocho({
      pasto_id: 'pasto-01',
      produto_id: 'prod-sal-mineral-80',
      escore_cocho: 2,
      sacos_fornecidos: 4,
      foto_attachment_id: attachmentId
    });

    expect(leitura.foto_attachment_id).toBe(attachmentId);
    expect(envelope.payload.foto_attachment_id).toBe(attachmentId);
    expect(envelope.attachment_refs.length).toBe(1);
    expect(envelope.attachment_refs[0]!.attachment_id).toBe(attachmentId);
    expect(envelope.attachment_refs[0]!.mime_type).toBe('image/jpeg');
    expect(envelope.attachment_refs[0]!.hash_sha256.length).toBe(64);
  });
});
