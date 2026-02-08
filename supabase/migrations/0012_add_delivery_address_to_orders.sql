-- Garante a criação da coluna delivery_address na tabela orders
-- O uso de IF NOT EXISTS previne erros caso a coluna já tenha sido parcialmente provisionada
ALTER TABLE public.orders 
ADD COLUMN IF NOT EXISTS delivery_address TEXT;