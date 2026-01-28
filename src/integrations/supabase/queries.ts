import { supabase } from "@/lib/supabase";
import { startOfDay, endOfDay, formatISO, format } from 'date-fns';

// Helper para definir o intervalo de busca para 'Hoje'
const getTodayRange = () => {
  // Obtém a data de hoje no formato YYYY-MM-DD (sem tempo ou fuso)
  const todayDateString = format(new Date(), 'yyyy-MM-dd');
  
  // Para consultas de intervalo (que são mais seguras para timestamp with time zone)
  const start = startOfDay(new Date());
  const end = endOfDay(new Date());
  
  return {
    todayDateString,
    start: formatISO(start),
    end: formatISO(end),
  };
};

export const fetchDashboardMetrics = async () => {
  // 1. Total Orders Count
  const { count: totalOrdersCount, error: ordersCountError } = await supabase
    .from('orders')
    .select('*', { count: 'exact', head: true });

  if (ordersCountError) throw ordersCountError;

  // 2. Itens na Rua (Ativos): status = 'picked_up'
  const { count: activeRentalsCount, error: activeRentalsError } = await supabase
    .from('orders')
    .select('*', { count: 'exact', head: true })
    .eq('status', 'picked_up');

  if (activeRentalsError) throw activeRentalsError;

  // 3. Reservas Futuras: status = 'reserved'
  const { count: futureReservationsCount, error: futureReservationsError } = await supabase
    .from('orders')
    .select('*', { count: 'exact', head: true })
    .eq('status', 'reserved');

  if (futureReservationsError) throw futureReservationsError;

  // 4. Total Revenue Sum
  const { data: revenueData, error: revenueError } = await supabase
    .from('orders')
    .select('total_amount');
    
  if (revenueError) throw revenueError;
  
  // Soma todos os total_amount (garantindo que sejam tratados como números)
  const totalRevenue = revenueData.reduce((sum, order) => sum + (Number(order.total_amount) || 0), 0);

  // 5. Clientes (Contagem de nomes de clientes únicos)
  const { data: clientData, error: clientError } = await supabase
    .from('orders')
    .select('customer_name');

  if (clientError) throw clientError;

  const uniqueClients = new Set(clientData.map(order => order.customer_name)).size;
  
  return {
    totalOrders: totalOrdersCount || 0,
    activeRentals: activeRentalsCount || 0,
    futureReservations: futureReservationsCount || 0,
    totalRevenue: totalRevenue,
    newClients: uniqueClients, 
  };
};

export const fetchPendingPickups = async () => {
  const { start, end } = getTodayRange();
  
  // Filtra pedidos reservados onde a data de início está dentro do intervalo de hoje.
  // Isso garante que pegamos todos os registros do dia, independentemente da hora.
  const { data, error } = await supabase
    .from('orders')
    .select('id, customer_name, start_date')
    .eq('status', 'reserved')
    .gte('start_date', start)
    .lte('start_date', end)
    .order('start_date', { ascending: true });

  if (error) throw error;
  return data;
};

export const fetchPendingReturns = async () => {
  const { start, end } = getTodayRange();

  // Filtra pedidos retirados onde a data de fim está dentro do intervalo de hoje.
  const { data, error } = await supabase
    .from('orders')
    .select('id, customer_name, end_date')
    .eq('status', 'picked_up')
    .gte('end_date', start)
    .lte('end_date', end)
    .order('end_date', { ascending: true });

  if (error) throw error;
  return data;
};

export const fetchTimelineData = async () => {
  // 1. Fetch all products (resources)
  const { data: products, error: productsError } = await supabase
    .from('products')
    .select('id, name, type, total_quantity, price')
    .order('name', { ascending: true });

  if (productsError) throw productsError;

  // 2. Fetch all active order items with order details (allocations)
  const { data: orderItems, error: itemsError } = await supabase
    .from('order_items')
    .select(`
      product_id,
      quantity,
      orders!inner (
        id,
        customer_name,
        start_date,
        end_date,
        status
      )
    `)
    .in('orders.status', ['reserved', 'picked_up']); // Apenas pedidos ativos ou reservados

  if (itemsError) throw itemsError;

  return { products, orderItems };
};

// Nova função para buscar dados da view inventory_analytics
export const fetchInventoryAnalytics = async () => {
  const { data, error } = await supabase
    .from('inventory_analytics')
    .select('*')
    .order('name', { ascending: true });

  if (error) throw error;
  return data;
};