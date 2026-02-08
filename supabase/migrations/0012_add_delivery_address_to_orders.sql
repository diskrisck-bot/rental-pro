-- Adiciona a coluna delivery_address à tabela orders para armazenar local de entrega/uso
ALTER TABLE public.orders 
ADD COLUMN delivery_address TEXT;