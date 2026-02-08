"use client";

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { Plus, Trash2, Loader2, Wallet, Edit, CreditCard, Clock, Zap, Calendar, AlertTriangle, Package, AlertCircle, CheckCircle, Truck, Store, MapPin } from 'lucide-react';
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
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { cn } from '@/lib/utils';
import { Textarea } from '@/components/ui/textarea';

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
  const [deliveryAddress, setDeliveryAddress] = useState('');

  const { data: products, isLoading: isProductsLoading } = useQuery<ProductData[]>({
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
      delivery_method: 'pickup', 
    }
  });

  const watchDates = watch(['start_date', 'end_date']);
  const watchFulfillmentType = watch('fulfillment_type');
  const watchDeliveryMethod = watch('delivery_method'); 
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

  const checkAvailabilityForUI = useCallback(async (productId: string, start: string, end: string): Promise<number> => {
    const { data: productData } = await supabase.from('products').select('total_quantity').eq('id', productId).single();
    if (!productData) return 0;
    const totalEstoque = Number(productData.total_quantity) || 0;

    const { data: activeRentals } = await supabase
      .from('order_items')
      .select(`quantity, orders!inner (start_date, end_date, status)`)
      .eq('product_id', productId)
      .neq('order_id', orderId || '00000000-0000-0000-0000-000000000000') 
      .in('orders.status', ['signed', 'reserved', 'picked_up']) 
      .lte('orders.start_date', `${end}T12:00:00.000Z`)
      .gte('orders.end_date', `${start}T12:00:00.000Z`);

    let maxUsage = 0;
    const startDay = parseISO(start);
    const endDay = parseISO(end);

    for (let d = startDay; d <= endDay; d = addDays(d, 1)) {
      const currentDayStr = format(d, 'yyyy-MM-dd');
      const usageOnThisDay = (activeRentals || []).reduce((acc: number, item: any) => {
        const itemStart = item.orders.start_date.split('T')[0];
        const itemEnd = item.orders.end_date.split('T')[0];
        if (currentDayStr >= itemStart && currentDayStr <= itemEnd) return acc + Number(item.quantity);
        return acc;
      }, 0);
      if (usageOnThisDay > maxUsage) maxUsage = usageOnThisDay;
    }
    return Math.max(0, totalEstoque - maxUsage);
  }, [orderId]);

  useEffect(() => {
    if (currentProductId && startDateStr && endDateStr) {
      if (isBefore(parseISO(endDateStr), parseISO(startDateStr))) {
        setCurrentAvailability(0);
        return;
      }
      setCurrentAvailability(null);
      checkAvailabilityForUI(currentProductId, startDateStr, endDateStr).then(setCurrentAvailability);
    }
  }, [currentProductId, startDateStr, endDateStr, checkAvailabilityForUI]);

  useEffect(() => {
    if (open) {
      const init = async () => {
        setFetchingData(true);
        if (orderId) {
          const { data: orderData } = await supabase.from('orders').select('*, order_items(*, products(name, price))').eq('id', orderId).single();
          if (orderData) {
            setValue('customer_name', orderData.customer_name);
            setValue('customer_phone', orderData.customer_phone || '');
            setValue('start_date', format(parseISO(orderData.start_date), 'yyyy-MM-dd'));
            setValue('end_date', format(parseISO(orderData.end_date), 'yyyy-MM-dd'));
            setValue('payment_method', orderData.payment_method || 'Pix');
            setValue('payment_timing', orderData.payment_timing || 'paid_on_pickup');
            setValue('fulfillment_type', orderData.fulfillment_type || 'reservation');
            setValue('delivery_method', orderData.delivery_method || 'pickup'); 
            setDeliveryAddress(orderData.delivery_address || '');
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
            delivery_method: 'pickup', 
          });
          setCustomerDocument('');
          setDeliveryAddress('');
          setSelectedItems([]);
        }
        setFetchingData(false);
      };
      init();
    }
  }, [open, orderId, setValue, reset]);

  const addItem = async () => {
    if (!startDateStr || !endDateStr || !currentProductId || currentQuantity < 1) return;
    const product = productList.find(p => p.id === currentProductId);
    if (!product) return;
    setLoading(true);
    try {
        const avail = await checkAvailabilityForUI(currentProductId, startDateStr, endDateStr);
        const quantityInCart = selectedItems.filter(item => item.product_id === currentProductId).reduce((sum, item) => sum + item.quantity, 0);
        if (quantityInCart + currentQuantity > avail) {
            showError(`Estoque insuficiente. Máximo disponível: ${avail} un.`);
            return; 
        }
        const existingItemIndex = selectedItems.findIndex(item => item.product_id === currentProductId);
        if (existingItemIndex !== -1) {
            setSelectedItems(selectedItems.map((item, index) => index === existingItemIndex ? { ...item, quantity: item.quantity + currentQuantity } : item));
        } else {
            setSelectedItems([...selectedItems, { product_id: currentProductId, product_name: product.name, quantity: currentQuantity, daily_price: Number(product.price) }]);
        }
        setCurrentProductId("");
        setCurrentQuantity(1);
    } catch (error: any) { showError(error.message); } finally { setLoading(false); }
  };

  const removeItem = (index: number) => {
    setSelectedItems(selectedItems.filter((_, i) => i !== index));
  };

  const onSubmit = async (values: any) => {
    if (selectedItems.length === 0) { showError("Adicione itens ao pedido"); return; }
    if (values.delivery_method === 'delivery' && !deliveryAddress.trim()) { showError("Informe o endereço de entrega."); return; }

    try {
      setLoading(true);

      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        showError("Sessão expirada. Faça login novamente.");
        return;
      }

      const newStart = new Date(`${values.start_date}T12:00:00`);
      const newEnd = new Date(`${values.end_date}T12:00:00`);

      // Payload Seguro: Garantindo que valores nulos sejam explicitamente null, não undefined
      const orderPayload: any = {
        customer_name: values.customer_name,
        customer_phone: values.customer_phone || null,
        customer_cpf: values.customer_cpf || null,
        start_date: newStart.toISOString(), 
        end_date: newEnd.toISOString(),     
        total_amount: financialSummary.totalAmount,
        payment_method: values.payment_method || 'Pix',
        payment_timing: values.payment_timing || 'paid_on_pickup',
        fulfillment_type: values.fulfillment_type || 'reservation',
        delivery_method: values.delivery_method || 'pickup', 
        delivery_address: values.delivery_method === 'delivery' ? (deliveryAddress.trim() || null) : null,
        user_id: user.id
      };

      if (!orderId) {
        orderPayload.status = 'pending_signature';
      }

      console.log("[CreateOrderDialog] Enviando Pedido:", orderPayload);

      let currentOrderId = orderId;

      if (orderId) {
        const { error: updateError } = await supabase
          .from('orders')
          .update(orderPayload)
          .eq('id', orderId);

        if (updateError) throw updateError;
        await supabase.from('order_items').delete().eq('order_id', orderId);
      } else {
        const { data: newOrder, error: insertError } = await supabase
          .from('orders')
          .insert([orderPayload])
          .select()
          .single();

        if (insertError || !newOrder) {
          console.error("[CreateOrderDialog] Erro no Insert:", insertError);
          throw new Error(insertError?.message || "Erro ao inserir pedido (retorno nulo)");
        }
        currentOrderId = newOrder.id;
      }

      const { error: itemsError } = await supabase
        .from('order_items')
        .insert(selectedItems.map(item => ({ 
          order_id: currentOrderId, 
          product_id: item.product_id, 
          quantity: item.quantity 
        })));

      if (itemsError) throw itemsError;

      showSuccess(orderId ? "Pedido atualizado!" : "Pedido criado!");
      setOpen(false);
      onOrderCreated();
    } catch (error: any) { 
      console.error("[CreateOrderDialog] Erro fatal:", error);
      showError(error.message); 
    } finally { 
      setLoading(false); 
    }
  };

  const isDataLoading = fetchingData || isProductsLoading;
  const isImmediate = watchFulfillmentType === 'immediate';
  const isDelivery = watchDeliveryMethod === 'delivery';

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{children}</DialogTrigger>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader><DialogTitle>{orderId ? 'Editar Locação' : 'Nova Locação'}</DialogTitle></DialogHeader>
        {isDataLoading ? (
          <div className="flex flex-col items-center justify-center py-12 gap-2"><Loader2 className="h-8 w-8 animate-spin text-primary" /><p className="text-sm text-muted-foreground">Carregando...</p></div>
        ) : (
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-6 py-4">
            <div className="space-y-3 border-b pb-4">
              <h3 className="text-base font-semibold flex items-center gap-2"><Calendar className="h-4 w-4 text-secondary" /> Tipo de Pedido</h3>
              <Select value={watchFulfillmentType} onValueChange={(val) => setValue('fulfillment_type', val as any)} disabled={!!orderId}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="immediate"><div className="flex items-center gap-2"><Zap className="h-4 w-4 text-primary" /> Retirada Imediata</div></SelectItem>
                  <SelectItem value="reservation"><div className="flex items-center gap-2"><Clock className="h-4 w-4 text-secondary" /> Reserva Futura</div></SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="grid gap-4">
              <div className="space-y-2"><Label>Nome do Cliente</Label><Input placeholder="Ex: João Silva" {...register('customer_name', { required: true })} /></div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2"><Label>Telefone</Label><MaskedInput mask={phoneMask} placeholder="(XX) XXXXX-XXXX" className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring" value={watch('customer_phone')} onChange={(e) => setValue('customer_phone', e.target.value)} required /></div>
                <div className="space-y-2"><Label>CPF / CNPJ</Label><Input placeholder="Digite o documento" maxLength={18} value={customerDocument} onChange={handleDocumentChange} required /><input type="hidden" {...register('customer_cpf', { required: true })} /></div>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2"><Label>Data Início</Label><Input type="date" {...register('start_date', { required: true })} disabled={isImmediate && !orderId} /></div>
                <div className="space-y-2"><Label>Data Fim</Label><Input type="date" {...register('end_date', { required: true })} /></div>
              </div>
            </div>
            
            <div className="border-t pt-4 space-y-3">
                <Label className="text-base font-semibold flex items-center gap-2"><Truck className="h-4 w-4 text-secondary" /> Responsabilidade Logística</Label>
                <RadioGroup value={watchDeliveryMethod} onValueChange={(val) => setValue('delivery_method', val)} className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <Label htmlFor="pickup" className={cn("flex flex-col items-center justify-between rounded-xl border-2 p-4 cursor-pointer transition-all", watchDeliveryMethod === 'pickup' ? "border-primary bg-primary/5 shadow-md" : "border-gray-200 hover:bg-gray-50")}>
                        <div className="flex items-center space-x-3 w-full"><RadioGroupItem value="pickup" id="pickup" className="h-5 w-5" /><div className="flex-1"><span className="font-bold text-sm flex items-center gap-2"><Store className="h-4 w-4" /> Retirada (Balcão)</span><p className="text-xs text-muted-foreground mt-1">No seu endereço.</p></div></div>
                    </Label>
                    <Label htmlFor="delivery" className={cn("flex flex-col items-center justify-between rounded-xl border-2 p-4 cursor-pointer transition-all", watchDeliveryMethod === 'delivery' ? "border-primary bg-primary/5 shadow-md" : "border-gray-200 hover:bg-gray-50")}>
                        <div className="flex items-center space-x-3 w-full"><RadioGroupItem value="delivery" id="delivery" className="h-5 w-5" /><div className="flex-1"><span className="font-bold text-sm flex items-center gap-2"><Truck className="h-4 w-4" /> Entrega (Frete)</span><p className="text-xs text-muted-foreground mt-1">No endereço do cliente.</p></div></div>
                    </Label>
                </RadioGroup>
            </div>
            
            {isDelivery && (
                <div className="space-y-2 border-t pt-4">
                    <Label className="flex items-center gap-2 font-semibold text-secondary"><MapPin className="h-4 w-4" /> Endereço de Entrega</Label>
                    <Textarea placeholder="Endereço completo" value={deliveryAddress} onChange={(e) => setDeliveryAddress(e.target.value)} required rows={3} />
                </div>
            )}

            <div className="border-t pt-4">
              <Label className="text-base font-semibold">Itens da Locação</Label>
              <div className="flex flex-col md:flex-row gap-4 mt-2 items-end">
                <div className="flex-1 space-y-2 w-full"><Select value={currentProductId} onValueChange={setCurrentProductId} disabled={isProductsLoading}><SelectTrigger><SelectValue placeholder="Adicionar produto" /></SelectTrigger><SelectContent>{productList.map(p => (<SelectItem key={p.id} value={p.id}>{p.name} (R$ {Number(p.price).toFixed(2)}/dia)</SelectItem>))}</SelectContent></Select></div>
                <div className="w-full md:w-24 space-y-2"><Input type="number" min="1" value={currentQuantity} onChange={(e) => setCurrentQuantity(parseInt(e.target.value) || 1)} /></div>
                <Button type="button" onClick={addItem} variant="secondary" className="w-full md:w-auto" disabled={!currentProductId || currentQuantity < 1}>Incluir</Button>
              </div>
              <div className="mt-4 space-y-2">
                {selectedItems.map((item, index) => (
                  <div key={index} className="flex justify-between items-center bg-white p-2 rounded border shadow-sm"><div className="flex flex-col"><span className="text-sm font-medium">{item.product_name} x {item.quantity}</span><span className="text-[10px] text-muted-foreground">R$ {item.daily_price.toFixed(2)}/dia</span></div><Button type="button" variant="ghost" size="sm" onClick={() => removeItem(index)} className="text-red-500"><Trash2 className="h-4 w-4" /></Button></div>
                ))}
              </div>
            </div>

            <div className="bg-secondary/10 border border-secondary/20 rounded-xl p-6 space-y-3">
              <div className="flex justify-between text-sm text-secondary"><span>Duração:</span><span className="font-bold">{financialSummary.durationInDays} dias</span></div>
              <div className="border-t border-secondary/20 pt-2 flex justify-between text-lg font-bold text-secondary"><span>Total:</span><span>R$ {financialSummary.totalAmount.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span></div>
            </div>

            <DialogFooter>
              <Button variant="outline" type="button" onClick={() => setOpen(false)}>Cancelar</Button>
              <Button type="submit" className="bg-primary hover:bg-primary/90 h-12 px-8" disabled={loading}>{loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : 'Salvar'}</Button>
            </DialogFooter>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
};

export default CreateOrderDialog;