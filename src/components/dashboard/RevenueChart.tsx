"use client";

import React from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

// Placeholder data for the last 6 months
const data = [
  { name: 'Jan', revenue: 4000 },
  { name: 'Fev', revenue: 3000 },
  { name: 'Mar', revenue: 5500 },
  { name: 'Abr', revenue: 4500 },
  { name: 'Mai', revenue: 6200 },
  { name: 'Jun', revenue: 7100 },
];

const formatCurrency = (value: number) => 
  `R$ ${value.toLocaleString('pt-BR', { minimumFractionDigits: 0 })}`;

const RevenueChart = () => {
  return (
    <Card className="rounded-xl shadow-sm col-span-full lg:col-span-2">
      <CardHeader>
        <CardTitle className="text-xl font-bold">Receita Mensal (Últimos 6 Meses)</CardTitle>
      </CardHeader>
      <CardContent className="h-80 p-4">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
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
      </CardContent>
    </Card>
  );
};

export default RevenueChart;