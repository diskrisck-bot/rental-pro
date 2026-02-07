-- =================================================================
-- RLS RESET AND STRICT ENFORCEMENT (V2)
-- This script ensures total isolation by dropping all previous policies,
-- deleting orphaned data, and applying the definitive SaaS Isolation policy.
-- =================================================================

-- 1. PRODUCTS Table (Equipamentos)
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS user_id UUID DEFAULT auth.uid();
ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Ver tudo" ON public.products;
DROP POLICY IF EXISTS "Select all" ON public.products;
DROP POLICY IF EXISTS "Public" ON public.products;
DROP POLICY IF EXISTS "SaaS Isolation" ON public.products;
DROP POLICY IF EXISTS "Tenant Isolation Select" ON public.products;
DROP POLICY IF EXISTS "Tenant Isolation All" ON public.products;
DROP POLICY IF EXISTS "Isolamento SaaS" ON public.products;
DELETE FROM public.products WHERE user_id IS NULL;
CREATE POLICY "SaaS_Isolation_V2" ON public.products
    FOR ALL
    TO authenticated
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

-- 2. ORDERS Table (Pedidos/Locações)
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS user_id UUID DEFAULT auth.uid();
ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Ver tudo" ON public.orders;
DROP POLICY IF EXISTS "Select all" ON public.orders;
DROP POLICY IF EXISTS "Public" ON public.orders;
DROP POLICY IF EXISTS "SaaS Isolation" ON public.orders;
DROP POLICY IF EXISTS "Tenant Isolation Select" ON public.orders;
DROP POLICY IF EXISTS "Tenant Isolation All" ON public.orders;
DROP POLICY IF EXISTS "Isolamento SaaS" ON public.orders;
DELETE FROM public.orders WHERE user_id IS NULL;
CREATE POLICY "SaaS_Isolation_V2" ON public.orders
    FOR ALL
    TO authenticated
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

-- 3. ASSETS Table
ALTER TABLE public.assets ADD COLUMN IF NOT EXISTS user_id UUID DEFAULT auth.uid();
ALTER TABLE public.assets ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Ver tudo" ON public.assets;
DROP POLICY IF EXISTS "Select all" ON public.assets;
DROP POLICY IF EXISTS "Public" ON public.assets;
DROP POLICY IF EXISTS "SaaS Isolation" ON public.assets;
DROP POLICY IF EXISTS "Tenant Isolation Select" ON public.assets;
DROP POLICY IF EXISTS "Tenant Isolation All" ON public.assets;
DROP POLICY IF EXISTS "Isolamento SaaS" ON public.assets;
DELETE FROM public.assets WHERE user_id IS NULL;
CREATE POLICY "SaaS_Isolation_V2" ON public.assets
    FOR ALL
    TO authenticated
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

-- 4. ORDER_ITEMS Table (Itens do Pedido)
ALTER TABLE public.order_items ADD COLUMN IF NOT EXISTS user_id UUID DEFAULT auth.uid();
ALTER TABLE public.order_items ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Ver tudo" ON public.order_items;
DROP POLICY IF EXISTS "Select all" ON public.order_items;
DROP POLICY IF EXISTS "Public" ON public.order_items;
DROP POLICY IF EXISTS "SaaS Isolation" ON public.order_items;
DROP POLICY IF EXISTS "Tenant Isolation Select" ON public.order_items;
DROP POLICY IF EXISTS "Tenant Isolation All" ON public.order_items;
DROP POLICY IF EXISTS "Isolamento SaaS" ON public.order_items;
DELETE FROM public.order_items WHERE user_id IS NULL;
CREATE POLICY "SaaS_Isolation_V2" ON public.order_items
    FOR ALL
    TO authenticated
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

-- 5. PROFILES Table (Dados Locadora/Clientes - usa 'id' como chave de dono)
-- Não possui user_id, usa 'id' que é a FK para auth.users
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Ver tudo" ON public.profiles;
DROP POLICY IF EXISTS "Select all" ON public.profiles;
DROP POLICY IF EXISTS "Public" ON public.profiles;
DROP POLICY IF EXISTS "SaaS Isolation" ON public.profiles;
DROP POLICY IF EXISTS "Tenant Isolation Select" ON public.profiles;
DROP POLICY IF EXISTS "Tenant Isolation All" ON public.profiles;
DROP POLICY IF EXISTS "Isolamento SaaS" ON public.profiles;
-- Não deletamos perfis NULL, pois a tabela profiles exige que 'id' seja NOT NULL e FK para auth.users.
CREATE POLICY "SaaS_Isolation_V2" ON public.profiles
    FOR ALL
    TO authenticated
    USING (auth.uid() = id)
    WITH CHECK (auth.uid() = id);