-- Adiciona a coluna delivery_method à tabela orders
ALTER TABLE public.orders
ADD COLUMN delivery_method TEXT DEFAULT 'pickup' NOT NULL;