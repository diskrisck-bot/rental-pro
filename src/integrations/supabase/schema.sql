-- SQL Migration for Contract Feature and Settings

-- 1. Ensure necessary columns exist in products and orders
ALTER TABLE public.products
ADD COLUMN IF NOT EXISTS valor_reposicao NUMERIC DEFAULT 0;

ALTER TABLE public.orders
ADD COLUMN IF NOT EXISTS forma_pagamento TEXT DEFAULT 'Pix';

-- 2. CREATE DEFINITIVE TABLE: company_settings
CREATE TABLE IF NOT EXISTS public.company_settings (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  business_name TEXT,
  business_cnpj TEXT, -- Usando CNPJ para consistência com o frontend
  business_address TEXT,
  business_phone TEXT,
  business_city TEXT,
  business_state TEXT,
  signature_url TEXT,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 3. Habilita RLS (Segurança)
ALTER TABLE public.company_settings ENABLE ROW LEVEL SECURITY;

-- 4. Cria Política de Acesso (Permitir tudo para o dono)
DROP POLICY IF EXISTS "Usuarios gerenciam sua propria empresa" ON public.company_settings;
CREATE POLICY "Usuarios gerenciam sua propria empresa" ON public.company_settings
    FOR ALL
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

-- 5. GARANTIR PERMISSÕES DE ACESSO (CRÍTICO PARA POSTGREST)
GRANT ALL ON TABLE public.company_settings TO anon, authenticated, service_role;
-- Se a tabela tivesse uma coluna SERIAL, precisaríamos de:
-- GRANT ALL ON SEQUENCE company_settings_id_seq TO anon, authenticated, service_role;

-- 6. NOTA: O comando NOTIFY pgrst, 'reload schema'; deve ser executado manualmente no console Supabase.