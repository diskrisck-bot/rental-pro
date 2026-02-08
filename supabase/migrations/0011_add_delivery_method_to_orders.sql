-- Adiciona a coluna delivery_method à tabela orders
ALTER TABLE public.orders
ADD COLUMN delivery_method TEXT DEFAULT 'pickup' NOT NULL;

-- Atualiza a política de UPDATE para incluir a nova coluna (se necessário, mas como RLS está desabilitado, não é estritamente necessário, mas é boa prática)
-- No entanto, como as políticas existentes são 'Public Update Orders' ON orders FOR UPDATE USING (true), não precisamos alterá-las.