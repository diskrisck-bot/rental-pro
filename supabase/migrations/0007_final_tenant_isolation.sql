-- =================================================================
-- FINAL TENANT ISOLATION SCRIPT: RLS RESET AND STRICT ENFORCEMENT
-- This script ensures total isolation by dropping all previous policies,
-- ensuring user_id exists, and applying the definitive Tenant Isolation policy.
-- =================================================================

-- Helper to drop generic policies (including the previous 'SaaS_Isolation' and 'SaaS_Isolation_V2')
DO $$
DECLARE
    t_name text;
    p_name text;
BEGIN
    FOR t_name IN SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' AND table_type = 'BASE TABLE' LOOP
        FOR p_name IN SELECT policy_name FROM pg_policies WHERE schemaname = 'public' AND tablename = t_name LOOP
            -- Drop all policies that are not the strict V2 policy
            IF p_name NOT LIKE 'Tenant_Isolation_Strict' THEN
                EXECUTE 'DROP POLICY IF EXISTS "' || p_name || '" ON public.' || t_name || ';';
            END IF;
        END LOOP;
    END LOOP;
END $$;

-- 1. PRODUCTS Table (Equipamentos)
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS user_id UUID DEFAULT auth.uid();
ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;
UPDATE public.products SET user_id = '00000000-0000-0000-0000-000000000000' WHERE user_id IS NULL;
CREATE POLICY "Tenant_Isolation_Strict" ON public.products
    FOR ALL
    TO authenticated
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

-- 2. ORDERS Table (Pedidos)
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS user_id UUID DEFAULT auth.uid();
ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;
UPDATE public.orders SET user_id = '00000000-0000-0000-0000-000000000000' WHERE user_id IS NULL;
CREATE POLICY "Tenant_Isolation_Strict" ON public.orders
    FOR ALL
    TO authenticated
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

-- 3. ASSETS Table
ALTER TABLE public.assets ADD COLUMN IF NOT EXISTS user_id UUID DEFAULT auth.uid();
ALTER TABLE public.assets ENABLE ROW LEVEL SECURITY;
UPDATE public.assets SET user_id = '00000000-0000-0000-0000-000000000000' WHERE user_id IS NULL;
CREATE POLICY "Tenant_Isolation_Strict" ON public.assets
    FOR ALL
    TO authenticated
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

-- 4. ORDER_ITEMS Table (Itens do Pedido)
ALTER TABLE public.order_items ADD COLUMN IF NOT EXISTS user_id UUID DEFAULT auth.uid();
ALTER TABLE public.order_items ENABLE ROW LEVEL SECURITY;
UPDATE public.order_items SET user_id = '00000000-0000-0000-0000-000000000000' WHERE user_id IS NULL;
CREATE POLICY "Tenant_Isolation_Strict" ON public.order_items
    FOR ALL
    TO authenticated
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

-- 5. PROFILES Table (Dados Locadora/Clientes - usa 'id' como chave de dono)
-- Note: Profiles uses 'id' as the tenant key, which is already NOT NULL and linked to auth.users.
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Tenant_Isolation_Strict" ON public.profiles
    FOR ALL
    TO authenticated
    USING (auth.uid() = id)
    WITH CHECK (auth.uid() = id);