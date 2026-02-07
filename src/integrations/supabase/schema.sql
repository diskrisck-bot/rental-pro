-- SQL Migration for Contract Feature and Settings

-- 1. Ensure necessary columns exist in products and orders
ALTER TABLE public.products
ADD COLUMN IF NOT EXISTS valor_reposicao NUMERIC DEFAULT 0;

ALTER TABLE public.orders
ADD COLUMN IF NOT EXISTS forma_pagamento TEXT DEFAULT 'Pix';

-- 2. CREATE DEFINITIVE TABLE: dados_locadora (HARD RESET)
CREATE TABLE IF NOT EXISTS public.dados_locadora (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID REFERENCES auth.users(id) NOT NULL,
    nome_fantasia TEXT,
    documento TEXT,
    endereco TEXT,
    cidade TEXT,
    estado TEXT,
    telefone TEXT,
    signature_url TEXT, -- Mantendo a funcionalidade de assinatura
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()),
    UNIQUE(user_id)
);

-- 3. Permissões Públicas (Para garantir que a API veja)
ALTER TABLE public.dados_locadora ENABLE ROW LEVEL SECURITY;
GRANT ALL ON TABLE public.dados_locadora TO postgres, anon, authenticated, service_role;

-- 4. Política de Acesso (Segurança)
DROP POLICY IF EXISTS "Dono acessa tudo" ON public.dados_locadora;
CREATE POLICY "Dono acessa tudo" ON public.dados_locadora
    FOR ALL
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

-- 5. O "Pulo do Gato": Força a atualização do cache (Deve ser executado manualmente no console)
-- NOTIFY pgrst, 'reload schema';