-- P0: statement_timeout with authenticated role is 8s; the canonical
-- security-barrier views repeatedly evaluate role functions and time out.
-- Source formula matches public.get_painel_mae for checked months.
-- Use SECURITY INVOKER and explicit authorization. NEVER service_role.
CREATE OR REPLACE FUNCTION public.get_painel_mae_rapido(
 p_fazenda_id uuid, p_retiro_id uuid, p_mes integer, p_ano integer
) RETURNS TABLE (
 consumo_real_g_cab_dia numeric, consumo_global_g_cab_dia numeric,
 eficiencia numeric, pastos_na_meta_num integer,
 pastos_na_meta_den integer, peso_medio_kg numeric
) LANGUAGE plpgsql STABLE SECURITY INVOKER
SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE current_uid uuid := auth.uid();
BEGIN
 IF CURRENT_USER <> 'authenticated' OR current_uid IS NULL THEN
  RAISE EXCEPTION 'Acesso nao autorizado' USING ERRCODE = '42501';
 END IF;
 IF p_fazenda_id IS NULL OR p_mes NOT BETWEEN 1 AND 12 OR
    p_ano NOT BETWEEN 2000 AND 2100 OR p_mes IS NULL OR p_ano IS NULL THEN
  RAISE EXCEPTION 'Periodo invalido' USING ERRCODE = '22023';
 END IF;
 IF p_retiro_id IS NOT NULL AND NOT EXISTS (
   SELECT 1 FROM public.retiros r
   WHERE r.id=p_retiro_id AND r.fazenda_id=p_fazenda_id
 ) THEN
  RAISE EXCEPTION 'Retiro nao autorizado' USING ERRCODE = '42501';
 END IF;
 IF NOT (
   public.is_admin(current_uid)
   OR EXISTS(SELECT 1 FROM public.gerentes g WHERE g.user_id=current_uid
     AND g.ativo IS TRUE AND (g.fazenda_id=p_fazenda_id
       OR EXISTS (SELECT 1 FROM public.gerentes_fazendas gf
          WHERE gf.gerente_id=g.id AND gf.fazenda_id=p_fazenda_id)))
   OR EXISTS(SELECT 1 FROM public.escritorios e WHERE e.user_id=current_uid
     AND e.ativo IS TRUE AND e.fazenda_id=p_fazenda_id)
   OR EXISTS(SELECT 1 FROM public.capatazes c
     JOIN public.retiros r ON r.fazenda_id=p_fazenda_id
     WHERE c.user_id=current_uid AND c.ativo IS TRUE
       AND (p_retiro_id IS NULL OR r.id=p_retiro_id)
       AND (c.retiro_id=r.id OR EXISTS(SELECT 1 FROM public.capatazes_retiros cr
           WHERE cr.capataz_id=c.id AND cr.retiro_id=r.id)))
 ) THEN
  RAISE EXCEPTION 'Fazenda nao autorizada' USING ERRCODE = '42501';
 END IF;
 RETURN QUERY
with
allowed as materialized (
 select r.id,r.fazenda_id,r.produto_id,r.peso_saco_kg,r.intervalo_padrao_dias
 from public.retiros r where r.fazenda_id=p_fazenda_id
 and (p_retiro_id is null or r.id=p_retiro_id)
 and CURRENT_USER='authenticated' and auth.uid() is not null
 and (
   (select public.is_admin(auth.uid()))
   or exists(select 1 from public.gerentes g where g.user_id=auth.uid() and g.ativo
     and (g.fazenda_id=r.fazenda_id or exists (select 1 from public.gerentes_fazendas gf where gf.gerente_id=g.id and gf.fazenda_id=r.fazenda_id)))
   or exists(select 1 from public.escritorios e where e.user_id=auth.uid() and e.ativo and e.fazenda_id=r.fazenda_id)
   or exists(select 1 from public.capatazes c where c.user_id=auth.uid() and c.ativo
     and (c.retiro_id=r.id or exists(select 1 from public.capatazes_retiros cr where cr.capataz_id=c.id and cr.retiro_id=r.id)))
 )
),
ev as materialized (
 select l.id,l.pasto_id,l.created_at,l.num_sacos>0 is_prod,coalesce(l.cocho_cheio,false) and l.num_sacos<=0 is_cc
 from public.lancamentos l join allowed r on r.id=l.retiro_id
 where l.fazenda_id=r.fazenda_id and (l.num_sacos>0 or l.cocho_cheio=true)
),
evg as (
 select e.*,sum(is_prod::int) over(partition by pasto_id order by created_at,is_prod desc,id rows unbounded preceding) as grp
 from ev e
),
cc as materialized (
 select (array_agg(id) filter(where is_prod))[1] as prod_id,count(*) filter(where is_cc)::int as n
 from evg group by pasto_id,grp
),
raw as materialized (
 select l.*,p.ativo,coalesce(nullif(l.num_animais,0),p.num_animais,0) as animais,
 p.num_animais animais_hoje,p.peso_medio_kg pasto_peso,p.sexo pasto_sexo,p.categoria pasto_categoria,
 p.intervalo_padrao_dias pasto_intervalo,r.intervalo_padrao_dias retiro_intervalo,
 f.intervalo_padrao_dias fazenda_intervalo,r.peso_saco_kg retiro_saco,
 pr.peso_saco_kg prod_saco,pr.amarelo_buffer_g,
 pr.consumo_recria1,pr.consumo_recria2,pr.consumo_engorda,
 pr.margem_mais_recria1_pct,pr.margem_mais_recria2_pct,pr.margem_mais_engorda_pct,
 pr.margem_menos_recria1_pct,pr.margem_menos_recria2_pct,pr.margem_menos_engorda_pct,
 coalesce(cc.n,0) n_cc,
 row_number() over (partition by l.pasto_id order by l.created_at desc) rn_all,
 row_number() over (partition by l.pasto_id,l.mes_referencia,l.ano_referencia order by l.created_at desc) rn_month
 from public.lancamentos l
 join allowed r on r.id=l.retiro_id
 join public.pastos p on p.id=l.pasto_id and p.retiro_id=r.id
 join public.fazendas f on f.id=r.fazenda_id
 left join public.ocupacoes_pasto o on o.id=l.ocupacao_id
 left join public.produtos pr on pr.id=coalesce(o.produto_id,p.produto_id,r.produto_id)
 left join cc on cc.prod_id=l.id
 where l.fazenda_id=r.fazenda_id and l.num_sacos>0 and coalesce(nullif(l.num_animais,0),p.num_animais,0)>0
),
days as materialized (
 select b.*,
 case when b.cobertura_dias_override is not null then b.cobertura_dias_override
 when b.rn_all=1 and coalesce(b.animais_hoje,0)>0 then greatest(coalesce(b.pasto_intervalo,b.retiro_intervalo,b.fazenda_intervalo,4)*(1+b.n_cc),
 least((now() at time zone 'America/Sao_Paulo')::date,(date_trunc('month',b.created_at at time zone 'America/Sao_Paulo')+interval '1 mon -1 days')::date)
 -(b.created_at at time zone 'America/Sao_Paulo')::date)
 else coalesce(b.pasto_intervalo,b.retiro_intervalo,b.fazenda_intervalo,4)*(1+b.n_cc) end real_days,
 case when b.rn_all=1 and coalesce(b.animais_hoje,0)>0 then greatest(
 case when b.cobertura_dias_override is null then coalesce(b.pasto_intervalo,b.retiro_intervalo,b.fazenda_intervalo,4)*(1+b.n_cc) else b.cobertura_dias_override end,
 (now() at time zone 'America/Sao_Paulo')::date-(b.created_at at time zone 'America/Sao_Paulo')::date)
 else case when b.cobertura_dias_override is null then coalesce(b.pasto_intervalo,b.retiro_intervalo,b.fazenda_intervalo,4)*(1+b.n_cc) else b.cobertura_dias_override end end global_days
 from raw b
),
vp as materialized (
 select d.*,
 round(d.num_sacos*coalesce(d.prod_saco,0)*1000.0/nullif(d.animais*d.global_days,0),2) global_consumo,
 round((d.num_sacos*coalesce(d.prod_saco,0)*1000.0/nullif(d.animais*d.global_days,0))/
 nullif((case when lower(coalesce(nullif(d.categoria,''),d.pasto_categoria,'')) like '%recria 1%' or lower(coalesce(nullif(d.categoria,''),d.pasto_categoria,'')) like '%recria1%' then d.consumo_recria1
 when lower(coalesce(nullif(d.categoria,''),d.pasto_categoria,'')) like '%recria 2%' or lower(coalesce(nullif(d.categoria,''),d.pasto_categoria,'')) like '%recria2%' then d.consumo_recria2 else d.consumo_engorda end)
 *coalesce(nullif(d.peso_medio_kg,0),d.pasto_peso)/100.0*1000,0),2) global_indice
 from days d
 where d.mes_referencia=p_mes and d.ano_referencia=p_ano and d.rn_month=1 and d.ativo
),
classification as materialized (
 select v.*,
 public.calcular_categoria(coalesce(nullif(v.pasto_peso,0),v.peso_medio_kg),v.pasto_sexo) category,
 coalesce(nullif(v.pasto_peso,0),v.peso_medio_kg) final_peso
 from vp v
),
indicators as (
 select c.*,
 case category when 'Recria 1' then consumo_recria1 when 'Recria 2' then consumo_recria2 else consumo_engorda end target_consumo,
 case category when 'Recria 1' then margem_mais_recria1_pct when 'Recria 2' then margem_mais_recria2_pct else margem_mais_engorda_pct end plus_margin,
 case category when 'Recria 1' then margem_menos_recria1_pct when 'Recria 2' then margem_menos_recria2_pct else margem_menos_engorda_pct end minus_margin
 from classification c
),
agg as (
 select round(sum(coalesce(v.num_sacos*v.prod_saco,v.num_sacos*v.retiro_saco,v.consumo_g_cab_dia*(v.animais*greatest(coalesce(nullif(v.dias_no_pasto,0),1),1))/1000))*1000/nullif(sum(v.animais*v.global_days),0),2) consumo_global,
 round(sum(greatest(0,100-abs(1-v.global_indice)*100)*(v.animais*v.global_days))/nullif(sum(v.animais*v.global_days),0),1) eficiencia,
 count(*) filter(where public.classificar_consumo(v.global_consumo,
 case when coalesce(v.target_consumo,0)>0 and coalesce(v.final_peso,0)>0 then v.target_consumo/100*v.final_peso*1000 else NULL end,
 v.plus_margin,v.minus_margin,coalesce(v.amarelo_buffer_g,0)) in ('Ideal','Atenção'))::int as na_meta,
 count(*)::int as pastos
 from indicators v
),
realagg as (
 select round(sum(d.num_sacos*coalesce(d.prod_saco,0))*1000/nullif(sum(d.animais*d.real_days),0),2) consumo_real
 from days d where d.mes_referencia=p_mes and d.ano_referencia=p_ano
),
weightagg as (
 select round(sum(coalesce(coalesce(nullif(p.peso_medio_kg,0),i.peso_medio_kg),p.peso_medio_kg,0)*p.num_animais)/nullif(sum(p.num_animais),0),1) peso_medio
 from public.pastos p join allowed r on r.id=p.retiro_id
 left join indicators i on i.pasto_id=p.id
 where p.ativo and p.num_animais>0
)
select ra.consumo_real,ag.consumo_global,ag.eficiencia,ag.na_meta,ag.pastos,wa.peso_medio
from realagg ra cross join agg ag cross join weightagg wa
;
END;
$function$;
-- A new function receives EXECUTE for PUBLIC by default in PostgreSQL.
-- Revoke in the same transaction, granting ONLY authenticated.
REVOKE ALL ON FUNCTION public.get_painel_mae_rapido(uuid,uuid,integer,integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_painel_mae_rapido(uuid,uuid,integer,integer) TO authenticated;
