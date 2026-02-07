-- SQL Migration for Contract Feature and Settings

-- 1. Add valor_reposicao to products table (Keep this, it's product related)
ALTER TABLE public.products
ADD COLUMN IF NOT EXISTS valor_reposicao NUMERIC DEFAULT 0;

-- 2. Add forma_pagamento to orders table (Keep this, it's order related)
ALTER TABLE public.orders
ADD COLUMN IF NOT EXISTS forma_pagamento TEXT DEFAULT 'Pix';

-- 3. CREATE NEW TABLE: company_settings
CREATE TABLE public.company_settings (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  business_name TEXT,
  business_cnpj TEXT,
  business_address TEXT,
  business_phone TEXT,
  business_city TEXT,
  business_state TEXT,
  signature_url TEXT,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable RLS (REQUIRED for security)
ALTER TABLE public.company_settings ENABLE ROW LEVEL SECURITY;

-- Create secure policies for each operation
CREATE POLICY "settings_select_own" ON public.company_settings
FOR SELECT TO authenticated USING (auth.uid() = user_id);

CREATE POLICY "settings_insert_own" ON public.company_settings
FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

CREATE POLICY "settings_update_own" ON public.company_settings
FOR UPDATE TO authenticated USING (auth.uid() = user_id);

CREATE POLICY "settings_delete_own" ON public.company_settings
FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- 4. NOTE: The RPC 'get_contract_data' must be manually updated in Supabase
-- to join with 'company_settings' instead of 'profiles' to fetch owner data.
-- Example: LEFT JOIN company_settings cs ON o.created_by = cs.user_id