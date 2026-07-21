
alter table syncvet_lote_ciclos
  add column if not exists fonte_protocolo text not null default 'veterinario'
    check (fonte_protocolo in ('fazenda', 'veterinario')),
  add column if not exists fonte_semen text not null default 'veterinario'
    check (fonte_semen in ('fazenda', 'veterinario')),
  add column if not exists semen_id uuid references syncvet_semen(id),
  add column if not exists semen_descricao_fazenda text;

alter table syncvet_manejos
  add column if not exists tipo_manejo text
    check (tipo_manejo in ('dg_us', 'iatf', 'retirada', 'outro')),
  add column if not exists hora_inicio timestamptz,
  add column if not exists fonte_protocolo text check (fonte_protocolo in ('fazenda', 'veterinario')),
  add column if not exists fonte_semen text check (fonte_semen in ('fazenda', 'veterinario')),
  add column if not exists semen_id uuid references syncvet_semen(id),
  add column if not exists semen_descricao_fazenda text;

create table if not exists syncvet_prenhez_historico (
  id uuid primary key default gen_random_uuid(),
  manejo_id uuid not null references syncvet_manejos(id) on delete cascade,
  veterinario_id uuid references syncvet_equipe(id),
  fazenda_id uuid,
  lote_id uuid,
  data date not null,
  total_prenhas integer not null default 0,
  total_diagnosticadas integer not null default 0,
  taxa_pct numeric(5,2),
  created_at timestamptz not null default now()
);

grant select, insert, update, delete on public.syncvet_prenhez_historico to authenticated;
grant all on public.syncvet_prenhez_historico to service_role;

create index if not exists syncvet_prenhez_historico_vet_idx on syncvet_prenhez_historico (veterinario_id);
create index if not exists syncvet_prenhez_historico_faz_idx on syncvet_prenhez_historico (fazenda_id);
create index if not exists syncvet_prenhez_historico_data_idx on syncvet_prenhez_historico (data);

create or replace function syncvet_registrar_prenhez_historico()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.tipo_manejo = 'dg_us' and new.status = 'concluido'
     and (old.status is distinct from 'concluido') then
    insert into syncvet_prenhez_historico
      (manejo_id, veterinario_id, fazenda_id, lote_id, data, total_prenhas, total_diagnosticadas, taxa_pct)
    select
      new.id,
      new.responsavel_id,
      coalesce(new.fazenda_id, l.fazenda_id),
      coalesce(new.lote_id, lc.lote_id),
      coalesce(new.data_execucao::date, current_date),
      count(*) filter (where r.resultado = 'prenha'),
      count(*),
      round(100.0 * count(*) filter (where r.resultado = 'prenha') / nullif(count(*), 0), 2)
    from syncvet_manejo_resultados r
    left join syncvet_lote_ciclos lc on lc.id = new.lote_ciclo_id
    left join syncvet_lotes l on l.id = coalesce(new.lote_id, lc.lote_id)
    where r.manejo_id = new.id
    group by l.fazenda_id, lc.lote_id;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_syncvet_prenhez_historico on syncvet_manejos;
create trigger trg_syncvet_prenhez_historico
after update on syncvet_manejos
for each row execute function syncvet_registrar_prenhez_historico();

alter table syncvet_prenhez_historico disable row level security;
