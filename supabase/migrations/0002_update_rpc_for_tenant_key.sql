CREATE OR REPLACE FUNCTION public.get_contract_data(p_order_id uuid)
 RETURNS TABLE(order_id uuid, customer_name text, customer_phone text, customer_cpf text, start_date timestamp with time zone, end_date timestamp with time zone, total_amount numeric, signed_at timestamp with time zone, signature_image text, signer_ip text, signer_user_agent text, owner_name text, owner_cnpj text, owner_address text, owner_phone text, owner_signature text, status text, items jsonb)
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
begin
  return query
  SELECT 
    o.id::uuid, 
    o.customer_name::text, 
    o.customer_phone::text,
    o.customer_cpf::text,
    o.start_date::timestamp with time zone,
    o.end_date::timestamp with time zone,
    o.total_amount::numeric,
    o.signed_at::timestamp with time zone,
    o.signature_image::text,
    o.signer_ip::text,
    o.signer_user_agent::text,
    p.business_name::text,
    p.business_cnpj::text,
    p.business_address::text,
    p.business_phone::text,
    p.signature_url::text,
    o.status::text,
    (
      SELECT jsonb_agg(
        jsonb_build_object(
          'quantity', oi.quantity,
          'products', jsonb_build_object(
            'name', pr.name,
            'price', pr.price
          )
        )
      )
      FROM order_items oi
      JOIN products pr ON oi.product_id = pr.id
      WHERE oi.order_id = o.id
    )::jsonb AS items
  FROM orders o
  LEFT JOIN profiles p ON o.user_id = p.id -- Alterado para usar a nova coluna user_id
  WHERE o.id = p_order_id;
end;
$function$