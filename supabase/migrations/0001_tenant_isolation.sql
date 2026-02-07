-- =================================================================
-- RLS IMPLEMENTATION FOR MULTI-TENANCY ISOLATION
-- =================================================================

-- 1. PRODUCTS Table
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id) DEFAULT auth.uid();
ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;
-- Removendo políticas antigas (permissivas)
DROP POLICY IF EXISTS "Authenticated users can manage products" ON public.products;
DROP POLICY IF EXISTS "Permissao Total MVP" ON public.products;
DROP POLICY IF EXISTS "Permitir Delete para Logados" ON public.products;
DROP POLICY IF EXISTS "Permitir Insert para Logados" ON public.products;
DROP POLICY IF EXISTS "Permitir Update para Logados" ON public.products;
DROP POLICY IF EXISTS "Permitir Select Geral" ON public.products;
-- Novas políticas de isolamento
CREATE POLICY "Tenant Isolation Select" ON public.products
    FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Tenant Isolation All" ON public.products
    FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE INDEX IF NOT EXISTS idx_products_user_id ON public.products(user_id);

-- 2. ORDERS Table
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id) DEFAULT auth.uid();
ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;
-- Removendo políticas antigas (permissivas)
DROP POLICY IF EXISTS "Permissao Total MVP Orders" ON public.orders;
DROP POLICY IF EXISTS "Authenticated users can manage orders" ON public.orders;
-- Novas políticas de isolamento
CREATE POLICY "Tenant Isolation Select" ON public.orders
    FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Tenant Isolation All" ON public.orders
    FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE INDEX IF NOT EXISTS idx_orders_user_id ON public.orders(user_id);

-- 3. ASSETS Table
ALTER TABLE public.assets ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id) DEFAULT auth.uid();
ALTER TABLE public.assets ENABLE ROW LEVEL SECURITY;
-- Removendo políticas antigas (permissivas)
DROP POLICY IF EXISTS "Authenticated users can manage assets" ON public.assets;
-- Novas políticas de isolamento
CREATE POLICY "Tenant Isolation Select" ON public.assets
    FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Tenant Isolation All" ON public.assets
    FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE INDEX IF NOT EXISTS idx_assets_user_id ON public.assets(user_id);

-- 4. ORDER_ITEMS Table
ALTER TABLE public.order_items ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id) DEFAULT auth.uid();
ALTER TABLE public.order_items ENABLE ROW LEVEL SECURITY;
-- Removendo políticas antigas (permissivas)
DROP POLICY IF EXISTS "Permissao Total MVP Items" ON public.order_items;
DROP POLICY IF EXISTS "Authenticated users can manage order_items" ON public.order_items;
-- Novas políticas de isolamento
CREATE POLICY "Tenant Isolation Select" ON public.order_items
    FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Tenant Isolation All" ON public.order_items
    FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE INDEX IF NOT EXISTS idx_order_items_user_id ON public.order_items(user_id);

-- 5. PROFILES Table (Usa 'id' como chave de tenant)
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
-- Removendo políticas antigas (permissivas)
DROP POLICY IF EXISTS "profiles_delete_own" ON public.profiles;
DROP POLICY IF EXISTS "profiles_update_own" ON public.profiles;
DROP POLICY IF EXISTS "profiles_insert_own" ON public.profiles;
DROP POLICY IF EXISTS "profiles_select_own" ON public.profiles;
-- Novas políticas de isolamento
CREATE POLICY "Tenant Isolation Select" ON public.profiles
    FOR SELECT USING (auth.uid() = id);
CREATE POLICY "Tenant Isolation All" ON public.profiles
    FOR ALL USING (auth.uid() = id) WITH CHECK (auth.uid() = id);
CREATE INDEX IF NOT EXISTS idx_profiles_id ON public.profiles(id);