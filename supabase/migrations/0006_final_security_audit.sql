-- =================================================================
-- FINAL SECURITY AUDIT: RLS ENFORCEMENT AND ORPHAN DATA DELETION
-- This script ensures total isolation by deleting orphaned data and applying
-- the strict SaaS Isolation policy to all critical tables.
-- =================================================================

-- Helper to drop generic policies
DO $$
DECLARE
    t_name text;
    p_name text;
BEGIN
    FOR t_name IN SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' AND table_type = 'BASE TABLE' LOOP
        FOR p_name IN SELECT policy_name FROM pg_policies WHERE schemaname = 'public' AND tablename = t_name LOOP
            -- Drop all policies that are not the strict V2 policy
            IF p_name NOT LIKE 'SaaS_Isolation_V2' THEN
                EXECUTE 'DROP POLICY IF EXISTS "' || p_name || '" ON public.' || t_name || ';';
            END IF;
        END LOOP;
    END LOOP;
END $$;

-- 1. PRODUCTS Table (Equipamentos)
ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;
DELETE FROM public.products WHERE user_id IS NULL;
CREATE POLICY "SaaS_Isolation" ON public.products
    FOR ALL
    TO authenticated
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

-- 2. ORDERS Table (Pedidos)
ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;
DELETE FROM public.orders WHERE user_id IS NULL;
CREATE POLICY "SaaS_Isolation" ON public.orders
    FOR ALL
    TO authenticated
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

-- 3. ASSETS Table
ALTER TABLE public.assets ENABLE ROW LEVEL SECURITY;
DELETE FROM public.assets WHERE user_id IS NULL;
CREATE POLICY "SaaS_Isolation" ON public.assets
    FOR ALL
    TO authenticated
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

-- 4. ORDER_ITEMS Table (Itens do Pedido)
ALTER TABLE public.order_items ENABLE ROW LEVEL SECURITY;
DELETE FROM public.order_items WHERE user_id IS NULL;
CREATE POLICY "SaaS_Isolation" ON public.order_items
    FOR ALL
    TO authenticated
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

-- 5. PROFILES Table (Dados Locadora/Clientes)
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
-- Note: Profiles uses 'id' as the tenant key
CREATE POLICY "SaaS_Isolation" ON public.profiles
    FOR ALL
    TO authenticated
    USING (auth.uid() = id)
    WITH CHECK (auth.uid() = id);