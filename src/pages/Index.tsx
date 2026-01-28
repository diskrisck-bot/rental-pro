"use client";

import React from 'react';
import { 
  Users, 
  Package, 
  Calendar, 
  TrendingUp 
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

const DashboardCard = ({ title, value, icon: Icon, description, trend }: any) => (
  <Card>
    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
      <CardTitle className="text-sm font-medium text-muted-foreground">{title}</CardTitle>
      <Icon className="h-4 w-4 text-blue-600" />
    </CardHeader>
    <CardContent>
      <div className="text-2xl font-bold">{value}</div>
      <p className="text-xs text-muted-foreground mt-1">
        <span className="text-green-500 font-medium">+{trend}%</span> {description}
      </p>
    </CardContent>
  </Card>
);

const Index = () => {
  return (
    <div className="p-8 space-y-8">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Bem-vindo, Admin</h1>
        <p className="text-muted-foreground">Aqui está o que está acontecendo na sua locadora hoje.</p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <DashboardCard 
          title="Total de Aluguéis" 
          value="128" 
          icon={Calendar} 
          description="em relação ao mês passado" 
          trend="12"
        />
        <DashboardCard 
          title="Itens Alugados" 
          value="42" 
          icon={Package} 
          description="ativos no momento" 
          trend="8"
        />
        <DashboardCard 
          title="Novos Clientes" 
          value="15" 
          icon={Users} 
          description="desde a última semana" 
          trend="5"
        />
        <DashboardCard 
          title="Receita Estimada" 
          value="R$ 12.450" 
          icon={TrendingUp} 
          description="projeção para este mês" 
          trend="18"
        />
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <Card className="col-span-1">
          <CardHeader>
            <CardTitle>Retiradas Pendentes (Hoje)</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {[1, 2, 3].map((i) => (
                <div key={i} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg border">
                  <div>
                    <p className="font-medium text-sm">Pedido #10{i}</p>
                    <p className="text-xs text-gray-500 text-muted-foreground">Cliente: João Souza</p>
                  </div>
                  <div className="text-xs font-semibold px-2 py-1 bg-yellow-100 text-yellow-700 rounded">
                    14:00h
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card className="col-span-1">
          <CardHeader>
            <CardTitle>Devoluções Pendentes (Hoje)</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {[1, 2].map((i) => (
                <div key={i} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg border">
                  <div>
                    <p className="font-medium text-sm">Pedido #09{i}</p>
                    <p className="text-xs text-gray-500 text-muted-foreground">Cliente: Maria Clara</p>
                  </div>
                  <div className="text-xs font-semibold px-2 py-1 bg-blue-100 text-blue-700 rounded">
                    18:00h
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default Index;