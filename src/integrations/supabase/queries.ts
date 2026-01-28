import { supabase } from "@/lib/supabase";
import { startOfDay, endOfDay, formatISO } from 'date-fns';

// Helper para definir o intervalo de busca para 'Hoje'
const getTodayRange = () => {
  const start = startOfDay(new Date());
  const end = endOfDay(new Date());
  // Usamos formatISO para garantir que o Supabase compare corretamente os timestamps
  return {
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

  // 2. Active Rentals Count (status = 'picked_up' OR 'reserved')
  const { count: activeRentalsCount, error: activeRentalsError } = await supabase
    .from('orders')
    .select('*', { count: 'exact', head: true })
    .in('status', ['picked_up', 'reserved']);

  if (activeRentalsError) throw activeRentalsError;

  // 3. Total Revenue Sum
  const { data: revenueData, error: revenueError } = await supabase
    .from('orders')
    .select('total_amount');
    
  if (revenueError) throw revenueError;
  
  // Soma todos os total_amount (garantindo que sejam tratados como números)
  const totalRevenue = revenueData.reduce((sum, order) => sum + (Number(order.total_amount) || 0), 0);

  // 4. New Clients (Contagem de nomes de clientes únicos)
  const { data: clientData, error: clientError } = await supabase
    .from('orders')
    .select('customer_name');

  if (clientError) throw clientError;

  const uniqueClients = new Set(clientData.map(order => order.customer_name)).size;
  
  return {
    totalOrders: totalOrdersCount || 0,
    activeRentals: activeRentalsCount || 0,
    totalRevenue: totalRevenue,
    newClients: uniqueClients, 
  };
};

export const fetchPendingPickups = async () => {
  const { start, end } = getTodayRange();
  
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