-- =================================================================
-- DEFINITIVE SAAS ISOLATION SCRIPT
-- Ensures strict tenant isolation using user_id (products, assets) and created_by (orders).
-- Implements cascading RLS for order_items.
-- =================================================================

-- Helper to drop all existing policies to prevent conflicts
DO $$
DECLARE
    t_name text;
    p_name text;
BEGIN
    FOR t_name IN SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' AND table_type = 'BASE TABLE' LOOP
        FOR p_name IN SELECT policy_name FROM pg_policies WHERE schemaname = 'public' AND tablename = t_name LOOP
            EXECUTE 'DROP POLICY IF EXISTS "' || p_name || '" ON public.' || t_name || ';';
        END LOOP;
    END LOOP;
END $$;

-- 1. CORREÇÃO DA TABELA DE PRODUTOS (INVENTÁRIO)
-- Garante a coluna de dono e índice
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id) DEFAULT auth.uid();
CREATE INDEX IF NOT EXISTS idx_products_userid ON public.products(user_id);
ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;

-- 2. CORREÇÃO DA TABELA DE PEDIDOS (ORDERS)
-- Usa 'created_by' como chave de dono
ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;

-- 3. CORREÇÃO DA TABELA DE ITENS DO PEDIDO (ORDER_ITEMS)
ALTER TABLE public.order_items ADD COLUMN IF NOT EXISTS user_id UUID DEFAULT auth.uid(); -- Mantém user_id para consistência, mas a RLS usará a cascata
ALTER TABLE public.order_items ENABLE ROW LEVEL SECURITY;

-- 4. CORREÇÃO DA TABELA DE ATIVOS (ASSETS)
ALTER TABLE public.assets ADD COLUMN IF NOT EXISTS user_id UUID DEFAULT auth.uid();
ALTER TABLE public.assets ENABLE ROW LEVEL SECURITY;

-- 5. CORREÇÃO DA TABELA DE PERFIS (PROFILES)
-- Usa 'id' como chave de dono
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;


-- 6. CRIAÇÃO DAS REGRAS DE ISOLAMENTO (RLS)

-- Regra para PRODUTOS: Só vejo produtos onde user_id = meu ID
CREATE POLICY "SaaS_Isolation_Products" ON public.products
AS PERMISSIVE FOR ALL TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

-- Regra para PEDIDOS: Só vejo pedidos onde created_by = meu ID
CREATE POLICY "SaaS_Isolation_Orders" ON public.orders
AS PERMISSIVE FOR ALL TO authenticated
USING (auth.uid() = created_by)
WITH CHECK (auth.uid() = created_by);

-- Regra para ATIVOS: Só vejo ativos onde user_id = meu ID
CREATE POLICY "SaaS_Isolation_Assets" ON public.assets
AS PERMISSIVE FOR ALL TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

-- Regra para ITENS DO PEDIDO (Cascata):
-- Só vejo itens se o pedido pai pertencer a mim.
CREATE POLICY "SaaS_Isolation_OrderItems" ON public.order_items
AS PERMISSIVE FOR ALL TO authenticated
USING (
    EXISTS ( SELECT 1 FROM public.orders WHERE orders.id = order_items.order_id AND orders.created_by = auth.uid() )
)
WITH CHECK (
    EXISTS ( SELECT 1 FROM public.orders WHERE orders.id = order_items.order_id AND orders.created_by = auth.uid() )
);

-- Regra para PERFIS: Só vejo meu próprio perfil
CREATE POLICY "SaaS_Isolation_Profiles" ON public.profiles
AS PERMISSIVE FOR ALL TO authenticated
USING (auth.uid() = id)
WITH CHECK (auth.uid() = id);


-- 7. SANITIZAÇÃO (ESCONDER DADOS ÓRFÃOS)
-- Atribui dados sem dono a um ID fantasma para que o RLS os ignore.
UPDATE public.products SET user_id = '00000000-0000-0000-0000-000000000000' WHERE user_id IS NULL;
UPDATE public.orders SET created_by = '00000000-0000-0000-0000-000000000000' WHERE created_by IS NULL;
UPDATE public.assets SET user_id = '00000000-0000-0000-0000-000000000000' WHERE user_id IS NULL;
UPDATE public.order_items SET user_id = '00000000-0000-0000-0000-000000000000' WHERE user_id IS NULL;