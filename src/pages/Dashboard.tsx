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
  AlertCircle,
  CheckCircle,
  ChevronRight,
  Calendar as CalendarIcon
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useQuery } from '@tanstack/react-query';
import { fetchBusinessName } from '@/integrations/supabase/queries';
import { format, isAfter, startOfDay, addDays, eachDayOfInterval, isSameDay, isBefore, parseISO, isWithinInterval } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { supabase } from '@/lib/supabase';
import { useNavigate, Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import CreateOrderDialog from '@/components/orders/CreateOrderDialog';
import RevenueChart from '@/components/dashboard/RevenueChart';

// --- SUB-COMPONENTS VISUAIS ---

interface MetricCardProps {
  title: string;
  value: string | number;
  subtext?: React.ReactNode;
  icon: React.ElementType;
  variant: 'primary' | 'secondary';
}

const MetricCard: React.FC<MetricCardProps> = ({ title, value, subtext, icon: Icon, variant }) => {
  const iconClasses = variant === 'primary' 
    ? "bg-primary text-white" // Safety Orange
    : "bg-secondary text-white"; // Legal Blue

  const valueClasses = "text-secondary"; // Legal Blue para todos os valores

  return (
    <Card className="shadow-hard-shadow border border-border bg-white">
      <CardContent className="p-6 flex items-start justify-between">
        <div>
          <p className="text-sm font-medium text-gray-500 mb-1">{title}</p>
          <h3 className={cn("text-3xl font-heading font-extrabold", valueClasses)}>{value}</h3>
          {subtext && <p className="text-xs text-gray-400 mt-2 flex items-center gap-1">{subtext}</p>}
        </div>
        <div className={cn("p-3 rounded-lg", iconClasses)}>
          <Icon className="h-6 w-6" />
        </div>
      </CardContent>
    </Card>
  );
};

// Widget de Inventário Rápido (Lado Direito)
const QuickInventoryWidget = ({ products, activeOrders }: any) => {
  const navigate = useNavigate();
  
  // Processa os dados para achar itens críticos
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
        // Prioriza: Esgotado > Baixo Estoque > Disponível
        const priority: any = { out_of_stock: 0, low_stock: 1, available: 2 };
        return priority[a.status] - priority[b.status];
    })
    .slice(0, 5); // Mostra apenas top 5
  }, [products, activeOrders]);

  return (
    <Card className="h-full border-none shadow-hard-shadow bg-white">
      <CardHeader className="pb-2 border-b border-gray-200">
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg font-heading font-extrabold text-gray-800">Inventário Rápido</CardTitle>
          <Button variant="ghost" size="sm" onClick={() => navigate('/inventory')} className="text-xs text-secondary hover:text-secondary/90">Ver tudo</Button>
        </div>
      </CardHeader>
      <CardContent className="p-0">
        <div className="divide-y divide-gray-100">
          {inventoryStatus.map((item: any) => (
            <div key={item.id} className="p-4 flex items-center justify-between hover:bg-gray-50 transition-colors">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-secondary/10 text-secondary">
                  <Package className="h-4 w-4" />
                </div>
                <div>
                  <p className="font-semibold text-sm text-gray-800">{item.name}</p>
                  <p className="text-xs text-gray-500">Total: {item.total_quantity} un</p>
                </div>
              </div>
              <div className="text-right">
                {item.status === 'out_of_stock' && (
                   <Badge variant="overdue">Esgotado</Badge>
                )}
                {item.status === 'low_stock' && (
                   <Badge variant="pending">{item.available} Restantes</Badge>
                )}
                {item.status === 'available' && (
                   <Badge variant="signed">{item.available} Disponíveis</Badge>
                )}
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
  // Mostra apenas 7 dias no dashboard para não poluir
  const days = eachDayOfInterval({ start: today, end: addDays(today, 6) });
  const DAY_WIDTH = 60; // Mais compacto que a tela cheia

  return (
    <Card className="h-full border-none shadow-hard-shadow bg-white overflow-hidden flex flex-col">
      <CardHeader className="pb-2 border-b border-gray-200 bg-white z-20">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <CardTitle className="text-lg font-heading font-extrabold text-gray-800">Timeline de Disponibilidade</CardTitle>
            <Badge variant="outline" className="text-xs font-normal text-gray-500">Próximos 7 dias</Badge>
          </div>
          <div className="flex gap-2">
             <Button variant="outline" size="sm" onClick={() => navigate('/timeline')} className="text-xs">
                Expandir <ChevronRight className="h-3 w-3 ml-1" />
             </Button>
          </div>
        </div>
      </CardHeader>
      
      <div className="flex-1 overflow-x-auto overflow-y-auto relative bg-background">
        <div className="min-w-[600px]">
            {/* Header Dias */}
            <div className="flex border-b border-gray-100 bg-white sticky top-0 z-10">
                <div className="w-48 p-3 text-xs font-semibold text-gray-400 border-r bg-gray-50/50 sticky left-0 z-20">Equipamento</div>
                {days.map(day => (
                    <div key={day.toString()} className="flex-1 min-w-[60px] p-2 text-center border-r border-gray-50">
                        <div className="text-[10px] font-bold text-gray-400 uppercase">{format(day, 'EEE', { locale: ptBR })}</div>
                        <div className="text-sm font-bold text-gray-700">{format(day, 'dd')}</div>
                    </div>
                ))}
            </div>

            {/* Linhas */}
            {products?.slice(0, 8).map((product: any) => { // Limita a 8 produtos para não poluir
                const allocations = activeOrders?.filter((item: any) => item.product_id === product.id) || [];
                return (
                    <div key={product.id} className="flex border-b border-gray-100 last:border-0 hover:bg-white transition-colors group h-12 relative">
                        <div className="w-48 p-3 text-sm font-medium text-gray-700 border-r border-gray-100 bg-white sticky left-0 z-10 truncate flex items-center">
                            {product.name}
                        </div>
                        <div className="flex-1 flex relative">
                            {days.map(day => (
                                <div key={day.toString()} className="flex-1 min-w-[60px] border-r border-gray-50/50" />
                            ))}
                            
                            {/* Barras de Reserva Simplificadas */}
                            {allocations.map((item: any, idx: number) => {
                                const start = parseISO(item.orders.start_date);
                                const end = parseISO(item.orders.end_date);
                                
                                // Lógica simplificada de posicionamento para o widget
                                let startIndex = days.findIndex(d => isSameDay(d, start));
                                let endIndex = days.findIndex(d => isSameDay(d, end));
                                
                                // Se começar antes de hoje, trava no inicio
                                if (isBefore(start, today)) startIndex = 0;
                                // Se terminar depois da janela, trava no fim
                                if (isAfter(end, days[days.length-1])) endIndex = 6;
                                
                                // Se estiver fora da janela
                                if (isAfter(start, days[days.length-1]) || isBefore(end, today)) return null;

                                const width = (endIndex - startIndex + 1) * 100 / 7; // % aproximada
                                const left = (startIndex) * 100 / 7;

                                const isSigned = item.orders.status === 'signed';

                                return (
                                    <div 
                                        key={idx}
                                        className={cn(
                                            "absolute top-2 h-8 rounded mx-0.5 text-[10px] font-bold text-white flex items-center px-2 shadow-sm overflow-hidden whitespace-nowrap",
                                            isSigned ? "bg-[#10B981]" : "bg-primary" // Usando cores estáticas
                                        )}
                                        style={{ 
                                            left: `${left}%`, 
                                            width: `${width}%`,
                                            maxWidth: '100%'
                                        }}
                                        title={item.orders.customer_name}
                                    >
                                        {item.orders.customer_name}
                                    </div>
                                )
                            })}
                        </div>
                    </div>
                )
            })}
            {products?.length > 8 && (
                <div className="p-2 text-center text-xs text-gray-400 bg-gray-50">
                    + {products.length - 8} outros produtos...
                </div>
            )}
        </div>
      </div>
    </Card>
  );
};


const Dashboard = () => {
  const { data: businessName } = useQuery({ queryKey: ['businessName'], queryFn: fetchBusinessName });
  
  // --- CARREGAMENTO DE DADOS UNIFICADO (Otimizado para Dashboard) ---
  // 1. Pedidos (Para métricas e timeline)
  const { data: orders } = useQuery({
    queryKey: ['dashboardOrders'],
    queryFn: async () => {
        const { data } = await supabase
            .from('orders')
            .select('*')
            .neq('status', 'canceled');
        return data || [];
    }
  });

  // 2. Produtos (Para inventário e timeline)
  const { data: products } = useQuery({
    queryKey: ['dashboardProducts'],
    queryFn: async () => {
        const { data } = await supabase.from('products').select('*').order('name');
        return data || [];
    }
  });

  // 3. Itens de Pedido (Para conectar produtos e timeline)
  const { data: orderItems } = useQuery({
    queryKey: ['dashboardOrderItems'],
    queryFn: async () => {
        const today = new Date().toISOString();
        const { data } = await supabase
            .from('order_items')
            .select('quantity, product_id, orders!inner(status, start_date, end_date, customer_name)')
            .in('orders.status', ['signed', 'reserved', 'picked_up'])
            .gte('orders.end_date', today); // Pega só o que não acabou ainda (para performance)
        return data || [];
    }
  });

  // --- CÁLCULO DE MÉTRICAS ---
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
    <div className="p-6 md:p-10 space-y-8 bg-background min-h-screen font-sans">
      
      {/* HEADER */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-3xl font-heading font-extrabold tracking-tight text-gray-900">Dashboard</h1>
          <p className="text-gray-500 mt-1">Bem-vindo, {businessName || 'Gestor'}. Visão geral de hoje.</p>
        </div>
        <div className="flex gap-3">
            <CreateOrderDialog onOrderCreated={() => window.location.reload()}> 
                <Button className="bg-primary hover:bg-primary/90 shadow-lg shadow-primary/20 transition-all">
                    + Novo Pedido
                </Button>
            </CreateOrderDialog>
        </div>
      </div>

      {/* METRICS ROW */}
      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
        <MetricCard 
            title="Receita Total" 
            value={formatCurrency(metrics.revenue)} 
            subtext={<span className="text-green-600 font-bold flex items-center"><TrendingUp className="h-3 w-3 mr-1"/> Acumulado</span>}
            icon={DollarSign} 
            variant="primary" 
        />
        <MetricCard 
            title="Contratos Ativos" 
            value={metrics.active} 
            subtext="Assinados ou Na Rua"
            icon={FileText} 
            variant="secondary" 
        />
        <MetricCard 
            title="Itens Alugados" 
            value={metrics.itemsOut} 
            subtext="Equipamentos fora"
            icon={Box} 
            variant="primary" 
        />
        <MetricCard 
            title="Base de Clientes" 
            value={metrics.clients} 
            subtext="Clientes únicos"
            icon={Users} 
            variant="secondary" 
        />
      </div>

      {/* MAIN CONTENT GRID */}
      <div className="grid gap-6 grid-cols-1 lg:grid-cols-12 h-[500px]">
        {/* ESQUERDA: TIMELINE (Ocupa 8 colunas) */}
        <div className="lg:col-span-8 h-full">
            <TimelineWidget products={products} activeOrders={orderItems} />
        </div>

        {/* DIREITA: INVENTÁRIO RÁPIDO (Ocupa 4 colunas) */}
        <div className="lg:col-span-4 h-full">
            <QuickInventoryWidget products={products} activeOrders={orderItems} />
        </div>
      </div>
      <RevenueChart />
    </div>
  );
};

export default Dashboard;