-- 1. Criação segura das colunas (Idempotente)
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS delivery_method text DEFAULT 'pickup';
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS delivery_address text;

-- 2. RESET DE PERMISSÕES
-- Isso garante que a API tenha visibilidade total sobre as novas colunas
GRANT SELECT, INSERT, UPDATE ON TABLE public.orders TO authenticated;
GRANT SELECT, INSERT, UPDATE ON TABLE public.orders TO service_role;
GRANT SELECT, INSERT, UPDATE ON TABLE public.orders TO anon;

-- 3. FORÇAR RECARREGAMENTO DO CACHE DA API (PostgREST)
NOTIFY pgrst, 'reload schema';