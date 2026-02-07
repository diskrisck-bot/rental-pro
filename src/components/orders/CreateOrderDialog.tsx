"use client";

import React, { useState, useEffect, useMemo } from 'react';
import { Plus, Trash2, Loader2, Wallet, CreditCard, Clock, Zap, Calendar, AlertTriangle } from 'lucide-react';
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
import { useQuery } from '@tanstack/react-query';
import { fetchAllProducts } from '@/integrations/supabase/queries';
import { Badge } from '@/components/ui/badge';

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

// Máscaras de Input
const phoneMask = ['(', /[1-9]/, /\d/, ')', ' ', /\d/, /\d/, /\d/, /\d/, /\d/, '-', /\d/, /\d/, /\d/, /\d/];
const cpfMask = [/\d/, /\d/, /\d/, '.', /\d/, /\d/, /\d/, '.', /\d/, /\d/, /\d/, '-', /\d/, /\d/];

const CreateOrderDialog = ({ orderId, onOrderCreated, children }: CreateOrderDialogProps) => {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [fetchingData, setFetchingData] = useState(false);
  const [selectedItems, setSelectedItems] = useState<OrderItem[]>([]);
  
  // Controle de adição de itens
  const [currentProductId, setCurrentProductId] = useState("");
  const [currentQuantity, setCurrentQuantity] = useState(1);

  // Busca produtos usando React Query (Cache inteligente)
  const { data: products, isLoading: isProductsLoading, isError: isProductsError } = useQuery({
    queryKey: ['allProducts'],
    queryFn: fetchAllProducts,
    enabled: open, // Só busca quando o modal abre
  });
  
  const productList = products || [];

  const defaultStartDate = format(new Date(), 'yyyy-MM-dd');
  const defaultEndDate = format(new Date(Date.now() + 86400000), 'yyyy-MM-dd'); // Amanhã

  const { register, handleSubmit, reset, watch, setValue } = useForm({
    defaultValues: {
      customer_name: '',
      customer_phone: '',
      customer_cpf: '',
      start_date: defaultStartDate,
      end_date: defaultEndDate,
      payment_method: 'Pix',
      payment_timing: 'paid_on_pickup',
      fulfillment_type: 'reservation',
    }
  });

  // Observa mudanças para recalcular totais em tempo real
  const watchDates = watch(['start_date', 'end_date']);
  const watchPaymentMethod = watch('payment_method');
  const watchPaymentTiming = watch('payment_timing');
  const watchFulfillmentType = watch('fulfillment_type');

  // Recálculo Financeiro Automático (Memoizado para performance)
  const financialSummary = useMemo(() => {
    return calculateOrderTotal(watchDates[0], watchDates[1], selectedItems);
  }, [selectedItems, watchDates]);

  // Ajusta data se for "Retirada Imediata"
  useEffect(() => {
    if (watchFulfillmentType === 'immediate') {
      setValue('start_date', format(new Date(), 'yyyy-MM-dd'));
    }
  }, [watchFulfillmentType, setValue]);

  // CARREGAMENTO DE DADOS (CRIAÇÃO OU EDIÇÃO)
  useEffect(() => {
    if (open) {
      const loadOrderData = async () => {
        // Se for Edição
        if (orderId) {
          if (isProductsLoading) return; // Espera produtos carregarem primeiro
          
          setFetchingData(true);
          try {
            const { data: orderData, error } = await supabase
              .from('orders')
              .select('*, order_items(*, products(name, price))')
              .eq('id', orderId)
              .single();

            if (error) throw error;

            if (orderData) {
              // Preenche formulário
              setValue('customer_name', orderData.customer_name);
              setValue('customer_phone', orderData.customer_phone || '');
              setValue('customer_cpf', orderData.customer_cpf || '');
              setValue('start_date', format(parseISO(orderData.start_date), 'yyyy-MM-dd'));
              setValue('end_date', format(parseISO(orderData.end_date), 'yyyy-MM-dd'));
              setValue('payment_method', orderData.payment_method || 'Pix');
              setValue('payment_timing', orderData.payment_timing || 'paid_on_pickup');
              setValue('fulfillment_type', orderData.fulfillment_type || 'reservation');
              
              // Mapeia itens existentes
              const existingItems = orderData.order_items.map((item: any) => ({
                product_id: item.product_id,
                product_name: item.products.name,
                quantity: item.quantity,
                daily_price: Number(item.products.price)
              }));
              setSelectedItems(existingItems);
            }
          } catch (err) {
            console.error(err);
            showError("Erro ao carregar dados do pedido.");
          } finally {
            setFetchingData(false);
          }
        } else {
          // Se for Criação (Novo Pedido): Reseta tudo
          reset({
            customer_name: '',
            customer_phone: '',
            customer_cpf: '',
            start_date: defaultStartDate,
            end_date: defaultEndDate,
            payment_method: 'Pix',
            payment_timing: 'paid_on_pickup',
            fulfillment_type: 'reservation',
          });
          setSelectedItems([]);
        }
      };

      loadOrderData();
    }
  }, [open, orderId, isProductsLoading, setValue, reset]);

  // Adicionar Item à Lista
  const addItem = () => {
    if (!currentProductId || currentQuantity < 1) return;
    const product = productList.find(p => p.id === currentProductId);
    if (!product) return;

    // Verifica se já existe o item na lista para somar quantidade
    const existingItemIndex = selectedItems.findIndex(i => i.product_id === currentProductId);
    
    if (existingItemIndex >= 0) {
      const updatedItems = [...selectedItems];
      updatedItems[existingItemIndex].quantity += currentQuantity;
      setSelectedItems(updatedItems);
    } else {
      const newItem: OrderItem = {
        product_id: currentProductId,
        product_name: product.name,
        quantity: currentQuantity,
        daily_price: Number(product.price)
      };
      setSelectedItems([...selectedItems, newItem]);
    }

    setCurrentProductId("");
    setCurrentQuantity(1);
  };

  // Remover Item da Lista
  const removeItem = (index: number) => {
    setSelectedItems(selectedItems.filter((_, i) => i !== index));
  };

  // SALVAR NO BANCO DE DADOS
  const onSubmit = async (values: any) => {
    if (selectedItems.length === 0) {
      showError("Adicione pelo menos um item ao pedido");
      return;
    }

    try {
      setLoading(true);

      const newStart = new Date(values.start_date);
      const newEnd = new Date(values.end_date);

      // --- 1. VERIFICAÇÃO DE CONFLITOS DE ESTOQUE ---
      for (const item of selectedItems) {
        const product = productList.find(p => p.id === item.product_id);
        
        // Verifica conflito apenas para produtos rastreáveis (únicos)
        if (product && product.type === 'trackable') {
          const { data: conflictingItems, error: conflictError } = await supabase
            .from('order_items')
            .select('order_id, orders!inner(start_date, end_date, status)')
            .eq('product_id', item.product_id)
            .neq('order_id', orderId || '00000000-0000-0000-0000-000000000000') // Ignora o próprio pedido na edição
            .in('orders.status', ['reserved', 'picked_up', 'pending_signature']);

          if (conflictError) throw conflictError;

          const collision = conflictingItems.some((ci: any) => {
            const existingStart = new Date(ci.orders.start_date);
            const existingEnd = new Date(ci.orders.end_date);
            // Lógica de colisão de datas
            return newStart <= existingEnd && existingStart <= newEnd;
          });

          if (collision) {
            showError(`O item "${product.name}" já está reservado neste período.`);
            setLoading(false);
            return;
          }
        }
      }

      // --- 2. PREPARAÇÃO DO PAYLOAD ---
      const orderPayload = {
        customer_name: values.customer_name,
        customer_phone: values.customer_phone,
        customer_cpf: values.customer_cpf,
        start_date: newStart.toISOString(),
        end_date: newEnd.toISOString(),
        total_amount: financialSummary.totalAmount, // Usa o total calculado com segurança
        payment_method: values.payment_method,
        payment_timing: values.payment_timing,
        fulfillment_type: values.fulfillment_type,
        status: orderId ? undefined : 'pending_signature' // Mantém status se editar, define padrão se novo
      };

      let currentOrderId = orderId;

      // --- 3. EXECUÇÃO (UPDATE OU INSERT) ---
      if (orderId) {
        // MODO EDIÇÃO
        const { error: updateError } = await supabase
          .from('orders')
          .update(orderPayload)
          .eq('id', orderId);
        
        if (updateError) throw updateError;

        // Remove itens antigos para reinserir os novos (Evita duplicidade e complexidade)
        const { error: deleteError } = await supabase
          .from('order_items')
          .delete()
          .eq('order_id', orderId);
        
        if (deleteError) throw deleteError;

      } else {
        // MODO CRIAÇÃO
        const { data: orderData, error: orderError } = await supabase
          .from('orders')
          .insert([orderPayload])
          .select()
          .single();

        if (orderError) throw orderError;
        currentOrderId = orderData.id;
      }

      // --- 4. INSERÇÃO DOS ITENS ---
      const itemsToInsert = selectedItems.map(item => ({
        order_id: currentOrderId,
        product_id: item.product_id,
        quantity: item.quantity
      }));

      const { error: itemsError } = await supabase
        .from('order_items')
        .insert(itemsToInsert);

      if (itemsError) throw itemsError;

      showSuccess(orderId ? "Locação atualizada!" : "Locação criada com sucesso!");
      setOpen(false);
      onOrderCreated(); // Atualiza a tabela pai
    } catch (error: any) {
      showError("Erro ao processar: " + error.message);
    } finally {
      setLoading(false);
    }
  };

  const isDataLoading = fetchingData || isProductsLoading;
  const isImmediate = watchFulfillmentType === 'immediate';

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {children}
      </DialogTrigger>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{orderId ? 'Editar Locação' : 'Nova Locação'}</DialogTitle>
        </DialogHeader>
        
        {isDataLoading ? (
          <div className="flex flex-col items-center justify-center py-12 gap-2">
            <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
            <p className="text-sm text-muted-foreground">Carregando dados...</p>
          </div>
        ) : (
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-6 py-4">
            
            {/* TIPO DE PEDIDO */}
            <div className="space-y-3 border-b pb-4">
              <h3 className="text-base font-semibold flex items-center gap-2">
                <Calendar className="h-4 w-4 text-blue-600" /> Tipo de Pedido
              </h3>
              <Select 
                value={watchFulfillmentType} 
                onValueChange={(val) => setValue('fulfillment_type', val as 'immediate' | 'reservation')}
                disabled={!!orderId} 
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Selecione o tipo" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="immediate">
                    <div className="flex items-center gap-2"><Zap className="h-4 w-4 text-orange-500" /> Retirada Imediata</div>
                  </SelectItem>
                  <SelectItem value="reservation">
                    <div className="flex items-center gap-2"><Clock className="h-4 w-4 text-blue-500" /> Reserva Futura</div>
                  </SelectItem>
                </SelectContent>
              </Select>
              
              <Badge variant="secondary" className="text-xs bg-gray-100 text-gray-600 border-gray-200">
                <AlertTriangle className="h-3 w-3 mr-1 text-orange-400" />
                {isImmediate 
                  ? "Estoque baixado logo após assinatura." 
                  : "Estoque reservado para as datas futuras."}
              </Badge>
            </div>

            {/* DADOS DO CLIENTE */}
            <div className="grid gap-4">
              <div className="space-y-2">
                <Label htmlFor="customer_name">Nome do Cliente</Label>
                <Input id="customer_name" placeholder="Nome completo" {...register('customer_name', { required: true })} />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="customer_phone">WhatsApp</Label>
                  <MaskedInput
                    mask={phoneMask}
                    placeholder="(XX) XXXXX-XXXX"
                    className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    value={watch('customer_phone')}
                    onChange={(e) => setValue('customer_phone', e.target.value)}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="customer_cpf">CPF</Label>
                  <MaskedInput
                    mask={cpfMask}
                    placeholder="000.000.000-00"
                    className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    value={watch('customer_cpf')}
                    onChange={(e) => setValue('customer_cpf', e.target.value)}
                    required
                  />
                </div>
              </div>

              {/* DATAS */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="start_date">Data Início</Label>
                  <Input 
                    id="start_date" 
                    type="date" 
                    {...register('start_date', { required: true })}
                    disabled={isImmediate && !orderId} 
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="end_date">Data Fim</Label>
                  <Input id="end_date" type="date" {...register('end_date', { required: true })} />
                </div>
              </div>
            </div>

            {/* ITENS */}
            <div className="border-t pt-4">
              <Label className="text-base font-semibold">Itens da Locação</Label>
              <div className="flex flex-col md:flex-row gap-4 mt-2 items-end">
                <div className="flex-1 w-full space-y-2">
                  <Label className="text-xs text-muted-foreground">Produto</Label>
                  <Select value={currentProductId} onValueChange={setCurrentProductId} disabled={isProductsLoading}>
                    <SelectTrigger>
                      <SelectValue placeholder={isProductsLoading ? "Carregando..." : "Selecionar produto"} />
                    </SelectTrigger>
                    <SelectContent>
                      {productList.map(p => (
                        <SelectItem key={p.id} value={p.id}>
                          {p.name} (R$ {Number(p.price).toFixed(2)}/dia)
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="w-full md:w-24 space-y-2">
                  <Label className="text-xs text-muted-foreground">Qtd</Label>
                  <Input type="number" min="1" value={currentQuantity} onChange={(e) => setCurrentQuantity(parseInt(e.target.value) || 1)} />
                </div>
                <Button type="button" onClick={addItem} variant="secondary" disabled={!currentProductId} className="w-full md:w-auto">
                  <Plus className="h-4 w-4 mr-2" /> Incluir
                </Button>
              </div>

              {/* LISTA DE ITENS ADICIONADOS */}
              <div className="mt-4 space-y-2">
                {selectedItems.length > 0 ? (
                  <div className="rounded-lg border bg-gray-50 p-4 space-y-2">
                    {selectedItems.map((item, index) => (
                      <div key={index} className="flex justify-between items-center bg-white p-2 rounded border shadow-sm">
                        <div className="flex flex-col">
                          <span className="text-sm font-medium">{item.product_name} x {item.quantity}</span>
                          <span className="text-[10px] text-muted-foreground">R$ {item.daily_price.toFixed(2)} un/dia</span>
                        </div>
                        <Button type="button" variant="ghost" size="sm" onClick={() => removeItem(index)} className="text-red-500 hover:text-red-700">
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-6 border-2 border-dashed rounded-lg bg-gray-50 text-gray-400 text-sm">
                    Nenhum item adicionado.
                  </div>
                )}
              </div>
            </div>

            {/* PAGAMENTO E TOTAL */}
            <div className="border-t pt-4 space-y-4">
              <h3 className="text-base font-semibold flex items-center gap-2">
                <CreditCard className="h-4 w-4 text-blue-600" /> Pagamento
              </h3>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Método</Label>
                  <Select value={watchPaymentMethod} onValueChange={(val) => setValue('payment_method', val)}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Pix">Pix</SelectItem>
                      <SelectItem value="Cartão de Crédito">Cartão de Crédito</SelectItem>
                      <SelectItem value="Dinheiro">Dinheiro</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Momento</Label>
                  <Select value={watchPaymentTiming} onValueChange={(val) => setValue('payment_timing', val)}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="paid_on_pickup">Pago na Retirada</SelectItem>
                      <SelectItem value="pay_on_return">Pagar na Devolução</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>

            {/* RESUMO FINANCEIRO (AZUL) */}
            <div className="bg-blue-50 border border-blue-100 rounded-xl p-6 space-y-3">
              <div className="flex items-center gap-2 text-blue-800 font-semibold mb-2">
                <Wallet className="h-5 w-5" /> Resumo Financeiro
              </div>
              <div className="flex justify-between text-sm text-blue-700">
                <span>Duração:</span>
                <span className="font-bold">{financialSummary.durationInDays} dias</span>
              </div>
              <div className="flex justify-between text-sm text-blue-700">
                <span>Diária Total:</span>
                <span className="font-bold">R$ {financialSummary.subtotalDaily.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
              </div>
              <div className="border-t border-blue-200 pt-2 flex justify-between text-lg font-bold text-blue-900">
                <span>Total a Pagar:</span>
                <span>R$ {financialSummary.totalAmount.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
              </div>
            </div>

            <DialogFooter>
              <Button variant="outline" type="button" onClick={() => setOpen(false)}>Cancelar</Button>
              <Button type="submit" className="bg-blue-600 hover:bg-blue-700 h-10 px-8" disabled={loading}>
                {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {orderId ? 'Salvar Alterações' : 'Criar Pedido'}
              </Button>
            </DialogFooter>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
};

export default CreateOrderDialog;