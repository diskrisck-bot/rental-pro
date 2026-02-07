"use client";

import React, { useState, useEffect } from 'react';
import { 
  Users, 
  Box, 
  DollarSign, 
  FileText, 
  Loader2, 
  Info,
  Plus,
  AlertTriangle,
  Package,
  TrendingUp
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { 
  fetchPendingPickups, 
  fetchPendingReturns,
  fetchBusinessName,
  fetchBusinessConfig,
  fetchProductCount
} from '@/integrations/supabase/queries';
import { format, isAfter, startOfDay } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { 
  Tooltip, 
  TooltipContent, 
  TooltipTrigger 
} from '@/components/ui/tooltip';
import RevenueChart from '@/components/dashboard/RevenueChart';
import { useNavigate } from 'react-router-dom';
import { useIsMobile } from '@/hooks/use-mobile';
import { Button } from '@/components/ui/button';
import CreateOrderDialog from '@/components/orders/CreateOrderDialog';
import { supabase } from '@/lib/supabase'; // Import direto para garantir os dados
import { showError } from '@/utils/toast';

const DashboardCard = ({ title, value, icon: Icon, description, isLoading, tooltipContent, subValue }: any) => {
  const isMobile = useIsMobile();
  return (
    <Card className="rounded-xl shadow-sm hover:shadow-md transition-shadow">
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <div className="flex flex-col">
          <div className="flex items-center gap-1">
            <CardTitle className="text-sm font-medium text-muted-foreground">{title}</CardTitle>
            {!isMobile && tooltipContent && (
              <Tooltip>
                <TooltipTrigger asChild><Info className="h-4 w-4 text-muted-foreground cursor-help" /></TooltipTrigger>
                <TooltipContent className="max-w-xs bg-gray-800 text-white border-none rounded-lg shadow-lg p-3"><p className="text-xs">{tooltipContent}</p></TooltipContent>
              </Tooltip>
            )}
          </div>
          {isMobile && tooltipContent && <p className="text-xs text-gray-400 mt-1">{tooltipContent}</p>}
        </div>
        <Icon className="h-4 w-4 text-blue-600" />
      </CardHeader>
      <CardContent>
        {isLoading ? <div className="h-8 flex items-center"><Loader2 className="h-5 w-5 animate-spin text-blue-400" /></div> : <div className="text-2xl font-bold">{value}</div>}
        <div className="flex flex-col mt-1">
            <p className="text-xs text-muted-foreground">{description}</p>
            {subValue && (
                <p className="text-[10px] font-semibold text-orange-600 mt-1 flex items-center gap-1">
                    <TrendingUp className="h-3 w-3" /> Pipeline: {subValue}
                </p>
            )}
        </div>
      </CardContent>
    </Card>
  );
};

const TaskListCard = ({ title, data, dateKey, emptyMessage, isLoading, tooltipContent }: any) => {
  const navigate = useNavigate();
  const isMobile = useIsMobile();
  const handleItemClick = (id: string) => navigate(`/orders?id=${id}`);
  return (
    <Card className="col-span-1 rounded-xl shadow-sm">
      <CardHeader>
        <div className="flex flex-col">
          <div className="flex items-center gap-2">
            <CardTitle>{title}</CardTitle>
            {!isMobile && tooltipContent && (
              <Tooltip>
                <TooltipTrigger asChild><Info className="h-4 w-4 text-muted-foreground cursor-help" /></TooltipTrigger>
                <TooltipContent className="max-w-xs bg-gray-800 text-white border-none rounded-lg shadow-lg p-3"><p className="text-xs">{tooltipContent}</p></TooltipContent>
              </Tooltip>
            )}
          </div>
          {isMobile && tooltipContent && <p className="text-xs text-gray-400 mt-1">{tooltipContent}</p>}
        </div>
      </CardHeader>
      <CardContent>
        {isLoading ? <div className="flex flex-col items-center justify-center py-8"><Loader2 className="h-6 w-6 animate-spin text-blue-600" /></div> : (
          <div className="space-y-4">
            {data && data.length > 0 ? data.map((item: any) => {
              const date = new Date(item[dateKey]);
              const time = format(date, 'HH:mm');
              const displayTime = time !== '00:00' ? time : 'Dia Todo';
              return (
                <div key={item.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg border hover:bg-gray-100 transition-colors cursor-pointer" onClick={() => handleItemClick(item.id)}>
                  <div><p className="font-medium text-sm">Pedido #{item.id.split('-')[0]}</p><p className="text-xs text-gray-500 text-muted-foreground">Cliente: {item.customer_name}</p></div>
                  <div className="text-xs font-semibold px-2 py-1 bg-yellow-100 text-yellow-700 rounded">{displayTime}</div>
                </div>
              );
            }) : <p className="text-sm text-center text-muted-foreground py-4 border-2 border-dashed rounded-lg">{emptyMessage}</p>}
          </div>
        )}
      </CardContent>
    </Card>
  );
};

const Dashboard = () => {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  
  // --- SUBTITUIÇÃO DO FETCH ANTIGO POR ESTADO LOCAL CALCULADO ---
  const [metrics, setMetrics] = useState({
    totalRevenue: 0,
    pipelineRevenue: 0,
    activeRentals: 0,
    futureReservations: 0,
    newClients: 0
  });
  const [loadingMetrics, setLoadingMetrics] = useState(true);

  // Calcula métricas em tempo real no frontend para garantir precisão
  const calculateMetrics = async () => {
    setLoadingMetrics(true);
    try {
        const { data: orders, error } = await supabase
            .from('orders')
            .select('*')
            .neq('status', 'canceled'); // Pega tudo menos cancelados

        if (error) throw error;

        if (orders) {
            // 1. Receita (Tudo que não é rascunho e não é cancelado)
            const revenue = orders
                .filter(o => o.status !== 'draft')
                .reduce((acc, curr) => acc + (Number(curr.total_amount) || 0), 0);

            // 2. Pipeline (Opcional: Valor estimado dos rascunhos)
            const pipeline = orders
                .filter(o => o.status === 'draft')
                .reduce((acc, curr) => acc + (Number(curr.total_amount) || 0), 0);

            // 3. Ativos (AQUI ESTÁ A CORREÇÃO: Signed + Reserved + Picked_up)
            const active = orders.filter(o => 
                ['signed', 'reserved', 'picked_up'].includes(o.status)
            ).length;

            // 4. Reservas Futuras (Ativos com data de início > hoje)
            const today = startOfDay(new Date());
            const future = orders.filter(o => {
                const start = new Date(o.start_date);
                return ['signed', 'reserved'].includes(o.status) && isAfter(start, today);
            }).length;

            // 5. Clientes Únicos
            const clients = new Set(orders.filter(o => o.status !== 'draft').map(o => o.customer_cpf)).size;

            setMetrics({
                totalRevenue: revenue,
                pipelineRevenue: pipeline,
                activeRentals: active,
                futureReservations: future,
                newClients: clients
            });
        }
    } catch (e) {
        console.error(e);
        showError("Erro ao calcular métricas.");
    } finally {
        setLoadingMetrics(false);
    }
  };

  // Chama o cálculo ao montar
  useEffect(() => { calculateMetrics(); }, []);

  const { data: businessName, isLoading: isLoadingName } = useQuery({ queryKey: ['businessName'], queryFn: fetchBusinessName, staleTime: 1000 * 60 * 5 });
  const { data: pickups, isLoading: isLoadingPickups } = useQuery({ queryKey: ['pendingPickups'], queryFn: fetchPendingPickups });
  const { data: returns, isLoading: isLoadingReturns } = useQuery({ queryKey: ['pendingReturns'], queryFn: fetchPendingReturns });
  
  const { data: businessConfig, isLoading: isLoadingConfig } = useQuery({ queryKey: ['businessConfig'], queryFn: fetchBusinessConfig, staleTime: 0 });
  const { data: productCount, isLoading: isLoadingProducts } = useQuery({ queryKey: ['productCount'], queryFn: fetchProductCount, staleTime: 0 });

  const isCompanyConfigured = !!(businessConfig?.business_name?.trim() && businessConfig?.business_cnpj?.trim());
  const hasProducts = (productCount || 0) > 0;
  const isGlobalLoading = isLoadingConfig || isLoadingProducts;

  const formatCurrency = (amount: number) => `R$ ${amount.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`;
  const greetingName = businessName || 'RentalPro';

  const renderQuickActionButton = () => {
    if (isGlobalLoading) return <Button disabled><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Verificando...</Button>;
    if (!isCompanyConfigured) return (
      <Button className="bg-orange-600 hover:bg-orange-700 shadow-lg" onClick={() => navigate('/settings')}>
        <AlertTriangle className="mr-2 h-4 w-4" /> Configure a Empresa
      </Button>
    );
    if (!hasProducts) return (
      <Button className="bg-indigo-600 hover:bg-indigo-700 text-white shadow-lg" onClick={() => navigate('/inventory')}>
        <Package className="mr-2 h-4 w-4" /> Cadastre um Produto
      </Button>
    );
    return (
      <CreateOrderDialog onOrderCreated={() => { calculateMetrics(); queryClient.invalidateQueries({ queryKey: ['dashboardMetrics'] }); }}>
        <Button className="bg-blue-600 hover:bg-blue-700 shadow-lg shadow-blue-100">
          <Plus className="mr-2 h-4 w-4" /> Novo Pedido
        </Button>
      </CreateOrderDialog>
    );
  };

  return (
    <div className="p-4 md:p-8 space-y-8">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold tracking-tight">Bem-vindo, {isLoadingName ? '...' : greetingName}</h1>
          <p className="text-muted-foreground">Aqui está o que está acontecendo na sua locadora hoje.</p>
        </div>
        {renderQuickActionButton()}
      </div>

      <div className="grid gap-4 grid-cols-1 md:grid-cols-2 lg:grid-cols-4">
        <DashboardCard 
            title="Faturamento Total" 
            value={formatCurrency(metrics.totalRevenue)} 
            icon={DollarSign} 
            description="contratos assinados e válidos" 
            subValue={metrics.pipelineRevenue > 0 ? formatCurrency(metrics.pipelineRevenue) : null}
            isLoading={loadingMetrics} 
            tooltipContent="Soma financeira de pedidos com assinatura confirmada." 
        />
        <DashboardCard 
            title="Contratos Ativos" 
            value={metrics.activeRentals.toLocaleString('pt-BR')} 
            icon={Box} 
            description="assinados, reservados ou na rua" 
            isLoading={loadingMetrics} 
            tooltipContent="Soma de pedidos Assinados, Reservados ou Em Andamento." 
        />
        <DashboardCard 
            title="Reservas Futuras" 
            value={metrics.futureReservations.toLocaleString('pt-BR')} 
            icon={FileText} 
            description="pedidos agendados" 
            isLoading={loadingMetrics} 
            tooltipContent="Pedidos ativos com data de início maior que hoje." 
        />
        <DashboardCard 
            title="Clientes Únicos" 
            value={metrics.newClients.toLocaleString('pt-BR')} 
            icon={Users} 
            description="total de clientes na base" 
            isLoading={loadingMetrics} 
            tooltipContent="Número de clientes cadastrados via pedidos." 
        />
      </div>
      
      <div className="grid gap-6 lg:grid-cols-3">
        <RevenueChart />
        <TaskListCard title="Retiradas Pendentes (Hoje)" data={pickups} dateKey="start_date" emptyMessage="Nenhuma retirada hoje." isLoading={isLoadingPickups} tooltipContent="Clientes para retirar hoje." />
      </div>
      <div className="grid gap-6 md:grid-cols-2">
        <TaskListCard title="Devoluções Pendentes (Hoje)" data={returns} dateKey="end_date" emptyMessage="Nenhuma devolução hoje." isLoading={isLoadingReturns} tooltipContent="Clientes para devolver hoje." />
      </div>
    </div>
  );
};

export default Dashboard;