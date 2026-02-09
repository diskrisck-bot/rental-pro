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
import { format, parseISO, isBefore, isAfter, startOfDay, eachDayOfInterval, isWithinInterval, addDays } from 'date-fns';
import { calculateOrderTotal } from '@/utils/financial';
import MaskedInput from 'react-text-mask';
import { useQuery } from '@tanstack/react-query';
import { fetchAllProducts } from '@/integrations/supabase/queries';
import { Badge } from '@/components/ui/badge';

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
          });
          setCustomerDocument('');
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
    if (selectedItems.length === 0) { showError("Adicione itens"); return; }
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
        status: orderId ? undefined : 'pending_signature' 
      };
      let currentOrderId = orderId;
      if (orderId) {
        await supabase.from('orders').update(orderPayload).eq('id', orderId);
        await supabase.from('order_items').delete().eq('order_id', orderId);
      } else {
        const { data } = await supabase.from('orders').insert([orderPayload]).select().single();
        currentOrderId = data.id;
      }
      const itemsToInsert = selectedItems.map(item => ({ order_id: currentOrderId, product_id: item.product_id, quantity: item.quantity }));
      await supabase.from('order_items').insert(itemsToInsert);
      showSuccess("Sucesso!");
      setOpen(false);
      onOrderCreated();
    } catch (e: any) { showError(e.message); } finally { setLoading(false); }
  };

  const isImmediate = watchFulfillmentType === 'immediate';

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
              <Label>Nome Cliente</Label><Input {...register('customer_name', { required: true })} />
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2"><Label>Telefone</Label><MaskedInput mask={phoneMask} className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm" value={watch('customer_phone')} onChange={(e) => setValue('customer_phone', e.target.value)} required /></div>
                <div className="space-y-2"><Label>CPF / CNPJ</Label><Input maxLength={18} value={customerDocument} onChange={handleDocumentChange} placeholder="CPF ou CNPJ" required /><input type="hidden" {...register('customer_cpf', { required: true })} /></div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2"><Label>Início</Label><Input type="date" {...register('start_date', { required: true })} disabled={isImmediate && !orderId} /></div>
                <div className="space-y-2"><Label>Fim</Label><Input type="date" {...register('end_date', { required: true })} /></div>
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