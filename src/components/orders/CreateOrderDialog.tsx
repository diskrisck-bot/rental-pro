"use client";

import React, { useState, useEffect, useMemo } from 'react';
import { Plus, Trash2, Loader2, Wallet, Edit } from 'lucide-react';
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
import { format, parseISO } from 'date-fns';
import { calculateOrderTotal } from '@/utils/financial';
import MaskedInput from 'react-text-mask';
import { Phone, User } from 'lucide-react';

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

// Máscaras
const phoneMask = ['(', /[1-9]/, /\d/, ')', ' ', /\d/, /\d/, /\d/, /\d/, /\d/, '-', /\d/, /\d/, /\d/, /\d/];
const cpfMask = [/\d/, /\d/, /\d/, '.', /\d/, /\d/, /\d/, '.', /\d/, /\d/, /\d/, '-', /\d/, /\d/];

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
      customer_phone: '',
      customer_cpf: '',
      start_date: format(new Date(), 'yyyy-MM-dd'),
      end_date: format(new Date(Date.now() + 86400000), 'yyyy-MM-dd'),
    }
  });

  const watchDates = watch(['start_date', 'end_date']);

  const financialSummary = useMemo(() => {
    return calculateOrderTotal(watchDates[0], watchDates[1], selectedItems);
  }, [selectedItems, watchDates]);

  // Carrega produtos e dados do pedido (se for edição)
  useEffect(() => {
    if (open) {
      const init = async () => {
        setFetchingData(true);
        const { data: productsData } = await supabase.from('products').select('id, name, price, type').order('name');
        setProducts(productsData || []);

        if (orderId) {
          const { data: orderData, error } = await supabase
            .from('orders')
            .select('*, order_items(*, products(name, price))')
            .eq('id', orderId)
            .single();

          if (orderData) {
            setValue('customer_name', orderData.customer_name);
            setValue('customer_phone', orderData.customer_phone || '');
            setValue('customer_cpf', orderData.customer_cpf || '');
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
        } else {
          // Reset form only on creation mode
          reset({
            customer_name: '',
            customer_phone: '',
            customer_cpf: '',
            start_date: format(new Date(), 'yyyy-MM-dd'),
            end_date: format(new Date(Date.now() + 86400000), 'yyyy-MM-dd'),
          });
          setSelectedItems([]);
        }
        setFetchingData(false);
      };
      init();
    }
  }, [open, orderId, setValue, reset]);

  const addItem = () => {
    if (!currentProductId || currentQuantity < 1) return;
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

      // --- 3. MÓDULO DE ESTOQUE E CONFLITOS (ANTIDUPLICIDADE) ---
      const newStart = new Date(values.start_date);
      const newEnd = new Date(values.end_date);

      for (const item of selectedItems) {
        const product = products.find(p => p.id === item.product_id);
        
        // Apenas verifica conflito para itens rastreáveis
        if (product && product.type === 'trackable') {
          // Busca itens de pedidos ativos (reserved ou picked_up) que colidem com o período
          const { data: conflictingItems, error: conflictError } = await supabase
            .from('order_items')
            .select('order_id, orders!inner(start_date, end_date, status)')
            .eq('product_id', item.product_id)
            .neq('order_id', orderId || '00000000-0000-0000-0000-000000000000') // Exclui o pedido atual se estiver editando
            .in('orders.status', ['reserved', 'picked_up']); 

          if (conflictError) throw conflictError;

          const collision = conflictingItems.some((ci: any) => {
            const existingStart = new Date(ci.orders.start_date);
            const existingEnd = new Date(ci.orders.end_date);

            // Colisão se [Novo Início <= Fim Existente] E [Início Existente <= Novo Fim]
            return newStart <= existingEnd && existingStart <= newEnd;
          });

          if (collision) {
            showError(`O item rastreável "${product.name}" já está reservado ou alugado no período selecionado.`);
            setLoading(false);
            return; // Bloqueia o salvamento
          }
        }
      }
      // --- FIM DA VERIFICAÇÃO DE CONFLITO ---

      const orderPayload = {
        customer_name: values.customer_name,
        customer_phone: values.customer_phone,
        customer_cpf: values.customer_cpf,
        start_date: newStart.toISOString(),
        end_date: newEnd.toISOString(),
        // --- 1. MÓDULO FINANCEIRO (CÁLCULO OBRIGATÓRIO) ---
        total_amount: financialSummary.totalAmount,
        // --- FIM DO CÁLCULO ---
        status: orderId ? undefined : 'reserved' // Novo pedido começa como 'reserved'
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
                  <Label htmlFor="customer_phone">Telefone/WhatsApp</Label>
                  <MaskedInput
                    mask={phoneMask}
                    placeholder="(XX) XXXXX-XXXX"
                    id="customer_phone"
                    type="tel"
                    className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                    value={watch('customer_phone')}
                    onChange={(e) => setValue('customer_phone', e.target.value, { shouldValidate: true })}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="customer_cpf">CPF</Label>
                  <MaskedInput
                    mask={cpfMask}
                    placeholder="XXX.XXX.XXX-XX"
                    id="customer_cpf"
                    className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                    value={watch('customer_cpf')}
                    onChange={(e) => setValue('customer_cpf', e.target.value, { shouldValidate: true })}
                    required
                  />
                </div>
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
                <span className="font-bold">{financialSummary.durationInDays} {financialSummary.durationInDays === 1 ? 'dia' : 'dias'}</span>
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