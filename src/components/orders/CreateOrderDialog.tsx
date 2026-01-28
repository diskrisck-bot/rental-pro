"use client";

import React, { useState, useEffect, useMemo } from 'react';
import { Plus, Trash2, Loader2, Calendar as CalendarIcon, Wallet, Edit } from 'lucide-react';
import { useForm } from 'react-hook-form';
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle, 
  DialogFooter,
  DialogTrigger
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from '@/components/ui/select';
import { supabase } from '@/lib/supabase';
import { showSuccess, showError } from '@/utils/toast';
import { format, differenceInDays, parseISO } from 'date-fns';

interface CreateOrderDialogProps {
  orderId?: string; // Se presente, entra em modo de edição
  onOrderCreated: () => void;
  children: React.ReactNode;
}

interface OrderItem {
  product_id: string;
  product_name: string;
  quantity: number;
  daily_price: number;
}

const CreateOrderDialog = ({ orderId, onOrderCreated, children }: CreateOrderDialogProps) => {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [fetchingData, setFetchingData] = useState(false);
  const [products, setProducts] = useState<any[]>([]);
  const [selectedItems, setSelectedItems] = useState<OrderItem[]>([]);
  
  const [currentProductId, setCurrentProductId] = useState("");
  const [currentQuantity, setCurrentQuantity] = useState(1);

  const { register, handleSubmit, reset, watch, setValue } = useForm({
    defaultValues: {
      customer_name: '',
      start_date: format(new Date(), 'yyyy-MM-dd'),
      end_date: format(new Date(Date.now() + 86400000), 'yyyy-MM-dd'),
    }
  });

  const watchDates = watch(['start_date', 'end_date']);

  const durationInDays = useMemo(() => {
    if (!watchDates[0] || !watchDates[1]) return 1;
    const start = parseISO(watchDates[0]);
    const end = parseISO(watchDates[1]);
    const diff = differenceInDays(end, start);
    return Math.max(1, diff + 1);
  }, [watchDates]);

  const financialSummary = useMemo(() => {
    const subtotalDaily = selectedItems.reduce((acc, item) => acc + (item.daily_price * item.quantity), 0);
    const totalAmount = subtotalDaily * durationInDays;
    return { subtotalDaily, totalAmount };
  }, [selectedItems, durationInDays]);

  // Carrega produtos e dados do pedido (se for edição)
  useEffect(() => {
    if (open) {
      const init = async () => {
        setFetchingData(true);
        const { data: productsData } = await supabase.from('products').select('*').order('name');
        setProducts(productsData || []);

        if (orderId) {
          const { data: orderData, error } = await supabase
            .from('orders')
            .select('*, order_items(*, products(*))')
            .eq('id', orderId)
            .single();

          if (orderData) {
            setValue('customer_name', orderData.customer_name);
            setValue('start_date', format(parseISO(orderData.start_date), 'yyyy-MM-dd'));
            setValue('end_date', format(parseISO(orderData.end_date), 'yyyy-MM-dd'));
            
            const existingItems = orderData.order_items.map((item: any) => ({
              product_id: item.product_id,
              product_name: item.products.name,
              quantity: item.quantity,
              daily_price: Number(item.products.price)
            }));
            setSelectedItems(existingItems);
          }
        }
        setFetchingData(false);
      };
      init();
    }
  }, [open, orderId, setValue]);

  const addItem = () => {
    if (!currentProductId) return;
    const product = products.find(p => p.id === currentProductId);
    if (!product) return;

    const newItem: OrderItem = {
      product_id: currentProductId,
      product_name: product.name,
      quantity: currentQuantity,
      daily_price: Number(product.price)
    };

    setSelectedItems([...selectedItems, newItem]);
    setCurrentProductId("");
    setCurrentQuantity(1);
  };

  const removeItem = (index: number) => {
    setSelectedItems(selectedItems.filter((_, i) => i !== index));
  };

  const onSubmit = async (values: any) => {
    if (selectedItems.length === 0) {
      showError("Adicione pelo menos um item ao pedido");
      return;
    }

    try {
      setLoading(true);

      const orderPayload = {
        customer_name: values.customer_name,
        start_date: new Date(values.start_date).toISOString(),
        end_date: new Date(values.end_date).toISOString(),
        total_amount: financialSummary.totalAmount,
        status: orderId ? undefined : 'reserved' // Não altera status na edição a menos que necessário
      };

      let currentOrderId = orderId;

      if (orderId) {
        // Modo Edição: Atualiza Pedido
        const { error: updateError } = await supabase
          .from('orders')
          .update(orderPayload)
          .eq('id', orderId);
        
        if (updateError) throw updateError;

        // Limpa itens antigos para reinserir os novos (estratégia segura)
        const { error: deleteError } = await supabase
          .from('order_items')
          .delete()
          .eq('order_id', orderId);
        
        if (deleteError) throw deleteError;
      } else {
        // Modo Criação: Insere Pedido
        const { data: orderData, error: orderError } = await supabase
          .from('orders')
          .insert([orderPayload])
          .select()
          .single();

        if (orderError) throw orderError;
        currentOrderId = orderData.id;
      }

      // Insere os itens atuais (novos ou atualizados)
      const itemsToInsert = selectedItems.map(item => ({
        order_id: currentOrderId,
        product_id: item.product_id,
        quantity: item.quantity
      }));

      const { error: itemsError } = await supabase
        .from('order_items')
        .insert(itemsToInsert);

      if (itemsError) throw itemsError;

      showSuccess(orderId ? "Pedido atualizado com sucesso!" : "Pedido criado com sucesso!");
      setOpen(false);
      reset();
      setSelectedItems([]);
      onOrderCreated();
    } catch (error: any) {
      showError("Erro ao processar pedido: " + error.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {children}
      </DialogTrigger>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{orderId ? 'Editar Locação' : 'Nova Locação'}</DialogTitle>
        </DialogHeader>
        
        {fetchingData ? (
          <div className="flex flex-col items-center justify-center py-12 gap-2">
            <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
            <p className="text-sm text-muted-foreground">Carregando dados do pedido...</p>
          </div>
        ) : (
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-6 py-4">
            <div className="grid gap-4">
              <div className="space-y-2">
                <Label htmlFor="customer_name">Nome do Cliente</Label>
                <Input 
                  id="customer_name" 
                  placeholder="Ex: João Silva" 
                  {...register('customer_name', { required: true })}
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="start_date">Data Início</Label>
                  <Input 
                    id="start_date" 
                    type="date" 
                    {...register('start_date', { required: true })}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="end_date">Data Fim</Label>
                  <Input 
                    id="end_date" 
                    type="date" 
                    {...register('end_date', { required: true })}
                  />
                </div>
              </div>
            </div>

            <div className="border-t pt-4">
              <Label className="text-base font-semibold">Itens da Locação</Label>
              <div className="flex gap-4 mt-2 items-end">
                <div className="flex-1 space-y-2">
                  <Label className="text-xs text-muted-foreground">Produto</Label>
                  <Select value={currentProductId} onValueChange={setCurrentProductId}>
                    <SelectTrigger>
                      <SelectValue placeholder="Adicionar novo produto" />
                    </SelectTrigger>
                    <SelectContent>
                      {products.map(p => (
                        <SelectItem key={p.id} value={p.id}>
                          {p.name} (R$ {Number(p.price).toFixed(2)}/dia)
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="w-24 space-y-2">
                  <Label className="text-xs text-muted-foreground">Qtd</Label>
                  <Input 
                    type="number" 
                    min="1" 
                    value={currentQuantity} 
                    onChange={(e) => setCurrentQuantity(parseInt(e.target.value) || 1)}
                  />
                </div>
                <Button type="button" onClick={addItem} variant="secondary">
                  <Plus className="h-4 w-4 mr-2" /> Incluir
                </Button>
              </div>

              <div className="mt-4 space-y-2">
                {selectedItems.length > 0 ? (
                  <div className="rounded-lg border bg-gray-50 p-4 space-y-2">
                    {selectedItems.map((item, index) => (
                      <div key={index} className="flex justify-between items-center bg-white p-2 rounded border shadow-sm">
                        <div className="flex flex-col">
                          <span className="text-sm font-medium">{item.product_name} x {item.quantity}</span>
                          <span className="text-[10px] text-muted-foreground">R$ {item.daily_price.toFixed(2)} por unidade/dia</span>
                        </div>
                        <Button 
                          type="button" 
                          variant="ghost" 
                          size="sm" 
                          onClick={() => removeItem(index)}
                          className="text-red-500 hover:text-red-700"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-center text-muted-foreground py-4 border-2 border-dashed rounded-lg">
                    Adicione os produtos para calcular o valor.
                  </p>
                )}
              </div>
            </div>

            <div className="bg-blue-50 border border-blue-100 rounded-xl p-6 space-y-3">
              <div className="flex items-center gap-2 text-blue-800 font-semibold mb-2">
                <Wallet className="h-5 w-5" />
                Recálculo Financeiro
              </div>
              <div className="flex justify-between text-sm text-blue-700">
                <span>Duração Atualizada:</span>
                <span className="font-bold">{durationInDays} {durationInDays === 1 ? 'dia' : 'dias'}</span>
              </div>
              <div className="flex justify-between text-sm text-blue-700">
                <span>Subtotal Diário:</span>
                <span className="font-bold">R$ {financialSummary.subtotalDaily.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
              </div>
              <div className="border-t border-blue-200 pt-2 flex justify-between text-lg font-bold text-blue-900">
                <span>Novo Valor Total:</span>
                <span>R$ {financialSummary.totalAmount.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
              </div>
            </div>

            <DialogFooter>
              <Button variant="outline" type="button" onClick={() => setOpen(false)}>Cancelar</Button>
              <Button type="submit" className="bg-blue-600 hover:bg-blue-700 h-12 px-8" disabled={loading}>
                {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {orderId ? 'Salvar Alterações' : 'Salvar Pedido'}
              </Button>
            </DialogFooter>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
};

export default CreateOrderDialog;