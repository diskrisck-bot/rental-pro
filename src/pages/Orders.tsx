"use client";

import React, { useState, useEffect } from 'react';
import { Plus, Search, Loader2, Download, MessageCircle, CheckCircle, DollarSign, Clock, Zap, Calendar } from 'lucide-react';
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
import { useSearchParams } from 'react-router-dom'; // Import useSearchParams

const getStatusBadge = (status: string) => {
  switch (status) {
    case 'draft': return <Badge variant="outline" className="bg-gray-100">Rascunho</Badge>;
    case 'reserved': return <Badge className="bg-yellow-100 text-yellow-800 border-yellow-200">Reservado</Badge>;
    case 'picked_up': return <Badge className="bg-blue-100 text-blue-800 border-blue-200">Retirado</Badge>;
    case 'returned': return <Badge className="bg-green-100 text-green-800 border-green-200">Devolvido</Badge>;
    default: return <Badge>{status}</Badge>;
  }
};

const getPaymentTimingBadge = (timing: string) => {
  if (timing === 'paid_on_pickup') {
    return (
      <Badge className="bg-green-50 text-green-700 border-green-200 hover:bg-green-100">
        <DollarSign className="h-3 w-3 mr-1" /> Pago (Retirada)
      </Badge>
    );
  }
  if (timing === 'pay_on_return') {
    return (
      <Badge className="bg-orange-50 text-orange-700 border-orange-200 hover:bg-orange-100">
        <Clock className="h-3 w-3 mr-1" /> A Pagar (Devolução)
      </Badge>
    );
  }
  return null;
};

const getFulfillmentTypeBadge = (type: string) => {
  if (type === 'immediate') {
    return (
      <Badge variant="secondary" className="bg-orange-50 text-orange-700 border-orange-200 hover:bg-orange-100">
        <Zap className="h-3 w-3 mr-1" /> Imediata
      </Badge>
    );
  }
  if (type === 'reservation') {
    return (
      <Badge variant="secondary" className="bg-blue-50 text-blue-700 border-blue-200 hover:bg-blue-100">
        <Calendar className="h-3 w-3 mr-1" /> Reserva
      </Badge>
    );
  }
  return null;
};

// Função auxiliar para gerar o link do WhatsApp (copiada de OrderDetailsSheet)
const getWhatsappLink = (order: any, isSigned: boolean) => {
    if (!order) return '#';
    
    const signLink = `${window.location.origin}/sign/${order.id}`;
    
    let messageText = '';
    if (isSigned) {
        messageText = `Olá ${order.customer_name}! ✅
Aqui está sua via do contrato assinado #${order.id.split('-')[0]}:
${signLink}
`;
    } else {
        messageText = `Olá ${order.customer_name}! 📦
Aqui está o link para visualizar e assinar seu contrato de locação #${order.id.split('-')[0]}:
${signLink}

Por favor, acesse e assine digitalmente.
`;
    }

    const encodedMessage = encodeURIComponent(messageText);
    
    let phone = order.customer_phone ? order.customer_phone.replace(/\D/g, '') : '';
    // Adiciona DDI 55 se o número tiver 10 ou 11 dígitos (formato brasileiro)
    if (phone.length === 10 || phone.length === 11) {
      phone = `55${phone}`;
    }
    
    // Se o número for inválido ou vazio, usa wa.me/ (que abre a lista de contatos)
    const baseUrl = phone ? `https://wa.me/${phone}` : `https://wa.me/`;
    
    return `${baseUrl}?text=${encodedMessage}`;
};

const Orders = () => {
  const [orders, setOrders] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [selectedOrderId, setSelectedOrderId] = useState<string | null>(null);
  const [isSheetOpen, setIsSheetOpen] = useState(false);
  
  const [searchParams, setSearchParams] = useSearchParams(); // Hook para ler URL params

  const fetchOrders = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('orders')
        .select(`
          *,
          order_items (
            quantity,
            products (name)
          )
        `)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setOrders(data || []);
    } catch (error: any) {
      showError("Erro ao carregar pedidos: " + error.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchOrders();
  }, []);
  
  // Efeito para lidar com a abertura do sheet via URL (fix 1)
  useEffect(() => {
    const idFromUrl = searchParams.get('id');
    if (idFromUrl) {
      setSelectedOrderId(idFromUrl);
      setIsSheetOpen(true);
      // Limpa o parâmetro da URL para evitar reabertura
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
      order.id?.toLowerCase().includes(searchTerm) ||
      order.customer_cpf?.includes(searchTerm) ||
      order.customer_phone?.includes(searchTerm)
    );
  });

  return (
    <div className="p-4 md:p-8 space-y-6">
      {/* Ajuste de Cabeçalho: flex-col no mobile, flex-row no desktop */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold tracking-tight">Pedidos</h1>
          <p className="text-muted-foreground">Acompanhe e gerencie todos os aluguéis.</p>
        </div>
        
        <CreateOrderDialog onOrderCreated={fetchOrders}>
          <Button className="bg-blue-600 hover:bg-blue-700 w-full md:w-auto">
            <Plus className="mr-2 h-4 w-4" /> Novo Pedido
          </Button>
        </CreateOrderDialog>
      </div>

      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
        <Input 
          placeholder="Buscar por cliente, ID, CPF ou Telefone..." 
          className="pl-10" 
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      <div className="border rounded-xl bg-white overflow-hidden shadow-sm">
        <div className="overflow-x-auto"> {/* Garantido overflow-x-auto */}
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>ID / Assinatura</TableHead>
                <TableHead>Cliente</TableHead>
                <TableHead>Tipo</TableHead> {/* NOVA COLUNA */}
                <TableHead>Período</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Pagamento</TableHead>
                <TableHead>Total</TableHead>
                <TableHead className="text-right">Ações Rápidas</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={8} className="h-24 text-center">
                    <Loader2 className="h-6 w-6 animate-spin mx-auto text-blue-600" />
                  </TableCell>
                </TableRow>
              ) : filteredOrders.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={8} className="h-24 text-center text-muted-foreground">
                    Nenhum pedido encontrado.
                  </TableCell>
                </TableRow>
              ) : (
                filteredOrders.map((order) => {
                  const isSigned = !!order.signed_at;
                  const whatsappLink = getWhatsappLink(order, isSigned);
                  
                  return (
                    <TableRow key={order.id} className="hover:bg-gray-50 cursor-pointer" onClick={() => handleViewDetails(order.id)}>
                      <TableCell className="font-medium">
                        <div className="font-mono text-[10px] text-gray-400 mb-1">
                          #{order.id.split('-')[0]}
                        </div>
                        {isSigned ? (
                          <Badge className="bg-green-100 text-green-800 border-green-200">
                            <CheckCircle className="h-3 w-3 mr-1" /> Assinado
                          </Badge>
                        ) : (
                          <Badge className="bg-orange-100 text-orange-800 border-orange-200">
                            Aguardando Assinatura
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell className="font-medium">{order.customer_name}</TableCell>
                      <TableCell>{getFulfillmentTypeBadge(order.fulfillment_type)}</TableCell> {/* NOVA CÉLULA */}
                      <TableCell className="text-sm">
                        {format(new Date(order.start_date), 'dd/MM')} - {format(new Date(order.end_date), 'dd/MM')}
                      </TableCell>
                      <TableCell>{getStatusBadge(order.status)}</TableCell>
                      <TableCell>{getPaymentTimingBadge(order.payment_timing)}</TableCell>
                      <TableCell className="font-semibold text-blue-600">
                        R$ {Number(order.total_amount || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-2">
                          {isSigned ? (
                            <>
                              {/* Botão 1: Baixar Contrato (Abre detalhes para download) */}
                              <Button 
                                variant="outline" 
                                size="sm" 
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleViewDetails(order.id); // Abre o painel onde o download é possível
                                }}
                                className="text-green-600 border-green-200 hover:bg-green-50"
                              >
                                <Download className="h-4 w-4" />
                              </Button>
                              {/* Botão 2: Reenviar no WhatsApp */}
                              <a 
                                href={whatsappLink}
                                target="_blank"
                                rel="noopener noreferrer"
                                onClick={(e) => e.stopPropagation()}
                              >
                                <Button variant="ghost" size="sm" className="text-green-600 hover:bg-green-50">
                                  <MessageCircle className="h-4 w-4" />
                                </Button>
                              </a>
                            </>
                          ) : (
                            // Cenário A: Enviar para Assinar
                            <a 
                              href={whatsappLink}
                              target="_blank"
                              rel="noopener noreferrer"
                              onClick={(e) => e.stopPropagation()}
                            >
                              <Button variant="secondary" size="sm" className="bg-blue-50 text-blue-600 hover:bg-blue-100">
                                <MessageCircle className="h-4 w-4 mr-1" /> Enviar
                              </Button>
                            </a>
                          )}
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

      <OrderDetailsSheet 
        orderId={selectedOrderId}
        open={isSheetOpen}
        onOpenChange={setIsSheetOpen}
        onStatusUpdate={fetchOrders}
      />
    </div>
  );
};

export default Orders;