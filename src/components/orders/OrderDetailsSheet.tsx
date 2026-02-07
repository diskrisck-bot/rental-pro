"use client";

import React, { useState, useEffect } from 'react';
import { 
  Sheet, SheetContent, SheetHeader, SheetTitle, SheetFooter 
} from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { 
  Loader2, Calendar, Package, ClipboardCheck, ArrowRightLeft, Edit, 
  CheckCircle, Phone, User, History, AlertCircle, MessageCircle, 
  Download, AlertTriangle, XCircle 
} from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { format, isAfter, parseISO, differenceInDays } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { showSuccess, showError } from '@/utils/toast';
import CreateOrderDialog from './CreateOrderDialog';
import { useQueryClient } from '@tanstack/react-query';
import { cn } from '@/lib/utils';
import jsPDF from 'jspdf';

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
  business_city: string | null;
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
      
      const { data, error } = await supabase
        .from('orders')
        .select(`
          *,
          order_items (
            quantity,
            products (name, price, replacement_value),
            assets (serial_number)
          )
        `)
        .eq('id', orderId)
        .single();

      if (error) throw error;
      setOrder(data);
      
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        const { data: profileData, error: profileError } = await supabase
          .from('profiles')
          .select('business_name, business_cnpj, business_address, business_phone, business_city, signature_url')
          .eq('id', user.id)
          .single();
          
        if (!profileError) {
          setOwnerProfile(profileData as OwnerProfile);
        }
      }

    } catch (error: any) {
      showError("Erro ao carregar detalhes.");
    } finally {
      setLoading(false);
    }
  };

  const getWhatsappLink = (order: any) => {
    if (!order) return '#';
    const signLink = `${window.location.origin}/contract/${order.id}`;
    const messageText = `Olá ${order.customer_name}! 📦\nSegue o link do seu contrato de locação #${order.id.split('-')[0]}:\n${signLink}\n\nFavor assinar digitalmente.`;
    const encodedMessage = encodeURIComponent(messageText);
    let phone = order.customer_phone ? order.customer_phone.replace(/\D/g, '') : '';
    if (phone.length >= 10) phone = `55${phone}`;
    return `https://wa.me/${phone}?text=${encodedMessage}`;
  };

  // --- GERADOR DE PDF PROFISSIONAL (Com Assinaturas Visuais) ---
  const generatePDF = async (order: any, owner: OwnerProfile | null) => {
    const doc = new jsPDF({ format: 'a4', unit: 'mm' });
    
    const locador = {
      name: owner?.business_name || "Locadora",
      cnpj: owner?.business_cnpj || "CNPJ n/a",
      address: owner?.business_address || "Endereço n/a",
      city: owner?.business_city || "Cidade da Empresa"
    };

    const dias = differenceInDays(parseISO(order.end_date), parseISO(order.start_date)) || 1;
    const formatMoney = (val: any) => Number(val).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
    
    const listaItens = order.order_items.map((i: any) => 
      `• ${i.quantity}x ${i.products?.name} (Reposição: ${formatMoney(i.products?.replacement_value || 0)})`
    ).join('\n');

    const header = "CONTRATO DE LOCAÇÃO DE BENS MÓVEIS";
    const intro = `LOCADOR: ${locador.name}, CNPJ ${locador.cnpj}, com sede em ${locador.address}.\n\nLOCATÁRIO: ${order.customer_name}, CPF/CNPJ ${order.customer_cpf || 'Não informado'}, residente em ${order.customer_address || 'Endereço não informado'}.`;
    
    const clauses = [
      { title: "1. DO OBJETO", text: `Locação dos bens: \n${listaItens}` },
      { title: "2. DO PRAZO", text: `Vigência de ${dias} dias: Início ${format(parseISO(order.start_date), "dd/MM/yyyy")} e Término ${format(parseISO(order.end_date), "dd/MM/yyyy")}.` },
      { title: "3. DO VALOR", text: `Total: ${formatMoney(order.total_amount)}. Pagamento via: ${order.payment_method || 'A combinar'}.` },
      { title: "4. REPOSIÇÃO", text: `Em caso de dano ou perda, o LOCATÁRIO indenizará o LOCADOR nos valores de reposição citados na Cláusula 1.` },
      { title: "5. DO FORO", text: `Eleito o foro de ${locador.city} para dirimir quaisquer dúvidas.` }
    ];

    const footer = `${locador.city}, ${format(new Date(), "dd 'de' MMMM 'de' yyyy", { locale: ptBR })}.`;

    const margin = 20;
    const pageWidth = 210;
    const maxLineWidth = pageWidth - (margin * 2);
    let currentY = 20;

    const printText = (text: string, size = 10, style = "normal", align = "left") => {
      doc.setFont("helvetica", style);
      doc.setFontSize(size);
      const lines = doc.splitTextToSize(text, maxLineWidth);
      if (currentY + (lines.length * 5) > 280) { doc.addPage(); currentY = 20; }
      doc.text(lines, align === "center" ? pageWidth / 2 : margin, currentY, { align: align as any });
      currentY += (lines.length * 4) + 4;
    };

    printText(header, 14, "bold", "center");
    currentY += 5;
    printText(intro, 10, "normal", "justify");
    currentY += 5;

    clauses.forEach(c => {
      printText(c.title, 10, "bold", "left");
      printText(c.text, 10, "normal", "left");
      currentY += 2;
    });

    currentY += 5;
    printText(footer, 10, "normal", "left");

    // --- ÁREA DE ASSINATURAS (Página 1) ---
    currentY += 30; // Espaço maior para as imagens
    if (currentY > 250) { doc.addPage(); currentY = 40; }
    
    const yLinha = currentY;
    const yImagem = currentY - 25; // Posição da imagem acima da linha

    // Assinatura do Locador (Dono)
    if (owner?.signature_url) {
      try {
        doc.addImage(owner.signature_url, 'PNG', margin + 5, yImagem, 50, 25);
      } catch (e) { console.error("Erro na assinatura do locador", e); }
    }
    doc.line(margin, yLinha, margin + 70, yLinha);
    doc.setFontSize(8); doc.text("LOCADOR", margin, yLinha + 5);
    
    // Assinatura do Locatário (Cliente)
    if (order.signature_image) {
        doc.addImage(order.signature_image, 'PNG', 120 + 5, yImagem, 50, 25);
    }
    doc.line(120, yLinha, 190, yLinha);
    doc.text("LOCATÁRIO", 120, yLinha + 5);

    // --- PÁGINA 2: AUDITORIA ---
    if (order.signed_at) {
      doc.addPage();
      currentY = 20;
      printText("CERTIFICADO DE ASSINATURA DIGITAL", 14, "bold", "center");
      currentY += 10;
      
      doc.setDrawColor(200);
      doc.setFillColor(245, 245, 245);
      doc.rect(margin, currentY, maxLineWidth, 60, 'FD');
      currentY += 10;
      
      const addLog = (l: string, v: string) => {
        doc.setFont("courier", "bold"); doc.text(l, margin + 5, currentY);
        doc.setFont("courier", "normal"); doc.text(v, margin + 45, currentY);
        currentY += 7;
      };

      addLog("ID:", order.id);
      addLog("Data:", format(parseISO(order.signed_at), "dd/MM/yyyy HH:mm:ss"));
      addLog("IP:", order.signer_ip || "N/A");
      addLog("Agent:", (order.signer_user_agent || "N/A").substring(0, 30) + "...");

      if (order.signature_image) {
        currentY += 5;
        doc.text("Rubrica:", margin + 5, currentY);
        doc.addImage(order.signature_image, 'PNG', margin + 5, currentY + 5, 40, 20);
      }
    }

    return doc;
  };

  const handleDownloadFinalPDF = async () => {
    if (!order) return;
    try {
      setIsGeneratingContract(true);
      const doc = await generatePDF(order, ownerProfile);
      doc.save(`Contrato-${order.id.split('-')[0]}.pdf`);
      showSuccess("Download iniciado.");
    } catch (error: any) {
      showError("Erro ao gerar PDF.");
    } finally {
      setIsGeneratingContract(false);
    }
  };

  const updateStatus = async (newStatus: string) => {
    if (!orderId) return;
    
    if (newStatus !== 'canceled' && !order.signed_at && newStatus !== 'pending_signature') {
      showError("Assinatura obrigatória para avançar.");
      return;
    }

    try {
      setUpdating(true);
      const payload: any = { status: newStatus };
      const now = new Date().toISOString();
      if (newStatus === 'picked_up') payload.picked_up_at = now;
      if (newStatus === 'returned') payload.returned_at = now;

      const { error } = await supabase.from('orders').update(payload).eq('id', orderId);
      if (error) throw error;

      showSuccess("Status atualizado!");
      queryClient.invalidateQueries({ queryKey: ['orders'] });
      fetchOrderDetails();
      onStatusUpdate();
    } catch (e: any) {
      showError(e.message);
    } finally {
      setUpdating(false);
    }
  };
  
  const handleCancelOrder = async () => {
    if (window.confirm("Deseja cancelar este pedido?")) {
      await updateStatus('canceled');
      onOpenChange(false);
    }
  };

  const getStatusConfig = (status: string) => {
    switch (status) {
      case 'draft': return { label: 'Rascunho', color: 'bg-gray-100 text-gray-800' };
      case 'pending_signature': return { label: 'Aguardando Assinatura', color: 'bg-yellow-100 text-yellow-800' };
      case 'reserved': return { label: 'Reservado', color: 'bg-blue-50 text-blue-700' };
      case 'picked_up': return { label: 'Em Andamento', color: 'bg-blue-100 text-blue-800' };
      case 'returned': return { label: 'Concluído', color: 'bg-green-100 text-green-800' };
      case 'canceled': return { label: 'Cancelado', color: 'bg-red-50 text-red-700' };
      default: return { label: status, color: 'bg-gray-100' };
    }
  };

  if (!order && loading) return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="flex items-center justify-center"><Loader2 className="animate-spin" /></SheetContent>
    </Sheet>
  );

  const statusConfig = order ? getStatusConfig(order.status) : { label: '', color: '' };
  const isSigned = !!order?.signed_at;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="sm:max-w-md flex flex-col h-full">
        <SheetHeader>
          <div className="flex justify-between items-start">
            <div>
              <SheetTitle className="text-xl">{order?.customer_name}</SheetTitle>
              <p className="text-xs text-muted-foreground font-mono">#{order?.id.split('-')[0]}</p>
            </div>
            <Badge className={statusConfig.color}>{statusConfig.label}</Badge>
          </div>
        </SheetHeader>

        <div className="flex-1 overflow-y-auto py-6 space-y-6">
          <div className="bg-blue-600 rounded-xl p-6 text-white shadow">
            <p className="text-xs font-bold opacity-80 mb-1">Total da Locação</p>
            <p className="text-3xl font-bold">R$ {Number(order?.total_amount || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</p>
          </div>

          {!isSigned && order?.status !== 'canceled' && (
            <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-4 text-sm text-yellow-800 flex items-center gap-2">
              <AlertTriangle className="h-4 w-4" /> Contrato pendente de assinatura.
            </div>
          )}

          {order?.status !== 'canceled' && (
            <div className="space-y-3">
               <a 
                 href={getWhatsappLink(order)}
                 target="_blank" rel="noopener noreferrer"
                 className="w-full h-12 bg-green-600 hover:bg-green-700 text-white font-bold rounded-xl flex items-center justify-center gap-2 shadow transition-all"
               >
                 <MessageCircle className="h-5 w-5" />
                 {isSigned ? 'Reenviar Contrato' : 'Enviar Link de Assinatura'}
               </a>
               
               {isSigned && (
                 <Button onClick={handleDownloadFinalPDF} disabled={isGeneratingContract} variant="outline" className="w-full h-12 border-green-500 text-green-600">
                   {isGeneratingContract ? <Loader2 className="animate-spin mr-2" /> : <Download className="mr-2" />}
                   Baixar PDF Assinado
                 </Button>
               )}
            </div>
          )}

          <div className="space-y-2">
            <h3 className="text-sm font-semibold flex items-center gap-2"><Package className="h-4 w-4" /> Itens</h3>
            <div className="border rounded-lg bg-white divide-y">
              {order?.order_items.map((item: any, idx: number) => (
                <div key={idx} className="p-3 flex justify-between">
                  <span className="text-sm">{item.products?.name}</span>
                  <Badge variant="secondary">x{item.quantity}</Badge>
                </div>
              ))}
            </div>
          </div>
        </div>

        <SheetFooter className="mt-auto pt-4 border-t flex-col gap-2">
           {order?.status === 'pending_signature' && (
             <Button className="w-full bg-green-600" onClick={() => updateStatus('reserved')} disabled={!isSigned}>
               <CheckCircle className="mr-2 h-4 w-4" /> Confirmar Reserva
             </Button>
           )}
           {order?.status === 'reserved' && (
             <Button className="w-full bg-blue-600" onClick={() => updateStatus('picked_up')} disabled={!isSigned}>
               <ClipboardCheck className="mr-2 h-4 w-4" /> Registrar Saída
             </Button>
           )}
           {order?.status === 'picked_up' && (
             <Button className="w-full bg-indigo-600" onClick={() => updateStatus('returned')}>
               <ArrowRightLeft className="mr-2 h-4 w-4" /> Registrar Devolução
             </Button>
           )}
           
           {order?.status !== 'returned' && order?.status !== 'canceled' && (
             <Button variant="ghost" className="w-full text-red-600" onClick={handleCancelOrder}>
               <XCircle className="mr-2 h-4 w-4" /> Cancelar Pedido
             </Button>
           )}
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
};

export default OrderDetailsSheet;