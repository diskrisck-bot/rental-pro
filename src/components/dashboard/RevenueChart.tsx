"use client";

import React from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useQuery } from '@tanstack/react-query';
import { fetchMonthlyRevenue } from '@/integrations/supabase/queries';
import { Loader2 } from 'lucide-react';

interface MonthlyRevenueData {
  name: string;
  revenue: number;
}

const formatCurrency = (value: number) => 
  `R$ ${value.toLocaleString('pt-BR', { minimumFractionDigits: 0 })}`;

const RevenueChart = () => {
  const { data: monthlyRevenue, isLoading } = useQuery<MonthlyRevenueData[]>({
    queryKey: ['monthlyRevenue'],
    queryFn: fetchMonthlyRevenue,
  });
  
  const hasData = monthlyRevenue && monthlyRevenue.some(d => d.revenue > 0);

  if (isLoading) {
    return (
      <Card className="rounded-xl shadow-sm col-span-full lg:col-span-2">
        <CardHeader>
          <CardTitle className="text-xl font-bold">Receita Mensal (Últimos 6 Meses)</CardTitle>
        </CardHeader>
        <CardContent className="h-80 flex items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="rounded-xl shadow-sm col-span-full lg:col-span-2">
      <CardHeader>
        <CardTitle className="text-xl font-bold">Receita Mensal (Últimos 6 Meses)</CardTitle>
      </CardHeader>
      <CardContent className="h-80 p-4">
        {hasData ? (
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={monthlyRevenue} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
              <XAxis dataKey="name" stroke="hsl(var(--muted-foreground))" fontSize={12} tickLine={false} axisLine={false} />
              <YAxis 
                stroke="hsl(var(--muted-foreground))" 
                fontSize={12} 
                tickLine={false} 
                axisLine={false} 
                tickFormatter={formatCurrency}
              />
              <Tooltip 
                cursor={{ fill: 'hsl(var(--accent))', opacity: 0.5 }}
                contentStyle={{ 
                  borderRadius: '0.5rem', 
                  border: '1px solid hsl(var(--border))', 
                  backgroundColor: 'hsl(var(--card))',
                  padding: '0.5rem'
                }}
                formatter={(value: number) => [formatCurrency(value), 'Receita']}
              />
              <Bar 
                dataKey="revenue" 
                fill="hsl(221 83% 53%)" // Custom blue color
                radius={[4, 4, 0, 0]} 
                maxBarSize={30}
              />
            </BarChart>
          </ResponsiveContainer>
        ) : (
          <div className="flex flex-col items-center justify-center h-full text-center text-muted-foreground">
            <p className="text-lg font-semibold mb-2">Nenhuma receita registrada ainda.</p>
            <p className="text-sm">Crie seu primeiro pedido para começar a visualizar os dados.</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default RevenueChart;