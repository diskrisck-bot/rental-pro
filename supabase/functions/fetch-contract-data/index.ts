import { serve } from "https://deno.land/std@0.190.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }
  
  const supabase = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_ANON_KEY') ?? '',
  )

  try {
    const { orderId } = await req.json();
    
    if (!orderId) {
      return new Response(JSON.stringify({ error: "Order ID is required" }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // 1. Fetch Order Details (including creator ID)
    const { data: orderData, error: orderError } = await supabase
      .from('orders')
      .select(`
        id, 
        customer_name, 
        customer_phone, 
        customer_cpf, 
        start_date, 
        end_date, 
        total_amount, 
        signed_at,
        signature_image,
        created_by
      `)
      .eq('id', orderId)
      .single();

    if (orderError || !orderData) {
      console.error("[fetch-contract-data] Error fetching order:", orderError?.message);
      return new Response(JSON.stringify({ error: "Order not found or database error." }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    
    // 2. Fetch Owner's Signature (assuming owner is the creator)
    let ownerSignature = null;
    if (orderData.created_by) {
        const { data: profileData, error: profileError } = await supabase
            .from('profiles')
            .select('default_signature_image')
            .eq('id', orderData.created_by)
            .single();

        if (profileError) {
            console.warn("[fetch-contract-data] Warning: Could not fetch owner profile signature:", profileError.message);
        } else {
            ownerSignature = profileData?.default_signature_image || null;
        }
    }

    // 3. Fetch Order Items
    const { data: itemsData, error: itemsError } = await supabase
        .from('order_items')
        .select(`
            quantity,
            products (name, price)
        `)
        .eq('order_id', orderId);

    if (itemsError) {
        console.error("[fetch-contract-data] Error fetching order items:", itemsError.message);
        throw itemsError;
    }

    const responseData = {
      order: orderData,
      items: itemsData,
      ownerSignature: ownerSignature,
    };

    return new Response(JSON.stringify(responseData), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    })
  } catch (error) {
    console.error("[fetch-contract-data] General error:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})