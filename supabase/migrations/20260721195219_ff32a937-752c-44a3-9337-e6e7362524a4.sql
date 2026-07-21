CREATE OR REPLACE FUNCTION public.syncvet_gerar_manejos_ciclo()
RETURNS trigger
LANGUAGE plpgsql
AS $function$
begin
  insert into syncvet_manejos (lote_ciclo_id, etapa_id, data_prevista, status, codigo_preco)
  select new.id, pe.id, new.data_d0 + pe.dia_offset, 'pendente', pe.codigo_preco
  from syncvet_protocolo_etapas pe
  where pe.protocolo_id = new.protocolo_id;
  return new;
end;
$function$;