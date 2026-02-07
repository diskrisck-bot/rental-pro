"use client";

import React, { useState, useEffect } from 'react';
import { Plus, Search, Loader2, Download, MessageCircle, CheckCircle, DollarSign, Clock, Zap, Calendar, AlertTriangle, Package, ArrowRightLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/lib/supabase';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import CreateOrderDialog from '@/components/orders/CreateOrderDialog';
import OrderDetailsSheet from '@/components/orders/OrderDetailsSheet';
import { showError } from '@/utils/toast';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { fetchBusinessConfig, fetchProductCount } from '@/integrations/supabase/queries';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';

// --- FUNÇÃO CORRIGIDA DE STATUS (IGUAL AO DASHBOARD) ---
const getStatusBadge = (status: string) => {
  switch (status) {
    case 'draft': 
      return <Badge variant="outline" className="bg-gray-100 text-gray-600 border-gray-200 uppercase text-[10px]">Rascunho</Badge>;
    
    case 'pending_signature': 
      return (
        <Badge className="bg-yellow-100 text-yellow-800 border-yellow-200 uppercase text-[10px] flex items-center gap-1 w-fit">
           <Clock className="w-3 h-3" /> Aguardando Assinatura
        </Badge>
      );

    case 'signed': 
      return (
        <Badge className="bg-green-100 text-green-700 border-green-200 uppercase text-[10px] flex items-center gap-1 w-fit">
          <div className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />
          Assinado
        </Badge>
      );
    
    case 'reserved': 
      return <Badge className="bg-blue-50 text-blue-700 border-blue-200 uppercase text-[10px]">Reservado</Badge>;
    
    case 'picked_up': 
      return <Badge className="bg-purple-100 text-purple-800 border-purple-200 uppercase text-[10px]">Em Andamento</Badge>;
    
    case 'returned': 
      return <Badge className="bg-green-100 text-green-800 border-green-200 uppercase text-[10px]">Concluído</Badge>;
    
    case 'canceled': 
      return <Badge className="bg-red-50 text-red-700 border-red-200 uppercase text-[10px]">Cancelado</Badge>;
    
    default: 
      return <Badge className="bg-gray-100 text-gray-800 uppercase text-[10px]">{status}</Badge>;
  }
};

const getPaymentTimingBadge = (timing: string) => {
  if (timing === 'paid_on_pickup') {
    return <Badge className="bg-emerald-50 text-emerald-700 border-emerald-200 text-[10px]"><DollarSign className="h-3 w-3 mr-1" /> Pago (Retirada)</Badge>;
  }
  if (timing === 'pay_on_return') {
    return <Badge className="bg-orange-50 text-orange-700 border-orange-200 text-[10px]"><Clock className="h-3 w-3 mr-1" /> A Pagar (Devolução)</Badge>;
  }
  return null;
};

const getFulfillmentTypeBadge = (type: string) => {
  if (type === 'immediate') return <Badge variant="secondary" className="bg-orange-50 text-orange-700 border-orange-200 text-[10px]"><Zap className="h-3 w-3 mr-1" /> Imediata</Badge>;
  if (type === 'reservation') return <Badge variant="secondary" className="bg-blue-50 text-blue-700 border-blue-200 text-[10px]"><Calendar className="h-3 w-3 mr-1" /> Reserva</Badge>;
  return null;
};

const getWhatsappLink = (order: any, isSigned: boolean) => {
    if (!order) return '#';
    const signLink = `${window.location.origin}/contract/${order.id}`;
    let messageText = isSigned 
      ? `Olá ${order.customer_name}! ✅\nSegue seu contrato assinado #${order.id.split('-')[0]}:\n${signLink}`
      : `Olá ${order.customer_name}! 📦\nSegue link para assinatura do contrato #${order.id.split('-')[0]}:\n${signLink}`;
    
    const encodedMessage = encodeURIComponent(messageText);
    let phone = order.customer_phone ? order.customer_phone.replace(/\D/g, '') : '';
    if (phone.length >= 10) phone = `55${phone}`;
    return `https://wa.me/${phone}?text=${encodedMessage}`;
};

const Orders = () => {
  const [orders, setOrders] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [selectedOrderId, setSelectedOrderId] = useState<string | null>(null);
  const [isSheetOpen, setIsSheetOpen] = useState(false);
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();

  const { data: businessConfig, isLoading: isLoadingConfig } = useQuery({
    queryKey: ['businessConfig'],
    queryFn: fetchBusinessConfig,
    staleTime: 0,
  });

  const { data: productCount, isLoading: isLoadingProducts } = useQuery({
    queryKey: ['productCount'],
    queryFn: fetchProductCount,
    staleTime: 0,
  });

  const isCompanyConfigured = !!(businessConfig?.business_name?.trim());
  const hasProducts = (productCount || 0) > 0;

  const fetchOrders = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('orders')
        .select(`*, order_items (quantity, products (name))`)
        .order('created_at', { ascending: false });
      if (error) throw error;
      setOrders(data || []);
    } catch (error: any) {
      showError("Erro ao carregar pedidos.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchOrders(); }, []);
  
  useEffect(() => {
    const idFromUrl = searchParams.get('id');
    if (idFromUrl) {
      setSelectedOrderId(idFromUrl);
      setIsSheetOpen(true);
      setSearchParams({}, { replace: true });
    }
  }, [searchParams, setSearchParams]);

  const handleViewDetails = (id: string) => {
    setSelectedOrderId(id);
    setIsSheetOpen(true);
  };
  
  const filteredOrders = orders.filter(order => {
    const searchTerm = search.toLowerCase();
    return (
      order.customer_name?.toLowerCase().includes(searchTerm) ||
      order.id?.toLowerCase().includes(searchTerm)
    );
  });

  const isGlobalLoading = isLoadingConfig || isLoadingProducts;

  const renderHeaderButton = () => {
    if (isGlobalLoading) return <Button disabled><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Carregando...</Button>;
    if (!isCompanyConfigured) return <Button className="bg-orange-600" onClick={() => navigate('/settings')}><AlertTriangle className="mr-2 h-4 w-4" /> Configurar Empresa</Button>;
    return (
      <CreateOrderDialog onOrderCreated={fetchOrders}>
        <Button className="bg-blue-600 hover:bg-blue-700 shadow-lg shadow-blue-100">
          <Plus className="mr-2 h-4 w-4" /> Novo Pedido
        </Button>
      </CreateOrderDialog>
    );
  };

  return (
    <div className="p-4 md:p-8 space-y-6 bg-gray-50/50 min-h-screen">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold tracking-tight text-gray-900">Pedidos</h1>
          <p className="text-muted-foreground">Gerenciamento de contratos e locações.</p>
        </div>
        {renderHeaderButton()}
      </div>

      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
        <Input 
          placeholder="Buscar cliente ou ID..." 
          className="pl-10 bg-white" 
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      <div className="border rounded-xl bg-white overflow-hidden shadow-sm border-gray-200">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader className="bg-gray-50">
              <TableRow>
                <TableHead className="w-[100px]">ID</TableHead>
                <TableHead>Cliente</TableHead>
                <TableHead>Período</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Pagamento</TableHead>
                <TableHead>Total</TableHead>
                <TableHead className="text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow><TableCell colSpan={7} className="h-32 text-center"><Loader2 className="h-8 w-8 animate-spin mx-auto text-blue-600" /></TableCell></TableRow>
              ) : filteredOrders.length === 0 ? (
                <TableRow><TableCell colSpan={7} className="h-32 text-center text-gray-500">Nenhum pedido encontrado.</TableCell></TableRow>
              ) : (
                filteredOrders.map((order) => {
                  const isSigned = !!order.signed_at;
                  const whatsappLink = getWhatsappLink(order, isSigned);
                  return (
                    <TableRow key={order.id} className="hover:bg-gray-50/80 transition-colors cursor-pointer" onClick={() => handleViewDetails(order.id)}>
                      <TableCell>
                        <span className="font-mono text-xs text-gray-500 font-bold">#{order.id.split('-')[0]}</span>
                      </TableCell>
                      <TableCell className="font-semibold text-gray-700">{order.customer_name}</TableCell>
                      <TableCell className="text-xs text-gray-500">
                        {format(new Date(order.start_date), 'dd/MM')} — {format(new Date(order.end_date), 'dd/MM')}
                      </TableCell>
                      <TableCell>{getStatusBadge(order.status)}</TableCell>
                      <TableCell>{getPaymentTimingBadge(order.payment_timing)}</TableCell>
                      <TableCell className="font-bold text-blue-600">
                        R$ {Number(order.total_amount || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                      </TableCell>
                      <TableCell className="text-right" onClick={(e) => e.stopPropagation()}>
                        <div className="flex justify-end gap-2">
                          <a href={whatsappLink} target="_blank" rel="noopener noreferrer">
                            <Button size="sm" variant="ghost" className="h-8 w-8 p-0 text-green-600 hover:bg-green-50 hover:text-green-700">
                              <MessageCircle className="h-4 w-4" />
                            </Button>
                          </a>
                          <Button size="sm" variant="ghost" onClick={() => handleViewDetails(order.id)} className="h-8 w-8 p-0 text-gray-400 hover:text-blue-600">
                             <ArrowRightLeft className="h-4 w-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </div>
      </div>
      <OrderDetailsSheet orderId={selectedOrderId} open={isSheetOpen} onOpenChange={setIsSheetOpen} onStatusUpdate={fetchOrders} />
    </div>
  );
};

export default Orders;