import React, { useState } from 'react';
import { useTranslation, Card, Button } from '@consubov/ui';
import { CapatazStore, CapatazState } from '../store/capatazStore';
import { compressPhoto, CompressedPhotoResult } from '../sync/photoCompression';

interface CapatazFotosTabProps {
  store: CapatazStore;
  state: CapatazState;
}

export const CapatazFotosTab: React.FC<CapatazFotosTabProps> = ({ store, state }) => {
  const { t } = useTranslation();

  const [selectedPasto, setSelectedPasto] = useState(state.pastos[0]?.pasto_id || 'pasto-01');
  const [photoType, setPhotoType] = useState<'leitura_matutina' | 'leitura_vespertina' | 'conferencia_limpeza' | 'auditoria'>('leitura_matutina');
  const [isCompressing, setIsCompressing] = useState(false);
  const [lastCompressed, setLastCompressed] = useState<CompressedPhotoResult | null>(null);
  const [successMessage, setSuccessMessage] = useState(false);

  // Simula captura de foto de alta resolução (4MB) e executa compressão client-side
  const handleSimulateCapture = async () => {
    setIsCompressing(true);
    try {
      // Simula uma foto de 4.2 MB (4.404.019 bytes)
      const fakeHighResBytes = new Uint8Array(4404019);
      const result = await compressPhoto(fakeHighResBytes, {
        pastoId: selectedPasto,
        cochoId: state.pastos.find(p => p.pasto_id === selectedPasto)?.cocho_id || 'cocho-pasto-01',
        tipoRegistro: photoType,
        maxWidth: 1280,
        maxHeight: 720,
        quality: 0.75
      });

      setLastCompressed(result);
      store.anexarFotoCocho(result);
      setSuccessMessage(true);
      setTimeout(() => setSuccessMessage(false), 4000);
    } finally {
      setIsCompressing(false);
    }
  };

  const photoList = Object.values(state.fotos);

  return (
    <div data-testid="capataz-fotos-tab">
      <Card elevation="elevated" style={{ marginBottom: 20 }}>
        <h2 style={{ fontSize: '1.25rem', fontWeight: 700, margin: '0 0 16px', color: '#0F172A' }}>
          {t('capataz.fotos.title')}
        </h2>

        {successMessage && (
          <div
            role="status"
            style={{
              padding: '12px 16px',
              backgroundColor: '#ECFDF5',
              border: '1px solid #10B981',
              borderRadius: 6,
              color: '#065F46',
              marginBottom: 16,
              fontWeight: 600
            }}
          >
            {t('capataz.fotos.success')}
          </div>
        )}

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 16, marginBottom: 20 }}>
          {/* Pasto */}
          <div>
            <label htmlFor="fotos-select-pasto" style={{ display: 'block', fontWeight: 600, marginBottom: 6, fontSize: '0.9rem' }}>
              {t('capataz.fotos.selectPasto')}
            </label>
            <select
              id="fotos-select-pasto"
              value={selectedPasto}
              onChange={e => setSelectedPasto(e.target.value)}
              aria-label={t('capataz.fotos.selectPasto')}
              style={{ width: '100%', padding: '10px 12px', borderRadius: 6, border: '1px solid #CBD5E1', fontSize: '0.95rem' }}
            >
              {state.pastos.map(p => (
                <option key={p.pasto_id} value={p.pasto_id}>
                  {p.nome_pasto}
                </option>
              ))}
            </select>
          </div>

          {/* Tipo de Registro */}
          <div>
            <label htmlFor="fotos-select-type" style={{ display: 'block', fontWeight: 600, marginBottom: 6, fontSize: '0.9rem' }}>
              {t('capataz.fotos.photoType')}
            </label>
            <select
              id="fotos-select-type"
              value={photoType}
              onChange={e => setPhotoType(e.target.value as any)}
              aria-label={t('capataz.fotos.photoType')}
              style={{ width: '100%', padding: '10px 12px', borderRadius: 6, border: '1px solid #CBD5E1', fontSize: '0.95rem' }}
            >
              <option value="leitura_matutina">{t('capataz.fotos.morning')}</option>
              <option value="leitura_vespertina">{t('capataz.fotos.afternoon')}</option>
              <option value="conferencia_limpeza">{t('capataz.fotos.cleaning')}</option>
              <option value="auditoria">{t('capataz.fotos.audit')}</option>
            </select>
          </div>
        </div>

        {/* Botão de Disparo / Captura */}
        <div style={{ marginBottom: 20 }}>
          <Button
            type="button"
            variant="primary"
            onClick={handleSimulateCapture}
            disabled={isCompressing}
            style={{ minHeight: 48, minWidth: 240, fontSize: '1rem' }}
          >
            {isCompressing ? t('capataz.fotos.compressing') : t('capataz.fotos.captureButton')}
          </Button>
        </div>

        {/* Estatísticas de Compressão da Última Foto */}
        {lastCompressed && (
          <div
            style={{
              padding: 16,
              backgroundColor: '#EFF6FF',
              border: '1px solid #93C5FD',
              borderRadius: 8,
              marginTop: 16
            }}
          >
            <div style={{ fontWeight: 700, color: '#1E40AF', marginBottom: 6 }}>
              {t('capataz.fotos.uploadQueue')}
            </div>
            <div style={{ fontSize: '0.9rem', color: '#1E3A8A' }}>
              {t('capataz.fotos.compressedInfo', {
                originalSize: Math.round(lastCompressed.originalSizeBytes / 1024).toString(),
                compressedSize: Math.round(lastCompressed.compressedSizeBytes / 1024).toString(),
                savings: lastCompressed.compressionRatioPct.toString()
              })}
            </div>
            <div style={{ fontSize: '0.8rem', color: '#3B82F6', marginTop: 4 }}>
              {t('capataz.fotos.sizeReduction', { percent: lastCompressed.compressionRatioPct.toString() })}
            </div>
          </div>
        )}
      </Card>

      {/* Galeria Local do Dia */}
      <Card elevation="elevated">
        <h3 style={{ fontSize: '1.1rem', fontWeight: 700, margin: '0 0 16px' }}>
          {t('capataz.fotos.galleryTitle')} ({photoList.length})
        </h3>

        {photoList.length === 0 ? (
          <p style={{ color: '#64748B', margin: 0 }}>
            {t('capataz.fotos.emptyGallery')}
          </p>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 16 }}>
            {photoList.map(photo => {
              const pastoName = state.pastos.find(p => p.pasto_id === photo.pastoId)?.nome_pasto || photo.pastoId;
              return (
                <div
                  key={photo.attachment_id}
                  style={{
                    border: '1px solid #CBD5E1',
                    borderRadius: 8,
                    overflow: 'hidden',
                    backgroundColor: '#F8FAFC'
                  }}
                >
                  <div
                    style={{
                      height: 120,
                      backgroundColor: '#E2E8F0',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      color: '#64748B',
                      fontSize: '0.85rem',
                      fontWeight: 600
                    }}
                  >
                    {t('capataz.fotos.photoResolution')}
                  </div>
                  <div style={{ padding: 10 }}>
                    <div style={{ fontWeight: 700, fontSize: '0.875rem', color: '#0F172A' }}>
                      {pastoName}
                    </div>
                    <div style={{ fontSize: '0.8rem', color: '#64748B', marginTop: 2 }}>
                      {t('capataz.fotos.sizeKb', {
                        size: Math.round(photo.compressedSizeBytes / 1024).toString(),
                        percent: photo.compressionRatioPct.toString()
                      })}
                    </div>
                    <div style={{ fontSize: '0.75rem', color: '#94A3B8', marginTop: 4 }}>
                      {photo.createdAt.slice(11, 16)}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </Card>
    </div>
  );
};
