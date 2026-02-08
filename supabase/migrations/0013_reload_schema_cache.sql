-- 1. Garante a existência da coluna (Idempotente)
ALTER TABLE public.orders 
ADD COLUMN IF NOT EXISTS delivery_address TEXT;

-- 2. Força permissões explícitas para garantir visibilidade da coluna pela API
-- Isso resolve problemas onde a coluna existe mas não é "enxergada" pelo PostgREST devido a permissões residuais
GRANT ALL ON TABLE public.orders TO anon;
GRANT ALL ON TABLE public.orders TO authenticated;
GRANT ALL ON TABLE public.orders TO service_role;

-- 3. Notifica o PostgREST para invalidar o cache do esquema imediatamente
NOTIFY pgrst, 'reload schema';