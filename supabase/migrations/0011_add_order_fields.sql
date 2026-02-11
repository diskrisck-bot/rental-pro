-- Adiciona colunas necessárias para o novo formulário de locação
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS delivery_method text;
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS paid boolean DEFAULT false;
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS discount numeric DEFAULT 0;

-- Notifica o PostgREST para atualizar o cache do schema imediatamente
NOTIFY pgrst, 'reload schema';