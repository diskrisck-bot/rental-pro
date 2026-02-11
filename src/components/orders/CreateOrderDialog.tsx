"use client";

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { 
  Plus, Trash2, Loader2, Wallet, Edit, CreditCard, Clock, Zap, 
  Calendar, AlertTriangle, Package, AlertCircle, CheckCircle, 
  Truck, Info, User, DollarSign, ShoppingCart, ArrowRight 
} from 'lucide-react';
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
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from '@/components/ui/table';
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
import { cn } from '@/lib/utils';

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

  const checkAvailabilityForUI = useCallback(async (productId: string, start: string, end: string): Promise<number> => {
    const product = productList.find(p => p.id === productId);
    if (!product) return 0;

    const { data: productData } = await supabase
      .from('products')
      .select('total_quantity')
      .eq('id', productId)
      .single();
      
    if (!productData) return 0;
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
            setValue('discount', Number(orderData.discount) || 0);
            setDisplayDiscount(formatCurrencyBRL(Number(orderData.discount) || 0));
            
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
    if (selectedItems.length === 0) { showError("Erro: Adicione pelo menos um item."); return; }
    if (!values.customer_name?.trim() || !values.customer_cpf?.trim()) { showError("Erro: Preencha os dados do cliente."); return; }

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
        discount: Number(values.discount) || 0,
        paid: values.payment_timing === 'paid_on_pickup',
        status: orderId ? undefined : 'pending_signature' 
      };

      let currentOrderId = orderId;

      if (orderId) {
        await supabase.from('orders').update(orderPayload).eq('id', orderId);
        await supabase.from('order_items').delete().eq('order_id', orderId);
      } else {
        const { data, error } = await supabase.from('orders').insert([orderPayload]).select().single();
        if (error) throw error;
        currentOrderId = data.id;
      }

      const itemsToInsert = selectedItems.map(item => ({ 
        order_id: currentOrderId, 
        product_id: item.product_id, 
        quantity: item.quantity 
      }));

      await supabase.from('order_items').insert(itemsToInsert);
      showSuccess("Locação salva com sucesso!");
      setOpen(false);
      onOrderCreated();
    } catch (e: any) { showError(e.message); } finally { setLoading(false); }
  };

  const isDataLoading = fetchingData || isProductsLoading;

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{children}</DialogTrigger>
      <DialogContent className="max-w-4xl max-h-[95vh] overflow-y-auto p-0 gap-0">
        <DialogHeader className="p-6 border-b bg-white sticky top-0 z-10">
          <div className="flex items-center justify-between">
            <DialogTitle className="text-2xl font-heading font-extrabold text-gray-900">
              {orderId ? 'Editar Locação' : 'Nova Locação'}
            </DialogTitle>
            <Badge variant="outline" className="bg-primary/5 text-primary border-primary/20 px-3 py-1">
              {watchFulfillmentType === 'immediate' ? 'Saída Imediata' : 'Reserva Futura'}
            </Badge>
          </div>
        </DialogHeader>

        {isDataLoading ? (
          <div className="flex justify-center py-20"><Loader2 className="animate-spin h-10 w-10 text-primary" /></div>
        ) : (
          <form onSubmit={handleSubmit(onSubmit)} className="p-6 space-y-8">
            
            {/* SEÇÃO 1: DADOS DO CLIENTE */}
            <section className="space-y-4">
              <div className="flex items-center gap-2 text-gray-500 font-bold text-xs uppercase tracking-wider">
                <User className="h-4 w-4" /> Cliente
              </div>
              <div className="bg-slate-50 border border-slate-200 rounded-xl p-5 space-y-4 shadow-sm">
                <div className="space-y-2">
                  <div className="flex items-center gap-1">
                    <Label className="text-gray-700 font-bold">Nome Completo / Razão Social</Label>
                    <TooltipProvider>
                      <Tooltip>
                        <TooltipTrigger asChild><Info className="h-3.5 w-3.5 text-muted-foreground cursor-help" /></TooltipTrigger>
                        <TooltipContent side="bottom" align="start" className="max-w-xs z-[100] bg-secondary text-white border-none shadow-xl">
                          <p>O contrato será gerado com este nome. Certifique-se de que está correto conforme o documento.</p>
                        </TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                  </div>
                  <Input {...register('customer_name', { required: true })} placeholder="Ex: João Silva ou Empresa LTDA" className="bg-white h-11" />
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label className="text-gray-700 font-bold">Telefone de Contato</Label>
                    <MaskedInput 
                      mask={phoneMask} 
                      placeholder="(00) 00000-0000" 
                      className="flex h-11 w-full rounded-md border border-input bg-white px-3 py-2 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring" 
                      value={watch('customer_phone')} 
                      onChange={(e) => setValue('customer_phone', e.target.value)} 
                      required 
                    />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-gray-700 font-bold">CPF ou CNPJ</Label>
                    <Input 
                      maxLength={18} 
                      value={customerDocument} 
                      onChange={handleDocumentChange} 
                      placeholder="000.000.000-00" 
                      className="bg-white h-11"
                      required 
                    />
                    <input type="hidden" {...register('customer_cpf', { required: true })} />
                  </div>
                </div>
              </div>
            </section>

            {/* SEÇÃO 2: LOGÍSTICA E PRAZOS */}
            <section className="space-y-4">
              <div className="flex items-center gap-2 text-gray-500 font-bold text-xs uppercase tracking-wider">
                <Calendar className="h-4 w-4" /> Período e Entrega
              </div>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label className="text-gray-700 font-bold">Data de Início</Label>
                  <div className="relative">
                    <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400 pointer-events-none" />
                    <Input type="date" {...register('start_date', { required: true })} disabled={watchFulfillmentType === 'immediate' && !orderId} className="pl-10 h-11" />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label className="text-gray-700 font-bold">Data de Término</Label>
                  <div className="relative">
                    <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400 pointer-events-none" />
                    <Input type="date" {...register('end_date', { required: true })} className="pl-10 h-11" />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label className="text-gray-700 font-bold">Método de Entrega</Label>
                  <Select value={watchDeliveryMethod} onValueChange={(val) => setValue('delivery_method', val)}>
                    <SelectTrigger className="h-11"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Retirada pelo Cliente (Balcão)"><div className="flex items-center gap-2"><Package className="h-4 w-4" /> Retirada (Balcão)</div></SelectItem>
                      <SelectItem value="Entrega pelo Locador (Frete)"><div className="flex items-center gap-2"><Truck className="h-4 w-4" /> Entrega (Frete)</div></SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </section>

            {/* SEÇÃO 3: ITENS DA LOCAÇÃO */}
            <section className="space-y-4">
              <div className="flex items-center gap-2 text-gray-500 font-bold text-xs uppercase tracking-wider">
                <ShoppingCart className="h-4 w-4" /> Equipamentos
              </div>
              
              {/* BARRA DE ADIÇÃO */}
              <div className="flex flex-col md:flex-row gap-3 bg-secondary/5 p-4 rounded-xl border border-secondary/10">
                <div className="flex-1">
                  <Select value={currentProductId} onValueChange={setCurrentProductId}>
                    <SelectTrigger className="h-11 bg-white"><SelectValue placeholder="Selecione um produto para incluir..." /></SelectTrigger>
                    <SelectContent>
                      {productList.map(p => (
                        <SelectItem key={p.id} value={p.id}>
                          {p.name} — {formatCurrencyBRL(p.price)}/dia
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="w-full md:w-24">
                  <Input type="number" min="1" value={currentQuantity} onChange={(e) => setCurrentQuantity(parseInt(e.target.value) || 1)} className="h-11 bg-white" />
                </div>
                <Button type="button" onClick={addItem} className="h-11 bg-secondary hover:bg-secondary/90 text-white font-bold px-6">
                  {loading ? <Loader2 className="animate-spin" /> : <Plus className="h-4 w-4 mr-2" />} Incluir
                </Button>
              </div>

              {/* TABELA DE ITENS */}
              <div className="border rounded-xl overflow-hidden shadow-sm">
                <Table>
                  <TableHeader className="bg-slate-50">
                    <TableRow>
                      <TableHead className="font-bold">Produto</TableHead>
                      <TableHead className="text-center font-bold">Qtd</TableHead>
                      <TableHead className="text-right font-bold">Valor Diária</TableHead>
                      <TableHead className="text-right font-bold">Subtotal</TableHead>
                      <TableHead className="w-12"></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {selectedItems.length === 0 ? (
                      <TableRow><TableCell colSpan={5} className="h-24 text-center text-gray-400 italic">Nenhum item adicionado ainda.</TableCell></TableRow>
                    ) : (
                      selectedItems.map((item, index) => {
                        const subtotal = item.daily_price * item.quantity * financialSummary.durationInDays;
                        return (
                          <TableRow key={index} className="hover:bg-slate-50/50">
                            <TableCell className="font-medium text-gray-900">{item.product_name}</TableCell>
                            <TableCell className="text-center"><Badge variant="outline" className="font-bold">{item.quantity}</Badge></TableCell>
                            <TableCell className="text-right text-gray-600">{formatCurrencyBRL(item.daily_price)}</TableCell>
                            <TableCell className="text-right font-bold text-gray-900">{formatCurrencyBRL(subtotal)}</TableCell>
                            <TableCell>
                              <Button type="button" variant="ghost" size="icon" onClick={() => removeItem(index)} className="text-red-400 hover:text-red-600 hover:bg-red-50">
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </TableCell>
                          </TableRow>
                        );
                      })
                    )}
                  </TableBody>
                </Table>
              </div>
            </section>

            {/* SEÇÃO 4: FINANCEIRO E FECHAMENTO */}
            <section className="space-y-4">
              <div className="flex items-center gap-2 text-gray-500 font-bold text-xs uppercase tracking-wider">
                <DollarSign className="h-4 w-4" /> Pagamento
              </div>
              
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
                {/* Inputs Financeiros */}
                <div className="lg:col-span-7 grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label className="text-gray-700 font-bold">Forma de Pagamento</Label>
                    <Select value={watchPaymentMethod} onValueChange={(val) => setValue('payment_method', val)}>
                      <SelectTrigger className="h-11"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="Pix">Pix</SelectItem>
                        <SelectItem value="Dinheiro">Dinheiro</SelectItem>
                        <SelectItem value="Cartão de Crédito">Cartão de Crédito</SelectItem>
                        <SelectItem value="Boleto">Boleto</SelectItem>
                        <SelectItem value="A Combinar">A Combinar</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label className="text-gray-700 font-bold">Status do Pagamento</Label>
                    <Select value={watchPaymentTiming} onValueChange={(val) => setValue('payment_timing', val)}>
                      <SelectTrigger className="h-11"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="paid_on_pickup">Pago (Já recebido)</SelectItem>
                        <SelectItem value="pay_on_return">Pendente (Pagar depois)</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2 md:col-span-2">
                    <Label className="text-gray-700 font-bold">Desconto Especial (R$)</Label>
                    <Input value={displayDiscount} onChange={handleDiscountChange} className="h-11" placeholder="R$ 0,00" />
                  </div>
                </div>

                {/* Card de Totais */}
                <div className="lg:col-span-5">
                  <div className="bg-blue-50 border border-blue-100 rounded-2xl p-6 space-y-3 shadow-sm">
                    <div className="flex justify-between text-sm text-blue-600 font-medium">
                      <span>Subtotal ({financialSummary.durationInDays} dias)</span>
                      <span>{formatCurrencyBRL(financialSummary.subtotalDaily * financialSummary.durationInDays)}</span>
                    </div>
                    <div className="flex justify-between text-sm text-red-500 font-medium">
                      <span>Desconto</span>
                      <span>- {formatCurrencyBRL(watchDiscount)}</span>
                    </div>
                    <div className="pt-3 border-t border-blue-200 flex justify-between items-end">
                      <span className="text-blue-900 font-extrabold uppercase text-xs tracking-widest mb-1">Total Final</span>
                      <span className="text-3xl font-black text-blue-900">{formatCurrencyBRL(financialSummary.totalAmount)}</span>
                    </div>
                  </div>
                </div>
              </div>
            </section>

            <DialogFooter className="pt-6 border-t sticky bottom-0 bg-white z-10">
              <div className="flex flex-col md:flex-row gap-3 w-full">
                <Button variant="outline" type="button" onClick={() => setOpen(false)} className="h-12 flex-1 font-bold">Cancelar</Button>
                <Button type="submit" disabled={loading} className="h-12 flex-[2] bg-primary hover:bg-primary/90 text-white font-black uppercase tracking-widest shadow-lg shadow-primary/20">
                  {loading ? <Loader2 className="animate-spin mr-2" /> : <CheckCircle className="h-5 w-5 mr-2" />}
                  {orderId ? 'Atualizar Locação' : 'Finalizar e Gerar Contrato'}
                </Button>
              </div>
            </DialogFooter>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
};

export default CreateOrderDialog;