-- SQL Migration for Contract Feature

-- 1. Add valor_reposicao to products table
ALTER TABLE public.products
ADD COLUMN valor_reposicao NUMERIC DEFAULT 0;

-- 2. Add forma_pagamento to orders table
ALTER TABLE public.orders
ADD COLUMN forma_pagamento TEXT DEFAULT 'Pix';

-- 3. Add city and state to profiles table (for contract FORO clause)
ALTER TABLE public.profiles
ADD COLUMN business_city TEXT;

ALTER TABLE public.profiles
ADD COLUMN business_state TEXT;

-- 4. NOTE: The RPC 'get_contract_data' must also be updated manually in Supabase
-- to include 'forma_pagamento', 'business_city', 'business_state' and 'valor_reposicao'
-- in its return structure for the SignContract page to work correctly.