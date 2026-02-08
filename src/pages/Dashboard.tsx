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
  User,
  Hash
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
import ThemeSwitcher from '@/components/ThemeSwitcher'; // Import ThemeSwitcher

// --- SUB-COMPONENTES VISUAIS ---

const MetricCard = ({ title, value, subtext, icon: Icon, variant }: any) => {
  const isPrimary = variant === 'primary'; // Laranja/Indigo
  const bgColor = isPrimary ? 'bg-primary/10' : 'bg-secondary/10';
  const textColor = isPrimary ? 'text-primary' : 'text-secondary';

  return (
    <Card className="shadow-hard border border-gray-200 bg-card relative overflow-hidden group hover:shadow-lg transition-all rounded-[var(--radius)]">
      <div className={`absolute top-0 left-0 w-1.5 h-full ${bgColor}`} />
      <CardContent className="p-6 flex items-start justify-between">
        <div>
          <p className="text-sm font-bold text-gray-500 uppercase tracking-wide mb-1">{title}</p>
          <h3 className={`text-3xl font-extrabold ${textColor}`}>{value}</h3>
          {subtext && <p className="text-xs text-gray-400 mt-2 flex items-center gap-1 font-medium">{subtext}</p>}
        </div>
        <div className={`p-3 rounded-lg ${bgColor}`}>
          <Icon className={`h-6 w-6 ${textColor}`} />
        </div>
      </CardContent>
    </Card>
  );
};

// WIDGET: ALERTAS DE DEVOLUÇÃO
const ReturnsAlertWidget = ({ orders }: { orders: any[] }) => {
  const navigate = useNavigate();
  const today = startOfDay(new Date());

  const returnsToday = useMemo(() => {
    return orders?.filter(o => {
      const end = startOfDay(parseISO(o.end_date));
      const isActive = ['signed', 'picked_up'].includes(o.status);
      return isSameDay(end, today) && isActive;
    }) || [];
  }, [orders]);

  if (returnsToday.length === 0) return null;

  return (
    <Card className="border-2 border-primary bg-primary/5 shadow-sm mb-6 rounded-[var(--radius)]">
      <CardHeader className="pb-2 border-b border-primary/20">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-primary" />
            <CardTitle className="text-lg font-extrabold text-primary uppercase">Atenção: Devoluções Hoje</CardTitle>
          </div>
          <Badge className="bg-primary hover:bg-primary/90 text-white font-bold">{returnsToday.length} Pendentes</Badge>
        </div>
      </CardHeader>
      <CardContent className="p-0">
        <div className="divide-y divide-primary/20">
          {returnsToday.map((order) => (
            <div key={order.id} className="p-4 flex items-center justify-between hover:bg-primary/10 transition-colors cursor-pointer" onClick={() => navigate(`/orders?id=${order.id}`)}>
              <div className="flex items-center gap-3">
                <div className="p-2 bg-card rounded-full border border-primary/20">
                  <Clock className="h-4 w-4 text-primary" />
                </div>
                <div>
                  <p className="font-bold text-foreground">{order.customer_name}</p>
                  <p className="text-xs text-primary font-medium">Pedido #{order.id.split('-')[0]}</p>
                </div>
              </div>
              <div className="text-right">
                <Button size="sm" variant="ghost" className="text-primary font-bold hover:text-primary/90 hover:bg-primary/20">
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
    
    const allRentedItems = activeOrders.flatMap((order: any) => 
        order.order_items.map((item: any) => ({
            product_id: item.product_id,
            quantity: item.quantity,
            start_date: order.start_date,
            end_date: order.end_date
        }))
    );

    const today = startOfDay(new Date());

    return products.map((product: any) => {
      const rentedToday = allRentedItems
        .filter((item: any) => {
          if (item.product_id !== product.id) return false;
          const start = startOfDay(parseISO(item.start_date));
          const end = startOfDay(parseISO(item.end_date));
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
    <Card className="h-full border border-gray-200 shadow-hard bg-card rounded-[var(--radius)]">
      <CardHeader className="pb-2 border-b border-gray-100">
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg font-extrabold text-secondary">Inventário Rápido</CardTitle>
          <Button variant="ghost" size="sm" onClick={() => navigate('/inventory')} className="text-xs font-bold text-gray-500 uppercase tracking-wide hover:text-secondary">Ver tudo</Button>
        </div>
      </CardHeader>
      <CardContent className="p-0">
        <div className="divide-y divide-gray-100">
          {inventoryStatus.map((item: any) => (
            <div key={item.id} className="p-4 flex items-center justify-between hover:bg-gray-50 transition-colors">
              <div className="flex items-center gap-3">
                <div className={cn(
                    "p-2 rounded-lg border",
                    item.status === 'out_of_stock' ? 'bg-red-50 border-red-100 text-destructive' : 
                    item.status === 'low_stock' ? 'bg-primary/10 border-primary/20 text-primary' : 
                    'bg-secondary/10 border-secondary/20 text-secondary'
                )}>
                  <Package className="h-4 w-4" />
                </div>
                <div>
                  <p className="font-bold text-sm text-foreground">{item.name}</p>
                  <p className="text-xs text-gray-500 font-medium">Total: {item.total_quantity} un</p>
                </div>
              </div>
              <div className="text-right">
                {item.status === 'out_of_stock' && <Badge className="bg-destructive text-white font-bold hover:bg-destructive/90">ESGOTADO</Badge>}
                {item.status === 'low_stock' && <Badge className="bg-primary text-white font-bold hover:bg-primary/90">{item.available} RESTANTES</Badge>}
                {item.status === 'available' && <Badge className="bg-green-600 text-white font-bold hover:bg-green-700">{item.available} DISPONÍVEIS</Badge>}
              </div>
            </div>
          ))}
          {inventoryStatus.length === 0 && <p className="p-6 text-center text-sm text-gray-400">Nenhum produto cadastrado.</p>}
        </div>
      </CardContent>
    </Card>
  );
};

// Widget de Timeline (Central) - AJUSTADO: SÓ ID NA COLUNA
const TimelineWidget = ({ activeOrders }: any) => {
  const navigate = useNavigate();
  const today = startOfDay(new Date());
  const days = eachDayOfInterval({ start: today, end: addDays(today, 6) }); 

  const sortedOrders = useMemo(() => {
    return (activeOrders || [])
        .filter((order: any) => {
            const start = parseISO(order.start_date);
            const end = parseISO(order.end_date);
            if (isBefore(end, today)) return false;
            if (isAfter(start, days[days.length - 1])) return false;
            return true;
        })
        .sort((a: any, b: any) => new Date(a.start_date).getTime() - new Date(b.start_date).getTime())
        .slice(0, 6);
  }, [activeOrders, days, today]);

  return (
    <Card className="h-full border border-gray-200 shadow-hard bg-card overflow-hidden flex flex-col rounded-[var(--radius)]">
      <CardHeader className="pb-2 border-b border-gray-100 bg-card z-20">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <CardTitle className="text-lg font-extrabold text-secondary">Timeline de Contratos</CardTitle>
            <Badge variant="outline" className="text-xs font-bold text-gray-500 border-gray-300">Próximos 7 dias</Badge>
          </div>
          <Button variant="outline" size="sm" onClick={() => navigate('/timeline')} className="text-xs font-bold uppercase tracking-wide border-gray-300 text-gray-600 hover:text-secondary">
             Expandir <ChevronRight className="h-3 w-3 ml-1" />
          </Button>
        </div>
      </CardHeader>
      
      <div className="flex-1 overflow-x-auto overflow-y-auto relative bg-muted/50">
        <div className="min-w-[600px]">
            {/* Header Dias */}
            <div className="flex border-b border-gray-200 bg-card sticky top-0 z-10 shadow-sm">
                {/* Coluna ID Estreita */}
                <div className="w-24 p-3 text-xs font-extrabold text-gray-400 border-r border-gray-200 bg-muted sticky left-0 z-20 uppercase tracking-wider flex items-center justify-center gap-1">
                    <Hash className="h-3 w-3" /> ID
                </div>
                {days.map(day => {
                    const isToday = isSameDay(day, today);
                    return (
                        <div key={day.toString()} className={`flex-1 min-w-[60px] p-2 text-center border-r border-gray-100 ${isToday ? 'bg-primary/10' : ''}`}>
                            <div className={`text-[10px] font-black uppercase ${isToday ? 'text-secondary' : 'text-gray-400'}`}>{format(day, 'EEE', { locale: ptBR })}</div>
                            <div className={`text-sm font-extrabold ${isToday ? 'text-primary' : 'text-foreground'}`}>{format(day, 'dd')}</div>
                        </div>
                    );
                })}
            </div>

            {/* Linhas (Pedidos) */}
            {sortedOrders.length === 0 ? <div className="p-8 text-center text-gray-400 text-sm font-medium">Sem contratos ativos na semana.</div> :
             sortedOrders.map((order: any) => {
                const start = parseISO(order.start_date);
                const end = parseISO(order.end_date);
                
                let startIndex = days.findIndex(d => isSameDay(d, start));
                let endIndex = days.findIndex(d => isSameDay(d, end));
                
                if (isBefore(start, today)) startIndex = 0;
                if (isAfter(end, days[days.length-1])) endIndex = 6;
                
                const width = (endIndex - startIndex + 1) * 100 / 7; 
                const left = (startIndex) * 100 / 7;
                
                const isEndsToday = isSameDay(end, today);

                return (
                    <div key={order.id} className="flex border-b border-gray-200 last:border-0 hover:bg-card transition-colors group h-12 relative bg-card">
                        {/* Coluna ID Limpa */}
                        <div className="w-24 p-3 text-xs font-bold text-secondary border-r border-gray-200 bg-card sticky left-0 z-10 flex items-center justify-center shadow-[2px_0_5px_-2px_rgba(0,0,0,0.1)]">
                            #{order.id.split('-')[0]}
                        </div>
                        
                        <div className="flex-1 flex relative">
                            {days.map(day => (
                                <div key={day.toString()} className={`flex-1 min-w-[60px] border-r border-gray-100 ${isSameDay(day, today) ? 'bg-primary/10' : ''}`} />
                            ))}
                            
                            <div 
                                className={cn(
                                    "absolute top-2 h-8 rounded-[var(--radius)] mx-0.5 text-[10px] font-bold text-white flex items-center px-2 shadow-sm overflow-hidden whitespace-nowrap",
                                    isEndsToday ? "bg-destructive" : "bg-green-600" // Using destructive for end today, green for active
                                )}
                                style={{ left: `${left}%`, width: `${width}%`, maxWidth: '100%' }}
                                title={order.customer_name}
                            >
                                {isEndsToday && <AlertTriangle className="h-3 w-3 mr-1 text-white" />}
                                {order.customer_name}
                            </div>
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

  const { data: activeOrders } = useQuery({
    queryKey: ['dashboardActiveOrders'],
    queryFn: async () => {
        const { data } = await supabase
            .from('orders')
            .select('*, order_items(quantity, product_id)')
            .in('status', ['signed', 'reserved', 'picked_up'])
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
    const itemsOut = activeOrders?.reduce((acc: number, order: any) => {
        const orderTotal = order.order_items.reduce((sum: number, item: any) => sum + item.quantity, 0);
        return acc + orderTotal;
    }, 0) || 0;

    return { revenue, active, future, clients, itemsOut };
  }, [orders, activeOrders]);

  const formatCurrency = (val: number) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val);

  return (
    <div className="p-6 md:p-10 space-y-8 bg-background min-h-screen font-sans">
      
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-3xl font-extrabold tracking-tight text-foreground uppercase">Dashboard</h1>
          <p className="text-gray-500 mt-1 font-medium">Visão tática: {businessName || 'Minha Locadora'}</p>
        </div>
        <div className="flex gap-3 items-center">
            <ThemeSwitcher />
            <CreateOrderDialog onOrderCreated={() => window.location.reload()}> 
                <Button className="bg-primary hover:bg-primary/90 text-white font-bold uppercase h-12 px-6 shadow-hard rounded-[var(--radius)] transition-all active:translate-y-1">
                    + Novo Pedido
                </Button>
            </CreateOrderDialog>
        </div>
      </div>

      <ReturnsAlertWidget orders={orders || []} />

      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
        <MetricCard title="Receita Total" value={formatCurrency(metrics.revenue)} subtext="Acumulado" icon={DollarSign} variant="primary" />
        <MetricCard title="Contratos Ativos" value={metrics.active} subtext="Em andamento" icon={FileText} variant="secondary" />
        <MetricCard title="Itens Alugados" value={metrics.itemsOut} subtext="Equipamentos fora" icon={Box} variant="primary" />
        <MetricCard title="Clientes" value={metrics.clients} subtext="Base total" icon={Users} variant="secondary" />
      </div>

      <div className="grid gap-6 grid-cols-1 lg:grid-cols-12">
        <div className="lg:col-span-8 h-full min-h-[400px]">
            <TimelineWidget activeOrders={activeOrders} />
        </div>
        <div className="lg:col-span-4 h-full min-h-[400px]">
            <QuickInventoryWidget products={products} activeOrders={activeOrders} />
        </div>
      </div>
    </div>
  );
};

export default Dashboard;