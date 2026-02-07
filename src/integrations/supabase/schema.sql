-- SQL Migration for Contract Feature and Settings

-- 1. Add valor_reposicao to products table
ALTER TABLE public.products
ADD COLUMN IF NOT EXISTS valor_reposicao NUMERIC DEFAULT 0;

-- 2. Add forma_pagamento to orders table
ALTER TABLE public.orders
ADD COLUMN IF NOT EXISTS forma_pagamento TEXT DEFAULT 'Pix';

-- 3. Add all required business fields to profiles table (for contract and settings)
ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS business_name TEXT;

ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS business_cnpj TEXT;

ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS business_address TEXT;

ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS business_phone TEXT;

ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS business_city TEXT;

ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS business_state TEXT;

-- 4. NOTE: The RPC 'get_contract_data' must also be updated manually in Supabase
-- to include all new fields in its return structure for the SignContract page to work correctly.