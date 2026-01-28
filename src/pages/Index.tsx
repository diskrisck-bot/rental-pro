"use client";

import React from 'react';
import { 
  Users, 
  Package, 
  Calendar, 
  TrendingUp,
  Loader2,
  Clock
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useQuery } from '@tanstack/react-query';
import { 
  fetchDashboardMetrics, 
  fetchPendingPickups, 
  fetchPendingReturns 
} from '@/integrations/supabase/queries';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

// Componente de Card de Métrica
const DashboardCard = ({ title, value, icon: Icon, description, isLoading }: any) => (
  <Card className="rounded-xl shadow-sm hover:shadow-md transition-shadow">
    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
      <CardTitle className="text-sm font-medium text-muted-foreground">{title}</CardTitle>
      <Icon className="h-4 w-4 text-blue-600" />
    </CardHeader>
    <CardContent>
      {isLoading ? (
        <div className="h-8 flex items-center">
          <Loader2 className="h-5 w-5 animate-spin text-blue-400" />
        </div>
      ) : (
        <div className="text-2xl font-bold">{value}</div>
      )}
      <p className="text-xs text-muted-foreground mt-1">
        {description}
      </p>
    </CardContent>
  </Card>
);

// Componente de Lista de Tarefas
const TaskListCard = ({ title, data, dateKey, emptyMessage, isLoading }: any) => (
  <Card className="col-span-1 rounded-xl shadow-sm">
    <CardHeader>
      <CardTitle>{title}</CardTitle>
    </CardHeader>
    <CardContent>
      {isLoading ? (
        <div className="flex flex-col items-center justify-center py-8">
          <Loader2 className="h-6 w-6 animate-spin text-blue-600" />
        </div>
      ) : (
        <div className="space-y-4">
          {data && data.length > 0 ? (
            data.map((item: any) => {
              const date = new Date(item[dateKey]);
              // Tentativa de extrair hora, se disponível e relevante
              const time = format(date, 'HH:mm');
              const displayTime = time !== '00:00' ? time : 'Dia Todo';

              return (
                <div key={item.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg border hover:bg-gray-100 transition-colors">
                  <div>
                    <p className="font-medium text-sm">Pedido #{item.id.split('-')[0]}</p>
                    <p className="text-xs text-gray-500 text-muted-foreground">Cliente: {item.customer_name}</p>
                  </div>
                  <div className="text-xs font-semibold px-2 py-1 bg-yellow-100 text-yellow-700 rounded">
                    {displayTime}
                  </div>
                </div>
              );
            })
          ) : (
            <p className="text-sm text-center text-muted-foreground py-4 border-2 border-dashed rounded-lg">
              {emptyMessage}
            </p>
          )}
        </div>
      )}
    </CardContent>
  </Card>
);


const Index = () => {
  const { data: metrics, isLoading: isLoadingMetrics } = useQuery({
    queryKey: ['dashboardMetrics'],
    queryFn: fetchDashboardMetrics,
  });

  const { data: pickups, isLoading: isLoadingPickups } = useQuery({
    queryKey: ['pendingPickups'],
    queryFn: fetchPendingPickups,
  });

  const { data: returns, isLoading: isLoadingReturns } = useQuery({
    queryKey: ['pendingReturns'],
    queryFn: fetchPendingReturns,
  });

  const formatCurrency = (amount: number) => 
    `R$ ${amount.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`;

  return (
    <div className="p-8 space-y-8">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Bem-vindo, Admin</h1>
        <p className="text-muted-foreground">Aqui está o que está acontecendo na sua locadora hoje.</p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <DashboardCard 
          title="Receita Total" 
          value={formatCurrency(metrics?.totalRevenue || 0)} 
          icon={TrendingUp} 
          description="valor total de todos os pedidos" 
          isLoading={isLoadingMetrics}
        />
        <DashboardCard 
          title="Itens na Rua (Ativos)" 
          value={metrics?.activeRentals.toLocaleString('pt-BR') || '0'} 
          icon={Package} 
          description="pedidos atualmente com clientes" 
          isLoading={isLoadingMetrics}
        />
        <DashboardCard 
          title="Reservas Futuras" 
          value={metrics?.futureReservations.toLocaleString('pt-BR') || '0'} 
          icon={Clock} 
          description="pedidos reservados, aguardando retirada" 
          isLoading={isLoadingMetrics}
        />
        <DashboardCard 
          title="Clientes Únicos" 
          value={metrics?.newClients.toLocaleString('pt-BR') || '0'} 
          icon={Users} 
          description="total de clientes únicos registrados" 
          isLoading={isLoadingMetrics}
        />
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <TaskListCard
          title="Retiradas Pendentes (Hoje)"
          data={pickups}
          dateKey="start_date"
          emptyMessage="Nenhuma retirada agendada para hoje."
          isLoading={isLoadingPickups}
        />

        <TaskListCard
          title="Devoluções Pendentes (Hoje)"
          data={returns}
          dateKey="end_date"
          emptyMessage="Nenhuma devolução pendente para hoje."
          isLoading={isLoadingReturns}
        />
      </div>
    </div>
  );
};

export default Index;