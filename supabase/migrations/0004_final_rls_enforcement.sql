-- =================================================================
-- FINAL RLS ENFORCEMENT SCRIPT: FIXING ORPHAN DATA AND APPLYING STRICT POLICIES
-- =================================================================

-- 1. PRODUCTS Table
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS user_id UUID DEFAULT auth.uid();
UPDATE public.products SET user_id = auth.uid() WHERE user_id IS NULL;
ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Ver tudo" ON public.products;
DROP POLICY IF EXISTS "Publico" ON public.products;
DROP POLICY IF EXISTS "Isolamento" ON public.products;
DROP POLICY IF EXISTS "Tenant Isolation Select" ON public.products;
DROP POLICY IF EXISTS "Tenant Isolation All" ON public.products;
DROP POLICY IF EXISTS "Isolamento SaaS" ON public.products;
CREATE POLICY "SaaS_Isolation_Policy" ON public.products
AS PERMISSIVE
FOR ALL
TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

-- 2. ORDERS Table
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS user_id UUID DEFAULT auth.uid();
UPDATE public.orders SET user_id = auth.uid() WHERE user_id IS NULL;
ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Ver tudo" ON public.orders;
DROP POLICY IF EXISTS "Publico" ON public.orders;
DROP POLICY IF EXISTS "Isolamento" ON public.orders;
DROP POLICY IF EXISTS "Tenant Isolation Select" ON public.orders;
DROP POLICY IF EXISTS "Tenant Isolation All" ON public.orders;
DROP POLICY IF EXISTS "Isolamento SaaS" ON public.orders;
CREATE POLICY "SaaS_Isolation_Policy" ON public.orders
AS PERMISSIVE
FOR ALL
TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

-- 3. ASSETS Table
ALTER TABLE public.assets ADD COLUMN IF NOT EXISTS user_id UUID DEFAULT auth.uid();
UPDATE public.assets SET user_id = auth.uid() WHERE user_id IS NULL;
ALTER TABLE public.assets ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Ver tudo" ON public.assets;
DROP POLICY IF EXISTS "Publico" ON public.assets;
DROP POLICY IF EXISTS "Isolamento" ON public.assets;
DROP POLICY IF EXISTS "Tenant Isolation Select" ON public.assets;
DROP POLICY IF EXISTS "Tenant Isolation All" ON public.assets;
DROP POLICY IF EXISTS "Isolamento SaaS" ON public.assets;
CREATE POLICY "SaaS_Isolation_Policy" ON public.assets
AS PERMISSIVE
FOR ALL
TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

-- 4. ORDER_ITEMS Table
ALTER TABLE public.order_items ADD COLUMN IF NOT EXISTS user_id UUID DEFAULT auth.uid();
UPDATE public.order_items SET user_id = auth.uid() WHERE user_id IS NULL;
ALTER TABLE public.order_items ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Ver tudo" ON public.order_items;
DROP POLICY IF EXISTS "Publico" ON public.order_items;
DROP POLICY IF EXISTS "Isolamento" ON public.order_items;
DROP POLICY IF EXISTS "Tenant Isolation Select" ON public.order_items;
DROP POLICY IF EXISTS "Tenant Isolation All" ON public.order_items;
DROP POLICY IF EXISTS "Isolamento SaaS" ON public.order_items;
CREATE POLICY "SaaS_Isolation_Policy" ON public.order_items
AS PERMISSIVE
FOR ALL
TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

-- 5. PROFILES Table (Uses 'id' as user_id, which is already NOT NULL and linked to auth.users)
-- We only need to ensure the policy is strict and uses 'id' instead of 'user_id'
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Ver tudo" ON public.profiles;
DROP POLICY IF EXISTS "Publico" ON public.profiles;
DROP POLICY IF EXISTS "Isolamento" ON public.profiles;
DROP POLICY IF EXISTS "Tenant Isolation Select" ON public.profiles;
DROP POLICY IF EXISTS "Tenant Isolation All" ON public.profiles;
DROP POLICY IF EXISTS "Isolamento SaaS" ON public.profiles;
CREATE POLICY "SaaS_Isolation_Policy" ON public.profiles
AS PERMISSIVE
FOR ALL
TO authenticated
USING (auth.uid() = id)
WITH CHECK (auth.uid() = id);