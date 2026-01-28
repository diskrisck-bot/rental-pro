"use client";

import React from 'react';
import { Plus, Search } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';

const getStatusBadge = (status: string) => {
  switch (status) {
    case 'draft': return <Badge variant="outline" className="bg-gray-100">Rascunho</Badge>;
    case 'reserved': return <Badge className="bg-yellow-100 text-yellow-800 border-yellow-200">Reservado</Badge>;
    case 'picked_up': return <Badge className="bg-blue-100 text-blue-800 border-blue-200">Retirado</Badge>;
    case 'returned': return <Badge className="bg-green-100 text-green-800 border-green-200">Devolvido</Badge>;
    default: return <Badge>{status}</Badge>;
  }
};

const Orders = () => {
  const orders = [
    { id: '1', customer: 'João Silva', date: '25/05 - 28/05', status: 'reserved', total: 750 },
    { id: '2', customer: 'Maria Oliveira', date: '20/05 - 22/05', status: 'picked_up', total: 450 },
    { id: '3', customer: 'Tech Corp', date: '15/05 - 16/05', status: 'returned', total: 1200 },
  ];

  return (
    <div className="p-8 space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Pedidos</h1>
          <p className="text-muted-foreground">Acompanhe e gerencie todos os aluguéis.</p>
        </div>
        <Button className="bg-blue-600 hover:bg-blue-700">
          <Plus className="mr-2 h-4 w-4" /> Novo Pedido
        </Button>
      </div>

      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
        <Input placeholder="Buscar por cliente ou pedido..." className="pl-10" />
      </div>

      <div className="border rounded-xl bg-white overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>ID</TableHead>
              <TableHead>Cliente</TableHead>
              <TableHead>Período</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Total</TableHead>
              <TableHead className="text-right">Ações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {orders.map((order) => (
              <TableRow key={order.id}>
                <TableCell className="font-mono text-xs">#{order.id}</TableCell>
                <TableCell className="font-medium">{order.customer}</TableCell>
                <TableCell>{order.date}</TableCell>
                <TableCell>{getStatusBadge(order.status)}</TableCell>
                <TableCell>R$ {order.total.toFixed(2)}</TableCell>
                <TableCell className="text-right">
                  <Button variant="ghost" size="sm">Ver Detalhes</Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
};

export default Orders;