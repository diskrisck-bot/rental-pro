"use client";

import React, { useState, useEffect, useMemo } from 'react';
import { Plus, Trash2, Loader2, Wallet, Edit, CreditCard, Clock, Zap, Calendar, AlertTriangle } from 'lucide-react';
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

// Máscaras
const phoneMask = ['(', /[1-9]/, /\d/, ')', ' ', /\d/, /\d/, /\d/, /\d/, /\d/, '-', /\d/, /\d/, /\d/, /\d/];
const cpfMask = [/\d/, /\d/, /\d/, '.', /\d/, /\d/, /\d/, '.', /\d/, /\d/, /\d/, '-', /\d/, /\d/];

const CreateOrderDialog = ({ orderId, onOrderCreated, children }: CreateOrderDialogProps) => {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [fetchingData, setFetchingData] = useState(false);
  const [selectedItems, setSelectedItems] = useState<OrderItem[]>([]);
  
  const [currentProductId, setCurrentProductId] = useState("");
  const [currentQuantity, setCurrentQuantity] = useState(1);

  // Fetch products using useQuery
  const { data: products, isLoading: isProductsLoading, isError: isProductsError } = useQuery({
    queryKey: ['allProducts'],
    queryFn: fetchAllProducts,
    enabled: open, // Only fetch when dialog is open
  });
  
  const productList = products || [];

  const defaultStartDate = format(new Date(), 'yyyy-MM-dd');
  const defaultEndDate = format(new Date(Date.now() + 86400000), 'yyyy-MM-dd');

  const { register, handleSubmit, reset, watch, setValue } = useForm({
    defaultValues: {
      customer_name: '',
      customer_phone: '',
      customer_cpf: '',
      start_date: defaultStartDate,
      end_date: defaultEndDate,
      payment_method: 'Pix', // Default value
      payment_timing: 'paid_on_pickup', // Default value
      fulfillment_type: 'reservation', // Novo campo padrão
    }
  });

  const watchDates = watch(['start_date', 'end_date']);
  const watchPaymentMethod = watch('payment_method');
  const watchPaymentTiming = watch('payment_timing');
  const watchFulfillmentType = watch('fulfillment_type');

  const financialSummary = useMemo(() => {
    return calculateOrderTotal(watchDates[0], watchDates[1], selectedItems);
  }, [selectedItems, watchDates]);

  // Efeito para ajustar a data de início quando o tipo de cumprimento muda
  useEffect(() => {
    if (watchFulfillmentType === 'immediate') {
      setValue('start_date', format(new Date(), 'yyyy-MM-dd'));
    } else if (watchFulfillmentType === 'reservation' && !orderId) {
      setValue('start_date', defaultStartDate);
    }
  }, [watchFulfillmentType, setValue, orderId]);


  // Exibe erro se o carregamento de produtos falhar
  useEffect(() => {
    if (isProductsError) {
      showError("Erro ao carregar a lista de produtos.");
    }
  }, [isProductsError]);

  // Carrega dados do pedido (se for edição) e inicializa o formulário
  useEffect(() => {
    if (open) {
      const init = async () => {
        if (orderId && isProductsLoading) {
            return; 
        }

        setFetchingData(true);

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
            setValue('payment_method', orderData.payment_method || 'Pix');
            setValue('payment_timing', orderData.payment_timing || 'paid_on_pickup');
            setValue('fulfillment_type', orderData.fulfillment_type || 'reservation');
            
            const existingItems = orderData.order_items.map((item: any) => ({
              product_id: item.product_id,
              product_name: item.products.name,
              quantity: item.quantity,
              daily_price: Number(item.products.price)
            }));
            setSelectedItems(existingItems);
          }
        } else {
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
        setFetchingData(false);
      };
      
      if (!orderId || !isProductsLoading) {
        init();
      }
    }
  }, [open, orderId, setValue, reset, isProductsLoading]);

  const addItem = () => {
    if (!currentProductId || currentQuantity < 1) return;
    const product = productList.find(p => p.id === currentProductId);
    if (!product) return;

    const existingItem = selectedItems.find(item => item.product_id === currentProductId);
    
    if (existingItem) {
        // Se já existe, apenas incrementa a quantidade visualmente ou substitui (depende da sua regra)
        // Aqui vamos somar para evitar duplicatas na lista visual
        const updatedItems = selectedItems.map(item => 
            item.product_id === currentProductId 
                ? { ...item, quantity: item.quantity + currentQuantity }
                : item
        );
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

      // --- CORREÇÃO DE FUSO HORÁRIO (A MÁGICA ACONTECE AQUI) ---
      // Forçamos o horário para 12:00:00 (Meio-dia).
      // Isso impede que o fuso horário (UTC-3) jogue a data para o dia anterior (21:00).
      const newStart = new Date(`${values.start_date}T12:00:00`);
      const newEnd = new Date(`${values.end_date}T12:00:00`);

      // --- 3. MÓDULO DE ESTOQUE E CONFLITOS (ANTIDUPLICIDADE) ---
      for (const item of selectedItems) {
        const product = productList.find(p => p.id === item.product_id);
        
        if (product && product.type === 'trackable') {
          const { data: conflictingItems, error: conflictError } = await supabase
            .from('order_items')
            .select('order_id, orders!inner(start_date, end_date, status)')
            .eq('product_id', item.product_id)
            .neq('order_id', orderId || '00000000-0000-0000-0000-000000000000') 
            .in('orders.status', ['reserved', 'picked_up', 'pending_signature']); 

          if (conflictError) throw conflictError;

          const collision = conflictingItems.some((ci: any) => {
            const existingStart = new Date(ci.orders.start_date);
            const existingEnd = new Date(ci.orders.end_date);
            // Verifica colisão usando os objetos Date corrigidos
            return newStart <= existingEnd && existingStart <= newEnd;
          });

          if (collision) {
            showError(`O item rastreável "${product.name}" já está reservado ou alugado no período selecionado.`);
            setLoading(false);
            return; 
          }
        }
      }

      const initialStatus = 'pending_signature';

      const orderPayload = {
        customer_name: values.customer_name,
        customer_phone: values.customer_phone,
        customer_cpf: values.customer_cpf,
        start_date: newStart.toISOString(), // Salva a data segura (12:00)
        end_date: newEnd.toISOString(),     // Salva a data segura (12:00)
        total_amount: financialSummary.totalAmount,
        payment_method: values.payment_method,
        payment_timing: values.payment_timing,
        fulfillment_type: values.fulfillment_type,
        status: orderId ? undefined : initialStatus 
      };

      let currentOrderId = orderId;

      if (orderId) {
        const { error: updateError } = await supabase
          .from('orders')
          .update(orderPayload)
          .eq('id', orderId);
        
        if (updateError) throw updateError;

        const { error: deleteError } = await supabase
          .from('order_items')
          .delete()
          .eq('order_id', orderId);
        
        if (deleteError) throw deleteError;
      } else {
        const { data: orderData, error: orderError } = await supabase
          .from('orders')
          .insert([orderPayload])
          .select()
          .single();

        if (orderError) throw orderError;
        currentOrderId = orderData.id;
      }

      const itemsToInsert = selectedItems.map(item => ({
        order_id: currentOrderId,
        product_id: item.product_id,
        quantity: item.quantity
      }));

      const { error: itemsError } = await supabase
        .from('order_items')
        .insert(itemsToInsert);

      if (itemsError) throw itemsError;

      showSuccess(orderId ? "Pedido atualizado com sucesso!" : "Pedido criado com sucesso! Aguardando assinatura.");
      setOpen(false);
      onOrderCreated();
    } catch (error: any) {
      showError("Erro ao processar pedido: " + error.message);
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
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
            <p className="text-sm text-muted-foreground">Carregando dados do pedido...</p>
          </div>
        ) : (
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-6 py-4">
            
            <div className="space-y-3 border-b pb-4">
              <h3 className="text-base font-semibold flex items-center gap-2">
                <Calendar className="h-4 w-4 text-secondary" /> Tipo de Pedido
              </h3>
              <Select 
                value={watchFulfillmentType} 
                onValueChange={(val) => setValue('fulfillment_type', val as 'immediate' | 'reservation')}
                disabled={!!orderId} 
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Selecione o tipo de pedido" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="immediate">
                    <div className="flex items-center gap-2">
                      <Zap className="h-4 w-4 text-primary" /> Retirada Imediata
                    </div>
                  </SelectItem>
                  <SelectItem value="reservation">
                    <div className="flex items-center gap-2">
                      <Clock className="h-4 w-4 text-secondary" /> Reserva Futura
                    </div>
                  </SelectItem>
                </SelectContent>
              </Select>
              
              <Badge variant="secondary" className="text-xs bg-gray-100 text-gray-600 border-gray-200">
                <AlertTriangle className="h-3 w-3 mr-1 text-primary" />
                {isImmediate 
                  ? "O estoque será baixado imediatamente APÓS a assinatura." 
                  : "O estoque será reservado para o período selecionado APÓS a assinatura."}
              </Badge>
            </div>

            <div className="grid gap-4">
              <div className="space-y-2">
                <Label htmlFor="customer_name">Nome do Cliente</Label>
                <Input 
                  id="customer_name" 
                  placeholder="Ex: João Silva" 
                  {...register('customer_name', { required: true })}
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="customer_phone">Telefone/WhatsApp</Label>
                  <MaskedInput
                    mask={phoneMask}
                    placeholder="(XX) XXXXX-XXXX"
                    id="customer_phone"
                    type="tel"
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
                    placeholder="XXX.XXX.XXX-XX"
                    id="customer_cpf"
                    className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    value={watch('customer_cpf')}
                    onChange={(e) => setValue('customer_cpf', e.target.value)}
                    required
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="start_date">Data Início</Label>
                  <Input 
                    id="start_date" 
                    type="date" 
                    {...register('start_date', { required: true })}
                    disabled={isImmediate && !orderId} 
                  />
                  {isImmediate && !orderId && (
                    <p className="text-xs text-muted-foreground">Data de início definida para hoje (Retirada Imediata).</p>
                  )}
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
              <div className="flex flex-col md:flex-row gap-4 mt-2 items-end">
                <div className="flex-1 space-y-2 w-full">
                  <Label className="text-xs text-muted-foreground">Produto</Label>
                  <Select 
                    value={currentProductId} 
                    onValueChange={setCurrentProductId}
                    disabled={isProductsLoading || isProductsError}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder={isProductsLoading ? "Carregando produtos..." : "Adicionar novo produto"} />
                    </SelectTrigger>
                    <SelectContent>
                      {isProductsError && (
                        <SelectItem value="error" disabled>Erro ao carregar produtos</SelectItem>
                      )}
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
                  <Input 
                    type="number" 
                    min="1" 
                    value={currentQuantity} 
                    onChange={(e) => setCurrentQuantity(parseInt(e.target.value) || 1)} 
                  />
                </div>
                <Button type="button" onClick={addItem} variant="secondary" disabled={isProductsLoading || isProductsError} className="w-full md:w-auto">
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

            <div className="border-t pt-4 space-y-4">
              <h3 className="text-base font-semibold flex items-center gap-2">
                <CreditCard className="h-4 w-4 text-secondary" /> Detalhes do Pagamento
              </h3>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Forma de Pagamento</Label>
                  <Select 
                    value={watchPaymentMethod} 
                    onValueChange={(val) => setValue('payment_method', val)}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione a forma" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Pix">Pix</SelectItem>
                      <SelectItem value="Cartão de Crédito">Cartão de Crédito</SelectItem>
                      <SelectItem value="Cartão de Débito">Cartão de Débito</SelectItem>
                      <SelectItem value="Dinheiro">Dinheiro</SelectItem>
                      <SelectItem value="Boleto / Outros">Boleto / Outros</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                
                <div className="space-y-2">
                  <Label>Momento do Pagamento</Label>
                  <Select 
                    value={watchPaymentTiming} 
                    onValueChange={(val) => setValue('payment_timing', val)}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione o momento" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="paid_on_pickup">✅ Pago na Retirada</SelectItem>
                      <SelectItem value="pay_on_return">⏳ Pagar na Devolução</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>

            <div className="bg-secondary/10 border border-secondary/20 rounded-xl p-6 space-y-3">
              <div className="flex items-center gap-2 text-secondary font-semibold mb-2">
                <Wallet className="h-5 w-5" />
                Recálculo Financeiro
              </div>
              <div className="flex justify-between text-sm text-secondary">
                <span>Duração Atualizada:</span>
                <span className="font-bold">{financialSummary.durationInDays} {financialSummary.durationInDays === 1 ? 'dia' : 'dias'}</span>
              </div>
              <div className="flex justify-between text-sm text-secondary">
                <span>Subtotal Diário:</span>
                <span className="font-bold">R$ {financialSummary.subtotalDaily.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
              </div>
              <div className="border-t border-secondary/20 pt-2 flex justify-between text-lg font-bold text-secondary">
                <span>Novo Valor Total:</span>
                <span>R$ {financialSummary.totalAmount.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
              </div>
            </div>

            <DialogFooter>
              <Button variant="outline" type="button" onClick={() => setOpen(false)}>Cancelar</Button>
              <Button type="submit" className="bg-primary hover:bg-primary/90 h-12 px-8" disabled={loading}>
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