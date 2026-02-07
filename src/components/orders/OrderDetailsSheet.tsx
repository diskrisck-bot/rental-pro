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
  MessageCircle,
  Download,
  Building,
  AlertTriangle,
  XCircle // Novo ícone para Cancelar
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

interface OwnerProfile {
  business_name: string | null;
  business_cnpj: string | null;
  business_address: string | null;
  business_phone: string | null;
  signature_url: string | null;
}

const OrderDetailsSheet = ({ orderId, open, onOpenChange, onStatusUpdate }: OrderDetailsSheetProps) => {
  const queryClient = useQueryClient();
  const [order, setOrder] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [updating, setUpdating] = useState(false);
  const [isGeneratingContract, setIsGeneratingContract] = useState(false);
  const [ownerProfile, setOwnerProfile] = useState<OwnerProfile | null>(null);

  useEffect(() => {
    if (open && orderId) {
      fetchOrderDetails();
    }
  }, [open, orderId]);

  const fetchOrderDetails = async () => {
    if (!orderId) return;
    try {
      setLoading(true);
      
      // 1. Fetch Order Data
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
      
      // 2. Fetch Owner Profile (including signature and business details)
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        const { data: profileData, error: profileError } = await supabase
          .from('profiles')
          .select('business_name, business_cnpj, business_address, business_phone, signature_url')
          .eq('id', user.id) // Busca o perfil do usuário logado
          .single();
          
        if (profileError && profileError.code !== 'PGRST116') {
          console.warn("Could not fetch owner profile details:", profileError.message);
        } else {
          setOwnerProfile(profileData as OwnerProfile);
        }
      }

    } catch (error: any) {
      showError("Erro ao carregar detalhes: " + error.message);
    } finally {
      setLoading(false);
    }
  };

  // Função auxiliar para gerar o link do WhatsApp
  const getWhatsappLink = (order: any) => {
    if (!order) return '#';
    
    const signLink = `${window.location.origin}/sign/${order.id}`;
    
    const messageText = `Olá ${order.customer_name}! 📦
Aqui está o link para visualizar e assinar seu contrato de locação #${order.id.split('-')[0]}:
${signLink}

Por favor, acesse e assine digitalmente.

---
🔒 *Gerado via RentalPRO - Gestão Inteligente para Locadoras*`;

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
  
  // FIX: Definindo a função handleShareContract
  const handleShareContract = (e: React.MouseEvent) => {
    // A tag handles the navigation, we just provide feedback
    showSuccess("Link de assinatura copiado e WhatsApp aberto!");
  };

  const generatePDF = async (order: any, ownerProfile: OwnerProfile | null, isFinal: boolean) => {
    const doc = new jsPDF();
    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();
    
    const profile = ownerProfile || {};
    
    // Função para adicionar rodapé com marca d'água
    const addWatermark = (doc: jsPDF, pageNumber: number) => {
      doc.setPage(pageNumber);
      doc.setFontSize(8);
      doc.setTextColor(150, 150, 150); // Cinza claro
      const watermarkText = "Gerado e Assinado digitalmente via RentalPro (rentalpro.com.br)";
      const textWidth = doc.getStringUnitWidth(watermarkText) * doc.getFontSize() / doc.internal.scaleFactor;
      const x = (pageWidth - textWidth) / 2;
      const y = pageHeight - 10;
      
      doc.text(watermarkText, pageWidth / 2, y, { align: 'center' });
      
      // Adicionar link clicável (URL: https://www.dyad.sh/ - usando dyad como placeholder)
      const linkUrl = "https://www.dyad.sh/"; 
      doc.link(x, y - 3, textWidth, 5, { url: linkUrl });
    };
    
    // --- 1. Conteúdo do Contrato (Página 1) ---
    
    // Cabeçalho
    doc.setFontSize(20);
    doc.setTextColor(30, 58, 138); // Blue-900
    doc.text("CONTRATO DE LOCAÇÃO", pageWidth / 2, 20, { align: 'center' });
    
    // Dados do Locador (Empresa)
    doc.setFontSize(12);
    doc.setTextColor(0, 0, 0);
    doc.setFont("helvetica", "bold");
    doc.text("LOCADOR (EMPRESA)", 14, 35);
    doc.setFont("helvetica", "normal");
    doc.text(`Nome: ${profile.business_name || 'N/A'}`, 14, 42);
    doc.text(`CNPJ/CPF: ${profile.business_cnpj || 'N/A'}`, 14, 49);
    doc.text(`Endereço: ${profile.business_address || 'N/A'}`, 14, 56);
    doc.text(`Telefone: ${profile.business_phone || 'N/A'}`, 14, 63);
    
    // Dados do Locatário (Cliente)
    doc.setFont("helvetica", "bold");
    doc.text("LOCATÁRIO (CLIENTE)", pageWidth / 2 + 10, 35);
    doc.setFont("helvetica", "normal");
    doc.text(`Nome: ${order.customer_name}`, pageWidth / 2 + 10, 42);
    doc.text(`CPF: ${order.customer_cpf || 'N/A'}`, pageWidth / 2 + 10, 49);
    doc.text(`Telefone: ${order.customer_phone || 'N/A'}`, pageWidth / 2 + 10, 56);
    
    // Período e Valor
    doc.setFontSize(12);
    doc.text(`Pedido: #${order.id.split('-')[0]}`, 14, 75);
    doc.text(`Período: ${format(parseISO(order.start_date), "dd/MM/yyyy")} a ${format(parseISO(order.end_date), "dd/MM/yyyy")}`, 14, 82);

    // Tabela de Itens
    const tableData = order.order_items.map((item: any) => [
      item.products.name,
      item.quantity,
      item.assets?.serial_number || 'N/A',
      `R$ ${Number(item.products.price).toFixed(2)}`
    ]);

    autoTable(doc, {
      startY: 90,
      head: [['Produto', 'Qtd', 'Serial', 'Preço/Dia']],
      body: tableData,
      headStyles: { fillStyle: 'F', fillColor: [37, 99, 235] }, // Blue-600
    });

    // Total
    const finalY = (doc as any).lastAutoTable.finalY || 120;
    doc.setFontSize(14);
    doc.setFont("helvetica", "bold");
    doc.text(`VALOR TOTAL: R$ ${Number(order.total_amount).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`, pageWidth - 14, finalY + 15, { align: 'right' });

    // Assinaturas (Locador e Locatário)
    let currentY = finalY + 40;
    
    // Assinatura do Locador (Dono)
    doc.setFontSize(10);
    doc.setFont("helvetica", "normal");
    doc.text("__________________________________________", pageWidth - 80, currentY);
    doc.text("Assinatura do Locador (RentalPro)", pageWidth - 80, currentY + 5);
    
    if (profile.signature_url) {
      // Desenha a assinatura do Locador
      doc.addImage(profile.signature_url, 'PNG', pageWidth - 80, currentY - 25, 60, 25);
    } else {
      // Placeholder se não houver assinatura padrão
      doc.setFontSize(12);
      doc.setFont("times", "italic");
      doc.text(profile.business_name || 'Locador', pageWidth - 80, currentY - 10);
      doc.setFont("helvetica", "normal");
    }

    // Assinatura do Locatário (Cliente)
    doc.setFontSize(10);
    doc.setFont("helvetica", "normal");
    doc.text("__________________________________________", 14, currentY);
    doc.text("Assinatura do Locatário (Cliente)", 14, currentY + 5);
    
    if (order.signature_image) {
      // Desenha a assinatura do Locatário
      doc.addImage(order.signature_image, 'PNG', 14, currentY - 25, 60, 25);
    } else {
      doc.setFontSize(12);
      doc.setFont("times", "italic");
      doc.text("Aguardando Assinatura", 14, currentY - 10);
      doc.setFont("helvetica", "normal");
    }
    
    // --- 2. Certificado de Assinatura (Página 2, se assinado) ---
    if (isFinal && order.signed_at) {
      doc.addPage();
      
      doc.setFontSize(18);
      doc.setTextColor(30, 58, 138);
      doc.text("CERTIFICADO DE ASSINATURA ELETRÔNICA", pageWidth / 2, 20, { align: 'center' });
      
      doc.setFontSize(12);
      doc.setTextColor(0, 0, 0);
      
      const auditY = 40;
      
      doc.text("Este documento foi assinado digitalmente pelo Locatário, conferindo validade jurídica conforme a Medida Provisória nº 2.200-2/2001.", 14, auditY);
      
      doc.setFontSize(10);
      doc.setFont("helvetica", "bold");
      doc.text("Detalhes da Assinatura:", 14, auditY + 15);
      
      doc.setFont("helvetica", "normal");
      doc.text(`ID do Documento (Hash): ${order.id}`, 14, auditY + 25);
      doc.text(`Assinado por: ${order.customer_name} (Locatário)`, 14, auditY + 35);
      doc.text(`Data/Hora da Assinatura: ${format(parseISO(order.signed_at), "dd/MM/yyyy 'às' HH:mm:ss", { locale: ptBR })}`, 14, auditY + 45);
      doc.text(`IP de Origem: ${order.signer_ip || 'N/A'}`, 14, auditY + 55);
      doc.text(`Dispositivo (User Agent): ${order.signer_user_agent || 'N/A'}`, 14, auditY + 65, { maxWidth: pageWidth - 28 });
    }

    // Adicionar marca d'água em todas as páginas
    const totalPages = doc.internal.pages.length;
    for (let i = 1; i <= totalPages; i++) {
      addWatermark(doc, i);
    }

    return doc;
  };

  const handleDownloadFinalPDF = async () => {
    if (!order) return;
    try {
      setIsGeneratingContract(true);
      // Passa o ownerProfile para a função de geração
      const doc = await generatePDF(order, ownerProfile, true); 
      doc.save(`contrato-assinado-${order.id.split('-')[0]}.pdf`);
      showSuccess("Download do contrato finalizado iniciado.");
    } catch (error: any) {
      showError("Erro ao gerar PDF final: " + error.message);
    } finally {
      setIsGeneratingContract(false);
    }
  };

  const updateStatus = async (newStatus: string) => {
    if (!orderId || !order) return;
    
    const isSigned = !!order.signed_at;
    
    // 3. Bloqueio de Ação se não estiver assinado e o status for de progressão
    if (!isSigned && (newStatus === 'reserved' || newStatus === 'picked_up')) {
      showError("É necessário coletar a assinatura do cliente antes de liberar o pedido.");
      return;
    }

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
      if (newStatus === 'pending_signature') successMessage = 'Status alterado para Aguardando Assinatura.';
      if (newStatus === 'reserved') successMessage = 'Reserva confirmada com sucesso!';
      if (newStatus === 'picked_up') successMessage = 'Retirada registrada com sucesso!';
      if (newStatus === 'returned') successMessage = 'Devolução registrada com sucesso!';

      showSuccess(successMessage);
      
      // Invalidações
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
  
  const handleCancelOrder = async () => {
    if (!orderId) return;
    
    const confirmation = window.confirm("Tem certeza que deseja CANCELAR este pedido? O estoque reservado será liberado imediatamente.");
    
    if (!confirmation) return;
    
    try {
      setUpdating(true);
      
      const { error } = await supabase
        .from('orders')
        .update({ status: 'canceled' })
        .eq('id', orderId);
        
      if (error) throw error;
      
      showSuccess("Pedido cancelado com sucesso! Estoque liberado.");
      
      // Invalidações para liberar o estoque e atualizar listas
      queryClient.invalidateQueries({ queryKey: ['dashboardMetrics'] });
      queryClient.invalidateQueries({ queryKey: ['pendingPickups'] });
      queryClient.invalidateQueries({ queryKey: ['pendingReturns'] });
      queryClient.invalidateQueries({ queryKey: ['orders'] });
      queryClient.invalidateQueries({ queryKey: ['timelineData'] });
      
      onOpenChange(false); // Fecha o modal
      onStatusUpdate(); // Atualiza a lista de pedidos
      
    } catch (error: any) {
      showError("Erro ao cancelar pedido: " + error.message);
    } finally {
      setUpdating(false);
    }
  };

  const getStatusConfig = (status: string) => {
    switch (status) {
      case 'draft': return { label: 'Rascunho', color: 'bg-gray-100 text-gray-800 border-gray-200' };
      case 'pending_signature': return { label: 'Aguardando Assinatura', color: 'bg-yellow-100 text-yellow-800 border-yellow-200' };
      case 'reserved': return { label: 'Reservado', color: 'bg-blue-50 text-blue-700 border-blue-200' };
      case 'picked_up': return { label: 'Em Andamento', color: 'bg-blue-100 text-blue-800 border-blue-200' };
      case 'returned': return { label: 'Concluído', color: 'bg-green-100 text-green-800 border-green-200' };
      case 'canceled': return { label: 'Cancelado', color: 'bg-red-50 text-red-700 border-red-200' }; // Novo status
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
  const isSigned = !!order?.signed_at;
  const isPendingSignature = order?.status === 'pending_signature';
  const isCanceled = order?.status === 'canceled';
  const isCompleted = order?.status === 'returned';
  
  // Se o pedido estiver cancelado ou concluído, não deve haver botão de ação principal
  const isActionDisabled = isCanceled || isCompleted;

  const renderActionButton = () => {
    if (!order || isActionDisabled) return null;

    let buttonProps = {
      label: '',
      status: '',
      icon: null,
      color: 'bg-blue-600 hover:bg-blue-700',
      disabled: false,
    };

    // Se estiver aguardando assinatura, o botão principal deve ser para confirmar a reserva
    if (isPendingSignature) {
        buttonProps = {
            label: 'Confirmar Reserva',
            status: 'reserved',
            icon: <CheckCircle className="mr-2 h-5 w-5" />,
            color: 'bg-green-600 hover:bg-green-700',
            disabled: !isSigned, // Bloqueado se não estiver assinado
        };
    } else if (order.status === 'reserved') {
        buttonProps = {
            label: 'Registrar Retirada/Check-out',
            status: 'picked_up',
            icon: <ClipboardCheck className="mr-2 h-5 w-5" />,
            color: 'bg-blue-600 hover:bg-blue-700',
            disabled: !isSigned, // Bloqueado se não estiver assinado
        };
    } else if (order.status === 'picked_up') {
        buttonProps = {
            label: 'Registrar Devolução/Check-in',
            status: 'returned',
            icon: <ArrowRightLeft className="mr-2 h-5 w-5" />,
            color: 'bg-green-600 hover:bg-green-700',
            disabled: false,
        };
    } else if (order.status === 'draft') {
        // Rascunhos não devem ter botão de ação principal aqui, pois o fluxo é via modal de edição.
        return null;
    } else {
        return null;
    }

    return (
      <Button 
        className={`w-full h-12 text-base ${buttonProps.color}`} 
        onClick={() => updateStatus(buttonProps.status)}
        disabled={updating || buttonProps.disabled}
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
                {/* Permite editar apenas se for rascunho ou pendente de assinatura */}
                {(order?.status === 'draft' || isPendingSignature) && (
                    <CreateOrderDialog orderId={orderId || undefined} onOrderCreated={() => { fetchOrderDetails(); onStatusUpdate(); }}>
                      <Button variant="ghost" size="icon" className="h-8 w-8 text-blue-600 hover:text-blue-700 hover:bg-blue-50">
                        <Edit className="h-4 w-4" />
                      </Button>
                    </CreateOrderDialog>
                )}
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

          {/* Alerta de Assinatura Pendente */}
          {!isSigned && !isCanceled && !isCompleted && (
            <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-4 text-sm text-yellow-800 flex items-center gap-3">
              <AlertTriangle className="h-5 w-5 flex-shrink-0" />
              <p className="font-semibold">Contrato não assinado.</p>
            </div>
          )}
          
          {/* Alerta de Cancelado */}
          {isCanceled && (
            <div className="bg-red-50 border border-red-200 rounded-xl p-4 text-sm text-red-800 flex items-center gap-3">
              <XCircle className="h-5 w-5 flex-shrink-0" />
              <p className="font-semibold">Este pedido foi cancelado. O estoque foi liberado.</p>
            </div>
          )}

          {/* Botão de Enviar Contrato (AGORA É UM LINK <a>) */}
          {!isCanceled && (
            <div className="space-y-3">
               <a 
                  href={getWhatsappLink(order)}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={handleShareContract} // Agora definido
                  className={cn(
                    "w-full h-14 bg-green-600 hover:bg-green-700 text-white font-bold gap-3 rounded-xl shadow-lg transition-all active:scale-95",
                    "inline-flex items-center justify-center text-base", // Estiliza como botão
                    loading && "opacity-50 cursor-not-allowed"
                  )}
                  aria-disabled={loading}
               >
                  <MessageCircle className="h-6 w-6" />
                  {isSigned ? 'Reenviar Contrato Assinado' : 'Enviar Link de Assinatura'}
               </a>
               
               {isSigned && (
                  <Button 
                    onClick={handleDownloadFinalPDF} 
                    disabled={isGeneratingContract || loading}
                    variant="outline"
                    className="w-full h-12 border-green-500 text-green-600 hover:bg-green-50"
                  >
                    {isGeneratingContract ? <Loader2 className="h-5 w-5 mr-2 animate-spin" /> : <Download className="h-5 w-5 mr-2" />}
                    Baixar Contrato Assinado
                  </Button>
               )}
            </div>
          )}

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
          {/* Mensagem de bloqueio se for necessário */}
          {isPendingSignature && !isSigned && (
            <div className="text-center text-sm text-red-600 p-2 border border-red-200 rounded-lg bg-red-50">
              <AlertTriangle className="h-4 w-4 inline mr-1" /> Assinatura pendente para liberar.
            </div>
          )}
          
          {/* Ação Principal */}
          {renderActionButton()}
          
          <div className="flex justify-between gap-2 w-full">
            {/* Botão de Cancelamento (Visível se não estiver concluído ou cancelado) */}
            {!isActionDisabled && (
              <Button 
                variant="ghost" 
                className="w-full h-12 text-red-600 hover:bg-red-50" 
                onClick={handleCancelOrder}
                disabled={updating}
              >
                {updating ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <XCircle className="mr-2 h-5 w-5" />}
                Cancelar Pedido
              </Button>
            )}
            
            <Button variant="outline" className={cn("h-12", isActionDisabled ? "w-full" : "w-1/2")} onClick={() => onOpenChange(false)}>
              Fechar Painel
            </Button>
          </div>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
};

export default OrderDetailsSheet;