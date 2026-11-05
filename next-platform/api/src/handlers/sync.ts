export async function handleSyncRequest(req: Request): Promise<Response> {
  const url = new URL(req.url);
  const tenantId = url.searchParams.get('tenant_id') || 'tenant-lab-001';
  const sinceCursor = Number(url.searchParams.get('since_cursor') || '0');

  return new Response(
    JSON.stringify({
      tenant_id: tenantId,
      fazenda_id: 'fazenda-guarani-01',
      next_cursor: sinceCursor + 1,
      has_more: false,
      deltas: [],
      server_timestamp: new Date().toISOString()
    }),
    { status: 200, headers: { 'Content-Type': 'application/json' } }
  );
}
