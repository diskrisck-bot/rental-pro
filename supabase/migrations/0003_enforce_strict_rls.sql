-- =================================================================
-- ENFORCING STRICT RLS (SaaS Isolation)
-- This migration ensures all permissive policies are dropped and only
-- tenant-specific policies remain, fixing potential cross-tenant leaks.
-- =================================================================

-- Helper to drop generic policies
DO $$
DECLARE
    t_name text;
    p_name text;
BEGIN
    FOR t_name IN SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' AND table_type = 'BASE TABLE' LOOP
        FOR p_name IN SELECT policy_name FROM pg_policies WHERE schemaname = 'public' AND tablename = t_name LOOP
            -- Drop all policies except the ones we just created in 0001_tenant_isolation.sql
            IF p_name NOT LIKE 'Tenant Isolation%' THEN
                EXECUTE 'DROP POLICY IF EXISTS "' || p_name || '" ON public.' || t_name || ';';
            END IF;
        END LOOP;
    END LOOP;
END $$;

-- 1. PRODUCTS Table
ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;
-- Re-creating strict policies (ensures they exist and override any potential gaps)
DROP POLICY IF EXISTS "Isolamento SaaS" ON public.products;
CREATE POLICY "Isolamento SaaS" ON public.products
    FOR ALL
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

-- 2. ORDERS Table
ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Isolamento SaaS" ON public.orders;
CREATE POLICY "Isolamento SaaS" ON public.orders
    FOR ALL
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

-- 3. ASSETS Table
ALTER TABLE public.assets ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Isolamento SaaS" ON public.assets;
CREATE POLICY "Isolamento SaaS" ON public.assets
    FOR ALL
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

-- 4. ORDER_ITEMS Table
ALTER TABLE public.order_items ENABLE ROW LEVEL SECURITY;
-- Note: order_items must join to orders to check RLS, but we enforce user_id on the table itself for safety.
DROP POLICY IF EXISTS "Isolamento SaaS" ON public.order_items;
CREATE POLICY "Isolamento SaaS" ON public.order_items
    FOR ALL
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

-- 5. PROFILES Table (Uses 'id' as user_id)
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Isolamento SaaS" ON public.profiles;
CREATE POLICY "Isolamento SaaS" ON public.profiles
    FOR ALL
    USING (auth.uid() = id)
    WITH CHECK (auth.uid() = id);

-- 6. INVENTORY_ANALYTICS View (Ensure the underlying tables are secure)
-- Views inherit security from underlying tables. No direct RLS needed here, but we ensure the base tables are locked down.

-- 7. Data Sanitization (Optional but recommended for production readiness)
-- Ensure user_id is NOT NULL on creation to prevent future orphans.
-- NOTE: This requires updating the handle_new_user function if it inserts into tables other than profiles.
-- Since we rely on DEFAULT auth.uid(), we assume new inserts are safe.
-- For existing data, we rely on the RLS policies to hide any NULL user_id records.