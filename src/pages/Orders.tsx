"use client";

import React, { useState, useEffect } from 'react';
import { Plus, Search, Loader2 } from 'lucide-react';
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
import { supabase } from '@/lib/supabase';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import CreateOrderDialog from '@/components/orders/CreateOrderDialog';
import { showError } from '@/utils/toast';

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
  const [orders, setOrders] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");

  const fetchOrders = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('orders')
        .select(`
          *,
          order_items (
            quantity,
            products (name)
          )
        `)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setOrders(data || []);
    } catch (error: any) {
      showError("Erro ao carregar pedidos: " + error.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchOrders();
  }, []);

  const filteredOrders = orders.filter(order => 
    order.customer_name.toLowerCase().includes(search.toLowerCase()) ||
    order.id.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="p-8 space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Pedidos</h1>
          <p className="text-muted-foreground">Acompanhe e gerencie todos os aluguéis.</p>
        </div>
        
        <CreateOrderDialog onOrderCreated={fetchOrders}>
          <Button className="bg-blue-600 hover:bg-blue-700">
            <Plus className="mr-2 h-4 w-4" /> Novo Pedido
          </Button>
        </CreateOrderDialog>
      </div>

      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
        <Input 
          placeholder="Buscar por cliente ou ID..." 
          className="pl-10" 
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      <div className="border rounded-xl bg-white overflow-hidden shadow-sm">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>ID</TableHead>
              <TableHead>Cliente</TableHead>
              <TableHead>Período</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Itens</TableHead>
              <TableHead className="text-right">Ações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={6} className="h-24 text-center">
                  <Loader2 className="h-6 w-6 animate-spin mx-auto text-blue-600" />
                </TableCell>
              </TableRow>
            ) : filteredOrders.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="h-24 text-center text-muted-foreground">
                  Nenhum pedido encontrado.
                </TableCell>
              </TableRow>
            ) : (
              filteredOrders.map((order) => (
                <TableRow key={order.id}>
                  <TableCell className="font-mono text-[10px] text-gray-400">
                    #{order.id.split('-')[0]}
                  </TableCell>
                  <TableCell className="font-medium">{order.customer_name}</TableCell>
                  <TableCell className="text-sm">
                    {format(new Date(order.start_date), 'dd/MM')} - {format(new Date(order.end_date), 'dd/MM')}
                  </TableCell>
                  <TableCell>{getStatusBadge(order.status)}</TableCell>
                  <TableCell className="text-sm">
                    {order.order_items?.length || 0} itens
                  </TableCell>
                  <TableCell className="text-right">
                    <Button variant="ghost" size="sm">Ver Detalhes</Button>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
};

export default Orders;