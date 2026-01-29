"use client";

import React, { useState, useEffect } from 'react';
import { 
  Sheet, 
  SheetContent, 
  SheetHeader, 
  SheetTitle, 
  SheetFooter 
} from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { 
  Loader2, 
  Calendar, 
  Package, 
  ClipboardCheck, 
  ArrowRightLeft, 
  Edit, 
  CheckCircle, 
  Phone, 
  User, 
  History, 
  AlertCircle,
  Share2,
  MessageCircle
} from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { format, isAfter, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { showSuccess, showError } from '@/utils/toast';
import CreateOrderDialog from './CreateOrderDialog';
import { useQueryClient } from '@tanstack/react-query';
import { cn } from '@/lib/utils';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

interface OrderDetailsSheetProps {
  orderId: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onStatusUpdate: () => void;
}

const OrderDetailsSheet = ({ orderId, open, onOpenChange, onStatusUpdate }: OrderDetailsSheetProps) => {
  const queryClient = useQueryClient();
  const [order, setOrder] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [updating, setUpdating] = useState(false);
  const [isGeneratingContract, setIsGeneratingContract] = useState(false);

  useEffect(() => {
    if (open && orderId) {
      fetchOrderDetails();
    }
  }, [open, orderId]);

  const fetchOrderDetails = async () => {
    if (!orderId) return;
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('orders')
        .select(`
          *,
          order_items (
            quantity,
            products (name, price, type),
            assets (serial_number)
          )
        `)
        .eq('id', orderId)
        .single();

      if (error) throw error;
      setOrder(data);
    } catch (error: any) {
      showError("Erro ao carregar detalhes: " + error.message);
    } finally {
      setLoading(false);
    }
  };

  const handleShareContract = async () => {
    if (!order) return;
    
    try {
      setIsGeneratingContract(true);
      
      // 1. Geração do PDF
      const doc = new jsPDF();
      const pageWidth = doc.internal.pageSize.getWidth();
      
      // Cabeçalho
      doc.setFontSize(20);
      doc.setTextColor(30, 58, 138); // Blue-900
      doc.text("CONTRATO DE LOCAÇÃO - RENTAL PRO", pageWidth / 2, 20, { align: 'center' });
      
      // Dados do Cliente
      doc.setFontSize(12);
      doc.setTextColor(0, 0, 0);
      doc.text(`Pedido: #${order.id.split('-')[0]}`, 14, 35);
      doc.text(`Cliente: ${order.customer_name}`, 14, 42);
      doc.text(`CPF: ${order.customer_cpf || 'Não informado'}`, 14, 49);
      doc.text(`Telefone: ${order.customer_phone || 'Não informado'}`, 14, 56);
      
      // Datas
      doc.text(`Data de Retirada: ${format(parseISO(order.start_date), "dd/MM/yyyy")}`, 14, 66);
      doc.text(`Data de Devolução: ${format(parseISO(order.end_date), "dd/MM/yyyy")}`, 14, 73);

      // Tabela de Itens
      const tableData = order.order_items.map((item: any) => [
        item.products.name,
        item.quantity,
        item.assets?.serial_number || 'N/A',
        `R$ ${Number(item.products.price).toFixed(2)}`
      ]);

      autoTable(doc, {
        startY: 80,
        head: [['Produto', 'Qtd', 'Serial', 'Preço/Dia']],
        body: tableData,
        headStyles: { fillStyle: 'F', fillColor: [37, 99, 235] }, // Blue-600
      });

      // Total
      const finalY = (doc as any).lastAutoTable.finalY || 100;
      doc.setFontSize(14);
      doc.setFont("helvetica", "bold");
      doc.text(`VALOR TOTAL: R$ ${Number(order.total_amount).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`, pageWidth - 14, finalY + 15, { align: 'right' });

      // Rodapé / Assinatura
      doc.setFontSize(10);
      doc.setFont("helvetica", "normal");
      doc.text("__________________________________________", 14, finalY + 40);
      doc.text("Assinatura do Cliente", 14, finalY + 45);
      
      doc.text("__________________________________________", pageWidth - 80, finalY + 40);
      doc.text("Assinatura da Locadora", pageWidth - 80, finalY + 45);

      doc.setFontSize(8);
      doc.setTextColor(150, 150, 150);
      doc.text("Gerado via RentalPRO - Gestão Inteligente para Locadoras", pageWidth / 2, doc.internal.pageSize.getHeight() - 10, { align: 'center' });

      // 2. Upload para Supabase Storage
      const pdfBlob = doc.output('blob');
      const fileName = `contrato-${order.id.split('-')[0]}-${Date.now()}.pdf`;
      const filePath = `${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from('contracts')
        .upload(filePath, pdfBlob, {
          contentType: 'application/pdf',
          cacheControl: '3600',
          upsert: false
        });

      if (uploadError) throw uploadError;

      // 3. Obter URL Pública
      const { data: { publicUrl } } = supabase.storage
        .from('contracts')
        .getPublicUrl(filePath);

      // 4. Disparo no WhatsApp
      const cleanPhone = order.customer_phone.replace(/\D/g, '');
      const message = `Olá ${order.customer_name}! 📦
Aqui está o link do seu contrato de locação #${order.id.split('-')[0]}:
${publicUrl}

Por favor, confira e assine.

---
🔒 *Gerado via RentalPRO - Gestão Inteligente para Locadoras*`;

      const encodedMessage = encodeURIComponent(message);
      const whatsappLink = `https://wa.me/${cleanPhone}?text=${encodedMessage}`;
      
      // CORREÇÃO: Usar window.location.href para evitar bloqueio de pop-up no mobile
      window.location.href = whatsappLink;
      
      showSuccess("Contrato gerado e link enviado para o WhatsApp!");
    } catch (error: any) {
      console.error("Erro ao gerar contrato:", error);
      showError("Erro ao processar contrato: " + (error.message || "Tente novamente."));
    } finally {
      setIsGeneratingContract(false);
    }
  };

  const updateStatus = async (newStatus: string) => {
    if (!orderId) return;
    try {
      setUpdating(true);
      
      const updatePayload: any = { status: newStatus };
      
      const now = new Date().toISOString();
      if (newStatus === 'picked_up') {
        updatePayload.picked_up_at = now;
      } else if (newStatus === 'returned') {
        updatePayload.returned_at = now;
      }

      const { error } = await supabase
        .from('orders')
        .update(updatePayload)
        .eq('id', orderId);

      if (error) throw error;

      let successMessage = '';
      if (newStatus === 'reserved') successMessage = 'Reserva confirmada com sucesso!';
      if (newStatus === 'picked_up') successMessage = 'Retirada registrada com sucesso!';
      if (newStatus === 'returned') successMessage = 'Devolução registrada com sucesso!';

      showSuccess(successMessage);
      
      queryClient.invalidateQueries({ queryKey: ['dashboardMetrics'] });
      queryClient.invalidateQueries({ queryKey: ['pendingPickups'] });
      queryClient.invalidateQueries({ queryKey: ['pendingReturns'] });
      queryClient.invalidateQueries({ queryKey: ['orders'] });
      queryClient.invalidateQueries({ queryKey: ['timelineData'] });
      
      fetchOrderDetails();
      onStatusUpdate();
      
    } catch (error: any) {
      showError("Erro ao atualizar status: " + error.message);
    } finally {
      setUpdating(false);
    }
  };

  const getStatusConfig = (status: string) => {
    switch (status) {
      case 'draft': return { label: 'Rascunho', color: 'bg-gray-100 text-gray-800 border-gray-200' };
      case 'reserved': return { label: 'Reservado', color: 'bg-yellow-100 text-yellow-800 border-yellow-200' };
      case 'picked_up': return { label: 'Retirado', color: 'bg-blue-100 text-blue-800 border-blue-200' };
      case 'returned': return { label: 'Devolvido', color: 'bg-green-100 text-green-800 border-green-200' };
      default: return { label: status, color: 'bg-gray-100 text-gray-800' };
    }
  };

  if (!order && loading) {
    return (
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent className="sm:max-w-md flex items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
        </SheetContent>
      </Sheet>
    );
  }

  const statusConfig = order ? getStatusConfig(order.status) : { label: '', color: '' };
  const isOverdue = order?.returned_at && order?.end_date && isAfter(parseISO(order.returned_at), parseISO(order.end_date));

  const renderActionButton = () => {
    if (!order) return null;

    let buttonProps = {
      label: '',
      status: '',
      icon: null,
      color: 'bg-blue-600 hover:bg-blue-700',
    };

    switch (order.status) {
      case 'draft':
        buttonProps = {
          label: 'Confirmar Reserva',
          status: 'reserved',
          icon: <CheckCircle className="mr-2 h-5 w-5" />,
          color: 'bg-green-600 hover:bg-green-700',
        };
        break;
      case 'reserved':
        buttonProps = {
          label: 'Registrar Retirada/Check-out',
          status: 'picked_up',
          icon: <ClipboardCheck className="mr-2 h-5 w-5" />,
          color: 'bg-blue-600 hover:bg-blue-700',
        };
        break;
      case 'picked_up':
        buttonProps = {
          label: 'Registrar Devolução/Check-in',
          status: 'returned',
          icon: <ArrowRightLeft className="mr-2 h-5 w-5" />,
          color: 'bg-green-600 hover:bg-green-700',
        };
        break;
      case 'returned':
        return null;
      default:
        return null;
    }

    return (
      <Button 
        className={`w-full h-12 text-base ${buttonProps.color}`} 
        onClick={() => updateStatus(buttonProps.status)}
        disabled={updating}
      >
        {updating ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : buttonProps.icon}
        {buttonProps.label}
      </Button>
    );
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="sm:max-w-md flex flex-col h-full">
        <SheetHeader className="space-y-4">
          <div className="flex justify-between items-start">
            <div>
              <div className="flex items-center gap-2">
                <SheetTitle className="text-2xl">{order?.customer_name}</SheetTitle>
                <CreateOrderDialog orderId={orderId || undefined} onOrderCreated={() => { fetchOrderDetails(); onStatusUpdate(); }}>
                  <Button variant="ghost" size="icon" className="h-8 w-8 text-blue-600 hover:text-blue-700 hover:bg-blue-50">
                    <Edit className="h-4 w-4" />
                  </Button>
                </CreateOrderDialog>
              </div>
              <p className="text-xs font-mono text-muted-foreground">ID: #{order?.id.split('-')[0]}</p>
              
              <div className="mt-2 space-y-1 text-sm">
                {order?.customer_phone && (
                  <div className="flex items-center gap-2 text-gray-600">
                    <Phone className="h-4 w-4 text-blue-500" />
                    <a href={`tel:${order.customer_phone.replace(/\D/g, '')}`} className="hover:underline">
                      {order.customer_phone}
                    </a>
                  </div>
                )}
                {order?.customer_cpf && (
                  <div className="flex items-center gap-2 text-gray-600">
                    <User className="h-4 w-4 text-blue-500" />
                    <span>{order.customer_cpf}</span>
                  </div>
                )}
              </div>
            </div>
            <Badge className={statusConfig.color}>{statusConfig.label}</Badge>
          </div>
        </SheetHeader>

        <div className="flex-1 overflow-y-auto py-6 space-y-8">
          <div className="bg-blue-600 rounded-xl p-6 text-white shadow-lg shadow-blue-100">
            <p className="text-xs uppercase font-bold opacity-80 mb-1">Valor Total da Locação</p>
            <p className="text-3xl font-bold">R$ {Number(order?.total_amount || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</p>
          </div>

          {/* Botão de Enviar Contrato */}
          <div className="space-y-3">
             <Button 
                onClick={handleShareContract} 
                disabled={isGeneratingContract || loading}
                className="w-full h-14 bg-green-600 hover:bg-green-700 text-white font-bold gap-3 rounded-xl shadow-lg transition-all active:scale-95"
             >
                {isGeneratingContract ? (
                  <>
                    <Loader2 className="h-6 w-6 animate-spin" />
                    Gerando link do contrato...
                  </>
                ) : (
                  <>
                    <MessageCircle className="h-6 w-6" />
                    Enviar Contrato no WhatsApp
                  </>
                )}
             </Button>
          </div>

          <div className="space-y-3">
            <h3 className="text-sm font-semibold flex items-center gap-2">
              <Calendar className="h-4 w-4 text-blue-600" /> Período Agendado
            </h3>
            <div className="bg-gray-50 rounded-lg p-4 grid grid-cols-2 gap-4">
              <div>
                <p className="text-[10px] uppercase text-gray-500 font-bold">Início</p>
                <p className="font-medium text-sm">{order && format(new Date(order.start_date), "dd/MM/yyyy", { locale: ptBR })}</p>
              </div>
              <div>
                <p className="text-[10px] uppercase text-gray-500 font-bold">Fim</p>
                <p className="font-medium text-sm">{order && format(new Date(order.end_date), "dd/MM/yyyy", { locale: ptBR })}</p>
              </div>
            </div>
          </div>

          {(order?.picked_up_at || order?.returned_at) && (
            <div className="space-y-3">
              <h3 className="text-sm font-semibold flex items-center gap-2">
                <History className="h-4 w-4 text-blue-600" /> Histórico Real
              </h3>
              <div className="bg-white border rounded-lg p-4 space-y-3 shadow-sm">
                {order.picked_up_at && (
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-[10px] uppercase text-gray-400 font-bold">Check-out (Retirada)</p>
                      <p className="text-sm font-medium">
                        {format(parseISO(order.picked_up_at), "dd/MM 'às' HH:mm", { locale: ptBR })}
                      </p>
                    </div>
                    <ClipboardCheck className="h-5 w-5 text-blue-500" />
                  </div>
                )}
                {order.returned_at && (
                  <div className="flex items-center justify-between pt-2 border-t">
                    <div>
                      <p className="text-[10px] uppercase text-gray-400 font-bold">Check-in (Devolução)</p>
                      <p className={cn(
                        "text-sm font-medium flex items-center gap-2",
                        isOverdue ? "text-red-600" : "text-green-600"
                      )}>
                        {format(parseISO(order.returned_at), "dd/MM 'às' HH:mm", { locale: ptBR })}
                        {isOverdue && <AlertCircle className="h-3 w-3" title="Devolução em atraso" />}
                      </p>
                    </div>
                    <ArrowRightLeft className={cn("h-5 w-5", isOverdue ? "text-red-500" : "text-green-500")} />
                  </div>
                )}
              </div>
            </div>
          )}

          <div className="space-y-3">
            <h3 className="text-sm font-semibold flex items-center gap-2">
              <Package className="h-4 w-4 text-blue-600" /> Itens do Pedido
            </h3>
            <div className="border rounded-lg divide-y bg-white">
              {order?.order_items.map((item: any, idx: number) => (
                <div key={idx} className="p-4 flex justify-between items-center">
                  <div className="space-y-1">
                    <p className="font-medium text-sm">{item.products?.name}</p>
                    <p className="text-xs text-muted-foreground">
                      Unitário: R$ {Number(item.products?.price || 0).toFixed(2)}/dia
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-xs font-bold text-blue-600 bg-blue-50 px-2 py-1 rounded">
                      x{item.quantity}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        <SheetFooter className="mt-auto pt-6 border-t sm:flex-col gap-2">
          {renderActionButton()}
          <Button variant="outline" className="w-full h-12" onClick={() => onOpenChange(false)}>
            Fechar Painel
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
};

export default OrderDetailsSheet;