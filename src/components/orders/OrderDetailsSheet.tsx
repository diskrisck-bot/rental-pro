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
    if (open && orderId) { fetchOrderDetails(); }
  }, [open, orderId]);

  const fetchOrderDetails = async () => {
    if (!orderId) return;
    try {
      setLoading(true);
      const { data, error } = await supabase.from('orders').select(`*, order_items (quantity, products (name, price, replacement_value), assets (serial_number))`).eq('id', orderId).single();
      if (error) throw error;
      setOrder(data);
      
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        const { data: profileData } = await supabase.from('profiles').select('*').eq('id', user.id).single();
        if (profileData) setOwnerProfile(profileData as OwnerProfile);
      }
    } catch (error: any) { showError("Erro ao carregar detalhes."); } finally { setLoading(false); }
  };

  const getWhatsappLink = (order: any) => {
    if (!order) return '#';
    const signLink = `${window.location.origin}/contract/${order.id}`;
    const messageText = `Olá ${order.customer_name}! 📄\nSegue o link do seu contrato de locação #${order.id.split('-')[0]}:\n${signLink}\n\nFavor assinar digitalmente.`;
    return `https://wa.me/${order.customer_phone?.replace(/\D/g, '')}?text=${encodeURIComponent(messageText)}`;
  };

  // --- GERADOR DE PDF ---
  const generatePDF = async (order: any, owner: OwnerProfile | null) => {
    const doc = new jsPDF({ format: 'a4', unit: 'mm' });
    const primaryColor = [30, 58, 138]; 
    const lightGray = [245, 245, 245];
    
    const locador = {
      name: owner?.business_name || "Locadora",
      cnpj: owner?.business_cnpj || "CNPJ n/a",
      address: owner?.business_address || "Endereço n/a",
      city: owner?.business_city || "Cidade da Empresa"
    };

    const dias = differenceInDays(parseISO(order.end_date), parseISO(order.start_date)) || 1;
    const formatMoney = (val: any) => Number(val).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
    
    const listaItens = order.order_items.map((i: any) => 
      `• ${i.quantity}x ${i.products?.name} (Valor de Reposição: ${formatMoney(i.products?.replacement_value || 0)})`
    ).join('\n');

    const margin = 20; const pageWidth = 210; const maxLineWidth = pageWidth - (margin * 2); let currentY = 20;

    const printTitle = (text: string) => {
      doc.setFont("helvetica", "bold"); doc.setFontSize(16); doc.setTextColor(primaryColor[0], primaryColor[1], primaryColor[2]);
      doc.text(text, pageWidth / 2, currentY, { align: "center" });
      doc.setDrawColor(primaryColor[0], primaryColor[1], primaryColor[2]); doc.setLineWidth(0.5); 
      doc.line(margin + 20, currentY + 2, pageWidth - 40, currentY + 2);
      currentY += 15;
    };
    const printSectionTitle = (text: string) => {
      if (currentY > 260) { doc.addPage(); currentY = 20; }
      doc.setFont("helvetica", "bold"); doc.setFontSize(11); doc.setTextColor(primaryColor[0], primaryColor[1], primaryColor[2]);
      doc.text(text.toUpperCase(), margin, currentY); currentY += 6;
    };
    const printBody = (text: string) => {
      doc.setFont("times", "normal"); doc.setFontSize(11); doc.setTextColor(0, 0, 0);
      const lines = doc.splitTextToSize(text, maxLineWidth);
      if (currentY + (lines.length * 5) > 275) { doc.addPage(); currentY = 20; }
      doc.text(lines, margin, currentY); currentY += (lines.length * 5) + 3;
    };

    printTitle("CONTRATO DE LOCAÇÃO DE BENS MÓVEIS");

    doc.setFillColor(lightGray[0], lightGray[1], lightGray[2]); doc.rect(margin, currentY, maxLineWidth, 35, 'FD');
    const startBoxY = currentY + 6;
    doc.setFont("helvetica", "bold"); doc.setFontSize(9); doc.setTextColor(0,0,0);
    doc.text("LOCADOR", margin + 5, startBoxY);
    doc.setFont("times", "normal"); doc.setFontSize(10);
    doc.text(`${locador.name}`, margin + 5, startBoxY + 5); doc.text(`CNPJ: ${locador.cnpj}`, margin + 5, startBoxY + 10);
    doc.text(`${locador.city}`, margin + 5, startBoxY + 15);

    doc.setFont("helvetica", "bold"); doc.setFontSize(9);
    doc.text("LOCATÁRIO", margin + 90, startBoxY);
    doc.setFont("times", "normal"); doc.setFontSize(10);
    doc.text(`${order.customer_name}`, margin + 90, startBoxY + 5); doc.text(`CPF: ${order.customer_cpf || '---'}`, margin + 90, startBoxY + 10);
    currentY += 45;

    printSectionTitle("1. DO OBJETO DA LOCAÇÃO"); printBody(`O presente instrumento tem como objeto o aluguel dos seguintes bens:\n${listaItens}`);
    printSectionTitle("2. VIGÊNCIA E PRAZOS"); printBody(`A locação terá a duração de ${dias} diária(s), iniciando-se em ${format(parseISO(order.start_date), "dd/MM/yyyy")} e encerrando-se em ${format(parseISO(order.end_date), "dd/MM/yyyy")}.`);
    printSectionTitle("3. VALOR E FORMA DE PAGAMENTO"); printBody(`Total: ${formatMoney(order.total_amount)}, via ${order.payment_method || 'combinar'}.`);
    printSectionTitle("4. RESPONSABILIDADE"); printBody("O LOCATÁRIO assume total responsabilidade pela guarda e uso dos bens. Em caso de perda ou dano, obriga-se a indenizar o LOCADOR pelo valor de reposição.");
    printSectionTitle("5. DO FORO"); printBody(`Eleito o foro de ${locador.city} para dirimir quaisquer dúvidas.`);

    currentY += 5; doc.setFont("times", "italic"); doc.text(`${locador.city}, ${format(new Date(), "dd 'de' MMMM 'de' yyyy", { locale: ptBR })}.`, margin, currentY);

    currentY += 25; if (currentY > 240) { doc.addPage(); currentY = 40; }
    const yAssin = currentY; const yImg = yAssin - 25;
    if (owner?.signature_url) { try { doc.addImage(owner.signature_url, 'PNG', margin + 10, yImg, 40, 20); } catch (e) {} }
    doc.setDrawColor(0,0,0); doc.line(margin, yAssin, margin + 70, yAssin); doc.setFont("helvetica", "bold"); doc.setFontSize(8); doc.text("LOCADOR", margin, yAssin + 5);
    if (order.signature_image) { try { doc.addImage(order.signature_image, 'PNG', 130, yImg, 40, 20); } catch (e) {} }
    doc.line(120, yAssin, 190, yAssin); doc.text("LOCATÁRIO", 120, yAssin + 5);

    if (order.signed_at) {
      doc.addPage(); currentY = 20;
      doc.setTextColor(primaryColor[0], primaryColor[1], primaryColor[2]); doc.setFont("helvetica", "bold"); doc.setFontSize(14); doc.text("CERTIFICADO DIGITAL", pageWidth/2, currentY, {align: 'center'});
      currentY += 20; doc.setFillColor(lightGray[0], lightGray[1], lightGray[2]); doc.rect(margin, currentY, maxLineWidth, 60, 'FD'); currentY += 10; doc.setTextColor(0,0,0);
      const addLog = (l: string, v: string) => { doc.setFont("courier", "bold"); doc.setFontSize(9); doc.text(l, margin + 5, currentY); doc.setFont("courier", "normal"); doc.text(v, margin + 40, currentY); currentY += 8; };
      addLog("ID:", order.id); addLog("Data:", format(parseISO(order.signed_at), "dd/MM/yyyy HH:mm")); addLog("IP:", order.signer_ip || "N/A");
      if (order.signature_image) { currentY += 5; doc.text("Rubrica:", margin + 5, currentY); doc.addImage(order.signature_image, 'PNG', margin + 5, currentY + 5, 30, 15); }
    }

    return doc;
  };

  const handleDownloadFinalPDF = async () => {
    if (!order) return;
    try { setIsGeneratingContract(true); const doc = await generatePDF(order, ownerProfile); doc.save(`Contrato-${order.id.split('-')[0]}.pdf`); showSuccess("Download iniciado."); } catch (e: any) { showError("Erro ao gerar PDF."); } finally { setIsGeneratingContract(false); }
  };

  const updateStatus = async (newStatus: string) => {
    if (!orderId) return;
    // Bloqueio: Não deixa avançar sem assinatura (exceto cancelar)
    if (newStatus !== 'canceled' && !order.signed_at && newStatus !== 'pending_signature') { 
        showError("É necessário que o cliente assine o contrato primeiro."); 
        return; 
    }
    
    try {
      setUpdating(true); const p: any = { status: newStatus };
      if (newStatus === 'picked_up') p.picked_up_at = new Date().toISOString(); // Isso atualiza o DASHBOARD (Itens na rua)
      if (newStatus === 'returned') p.returned_at = new Date().toISOString(); // Isso devolve ao estoque
      
      await supabase.from('orders').update(p).eq('id', orderId);
      
      showSuccess("Status atualizado!"); 
      queryClient.invalidateQueries({ queryKey: ['orders'] }); 
      fetchOrderDetails(); 
      onStatusUpdate();
    } catch (e: any) { showError(e.message); } finally { setUpdating(false); }
  };
  
  const handleCancelOrder = async () => { if (window.confirm("Deseja cancelar este pedido? O estoque será liberado.")) { await updateStatus('canceled'); onOpenChange(false); } };

  if (!order && loading) return <Sheet open={open} onOpenChange={onOpenChange}><SheetContent><Loader2 className="animate-spin" /></SheetContent></Sheet>;
  
  const isSigned = !!order?.signed_at;
  const status = order?.status;

  // Renderização do Status Visual
  const getStatusBadge = () => {
      switch(status) {
          case 'pending_signature': return <Badge className="bg-yellow-100 text-yellow-800">Aguardando Assinatura</Badge>;
          case 'reserved': return <Badge className="bg-secondary/10 text-secondary">Reservado</Badge>;
          case 'picked_up': return <Badge className="bg-purple-100 text-purple-800">Em Andamento (Na Rua)</Badge>; // Keeping purple for high contrast status
          case 'returned': return <Badge className="bg-green-100 text-green-800">Concluído</Badge>;
          case 'canceled': return <Badge className="bg-red-100 text-red-800">Cancelado</Badge>;
          default: return <Badge>{status}</Badge>;
      }
  };
  
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="sm:max-w-md flex flex-col h-full">
        <SheetHeader>
          <div className="flex justify-between items-start">
            <div><SheetTitle>{order?.customer_name}</SheetTitle><p className="text-xs text-muted-foreground">#{order?.id.split('-')[0]}</p></div>
            {getStatusBadge()}
          </div>
        </SheetHeader>

        <div className="flex-1 overflow-y-auto py-6 space-y-6">
          <div className="bg-secondary rounded-xl p-6 text-white shadow"><p className="text-xs font-bold opacity-80 mb-1">Total</p><p className="text-3xl font-heading font-extrabold">R$ {Number(order?.total_amount || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</p></div>
          
          {/* Seção de Contrato e PDF */}
          <div className="space-y-3">
             <a href={getWhatsappLink(order)} target="_blank" rel="noopener noreferrer" className="w-full h-12 bg-green-600 hover:bg-green-700 text-white font-bold rounded-xl flex items-center justify-center gap-2 shadow"><MessageCircle className="h-5 w-5" /> {isSigned ? 'Reenviar Contrato' : 'Link de Assinatura'}</a>
             <Button onClick={handleDownloadFinalPDF} disabled={isGeneratingContract} variant="outline" className="w-full h-12 border-green-500 text-green-600">{isGeneratingContract ? <Loader2 className="animate-spin mr-2" /> : <Download className="mr-2" />} Baixar PDF Profissional</Button>
          </div>

          <div className="border rounded-lg bg-white divide-y">
            {order?.order_items.map((item: any, idx: number) => (
              <div key={idx} className="p-3 flex justify-between"><span className="text-sm">{item.products?.name}</span><Badge variant="secondary">x{item.quantity}</Badge></div>
            ))}
          </div>
        </div>

        {/* --- AQUI ESTÁ A CORREÇÃO: BOTÕES OPERACIONAIS --- */}
        <SheetFooter className="mt-auto pt-4 border-t flex-col gap-3">
           
           {/* 1. SE ASSINADO -> CONFIRMAR RESERVA */}
           {status === 'pending_signature' && (
             <Button className="w-full h-12 bg-primary hover:bg-primary/90 text-lg shadow-sm" onClick={() => updateStatus('reserved')} disabled={!isSigned}>
               <CheckCircle className="mr-2 h-5 w-5" /> Confirmar Reserva
             </Button>
           )}

           {/* 2. SE RESERVADO -> REGISTRAR SAÍDA (CHECK-OUT) */}
           {status === 'reserved' && (
             <Button className="w-full h-12 bg-secondary hover:bg-secondary/90 text-lg shadow-sm" onClick={() => updateStatus('picked_up')}>
               <ClipboardCheck className="mr-2 h-5 w-5" /> Registrar Retirada (Check-out)
             </Button>
           )}

           {/* 3. SE NA RUA -> REGISTRAR DEVOLUÇÃO (CHECK-IN) */}
           {status === 'picked_up' && (
             <Button className="w-full h-12 bg-green-600 hover:bg-green-700 text-lg shadow-sm" onClick={() => updateStatus('returned')}>
               <ArrowRightLeft className="mr-2 h-5 w-5" /> Registrar Devolução (Check-in)
             </Button>
           )}

           {/* BOTÃO DE CANCELAR (Sempre visível exceto se concluído) */}
           {status !== 'returned' && status !== 'canceled' && (
             <Button variant="ghost" className="w-full text-red-600 hover:bg-red-50" onClick={handleCancelOrder}>
               <XCircle className="mr-2 h-4 w-4" /> Cancelar Pedido
             </Button>
           )}
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
};

export default OrderDetailsSheet;