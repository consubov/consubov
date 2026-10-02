import { RBAC_MATRIX, checkPermission, UserProfile, Resource } from './rbac-matrix';

describe('RBAC Matrix', () => {
  const profiles: UserProfile[] = [
    'administrador',
    'gerente',
    'capataz',
    'escritório',
    'operador de fábrica',
    'consultor',
    'pesador',
    'pecuarista',
    'SyncVet legado',
  ];

  const resources: Resource[] = [
    'usuários',
    'fazendas',
    'retiros',
    'pastos',
    'produtos/dietas',
    'operações',
    'relatórios',
    'estoque',
    'visitas',
    'fábrica',
    'pesagens',
    'administração SaaS',
  ];

  test('matrix contains all profiles and resources', () => {
    expect(Object.keys(RBAC_MATRIX)).toHaveLength(profiles.length);
    profiles.forEach(profile => {
      expect(RBAC_MATRIX[profile]).toBeDefined();
      expect(Object.keys(RBAC_MATRIX[profile])).toHaveLength(resources.length);
      resources.forEach(resource => {
        expect(RBAC_MATRIX[profile][resource]).toBeDefined();
      });
    });
  });

  test('checkPermission function returns correct value from matrix', () => {
    profiles.forEach(profile => {
      resources.forEach(resource => {
        const expected = RBAC_MATRIX[profile][resource];
        const actual = checkPermission(profile, resource);
        expect(actual).toBe(expected);
      });
    });
  });

  test('each cell contains a valid permission value', () => {
    profiles.forEach(profile => {
      resources.forEach(resource => {
        const permission = RBAC_MATRIX[profile][resource];
        expect(['ALLOW', 'DENY', 'PENDENTE', 'N/A']).toContain(permission);
      });
    });
  });
});

