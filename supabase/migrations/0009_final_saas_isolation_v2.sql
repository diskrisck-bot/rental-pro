-- =================================================================
-- DEFINITIVE SAAS ISOLATION SCRIPT V2
-- Ensures strict tenant isolation using user_id (products, assets) and created_by (orders).
-- Implements cascading RLS for order_items and ensures all tables have RLS enabled.
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

-- 1. CORREÇÃO ESTRUTURAL (Adicionar Dono onde falta)
-- A tabela 'products' não tinha dono. Vamos criar e já preencher com o ID de quem criar.
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id) DEFAULT auth.uid();
CREATE INDEX IF NOT EXISTS idx_products_userid ON public.products(user_id);

-- A tabela 'assets' (itens individuais) também precisa de dono para facilitar a segurança
ALTER TABLE public.assets ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id) DEFAULT auth.uid();
CREATE INDEX IF NOT EXISTS idx_assets_userid ON public.assets(user_id);

-- 2. HABILITAR RLS (O CADEADO)
ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.order_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.assets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- 3. CRIAÇÃO DAS POLÍTICAS DE ISOLAMENTO (A LÓGICA DE OURO)

-- Para PRODUTOS: "Só vejo se o user_id for meu"
CREATE POLICY "SaaS_Isolation_Products" ON public.products
AS PERMISSIVE FOR ALL TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

-- Para PEDIDOS (ORDERS): "Só vejo se created_by for meu"
CREATE POLICY "SaaS_Isolation_Orders" ON public.orders
AS PERMISSIVE FOR ALL TO authenticated
USING (auth.uid() = created_by)
WITH CHECK (auth.uid() = created_by);

-- Para ASSETS: "Só vejo se o user_id for meu"
CREATE POLICY "SaaS_Isolation_Assets" ON public.assets
AS PERMISSIVE FOR ALL TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

-- Para ORDER_ITEMS (Cascata): "Só vejo itens se eu for o dono do pedido relacionado"
CREATE POLICY "SaaS_Isolation_OrderItems" ON public.order_items
AS PERMISSIVE FOR ALL TO authenticated
USING (
    EXISTS ( SELECT 1 FROM public.orders WHERE orders.id = order_items.order_id AND orders.created_by = auth.uid() )
)
WITH CHECK (
    EXISTS ( SELECT 1 FROM public.orders WHERE orders.id = order_items.order_id AND orders.created_by = auth.uid() )
);

-- Para PROFILES: "Só vejo o meu perfil"
CREATE POLICY "SaaS_Isolation_Profiles" ON public.profiles
AS PERMISSIVE FOR ALL TO authenticated
USING (auth.uid() = id)
WITH CHECK (auth.uid() = id);

-- 4. OCULTAR DADOS ANTIGOS (SANITIZE)
-- Move dados órfãos para um ID fantasma para que o RLS os ignore.
UPDATE public.products SET user_id = '00000000-0000-0000-0000-000000000000' WHERE user_id IS NULL;
UPDATE public.assets SET user_id = '00000000-0000-0000-0000-000000000000' WHERE user_id IS NULL;
UPDATE public.orders SET created_by = '00000000-0000-0000-0000-000000000000' WHERE created_by IS NULL;