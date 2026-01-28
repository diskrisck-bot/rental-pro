"use client";

import React, { useState, useEffect } from 'react';
import { 
  Sheet, 
  SheetContent, 
  SheetHeader, 
  SheetTitle, 
  SheetFooter 
} from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Loader2, Calendar, Package, ClipboardCheck, ArrowRightLeft, Wallet } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { showSuccess, showError } from '@/utils/toast';

interface OrderDetailsSheetProps {
  orderId: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onStatusUpdate: () => void;
}

const OrderDetailsSheet = ({ orderId, open, onOpenChange, onStatusUpdate }: OrderDetailsSheetProps) => {
  const [order, setOrder] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [updating, setUpdating] = useState(false);

  useEffect(() => {
    if (open && orderId) {
      fetchOrderDetails();
    }
  }, [open, orderId]);

  const fetchOrderDetails = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('orders')
        .select(`
          *,
          order_items (
            quantity,
            products (name, price),
            assets (serial_number)
          )
        `)
        .eq('id', orderId)
        .single();

      if (error) throw error;
      setOrder(data);
    } catch (error: any) {
      showError("Erro ao carregar detalhes: " + error.message);
    } finally {
      setLoading(false);
    }
  };

  const updateStatus = async (newStatus: string) => {
    try {
      setUpdating(true);
      const { error } = await supabase
        .from('orders')
        .update({ status: newStatus })
        .eq('id', orderId);

      if (error) throw error;

      showSuccess(`Status atualizado para ${newStatus === 'picked_up' ? 'Retirado' : 'Devolvido'}`);
      onStatusUpdate();
      onOpenChange(false);
    } catch (error: any) {
      showError("Erro ao atualizar status: " + error.message);
    } finally {
      setUpdating(false);
    }
  };

  const getStatusConfig = (status: string) => {
    switch (status) {
      case 'reserved': return { label: 'Reservado', color: 'bg-yellow-100 text-yellow-800 border-yellow-200' };
      case 'picked_up': return { label: 'Retirado', color: 'bg-blue-100 text-blue-800 border-blue-200' };
      case 'returned': return { label: 'Devolvido', color: 'bg-green-100 text-green-800 border-green-200' };
      default: return { label: status, color: 'bg-gray-100 text-gray-800' };
    }
  };

  if (!order && loading) {
    return (
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent className="sm:max-w-md flex items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
        </SheetContent>
      </Sheet>
    );
  }

  const statusConfig = order ? getStatusConfig(order.status) : { label: '', color: '' };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="sm:max-w-md flex flex-col h-full">
        <SheetHeader className="space-y-4">
          <div className="flex justify-between items-start">
            <div>
              <SheetTitle className="text-2xl">{order?.customer_name}</SheetTitle>
              <p className="text-xs font-mono text-muted-foreground">ID: #{order?.id.split('-')[0]}</p>
            </div>
            <Badge className={statusConfig.color}>{statusConfig.label}</Badge>
          </div>
        </SheetHeader>

        <div className="flex-1 overflow-y-auto py-6 space-y-8">
          {/* Valor Total de Destaque */}
          <div className="bg-blue-600 rounded-xl p-6 text-white shadow-lg shadow-blue-100">
            <p className="text-xs uppercase font-bold opacity-80 mb-1">Valor Total da Locação</p>
            <p className="text-3xl font-bold">R$ {Number(order?.total_amount || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</p>
          </div>

          {/* Datas */}
          <div className="space-y-3">
            <h3 className="text-sm font-semibold flex items-center gap-2">
              <Calendar className="h-4 w-4 text-blue-600" /> Período da Locação
            </h3>
            <div className="bg-gray-50 rounded-lg p-4 grid grid-cols-2 gap-4">
              <div>
                <p className="text-[10px] uppercase text-gray-500 font-bold">Início</p>
                <p className="font-medium text-sm">{order && format(new Date(order.start_date), "dd 'de' MMMM, yyyy", { locale: ptBR })}</p>
              </div>
              <div>
                <p className="text-[10px] uppercase text-gray-500 font-bold">Fim</p>
                <p className="font-medium text-sm">{order && format(new Date(order.end_date), "dd 'de' MMMM, yyyy", { locale: ptBR })}</p>
              </div>
            </div>
          </div>

          {/* Itens */}
          <div className="space-y-3">
            <h3 className="text-sm font-semibold flex items-center gap-2">
              <Package className="h-4 w-4 text-blue-600" /> Itens do Pedido
            </h3>
            <div className="border rounded-lg divide-y bg-white">
              {order?.order_items.map((item: any, idx: number) => (
                <div key={idx} className="p-4 flex justify-between items-center">
                  <div className="space-y-1">
                    <p className="font-medium text-sm">{item.products?.name}</p>
                    <p className="text-xs text-muted-foreground">
                      Unitário: R$ {Number(item.products?.price || 0).toFixed(2)}/dia
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-xs font-bold text-blue-600 bg-blue-50 px-2 py-1 rounded">
                      x{item.quantity}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        <SheetFooter className="mt-auto pt-6 border-t sm:flex-col gap-2">
          {order?.status === 'reserved' && (
            <Button 
              className="w-full bg-blue-600 hover:bg-blue-700 h-12 text-base" 
              onClick={() => updateStatus('picked_up')}
              disabled={updating}
            >
              {updating ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <ClipboardCheck className="mr-2 h-5 w-5" />}
              Marcar como Retirado
            </Button>
          )}
          {order?.status === 'picked_up' && (
            <Button 
              className="w-full bg-green-600 hover:bg-green-700 h-12 text-base" 
              onClick={() => updateStatus('returned')}
              disabled={updating}
            >
              {updating ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <ArrowRightLeft className="mr-2 h-5 w-5" />}
              Marcar como Devolvido
            </Button>
          )}
          <Button variant="outline" className="w-full h-12" onClick={() => onOpenChange(false)}>
            Fechar Painel
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
};

export default OrderDetailsSheet;