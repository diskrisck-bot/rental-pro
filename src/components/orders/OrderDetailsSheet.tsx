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
  Download, AlertTriangle, XCircle, Truck 
} from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { format, isAfter, parseISO, differenceInDays } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { showSuccess, showError } from '@/utils/toast';
import { useQueryClient } from '@tanstack/react-query';
import { cn } from '@/lib/utils';
import jsPDF from 'jspdf';
import 'jspdf-autotable'; 

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
    
    // Higienização estrita do telefone
    let phone = order.customer_phone?.replace(/\D/g, '') || '';
    
    // Validação de DDI Brasil (55)
    if (phone.length === 10 || phone.length === 11) {
      phone = `55${phone}`;
    }
    
    return `https://wa.me/${phone}?text=${encodeURIComponent(messageText)}`;
  };

  const generatePDF = async (order: any, owner: OwnerProfile | null) => {
    const doc = new jsPDF({ format: 'a4', unit: 'mm' });
    const primaryColor = [30, 58, 138]; 
    const lightGray = [245, 245, 245];
    
    const locador = {
      name: owner?.business_name || "LOCADOR NÃO CADASTRADO",
      cnpj: owner?.business_cnpj || "CNPJ n/a",
      address: owner?.business_address || "Endereço n/a",
      phone: owner?.business_phone || "Telefone n/a",
      city: owner?.business_city || "Cidade da Empresa",
      signature: owner?.signature_url
    };

    const dias = differenceInDays(parseISO(order.end_date), parseISO(order.start_date)) + 1;
    const formatMoney = (val: any) => Number(val).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
    
    const listaItens = order.order_items.map((i: any) => 
      `• ${i.quantity}x ${i.products?.name} (Valor de Reposição: ${formatMoney(i.products?.replacement_value || 0)})`
    ).join('\n');

    const margin = 20; 
    const pageWidth = 210; 
    const maxLineWidth = pageWidth - (margin * 2); 
    let currentY = 20;

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

    doc.setFillColor(lightGray[0], lightGray[1], lightGray[2]); doc.rect(margin, currentY, maxLineWidth, 45, 'FD');
    const startBoxY = currentY + 6;
    
    doc.setFont("helvetica", "bold"); doc.setFontSize(10); doc.setTextColor(0,0,0);
    doc.text("LOCADOR (EMPRESA)", margin + 5, startBoxY);
    doc.setFont("times", "normal"); doc.setFontSize(9);
    doc.text(`Nome: ${locador.name}`, margin + 5, startBoxY + 5); 
    doc.text(`CNPJ: ${locador.cnpj}`, margin + 5, startBoxY + 10);
    doc.text(`Endereço: ${locador.address}`, margin + 5, startBoxY + 15);
    doc.text(`Cidade: ${locador.city} | Tel: ${locador.phone}`, margin + 5, startBoxY + 20);

    doc.setFont("helvetica", "bold"); doc.setFontSize(10);
    doc.text("LOCATÁRIO (CLIENTE)", margin + 90, startBoxY);
    doc.setFont("times", "normal"); doc.setFontSize(9);
    doc.text(`Nome: ${order.customer_name}`, margin + 90, startBoxY + 5); 
    doc.text(`CPF/CNPJ: ${order.customer_cpf || '---'}`, margin + 90, startBoxY + 10);
    doc.text(`Telefone: ${order.customer_phone || '---'}`, margin + 90, startBoxY + 15);
    doc.text(`Endereço: ${order.customer_address || '---'}`, margin + 90, startBoxY + 20);
    
    currentY += 55; 

    printSectionTitle("CLÁUSULA 1 - DO OBJETO DA LOCAÇÃO"); 
    printBody(`O presente instrumento tem como objeto o aluguel dos seguintes bens móveis, que o LOCATÁRIO declara receber em perfeito estado de funcionamento e conservação:\n\n${listaItens}\n\nParágrafo Único: O valor de reposição de cada item é o valor que será cobrado integralmente do LOCATÁRIO em caso de perda, roubo, furto ou dano irreparável.`);

    printSectionTitle("CLÁUSULA 2 - DO PRAZO E ENTREGA"); 
    printBody(`A locação vigorará pelo período de ${dias} diária(s), iniciando-se em ${format(parseISO(order.start_date), "dd/MM/yyyy")} e encerrando-se em ${format(parseISO(order.end_date), "dd/MM/yyyy")}, devendo os bens ser devolvidos na data final até as 18:00h. O atraso na devolução configurará apropriação indébita e gerará cobrança de novas diárias, sem prejuízo de multa de 10% sobre o valor total do contrato.`);

    printSectionTitle("CLÁUSULA 3 - DO PREÇO E PAGAMENTO"); 
    printBody(`O valor total da locação é de ${formatMoney(order.total_amount)}, a ser pago via ${order.payment_method || 'combinar'}. O não pagamento na data acordada acarretará juros de mora de 1% (um por cento) ao mês e multa de 2% (dois por cento) sobre o valor devido.`);

    printSectionTitle("CLÁUSULA 4 - DA RESPONSABILIDADE E USO"); 
    printBody("O LOCATÁRIO declara receber os bens em perfeito estado de funcionamento e conservação. É de inteira responsabilidade do LOCATÁRIO a guarda e o uso correto dos equipamentos. Em caso de dano, avaria, roubo ou furto, o LOCATÁRIO arcará com o custo integral de reparo ou reposição do bem por um novo, de mesma marca e modelo, conforme os valores de reposição listados na Cláusula 1.");

    printSectionTitle("CLÁUSULA 5 - DO TRANSPORTE"); 
    printBody("O transporte dos equipamentos (retirada e devolução) corre por conta e risco do LOCATÁRIO, salvo disposição em contrário expressa neste contrato.");

    printSectionTitle("CLÁUSULA 6 - DA RESCISÃO"); 
    printBody("O descumprimento de qualquer cláusula contratual ensejará a rescisão imediata deste contrato e a retomada dos bens pelo LOCADOR, sem prejuízo das penalidades cabíveis.");

    printSectionTitle("CLÁULA 7 - DO FORO"); 
    printBody(`Fica eleito o foro da comarca de ${locador.city} para dirimir quaisquer dúvidas oriundas deste contrato, renunciando a qualquer outro, por mais privilegiado que seja.`);

    currentY += 5; 
    doc.setFont("times", "italic"); 
    doc.text(`${locador.city}, ${format(new Date(), "dd 'de' MMMM 'de' yyyy", { locale: ptBR })}.`, margin, currentY);

    currentY += 25; 
    if (currentY > 240) { doc.addPage(); currentY = 40; }
    
    const yAssin = currentY; 
    const yImg = yAssin - 25;
    
    if (locador.signature) { try { doc.addImage(locador.signature, 'PNG', margin + 10, yImg, 40, 20); } catch (e) {} }
    doc.setDrawColor(0,0,0); doc.line(margin, yAssin, margin + 70, yAssin); 
    doc.setFont("helvetica", "bold"); doc.setFontSize(8); doc.text("LOCADOR", margin, yAssin + 5);
    
    if (order.signature_image) { try { doc.addImage(order.signature_image, 'PNG', 130, yImg, 40, 20); } catch (e) {} }
    doc.line(120, yAssin, 190, yAssin); 
    doc.text("LOCATÁRIO", 120, yAssin + 5);
    
    if (order.signed_at) {
      doc.addPage(); currentY = 20;
      doc.setTextColor(primaryColor[0], primaryColor[1], primaryColor[2]); doc.setFont("helvetica", "bold"); doc.setFontSize(14); doc.text("CERTIFICADO DIGITAL DE ASSINATURA", pageWidth/2, currentY, {align: 'center'});
      currentY += 20; doc.setFillColor(lightGray[0], lightGray[1], lightGray[2]); doc.rect(margin, currentY, maxLineWidth, 60, 'FD'); currentY += 10; doc.setTextColor(0,0,0);
      const addLog = (l: string, v: string) => { doc.setFont("courier", "bold"); doc.setFontSize(9); doc.text(l, margin + 5, currentY); doc.setFont("courier", "normal"); doc.text(v, margin + 40, currentY); currentY += 8; };
      addLog("ID:", order.id); 
      addLog("Data:", format(parseISO(order.signed_at), "dd/MM/yyyy HH:mm")); 
      addLog("IP:", order.signer_ip || "N/A");
      addLog("User Agent:", order.signer_user_agent ? order.signer_user_agent.substring(0, 50) + '...' : "N/A");
      if (order.signature_image) { currentY += 5; doc.text("Rubrica:", margin + 5, currentY); doc.addImage(order.signature_image, 'PNG', margin + 5, currentY + 5, 30, 15); }
    }

    return doc;
  };

  const handleDownloadFinalPDF = async () => {
    if (!order) return;
    try { setIsGeneratingContract(true); const doc = await generatePDF(order, ownerProfile); doc.save(`Contrato-${order.id.split('-')[0]}.pdf`); showSuccess("Download iniciado."); } catch (e: any) { showError("Erro ao gerar PDF: " + e.message); } finally { setIsGeneratingContract(false); }
  };

  const updateStatus = async (newStatus: string) => {
    if (!orderId) return;
    
    try {
      setUpdating(true); 
      const p: any = { status: newStatus };
      
      if (newStatus === 'picked_up') p.picked_up_at = new Date().toISOString(); 
      if (newStatus === 'returned') p.returned_at = new Date().toISOString(); 
      
      if (order?.status === 'signed' && newStatus === 'returned') {
          p.picked_up_at = new Date().toISOString();
      }

      const { error } = await supabase.from('orders').update(p).eq('id', orderId);
      if(error) throw error;
      
      showSuccess(
        newStatus === 'picked_up' ? "Equipamento retirado! Bom trabalho." : 
        newStatus === 'returned' ? "Equipamento devolvido! Estoque liberado." : "Status atualizado!"
      );

      queryClient.invalidateQueries({ queryKey: ['orders'] }); 
      queryClient.invalidateQueries({ queryKey: ['dashboardOrders'] }); 
      queryClient.invalidateQueries({ queryKey: ['dashboardOrderItems'] }); 
      fetchOrderDetails(); 
      onStatusUpdate();
    } catch (e: any) { showError(e.message); } finally { setUpdating(false); }
  };
  
  const handleCancelOrder = async () => { if (window.confirm("Deseja cancelar este pedido? O estoque será liberado.")) { await updateStatus('canceled'); onOpenChange(false); } };

  if (!order && loading) return <Sheet open={open} onOpenChange={onOpenChange}><SheetContent><Loader2 className="animate-spin" /></SheetContent></Sheet>;
  
  const isSigned = !!order?.signed_at;
  const status = order?.status;
  const isFinalized = status === 'returned' || status === 'canceled';
  const showWhatsappButton = !isFinalized;

  const getStatusBadge = () => {
      switch(status) {
          case 'pending_signature': return <Badge variant="outline" className="text-primary border-primary/20 bg-primary/10">Aguardando Assinatura</Badge>;
          case 'signed': return <Badge className="bg-success">Assinado</Badge>;
          case 'reserved': return <Badge className="bg-primary">Reservado</Badge>;
          case 'picked_up': return <Badge className="bg-primary">Em Andamento (Na Rua)</Badge>; 
          case 'returned': return <Badge className="bg-gray-600">Concluído</Badge>;
          case 'canceled': return <Badge variant="destructive">Cancelado</Badge>;
          default: return <Badge>{status}</Badge>;
      }
  };
  
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="sm:max-w-md flex flex-col h-full p-0 gap-0 bg-background">
        
        <SheetHeader className="px-6 py-4 border-b border-gray-100 bg-card">
          <div className="flex justify-between items-start">
            <div>
                <SheetTitle className="text-foreground font-extrabold text-xl uppercase">{order?.customer_name}</SheetTitle>
                <p className="text-xs text-gray-500 font-bold">Pedido #{order?.id.split('-')[0]}</p>
            </div>
            {getStatusBadge()}
          </div>
        </SheetHeader>

        <div className="flex-1 overflow-y-auto p-6 space-y-6 bg-background">
          
          <div className="bg-primary rounded-[var(--radius)] p-6 text-white shadow-custom text-center">
            <p className="text-xs font-bold opacity-80 uppercase tracking-widest mb-1">Valor do Contrato</p>
            <p className="text-4xl font-black">R$ {Number(order?.total_amount || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</p>
          </div>
          
          {/* AJUSTE DE RESPONSIVIDADE: grid-cols-1 no mobile, sm:grid-cols-2 no desktop */}
          <div className={cn("grid gap-3", showWhatsappButton ? "grid-cols-1 sm:grid-cols-2" : "grid-cols-1")}>
             
             {showWhatsappButton && (
                <a href={getWhatsappLink(order)} target="_blank" rel="noopener noreferrer" className="w-full">
                    <Button variant="outline" className="w-full h-12 border-success text-success hover:bg-success/10 font-bold text-sm">
                        <MessageCircle className="h-4 w-4 mr-2" /> Enviar Link (WA)
                    </Button>
                </a>
             )}

             <Button 
                onClick={handleDownloadFinalPDF} 
                disabled={isGeneratingContract} 
                variant={isSigned ? "default" : "outline"} 
                className={cn(
                    "w-full h-12 font-bold text-sm", 
                    isSigned 
                        ? "bg-secondary hover:bg-secondary/90 text-white" 
                        : "border-foreground text-foreground", 
                    !showWhatsappButton && "col-span-full"
                )}
             >
                {isGeneratingContract ? <Loader2 className="animate-spin mr-2" /> : <Download className="mr-2 h-4 w-4" />} 
                {isSigned ? 'Baixar Contrato' : 'Baixar Rascunho'}
             </Button>
          </div>

          <div className="bg-card rounded-[var(--radius)] border border-gray-200 p-4 shadow-custom">
            <h4 className="text-xs font-bold text-gray-500 uppercase mb-3 flex items-center gap-2"><Package className="h-4 w-4"/> Equipamentos</h4>
            <div className="divide-y divide-gray-100">
                {order?.order_items.map((item: any, idx: number) => (
                  <div key={idx} className="py-3 flex justify-between items-center">
                      <span className="text-sm font-medium text-foreground">{item.products?.name}</span>
                      <Badge className="bg-primary">x{item.quantity}</Badge>
                  </div>
                ))}
            </div>
          </div>
        </div>

        <SheetFooter className="border-t border-gray-200 bg-card mt-auto w-full">
            <div className="p-6 flex flex-col gap-3 w-full">
                
                {status === 'signed' && (
                    <Button 
                        className="w-full h-14 bg-success hover:bg-success/90 text-white font-bold uppercase text-lg shadow-lg" 
                        onClick={() => updateStatus('picked_up')} 
                        disabled={updating}
                    >
                        {updating ? <Loader2 className="mr-2 h-6 w-6 animate-spin" /> : <Truck className="mr-2 h-6 w-6" />} 
                        CONFIRMAR RETIRADA
                    </Button>
                )}

                {status === 'reserved' && (
                    <Button 
                        className="w-full h-14 bg-primary hover:bg-primary/90 text-white font-bold uppercase text-lg shadow-lg" 
                        onClick={() => updateStatus('picked_up')}
                        disabled={updating}
                    >
                        {updating ? <Loader2 className="mr-2 h-6 w-6 animate-spin" /> : <Truck className="mr-2 h-6 w-6" />} 
                        CONFIRMAR RETIRADA
                    </Button>
                )}

                {status === 'picked_up' && (
                    <Button 
                        className="w-full h-14 bg-success hover:bg-success/90 text-white font-bold uppercase text-lg shadow-lg" 
                        onClick={() => updateStatus('returned')}
                        disabled={updating}
                    >
                        {updating ? <Loader2 className="mr-2 h-6 w-6 animate-spin" /> : <ArrowRightLeft className="mr-2 h-6 w-6" />} 
                        REGISTRAR DEVOLUÇÃO
                    </Button>
                )}

                {isFinalized && (
                    <div className="p-4 bg-success/10 border border-success/20 rounded-lg flex items-center justify-center gap-2 text-success font-bold">
                        <CheckCircle className="h-5 w-5" /> Contrato Finalizado
                    </div>
                )}

                {!isFinalized && (
                    <Button 
                        variant="ghost" 
                        className="w-full text-destructive hover:text-destructive/90 hover:bg-destructive/10 font-bold uppercase text-xs mt-2" 
                        onClick={handleCancelOrder} 
                        disabled={updating}
                    >
                        <XCircle className="mr-2 h-4 w-4" /> CANCELAR PEDIDO
                    </Button>
                )}
            </div>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
};

export default OrderDetailsSheet;