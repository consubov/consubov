UPDATE public.notificacoes
   SET fazenda_id = (dados ->> 'fazenda_id')::uuid
 WHERE fazenda_id IS NULL
   AND tipo NOT IN ('lead', 'aviso')
   AND dados ? 'fazenda_id'
   AND NULLIF(dados ->> 'fazenda_id', '') IS NOT NULL;