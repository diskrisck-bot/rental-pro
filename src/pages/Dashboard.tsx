"use client";

import React, { useState, useMemo } from 'react';
import { 
  Users, 
  Box, 
  DollarSign, 
  FileText, 
  Loader2, 
  TrendingUp,
  Package,
  AlertTriangle,
  CheckCircle,
  ChevronRight,
  Clock,
  ArrowRightLeft
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useQuery } from '@tanstack/react-query';
import { fetchBusinessName } from '@/integrations/supabase/queries';
import { format, isAfter, startOfDay, addDays, eachDayOfInterval, isSameDay, isBefore, parseISO, isWithinInterval } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { supabase } from '@/lib/supabase';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import CreateOrderDialog from '@/components/orders/CreateOrderDialog';

// --- SUB-COMPONENTES VISUAIS ---

const MetricCard = ({ title, value, subtext, icon: Icon, variant }: any) => {
  const isPrimary = variant === 'primary'; // Laranja
  const bgColor = isPrimary ? 'bg-[#F57C00]' : 'bg-[#1A237E]';
  const textColor = isPrimary ? 'text-[#F57C00]' : 'text-[#1A237E]';

  return (
    <Card className="shadow-hard border border-gray-200 bg-white relative overflow-hidden group hover:shadow-lg transition-all rounded-xl">
      <div className={`absolute top-0 left-0 w-1.5 h-full ${bgColor}`} />
      <CardContent className="p-6 flex items-start justify-between">
        <div>
          <p className="text-sm font-bold text-gray-500 uppercase tracking-wide mb-1">{title}</p>
          <h3 className={`text-3xl font-extrabold ${textColor}`}>{value}</h3>
          {subtext && <p className="text-xs text-gray-400 mt-2 flex items-center gap-1 font-medium">{subtext}</p>}
        </div>
        <div className={`p-3 rounded-lg ${bgColor} bg-opacity-10`}>
          <Icon className={`h-6 w-6 ${textColor}`} />
        </div>
      </CardContent>
    </Card>
  );
};

// WIDGET: ALERTAS DE DEVOLUÇÃO (NOVO)
const ReturnsAlertWidget = ({ orders }: { orders: any[] }) => {
  const navigate = useNavigate();
  const today = startOfDay(new Date());

  // Filtra pedidos que vencem HOJE e estão ativos
  const returnsToday = useMemo(() => {
    return orders?.filter(o => {
      const end = startOfDay(parseISO(o.end_date));
      // Status deve ser 'signed', 'picked_up' ou 'reserved' (embora reserved geralmente não precise devolver, se vence hoje, é bom checar)
      const isActive = ['signed', 'picked_up'].includes(o.status);
      return isSameDay(end, today) && isActive;
    }) || [];
  }, [orders]);

  if (returnsToday.length === 0) return null; // Não mostra se não tiver devolução

  return (
    <Card className="border-2 border-[#F57C00] bg-orange-50/50 shadow-sm mb-6">
      <CardHeader className="pb-2 border-b border-orange-100">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-[#F57C00]" />
            <CardTitle className="text-lg font-extrabold text-orange-900 uppercase">Atenção: Devoluções Hoje</CardTitle>
          </div>
          <Badge className="bg-[#F57C00] hover:bg-orange-600 text-white font-bold">{returnsToday.length} Pendentes</Badge>
        </div>
      </CardHeader>
      <CardContent className="p-0">
        <div className="divide-y divide-orange-200/50">
          {returnsToday.map((order) => (
            <div key={order.id} className="p-4 flex items-center justify-between hover:bg-orange-100/50 transition-colors cursor-pointer" onClick={() => navigate(`/orders?id=${order.id}`)}>
              <div className="flex items-center gap-3">
                <div className="p-2 bg-white rounded-full border border-orange-200">
                  <Clock className="h-4 w-4 text-[#F57C00]" />
                </div>
                <div>
                  <p className="font-bold text-gray-900">{order.customer_name}</p>
                  <p className="text-xs text-orange-800 font-medium">Pedido #{order.id.split('-')[0]}</p>
                </div>
              </div>
              <div className="text-right">
                <Button size="sm" variant="ghost" className="text-[#F57C00] font-bold hover:text-orange-800 hover:bg-orange-200">
                  Ver Pedido <ChevronRight className="h-4 w-4 ml-1" />
                </Button>
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
};

// Widget de Inventário Rápido (Lado Direito)
const QuickInventoryWidget = ({ products, activeOrders }: any) => {
  const navigate = useNavigate();
  
  const inventoryStatus = useMemo(() => {
    if (!products || !activeOrders) return [];
    const today = startOfDay(new Date());

    return products.map((product: any) => {
      const rentedToday = activeOrders
        .filter((item: any) => {
          if (item.product_id !== product.id) return false;
          const start = startOfDay(parseISO(item.orders.start_date));
          const end = startOfDay(parseISO(item.orders.end_date));
          return isWithinInterval(today, { start, end });
        })
        .reduce((acc: number, item: any) => acc + item.quantity, 0);

      const available = product.total_quantity - rentedToday;
      let status = 'available';
      if (available <= 0) status = 'out_of_stock';
      else if (available / product.total_quantity <= 0.2) status = 'low_stock';

      return { ...product, available, status };
    })
    .sort((a: any, b: any) => {
        const priority: any = { out_of_stock: 0, low_stock: 1, available: 2 };
        return priority[a.status] - priority[b.status];
    })
    .slice(0, 5);
  }, [products, activeOrders]);

  return (
    <Card className="h-full border border-gray-200 shadow-hard bg-white rounded-xl">
      <CardHeader className="pb-2 border-b border-gray-100">
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg font-extrabold text-[#1A237E]">Inventário Rápido</CardTitle>
          <Button variant="ghost" size="sm" onClick={() => navigate('/inventory')} className="text-xs font-bold text-gray-500 uppercase tracking-wide hover:text-[#1A237E]">Ver tudo</Button>
        </div>
      </CardHeader>
      <CardContent className="p-0">
        <div className="divide-y divide-gray-100">
          {inventoryStatus.map((item: any) => (
            <div key={item.id} className="p-4 flex items-center justify-between hover:bg-gray-50 transition-colors">
              <div className="flex items-center gap-3">
                <div className={`p-2 rounded-lg border ${item.status === 'out_of_stock' ? 'bg-red-50 border-red-100 text-red-600' : item.status === 'low_stock' ? 'bg-orange-50 border-orange-100 text-[#F57C00]' : 'bg-blue-50 border-blue-100 text-[#1A237E]'}`}>
                  <Package className="h-4 w-4" />
                </div>
                <div>
                  <p className="font-bold text-sm text-gray-800">{item.name}</p>
                  <p className="text-xs text-gray-500 font-medium">Total: {item.total_quantity} un</p>
                </div>
              </div>
              <div className="text-right">
                {item.status === 'out_of_stock' && <Badge className="bg-[#D32F2F] text-white font-bold hover:bg-red-700">ESGOTADO</Badge>}
                {item.status === 'low_stock' && <Badge className="bg-[#F57C00] text-white font-bold hover:bg-orange-600">{item.available} RESTANTES</Badge>}
                {item.status === 'available' && <Badge className="bg-[#10B981] text-white font-bold hover:bg-green-600">{item.available} DISPONÍVEIS</Badge>}
              </div>
            </div>
          ))}
          {inventoryStatus.length === 0 && <p className="p-6 text-center text-sm text-gray-400">Nenhum produto cadastrado.</p>}
        </div>
      </CardContent>
    </Card>
  );
};

// Widget de Timeline (Central)
const TimelineWidget = ({ products, activeOrders }: any) => {
  const navigate = useNavigate();
  const today = startOfDay(new Date());
  const days = eachDayOfInterval({ start: today, end: addDays(today, 6) });

  return (
    <Card className="h-full border border-gray-200 shadow-hard bg-white overflow-hidden flex flex-col rounded-xl">
      <CardHeader className="pb-2 border-b border-gray-100 bg-white z-20">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <CardTitle className="text-lg font-extrabold text-[#1A237E]">Timeline (7 Dias)</CardTitle>
          </div>
          <Button variant="outline" size="sm" onClick={() => navigate('/timeline')} className="text-xs font-bold uppercase tracking-wide border-gray-300 text-gray-600">
             Expandir <ChevronRight className="h-3 w-3 ml-1" />
          </Button>
        </div>
      </CardHeader>
      
      <div className="flex-1 overflow-x-auto overflow-y-auto relative bg-gray-50/50">
        <div className="min-w-[600px]">
            {/* Header Dias */}
            <div className="flex border-b border-gray-200 bg-white sticky top-0 z-10 shadow-sm">
                <div className="w-48 p-3 text-xs font-extrabold text-gray-400 border-r border-gray-200 bg-gray-50 sticky left-0 z-20 uppercase tracking-wider">Equipamento</div>
                {days.map(day => {
                    const isToday = isSameDay(day, today);
                    return (
                        <div key={day.toString()} className={`flex-1 min-w-[60px] p-2 text-center border-r border-gray-100 ${isToday ? 'bg-blue-50/50' : ''}`}>
                            <div className={`text-[10px] font-black uppercase ${isToday ? 'text-[#1A237E]' : 'text-gray-400'}`}>{format(day, 'EEE', { locale: ptBR })}</div>
                            <div className={`text-sm font-extrabold ${isToday ? 'text-[#F57C00]' : 'text-gray-700'}`}>{format(day, 'dd')}</div>
                        </div>
                    );
                })}
            </div>

            {/* Linhas */}
            {products?.slice(0, 8).map((product: any) => {
                const allocations = activeOrders?.filter((item: any) => item.product_id === product.id) || [];
                return (
                    <div key={product.id} className="flex border-b border-gray-200 last:border-0 hover:bg-white transition-colors group h-14 relative bg-white">
                        <div className="w-48 p-3 text-sm font-bold text-gray-700 border-r border-gray-200 bg-white sticky left-0 z-10 truncate flex items-center shadow-[2px_0_5px_-2px_rgba(0,0,0,0.1)]">
                            {product.name}
                        </div>
                        <div className="flex-1 flex relative">
                            {days.map(day => (
                                <div key={day.toString()} className={`flex-1 min-w-[60px] border-r border-gray-100 ${isSameDay(day, today) ? 'bg-blue-50/20' : ''}`} />
                            ))}
                            
                            {/* Barras de Reserva */}
                            {allocations.map((item: any, idx: number) => {
                                const start = parseISO(item.orders.start_date);
                                const end = parseISO(item.orders.end_date);
                                
                                let startIndex = days.findIndex(d => isSameDay(d, start));
                                let endIndex = days.findIndex(d => isSameDay(d, end));
                                
                                if (isBefore(start, today)) startIndex = 0;
                                if (isAfter(end, days[days.length-1])) endIndex = 6;
                                if (isAfter(start, days[days.length-1]) || isBefore(end, today)) return null;

                                const width = (endIndex - startIndex + 1) * 100 / 7; 
                                const left = (startIndex) * 100 / 7;

                                const isEndsToday = isSameDay(end, today);

                                return (
                                    <div 
                                        key={idx}
                                        className={cn(
                                            "absolute top-3 h-8 rounded-md mx-0.5 text-[10px] font-bold text-white flex items-center px-2 shadow-sm overflow-hidden whitespace-nowrap border-l-4 border-white/20",
                                            isEndsToday ? "bg-[#D32F2F]" : "bg-[#10B981]" // Vermelho se vence hoje, Verde caso contrário
                                        )}
                                        style={{ left: `${left}%`, width: `${width}%`, maxWidth: '100%' }}
                                        title={item.orders.customer_name}
                                    >
                                        {isEndsToday && <AlertTriangle className="h-3 w-3 mr-1 text-white animate-pulse" />}
                                        {item.orders.customer_name}
                                        {isEndsToday && <span className="ml-1 opacity-90 font-black uppercase text-[9px] bg-black/20 px-1 rounded">VENCE HOJE</span>}
                                    </div>
                                )
                            })}
                        </div>
                    </div>
                )
            })}
        </div>
      </div>
    </Card>
  );
};


const Dashboard = () => {
  const { data: businessName } = useQuery({ queryKey: ['businessName'], queryFn: fetchBusinessName });
  
  // Queries
  const { data: orders } = useQuery({
    queryKey: ['dashboardOrders'],
    queryFn: async () => {
        const { data } = await supabase.from('orders').select('*').neq('status', 'canceled');
        return data || [];
    }
  });

  const { data: products } = useQuery({
    queryKey: ['dashboardProducts'],
    queryFn: async () => {
        const { data } = await supabase.from('products').select('*').order('name');
        return data || [];
    }
  });

  const { data: orderItems } = useQuery({
    queryKey: ['dashboardOrderItems'],
    queryFn: async () => {
        const today = new Date().toISOString();
        const { data } = await supabase
            .from('order_items')
            .select('quantity, product_id, orders!inner(status, start_date, end_date, customer_name)')
            .in('orders.status', ['signed', 'reserved', 'picked_up'])
            // .gte('orders.end_date', today); // REMOVI ESSE FILTRO para garantir que apareça tudo, mesmo que tenha vencido ontem e não devolveu
        return data || [];
    }
  });

  const metrics = useMemo(() => {
    if (!orders) return { revenue: 0, active: 0, future: 0, clients: 0, itemsOut: 0 };

    const revenue = orders.filter(o => o.status !== 'draft').reduce((acc, curr) => acc + (Number(curr.total_amount) || 0), 0);
    const active = orders.filter(o => ['signed', 'reserved', 'picked_up'].includes(o.status)).length;
    
    const today = startOfDay(new Date());
    const future = orders.filter(o => {
        const start = new Date(o.start_date);
        return ['signed', 'reserved'].includes(o.status) && isAfter(start, today);
    }).length;

    const clients = new Set(orders.filter(o => o.status !== 'draft').map(o => o.customer_cpf)).size;
    const itemsOut = orderItems?.reduce((acc, item) => acc + item.quantity, 0) || 0;

    return { revenue, active, future, clients, itemsOut };
  }, [orders, orderItems]);

  const formatCurrency = (val: number) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val);

  return (
    <div className="p-6 md:p-10 space-y-8 bg-[#F4F5F7] min-h-screen font-sans">
      
      {/* HEADER */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-3xl font-extrabold tracking-tight text-[#1A237E] uppercase">Dashboard</h1>
          <p className="text-gray-500 mt-1 font-medium">Visão tática: {businessName || 'Minha Locadora'}</p>
        </div>
        <div className="flex gap-3">
            <CreateOrderDialog onOrderCreated={() => window.location.reload()}> 
                <Button className="bg-[#F57C00] hover:bg-orange-700 text-white font-bold uppercase tracking-wide h-12 px-6 shadow-hard rounded-lg transition-all active:translate-y-1">
                    + Novo Pedido
                </Button>
            </CreateOrderDialog>
        </div>
      </div>

      {/* ALERTA DE DEVOLUÇÃO (NOVO E DESTAQUE) */}
      <ReturnsAlertWidget orders={orders || []} />

      {/* METRICS ROW */}
      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
        <MetricCard title="Receita Total" value={formatCurrency(metrics.revenue)} subtext="Acumulado" icon={DollarSign} variant="primary" />
        <MetricCard title="Contratos Ativos" value={metrics.active} subtext="Em andamento" icon={FileText} variant="secondary" />
        <MetricCard title="Itens Alugados" value={metrics.itemsOut} subtext="Equipamentos fora" icon={Box} variant="primary" />
        <MetricCard title="Clientes" value={metrics.clients} subtext="Base total" icon={Users} variant="secondary" />
      </div>

      {/* MAIN CONTENT GRID */}
      <div className="grid gap-6 grid-cols-1 lg:grid-cols-12">
        <div className="lg:col-span-8 h-full min-h-[400px]">
            <TimelineWidget products={products} activeOrders={orderItems} />
        </div>
        <div className="lg:col-span-4 h-full min-h-[400px]">
            <QuickInventoryWidget products={products} activeOrders={orderItems} />
        </div>
      </div>
    </div>
  );
};

export default Dashboard;