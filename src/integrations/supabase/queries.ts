import { supabase } from "@/lib/supabase";
import { startOfDay, endOfDay, formatISO, format, subMonths, startOfMonth, endOfMonth } from 'date-fns';

// Helper para definir o intervalo de busca para 'Hoje'
const getTodayRange = () => {
  const todayDateString = format(new Date(), 'yyyy-MM-dd');
  const start = startOfDay(new Date());
  const end = endOfDay(new Date());
  
  return {
    todayDateString,
    start: formatISO(start),
    end: formatISO(end),
  };
};

export const fetchDashboardMetrics = async () => {
  const { count: totalOrdersCount, error: ordersCountError } = await supabase
    .from('orders')
    .select('*', { count: 'exact', head: true });

  if (ordersCountError) throw ordersCountError;

  const { count: activeRentalsCount, error: activeRentalsError } = await supabase
    .from('orders')
    .select('*', { count: 'exact', head: true })
    .eq('status', 'picked_up');

  if (activeRentalsError) throw activeRentalsError;

  const { count: futureReservationsCount, error: futureReservationsError } = await supabase
    .from('orders')
    .select('*', { count: 'exact', head: true })
    .in('status', ['reserved', 'pending_signature']);

  if (futureReservationsError) throw futureReservationsError;

  const { data: revenueData, error: revenueError } = await supabase
    .from('orders')
    .select('total_amount');
    
  if (revenueError) throw revenueError;
  const totalRevenue = revenueData.reduce((sum, order) => sum + (Number(order.total_amount) || 0), 0);

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

export const fetchTimelineData = async () => {
  const { data: products, error: productsError } = await supabase
    .from('products')
    .select('id, name, type, total_quantity, price')
    .order('name', { ascending: true });

  if (productsError) throw productsError;

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
    .in('orders.status', ['reserved', 'picked_up', 'pending_signature']);

  if (itemsError) throw itemsError;

  return { products, orderItems };
};

export const fetchInventoryAnalytics = async () => {
  const { data, error } = await supabase
    .from('inventory_analytics')
    .select('*')
    .order('name', { ascending: true });

  if (error) throw error;
  return data;
};

export const fetchProductAssets = async (productId: string) => {
  const { data, error } = await supabase
    .from('assets')
    .select('id, serial_number, created_at')
    .eq('product_id', productId)
    .order('created_at', { ascending: true });

  if (error) throw error;
  return data;
};

export const fetchAllProducts = async () => {
  const { data, error } = await supabase
    .from('products')
    .select('id, name, price, type')
    .order('name', { ascending: true });

  if (error) throw error;
  return data;
};

export const fetchProductCount = async () => {
  const { count, error } = await supabase
    .from('products')
    .select('*', { count: 'exact', head: true });

  if (error) throw error;
  return count || 0;
};

export const fetchBusinessName = async (): Promise<string | null> => {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  const { data, error } = await supabase
    .from('profiles')
    .select('business_name')
    .eq('id', user.id)
    .single();

  if (error && error.code !== 'PGRST116') throw error;
  return data?.business_name || null;
};

export const fetchBusinessConfig = async (): Promise<{ business_name: string | null, business_cnpj: string | null } | null> => {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  const { data, error } = await supabase
    .from('profiles')
    .select('business_name, business_cnpj')
    .eq('id', user.id)
    .single();

  if (error && error.code !== 'PGRST116') throw error;
  return data || { business_name: null, business_cnpj: null };
};

export const fetchMonthlyRevenue = async () => {
  const today = new Date();
  const sixMonthsAgo = subMonths(today, 5);
  const startOfPeriod = startOfMonth(sixMonthsAgo);
  
  const { data, error } = await supabase
    .from('orders')
    .select('total_amount, created_at')
    .neq('status', 'canceled')
    .gte('created_at', formatISO(startOfPeriod));

  if (error) throw error;

  const monthlyRevenueMap = new Map<string, number>();
  const monthNames = [];
  
  for (let i = 0; i < 6; i++) {
    const monthDate = subMonths(today, 5 - i);
    const monthKey = format(monthDate, 'MMM');
    monthNames.push(monthKey);
    monthlyRevenueMap.set(monthKey, 0);
  }

  data.forEach(order => {
    const monthKey = format(parseISO(order.created_at), 'MMM');
    const amount = Number(order.total_amount) || 0;
    
    if (monthlyRevenueMap.has(monthKey)) {
      monthlyRevenueMap.set(monthKey, monthlyRevenueMap.get(monthKey)! + amount);
    }
  });

  const chartData = monthNames.map(month => ({
    name: month,
    revenue: monthlyRevenueMap.get(month) || 0,
  }));

  return chartData;
};