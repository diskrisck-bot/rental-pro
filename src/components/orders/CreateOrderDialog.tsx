"use client";

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { Plus, Trash2, Loader2, Wallet, Edit, CreditCard, Clock, Zap, Calendar, AlertTriangle, Package, AlertCircle, CheckCircle } from 'lucide-react';
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
import { format, parseISO, isBefore, isAfter, startOfDay } from 'date-fns';
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

interface ProductData {
  id: string;
  name: string;
  price: number;
  type: 'trackable' | 'bulk';
  total_quantity: number;
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
  const [currentAvailability, setCurrentAvailability] = useState<number | null>(null);

  // Fetch products using useQuery
  const { data: products, isLoading: isProductsLoading, isError: isProductsError } = useQuery<ProductData[]>({
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
  const [startDateStr, endDateStr] = watchDates;

  const financialSummary = useMemo(() => {
    return calculateOrderTotal(startDateStr, endDateStr, selectedItems);
  }, [selectedItems, startDateStr, endDateStr]);

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

  // Lógica de verificação de disponibilidade
  const checkAvailability = useCallback(async (productId: string, start: string, end: string): Promise<number> => {
    const product = productList.find(p => p.id === productId);
    if (!product) return 0;

    const totalQuantity = product.total_quantity || 0;
    
    // Usamos T12:00:00Z para consistência ao salvar.
    const startBoundary = `${start}T12:00:00.000Z`;
    const endBoundary = `${end}T12:00:00.000Z`;

    // Lógica de Colisão CORRIGIDA:
    // Um aluguel existente (Order) colide com o período selecionado (Selected) se:
    // (Order.start_date <= Selected.end_date) AND (Order.end_date >= Selected.start_date)
    // Usamos <= e >= para garantir que 1-day rentals (Start=End) sejam contados como conflito.
    
    // Se for produto rastreável, a quantidade total é 1, e a lógica de colisão é mais simples
    if (product.type === 'trackable') {
        
        // Para produtos rastreáveis, se houver qualquer colisão, a disponibilidade é 0
        const { count, error } = await supabase
            .from('order_items')
            .select('order_id', { count: 'exact', head: true })
            .eq('product_id', productId)
            .neq('order_id', orderId || '00000000-0000-0000-0000-000000000000') 
            .in('orders.status', ['signed', 'reserved', 'picked_up'])
            .lte('orders.start_date', endBoundary) // OrderStart <= SelectedEnd (CORREÇÃO APLICADA)
            .gte('orders.end_date', startBoundary); // OrderEnd >= SelectedStart (CORREÇÃO APLICADA)

        if (error) throw error;
        
        // Se count > 0, está ocupado. Disponibilidade é 1 - count.
        return Math.max(0, totalQuantity - (count || 0));
    }

    // Lógica para produtos de Granel (Bulk)
    const { data: conflictingItems, error: conflictError } = await supabase
        .from('order_items')
        .select(`
            quantity,
            orders!inner (
                status,
                start_date,
                end_date
            )
        `)
        .eq('product_id', productId)
        .neq('order_id', orderId || '00000000-0000-0000-0000-000000000000') 
        .in('orders.status', ['signed', 'reserved', 'picked_up'])
        .lte('orders.start_date', endBoundary) // OrderStart <= SelectedEnd (CORREÇÃO APLICADA)
        .gte('orders.end_date', startBoundary); // OrderEnd >= SelectedStart (CORREÇÃO APLICADA)

    if (conflictError) throw conflictError;

    const occupiedQuantity = conflictingItems.reduce((sum, item: any) => sum + item.quantity, 0);
    
    return Math.max(0, totalQuantity - occupiedQuantity);
  }, [productList, orderId]);

  // Efeito para atualizar a disponibilidade na UI
  useEffect(() => {
    if (currentProductId && startDateStr && endDateStr) {
      setCurrentAvailability(null);
      checkAvailability(currentProductId, startDateStr, endDateStr)
        .then(setCurrentAvailability)
        .catch((e) => {
          console.error("Erro ao verificar disponibilidade:", e);
          setCurrentAvailability(0);
        });
    } else {
      setCurrentAvailability(null);
    }
  }, [currentProductId, startDateStr, endDateStr, checkAvailability]);


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

  const addItem = async () => {
    // 1. PRÉ-REQUISITO DE DATA
    if (!startDateStr || !endDateStr) {
        showError("Selecione o período do evento para verificar a disponibilidade.");
        return;
    }
    if (!currentProductId || currentQuantity < 1) return;
    
    const product = productList.find(p => p.id === currentProductId);
    if (!product) return;

    // 2. LÓGICA DE VERIFICAÇÃO DE ESTOQUE (Anti-Overselling)
    
    // Soma a quantidade já selecionada no carrinho local para este produto
    const quantityInCart = selectedItems
        .filter(item => item.product_id === currentProductId)
        .reduce((sum, item) => sum + item.quantity, 0);

    const requestedQuantity = currentQuantity;
    const totalRequested = quantityInCart + requestedQuantity;

    try {
        setLoading(true); // Bloqueia o botão de adicionar enquanto verifica
        const availableQuantity = await checkAvailability(currentProductId, startDateStr, endDateStr);
        
        if (totalRequested > availableQuantity) {
            showError(`Estoque insuficiente para este período. Disponível: ${availableQuantity}, Solicitado: ${totalRequested}`);
            return;
        }
    } catch (error: any) {
        showError("Erro ao verificar estoque: " + error.message);
        return;
    } finally {
        setLoading(false);
    }

    // 3. Se passou na validação, adiciona/atualiza o item
    const existingItemIndex = selectedItems.findIndex(item => item.product_id === currentProductId);
    
    if (existingItemIndex !== -1) {
        // Se já existe, atualiza a quantidade (já validamos o totalRequested)
        const updatedItems = selectedItems.map((item, index) => 
            index === existingItemIndex 
                ? { ...item, quantity: totalRequested }
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
    setCurrentAvailability(null);
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
      // Revalidação final de estoque antes de salvar (para garantir que as datas não mudaram)
      for (const item of selectedItems) {
        const product = productList.find(p => p.id === item.product_id);
        
        if (product) {
            const available = await checkAvailability(product.id, values.start_date, values.end_date);
            if (item.quantity > available) {
                showError(`Falha na validação final: O item "${product.name}" excede o estoque disponível (${available} un) para o período selecionado.`);
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

        // Deleta itens antigos antes de inserir os novos
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
  const isAddButtonDisabled = !currentProductId || currentQuantity < 1 || loading || !startDateStr || !endDateStr;

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
                <Button type="button" onClick={addItem} variant="secondary" disabled={isAddButtonDisabled} className="w-full md:w-auto">
                  {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4 mr-2" />} Incluir
                </Button>
              </div>
              
              {/* Feedback de Disponibilidade */}
              {currentProductId && startDateStr && endDateStr && (
                <div className="mt-2 flex items-center gap-2 text-sm">
                    {currentAvailability === null ? (
                        <span className="text-muted-foreground flex items-center gap-1"><Loader2 className="h-3 w-3 animate-spin" /> Verificando disponibilidade...</span>
                    ) : currentAvailability > 0 ? (
                        <span className="text-success flex items-center gap-1 font-semibold"><CheckCircle className="h-3 w-3" /> Disponível para o período: {currentAvailability} un.</span>
                    ) : (
                        <span className="text-destructive flex items-center gap-1 font-semibold"><AlertCircle className="h-3 w-3" /> Esgotado para o período.</span>
                    )}
                </div>
              )}

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