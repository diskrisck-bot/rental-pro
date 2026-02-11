"use client";

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { Plus, Trash2, Loader2, Wallet, Edit, CreditCard, Clock, Zap, Calendar, AlertTriangle, Package, AlertCircle, CheckCircle, Truck, Info } from 'lucide-react';
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
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { supabase } from '@/lib/supabase';
import { showSuccess, showError } from '@/utils/toast';
import { format, parseISO, isBefore, isAfter, startOfDay, eachDayOfInterval, isWithinInterval, addDays } from 'date-fns';
import { calculateOrderTotal } from '@/utils/financial';
import MaskedInput from 'react-text-mask';
import { useQuery } from '@tanstack/react-query';
import { fetchAllProducts } from '@/integrations/supabase/queries';
import { Badge } from '@/components/ui/badge';
import { formatCurrencyBRL, parseCurrencyBRL } from '@/utils/currency';

interface CreateOrderDialogProps {
  orderId?: string; 
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

const phoneMask = ['(', /[1-9]/, /\d/, ')', ' ', /\d/, /\d/, /\d/, /\d/, /\d/, '-', /\d/, /\d/, /\d/, /\d/];

const CreateOrderDialog = ({ orderId, onOrderCreated, children }: CreateOrderDialogProps) => {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [fetchingData, setFetchingData] = useState(false);
  const [selectedItems, setSelectedItems] = useState<OrderItem[]>([]);
  
  const [currentProductId, setCurrentProductId] = useState("");
  const [currentQuantity, setCurrentQuantity] = useState(1);
  const [currentAvailability, setCurrentAvailability] = useState<number | null>(null);
  
  const [customerDocument, setCustomerDocument] = useState('');
  const [displayDiscount, setDisplayDiscount] = useState('R$ 0,00');

  const { data: products, isLoading: isProductsLoading, isError: isProductsError } = useQuery<ProductData[]>({
    queryKey: ['allProducts'],
    queryFn: fetchAllProducts,
    enabled: open,
  });
  
  const productList = products || [];

  const defaultStartDate = format(new Date(), 'yyyy-MM-dd');
  const defaultEndDate = format(addDays(new Date(), 1), 'yyyy-MM-dd');

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
      delivery_method: 'Retirada pelo Cliente (Balcão)',
      discount: 0,
    }
  });

  const watchDates = watch(['start_date', 'end_date']);
  const watchPaymentMethod = watch('payment_method');
  const watchPaymentTiming = watch('payment_timing');
  const watchDeliveryMethod = watch('delivery_method');
  const watchFulfillmentType = watch('fulfillment_type');
  const watchDiscount = watch('discount');
  const [startDateStr, endDateStr] = watchDates;

  const financialSummary = useMemo(() => {
    const base = calculateOrderTotal(startDateStr, endDateStr, selectedItems);
    const totalWithDiscount = Math.max(0, base.totalAmount - (Number(watchDiscount) || 0));
    return { ...base, totalAmount: totalWithDiscount };
  }, [selectedItems, startDateStr, endDateStr, watchDiscount]);

  const handleDocumentChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    let value = e.target.value.replace(/\D/g, '');
    if (value.length > 14) value = value.slice(0, 14);

    if (value.length <= 11) {
      value = value.replace(/(\d{3})(\d)/, '$1.$2');
      value = value.replace(/(\d{3})(\d)/, '$1.$2');
      value = value.replace(/(\d{3})(\d{1,2})$/, '$1-$2');
    } else {
      value = value.replace(/^(\d{2})(\d)/, '$1.$2');
      value = value.replace(/^(\d{2})\.(\d{3})(\d)/, '$1.$2.$3');
      value = value.replace(/\.(\d{3})(\d)/, '.$1/$2');
      value = value.replace(/(\d{4})(\d)/, '$1-$2');
    }

    setCustomerDocument(value);
    setValue('customer_cpf', value, { shouldValidate: true });
  };

  const handleDiscountChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const formatted = formatCurrencyBRL(e.target.value);
    const numeric = parseCurrencyBRL(e.target.value);
    setDisplayDiscount(formatted);
    setValue('discount', numeric);
  };

  useEffect(() => {
    if (watchFulfillmentType === 'immediate') {
      setValue('start_date', format(new Date(), 'yyyy-MM-dd'));
    } else if (watchFulfillmentType === 'reservation' && !orderId) {
      setValue('start_date', defaultStartDate);
    }
  }, [watchFulfillmentType, setValue, orderId]);

  useEffect(() => {
    if (isProductsError) {
      showError("Erro ao carregar a lista de produtos.");
    }
  }, [isProductsError]);

  const checkAvailabilityForUI = useCallback(async (productId: string, start: string, end: string): Promise<number> => {
    const product = productList.find(p => p.id === productId);
    if (!product) return 0;

    const { data: productData, error: prodError } = await supabase
      .from('products')
      .select('total_quantity')
      .eq('id', productId)
      .single();
      
    if (prodError || !productData) return 0;
    const totalEstoque = Number(productData.total_quantity) || 0;

    const startBoundary = `${start}T12:00:00.000Z`;
    const endBoundary = `${end}T12:00:00.000Z`;

    const { data: activeRentals } = await supabase
      .from('order_items')
      .select(`
        quantity,
        orders!inner (start_date, end_date, status)
      `)
      .eq('product_id', productId)
      .neq('order_id', orderId || '00000000-0000-0000-0000-000000000000') 
      .in('orders.status', ['signed', 'reserved', 'picked_up']) 
      .lte('orders.start_date', endBoundary)
      .gte('orders.end_date', startBoundary);

    let maxUsage = 0;
    const startDay = parseISO(start);
    const endDay = parseISO(end);

    for (let d = startDay; d <= endDay; d = addDays(d, 1)) {
      const currentDayStr = format(d, 'yyyy-MM-dd');
      const usageOnThisDay = (activeRentals || []).reduce((acc, item) => {
        const itemQuantity = Number(item.quantity) || 0;
        const itemStart = item.orders.start_date.split('T')[0];
        const itemEnd = item.orders.end_date.split('T')[0];
        if (currentDayStr >= itemStart && currentDayStr <= itemEnd) {
          return acc + itemQuantity;
        }
        return acc;
      }, 0);
      if (usageOnThisDay > maxUsage) maxUsage = usageOnThisDay;
    }

    return Math.max(0, totalEstoque - maxUsage);
  }, [productList, orderId]);

  useEffect(() => {
    if (currentProductId && startDateStr && endDateStr) {
      if (isBefore(parseISO(endDateStr), parseISO(startDateStr))) {
        setCurrentAvailability(0);
        return;
      }
      setCurrentAvailability(null);
      checkAvailabilityForUI(currentProductId, startDateStr, endDateStr)
        .then(setCurrentAvailability)
        .catch(() => setCurrentAvailability(0));
    } else {
      setCurrentAvailability(null);
    }
  }, [currentProductId, startDateStr, endDateStr, checkAvailabilityForUI]);

  useEffect(() => {
    if (open) {
      const init = async () => {
        if (orderId && isProductsLoading) return; 
        setFetchingData(true);
        if (orderId) {
          const { data: orderData } = await supabase
            .from('orders')
            .select('*, order_items(*, products(name, price))')
            .eq('id', orderId)
            .single();
          if (orderData) {
            setValue('customer_name', orderData.customer_name);
            setValue('customer_phone', orderData.customer_phone || '');
            setValue('start_date', format(parseISO(orderData.start_date), 'yyyy-MM-dd'));
            setValue('end_date', format(parseISO(orderData.end_date), 'yyyy-MM-dd'));
            setValue('payment_method', orderData.payment_method || 'Pix');
            setValue('payment_timing', orderData.payment_timing || 'paid_on_pickup');
            setValue('fulfillment_type', orderData.fulfillment_type || 'reservation');
            setValue('delivery_method', orderData.delivery_method || 'Retirada pelo Cliente (Balcão)');
            setCustomerDocument(orderData.customer_cpf || '');
            setValue('customer_cpf', orderData.customer_cpf || '');
            
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
            delivery_method: 'Retirada pelo Cliente (Balcão)',
            discount: 0,
          });
          setCustomerDocument('');
          setDisplayDiscount('R$ 0,00');
          setSelectedItems([]);
        }
        setFetchingData(false);
      };
      if (!orderId || !isProductsLoading) init();
    }
  }, [open, orderId, setValue, reset, isProductsLoading]);

  const addItem = async () => {
    if (!startDateStr || !endDateStr || isBefore(parseISO(endDateStr), parseISO(startDateStr)) || !currentProductId || currentQuantity < 1) return;
    const product = productList.find(p => p.id === currentProductId);
    if (!product) return;
    setLoading(true);
    try {
        const { data: productData } = await supabase.from('products').select('total_quantity').eq('id', currentProductId).single();
        const totalEstoque = Number(productData?.total_quantity) || 0;
        const startBoundary = `${startDateStr}T12:00:00.000Z`;
        const endBoundary = `${endDateStr}T12:00:00.000Z`;
        const { data: activeRentals } = await supabase.from('order_items').select(`quantity, orders!inner(start_date, end_date, status)`).eq('product_id', currentProductId).neq('order_id', orderId || '00000000-0000-0000-0000-000000000000').in('orders.status', ['signed', 'reserved', 'picked_up']).lte('orders.start_date', endBoundary).gte('orders.end_date', startBoundary);
        let maxUsage = 0;
        const start = parseISO(startDateStr);
        const end = parseISO(endDateStr);
        for (let d = start; d <= end; d = addDays(d, 1)) {
          const dayStr = format(d, 'yyyy-MM-dd');
          const usage = (activeRentals || []).reduce((acc: number, item: any) => (dayStr >= item.orders.start_date.split('T')[0] && dayStr <= item.orders.end_date.split('T')[0]) ? acc + Number(item.quantity) : acc, 0);
          if (usage > maxUsage) maxUsage = usage;
        }
        const available = totalEstoque - maxUsage;
        const inCart = selectedItems.filter(i => i.product_id === currentProductId).reduce((sum, i) => sum + i.quantity, 0);
        if (inCart + currentQuantity > available) {
            showError(`Estoque insuficiente. Disponível: ${available} un.`);
            return;
        }
        const existingIdx = selectedItems.findIndex(i => i.product_id === currentProductId);
        if (existingIdx !== -1) {
            setSelectedItems(selectedItems.map((item, idx) => idx === existingIdx ? { ...item, quantity: item.quantity + currentQuantity } : item));
        } else {
            setSelectedItems([...selectedItems, { product_id: currentProductId, product_name: product.name, quantity: currentQuantity, daily_price: Number(product.price) }]);
        }
        setCurrentProductId("");
        setCurrentQuantity(1);
    } catch (e: any) { showError(e.message); } finally { setLoading(false); }
  };

  const removeItem = (index: number) => setSelectedItems(selectedItems.filter((_, i) => i !== index));

  const onSubmit = async (values: any) => {
    // 1. VALIDAÇÃO DE ITENS (Guard Clause)
    if (selectedItems.length === 0) { 
      showError("Erro: Adicione pelo menos um item à locação antes de salvar."); 
      return; 
    }

    // 2. VALIDAÇÃO DE CLIENTE (Guard Clause)
    if (!values.customer_name?.trim() || !values.customer_cpf?.trim()) {
      showError("Erro: Preencha o nome e o CPF/CNPJ do cliente corretamente.");
      return;
    }

    try {
      setLoading(true);
      const orderPayload = {
        customer_name: values.customer_name,
        customer_phone: values.customer_phone,
        customer_cpf: values.customer_cpf,
        start_date: new Date(`${values.start_date}T12:00:00`).toISOString(),
        end_date: new Date(`${values.end_date}T12:00:00`).toISOString(),
        total_amount: financialSummary.totalAmount,
        payment_method: values.payment_method,
        payment_timing: values.payment_timing,
        fulfillment_type: values.fulfillment_type,
        delivery_method: values.delivery_method,
        status: orderId ? undefined : 'pending_signature' 
      };

      let currentOrderId = orderId;

      if (orderId) {
        const { error: updateError } = await supabase.from('orders').update(orderPayload).eq('id', orderId);
        if (updateError) throw updateError;
        
        const { error: deleteError } = await supabase.from('order_items').delete().eq('order_id', orderId);
        if (deleteError) throw deleteError;
      } else {
        // 3. TRATAMENTO DE RETORNO DO SUPABASE (Proteção contra null)
        const { data, error: insertError } = await supabase.from('orders').insert([orderPayload]).select().single();
        
        if (insertError) throw insertError;
        if (!data) throw new Error("Falha ao criar locação: O banco de dados não retornou o registro criado.");
        
        currentOrderId = data.id;
      }

      // 4. PERSISTÊNCIA DE ITENS
      if (!currentOrderId) throw new Error("Erro crítico: ID da locação não identificado.");

      const itemsToInsert = selectedItems.map(item => ({ 
        order_id: currentOrderId, 
        product_id: item.product_id, 
        quantity: item.quantity 
      }));

      const { error: itemsError } = await supabase.from('order_items').insert(itemsToInsert);
      if (itemsError) throw itemsError;

      showSuccess("Locação salva com sucesso!");
      setOpen(false);
      onOrderCreated();
    } catch (e: any) { 
      console.error("[CreateOrderDialog] Erro ao salvar:", e);
      showError(e.message || "Ocorreu um erro inesperado ao salvar a locação."); 
    } finally { 
      setLoading(false); 
    }
  };

  const isImmediate = watchFulfillmentType === 'immediate';
  const isDataLoading = fetchingData || isProductsLoading;

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{children}</DialogTrigger>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader><DialogTitle>{orderId ? 'Editar Locação' : 'Nova Locação'}</DialogTitle></DialogHeader>
        {isDataLoading ? <div className="flex justify-center py-12"><Loader2 className="animate-spin" /></div> : (
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
            <div className="space-y-3 border-b pb-4">
              <Label>Tipo de Pedido</Label>
              <Select value={watchFulfillmentType} onValueChange={(val) => setValue('fulfillment_type', val as any)} disabled={!!orderId}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="immediate"><div className="flex items-center gap-2"><Zap className="h-4 w-4" /> Imediato</div></SelectItem><SelectItem value="reservation"><div className="flex items-center gap-2"><Clock className="h-4 w-4" /> Reserva</div></SelectItem></SelectContent></Select>
            </div>
            <div className="grid gap-4">
              <div className="space-y-2">
                <div className="flex items-center gap-1">
                  <Label>Nome Cliente</Label>
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Info className="h-3.5 w-3.5 text-muted-foreground cursor-help" />
                      </TooltipTrigger>
                      <TooltipContent side="bottom" align="start" className="max-w-[250px] z-[100] bg-secondary text-white border-none shadow-xl">
                        <p>Selecione o locatário responsável. O contrato será gerado com os dados (CPF/CNPJ e Endereço) deste cadastro.</p>
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                </div>
                <Input {...register('customer_name', { required: true })} />
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2"><Label>Telefone</Label><MaskedInput mask={phoneMask} placeholder="(00) 00000-0000" className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm" value={watch('customer_phone')} onChange={(e) => setValue('customer_phone', e.target.value)} required /></div>
                <div className="space-y-2"><Label>CPF / CNPJ</Label><Input maxLength={18} value={customerDocument} onChange={handleDocumentChange} placeholder="CPF ou CNPJ" required /><input type="hidden" {...register('customer_cpf', { required: true })} /></div>
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <div className="flex items-center gap-1">
                    <Label>Início</Label>
                    <TooltipProvider>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Info className="h-3.5 w-3.5 text-muted-foreground cursor-help" />
                        </TooltipTrigger>
                        <TooltipContent side="bottom" align="start" className="max-w-[250px] z-[100] bg-secondary text-white border-none shadow-xl">
                          <p>O sistema calcula o valor total automaticamente multiplicando o preço dos itens pelo número de dias selecionados neste intervalo.</p>
                        </TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                  </div>
                  <Input type="date" {...register('start_date', { required: true })} disabled={isImmediate && !orderId} />
                </div>
                <div className="space-y-2">
                  <div className="flex items-center gap-1">
                    <Label>Fim</Label>
                    <TooltipProvider>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Info className="h-3.5 w-3.5 text-muted-foreground cursor-help" />
                        </TooltipTrigger>
                        <TooltipContent side="bottom" align="start" className="max-w-[250px] z-[100] bg-secondary text-white border-none shadow-xl">
                          <p>O sistema calcula o valor total automaticamente multiplicando o preço dos itens pelo número de dias selecionados neste intervalo.</p>
                        </TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                  </div>
                  <Input type="date" {...register('end_date', { required: true })} />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <div className="flex items-center gap-1">
                    <Label>Forma de Pagamento</Label>
                    <TooltipProvider>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Info className="h-3.5 w-3.5 text-muted-foreground cursor-help" />
                        </TooltipTrigger>
                        <TooltipContent side="bottom" align="start" className="max-w-[250px] z-[100] bg-secondary text-white border-none shadow-xl">
                          <p>Defina como o cliente vai pagar. Essa informação constará na Cláusula 3 do contrato.</p>
                        </TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                  </div>
                  <Select value={watchPaymentMethod} onValueChange={(val) => setValue('payment_method', val)}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Pix">Pix</SelectItem>
                      <SelectItem value="Dinheiro">Dinheiro</SelectItem>
                      <SelectItem value="Cartão de Crédito">Cartão de Crédito</SelectItem>
                      <SelectItem value="Cartão de Débito">Cartão de Débito</SelectItem>
                      <SelectItem value="Boleto">Boleto</SelectItem>
                      <SelectItem value="A Combinar">A Combinar</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <div className="flex items-center gap-1">
                    <Label>Status do Pagamento</Label>
                    <TooltipProvider>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Info className="h-3.5 w-3.5 text-muted-foreground cursor-help" />
                        </TooltipTrigger>
                        <TooltipContent side="bottom" align="start" className="max-w-[250px] z-[100] bg-secondary text-white border-none shadow-xl">
                          <p>Indique se o valor já foi recebido ou se ficará pendente para o momento da entrega ou devolução.</p>
                        </TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                  </div>
                  <Select value={watchPaymentTiming} onValueChange={(val) => setValue('payment_timing', val)}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="paid_on_pickup">Pago (Já recebido)</SelectItem>
                      <SelectItem value="pay_on_return">Pendente (Pagar na Entrega/Devolução)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <div className="flex items-center gap-1">
                    <Label>Frete / Retirada</Label>
                    <TooltipProvider>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Info className="h-3.5 w-3.5 text-muted-foreground cursor-help" />
                        </TooltipTrigger>
                        <TooltipContent side="bottom" align="start" className="max-w-[250px] z-[100] bg-secondary text-white border-none shadow-xl">
                          <p>Retirada: Cliente busca no balcão (sem custo). Entrega: Sua equipe leva até o local (pode haver taxa de frete).</p>
                        </TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                  </div>
                  <Select value={watchDeliveryMethod} onValueChange={(val) => setValue('delivery_method', val)}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Retirada pelo Cliente (Balcão)">Retirada pelo Cliente (Balcão)</SelectItem>
                      <SelectItem value="Entrega pelo Locador (Frete)">Entrega pelo Locador (Frete)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <div className="flex items-center gap-1">
                    <Label>Desconto (R$)</Label>
                    <TooltipProvider>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Info className="h-3.5 w-3.5 text-muted-foreground cursor-help" />
                        </TooltipTrigger>
                        <TooltipContent side="bottom" align="start" className="max-w-[250px] z-[100] bg-secondary text-white border-none shadow-xl">
                          <p>Valor em R$ para subtrair do total. Útil para negociações especiais ou parceiros.</p>
                        </TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                  </div>
                  <Input value={displayDiscount} onChange={handleDiscountChange} />
                </div>
              </div>
            </div>
            <div className="border-t pt-4">
              <Label>Itens</Label>
              <div className="flex gap-4 mt-2">
                <Select value={currentProductId} onValueChange={setCurrentProductId}><SelectTrigger><SelectValue placeholder="Produto" /></SelectTrigger><SelectContent>{productList.map(p => (<SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>))}</SelectContent></Select>
                <Input className="w-24" type="number" min="1" value={currentQuantity} onChange={(e) => setCurrentQuantity(parseInt(e.target.value) || 1)} />
                <Button type="button" onClick={addItem} variant="secondary">Incluir</Button>
              </div>
              <div className="mt-4 space-y-2">
                {selectedItems.map((item, index) => (
                  <div key={index} className="flex justify-between items-center bg-gray-50 p-2 rounded border">
                    <span className="text-sm font-medium">{item.product_name} x {item.quantity}</span>
                    <Button type="button" variant="ghost" size="sm" onClick={() => removeItem(index)}><Trash2 className="h-4 w-4 text-red-500" /></Button>
                  </div>
                ))}
              </div>
            </div>
            <div className="bg-secondary/10 p-4 rounded-xl flex justify-between font-bold">
                <span>Total:</span><span>R$ {financialSummary.totalAmount.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
            </div>
            <DialogFooter><Button variant="outline" type="button" onClick={() => setOpen(false)}>Cancelar</Button><Button type="submit" disabled={loading}>{loading ? <Loader2 className="animate-spin" /> : 'Salvar'}</Button></DialogFooter>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
};

export default CreateOrderDialog;