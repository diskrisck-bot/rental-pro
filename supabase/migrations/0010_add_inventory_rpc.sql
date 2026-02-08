-- Cria a função para calcular a quantidade ocupada de um produto em um período
CREATE OR REPLACE FUNCTION public.get_occupied_quantity(
    p_product_id uuid,
    p_start_date timestamp with time zone,
    p_end_date timestamp with time zone,
    p_current_order_id uuid DEFAULT NULL
)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    occupied_count integer;
BEGIN
    -- A lógica de sobreposição de intervalos (&&) é a mais robusta.
    -- [start, end] representa o período de locação.
    -- Usamos '[]' para indicar que o intervalo é inclusivo em ambas as extremidades.
    SELECT COALESCE(SUM(oi.quantity), 0)
    INTO occupied_count
    FROM public.order_items oi
    JOIN public.orders o ON oi.order_id = o.id
    WHERE 
        oi.product_id = p_product_id
        AND o.status IN ('signed', 'reserved', 'picked_up')
        -- Exclui o pedido atual se estivermos em modo de edição
        AND (p_current_order_id IS NULL OR o.id <> p_current_order_id)
        -- Verifica a sobreposição usando o operador de interseção de tsrange (&&)
        AND tsrange(o.start_date, o.end_date, '[]') && tsrange(p_start_date, p_end_date, '[]');

    RETURN occupied_count;
END;
$$;