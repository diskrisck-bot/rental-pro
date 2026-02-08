-- Adiciona a coluna delivery_address à tabela orders
ALTER TABLE public.orders
ADD COLUMN delivery_address TEXT;