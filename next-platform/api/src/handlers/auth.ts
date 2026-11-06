import {
  SYNTHETIC_USERS,
  resolveActiveContext,
  createClaimsFromContext,
  signSyntheticJwt,
  SYNTHETIC_JWT_SECRET_LAB,
  type SyntheticUserSession,
  type SyntheticJwtClaims,
  type TokenPair
} from '@consubov/auth-client';
import { initialModuleData } from '../fixtures/module-provisioning';
import { LabGrantRegistry } from '../auth/grants';
import { InMemoryLedger } from '../ledger/in-memory-ledger';

const LAB_SESSION_TTL_SECONDS = 24 * 60 * 60;
const directLedger = new InMemoryLedger();
const directGrants = new LabGrantRegistry();

export async function handleAuthRequest(req: Request, ledger: InMemoryLedger = directLedger, grants: LabGrantRegistry = directGrants): Promise<Response> {
  const url = new URL(req.url);
  if (url.pathname !== '/api/v1/auth/login' || req.method !== 'POST') {
    return json({ error: 'NOT_FOUND', message: 'Rota de autenticação não encontrada.' }, 404);
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return json({ error: 'INVALID_JSON', message: 'Corpo da requisição deve ser um JSON válido.' }, 400);
  }

  if (!body || typeof body !== 'object') return json({ error: 'INVALID_REQUEST', message: 'Requisição inválida.' }, 400);
  const input = body as Record<string, unknown>;
  const email = typeof input.email === 'string' ? input.email.trim().toLowerCase() : '';
  const password = typeof input.password === 'string' ? input.password : '';
  const deviceId = typeof input.device_id === 'string' ? input.device_id.trim() : '';
  const membershipId = typeof input.membership_id === 'string' ? input.membership_id : undefined;
  if (!email || !password || !deviceId) {
    return json({ error: 'MISSING_CREDENTIALS', message: 'Email, senha e identificador do dispositivo são obrigatórios.' }, 400);
  }
  if (deviceId.length > 128) return json({ error: 'INVALID_DEVICE', message: 'Identificador de dispositivo inválido.' }, 400);

  const user = SYNTHETIC_USERS[email];
  if (!user || password !== user.password_hash) {
    return json({ error: 'UNAUTHORIZED', message: 'Credenciais inválidas.' }, 401);
  }
  if (user.memberships.some(membership => membership.profile_id !== user.primary_profile)) {
    return json({ error: 'ACCOUNT_PROFILE_INVALID', message: 'A conta deve possuir um único perfil operacional.' }, 403);
  }

  const availableMemberships = user.memberships.filter(membership =>
    membership.is_active && membership.profile_id === user.primary_profile
  );
  if (availableMemberships.length === 0) {
    return json({ error: 'FORBIDDEN', message: 'ACESSO_NEGADO_403: Usuário não possui vínculos ativos no sistema.' }, 403);
  }
  const selectedMembership = membershipId
    ? availableMemberships.find(membership => membership.membership_id === membershipId)
    : undefined;
  if (membershipId && !selectedMembership) {
    return json({ error: 'UNAUTHORIZED_CONTEXT', message: 'Vínculo selecionado não pertence ao usuário ou está inativo.' }, 403);
  }

  const now = new Date();
  const expiresAt = new Date(now.getTime() + LAB_SESSION_TTL_SECONDS * 1000);
  const baseSession: SyntheticUserSession = {
    session_id: `sess-${user.user_id}-${crypto.randomUUID()}`,
    user_id: user.user_id,
    user_name: user.name,
    user_email: user.email,
    profile_id: user.primary_profile,
    memberships: user.memberships,
    active_context: null,
    issued_at: now.toISOString(),
    expires_at: expiresAt.toISOString(),
    device_id: deviceId
  };

  if (selectedMembership) {
    baseSession.active_context = resolveActiveContext(baseSession, selectedMembership.membership_id);
  }

  let tokens: TokenPair | undefined;
  let selectedClaims: SyntheticJwtClaims | undefined;
  if (selectedMembership && baseSession.active_context) {
    const claims = createClaimsFromContext(baseSession, baseSession.active_context, LAB_SESSION_TTL_SECONDS);
    selectedClaims = claims;
    grants.register(claims);
    tokens = {
      access_token: await signSyntheticJwt(claims, SYNTHETIC_JWT_SECRET_LAB, { expiresInSeconds: LAB_SESSION_TTL_SECONDS }),
      refresh_token: '',
      token_type: 'Bearer',
      expires_in: LAB_SESSION_TTL_SECONDS
    };
  }

  if (selectedClaims && !grants.check(selectedClaims, selectedClaims.profile_id === 'administrador' ? 'audit:view' : 'sync.pull')) {
    return json({ error: 'FORBIDDEN', message: 'O vínculo ou a sessão mudou durante a autenticação.' }, 403);
  }

  let initialData = initialModuleData(baseSession);
  if (initialData && tokens) {
    const claims = selectedClaims!;
    ledger.initialize(claims, initialData.snapshot.data, initialData.snapshot.modifiedAt);
    const current = ledger.currentSnapshot(claims)!;
    initialData = { ...initialData, attachment_refs: ledger.attachmentRefs(claims, [current.data]), snapshot: { ...initialData.snapshot, data: current.data, version: current.version, modifiedAt: current.modifiedAt } };
  }
  return json({
    session: baseSession,
    available_memberships: availableMemberships,
    requires_context_selection: !selectedMembership,
    ...(tokens ? { tokens, initial_data: initialData } : {})
  }, 200);
}

function json(body: unknown, status: number): Response {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
}
