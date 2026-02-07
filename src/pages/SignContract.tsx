"use client";

import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { Loader2, CheckCircle, AlertTriangle, Download, Building, User } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { format, parseISO, differenceInDays } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import SignaturePad from '@/components/settings/SignaturePad';
import { showError, showSuccess } from '@/utils/toast';
import { Badge } from '@/components/ui/badge';
import jsPDF from 'jspdf';
import { cn } from '@/lib/utils';

const SignContract = () => {
  const { orderId } = useParams<{ orderId: string }>();
  const [order, setOrder] = useState<any>(null);
  const [locador, setLocador] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [signing, setSigning] = useState(false);
  const [customerSignature, setCustomerSignature] = useState<string | null>(null);
  const [agreed, setAgreed] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);

  const fetchData = async () => {
    if (!orderId) { setLoading(false); return; }
    setLoading(true);
    try {
      const { data: rpcData, error: rpcError } = await supabase.rpc('get_contract_data', { 
        p_order_id: orderId 
      });

      if (rpcError) throw rpcError;
      if (!rpcData || rpcData.length === 0) throw new Error("Contrato não encontrado.");

      const raw = rpcData[0];
      setOrder(raw);
      setCustomerSignature(raw.signature_image);
      setLocador({
        business_name: raw.owner_name,
        business_cnpj: raw.owner_cnpj,
        business_address: raw.owner_address,
        business_phone: raw.owner_phone,
        business_city: raw.owner_city, 
        signature_url: raw.owner_signature
      });
    } catch (error: any) {
      showError("Erro ao carregar contrato.");
    } finally { setLoading(false); }
  };

  useEffect(() => { fetchData(); }, [orderId]);

  const handleSign = async () => {
    if (!orderId || !customerSignature || !agreed) return;
    setSigning(true);
    try {
      const ipRes = await fetch('https://api.ipify.org?format=json');
      const ipData = await ipRes.json();
      const { error } = await supabase.rpc('sign_order_contract', {
        target_order_id: orderId,
        signature_data: customerSignature,
        client_ip: ipData?.ip || '0.0.0.0',
        client_agent: navigator.userAgent
      });
      if (error) throw error;
      showSuccess("Assinado com sucesso!");
      fetchData();
    } catch (error: any) {
      showError("Erro ao assinar: " + error.message);
    } finally { setSigning(false); }
  };

  const generatePDF = async () => {
    if (!order || !locador) return;
    setIsDownloading(true);
    try {
      const doc = new jsPDF();
      const pageWidth = doc.internal.pageSize.getWidth();
      const margin = 14;
      const maxW = pageWidth - (margin * 2);
      
      doc.setFontSize(14);
      doc.setFont("helvetica", "bold");
      doc.text("CONTRATO DE LOCAÇÃO DE EQUIPAMENTOS", pageWidth / 2, 20, { align: 'center' });

      doc.setFontSize(10);
      doc.setFont("helvetica", "normal");
      
      const dias = differenceInDays(parseISO(order.end_date), parseISO(order.start_date)) || 0;
      
      const corpoContrato = `
LOCADOR: ${locador.business_name || '---'}, CNPJ/CPF: ${locador.business_cnpj || '---'}, com sede em ${locador.business_address || '---'}, na cidade de ${locador.business_city || '---'}.

LOCATÁRIA: ${order.customer_name || '---'}, CNPJ/CPF: ${order.customer_cpf || '---'}, residente em ${order.customer_address || '---'}.

CLÁUSULA PRIMEIRA – DO OBJETO
Locação dos seguintes equipamentos e acessórios:
${order.items?.map((i: any) => `- ${i.quantity}x ${i.name}`).join('\n')}

CLÁUSULA SEGUNDA – DO PRAZO
Duração de ${dias} dias, iniciando em ${format(parseISO(order.start_date), "dd/MM/yyyy")} e encerrando em ${format(parseISO(order.end_date), "dd/MM/yyyy")}.

CLÁUSULA TERCEIRA – PREÇO E PAGAMENTO
Valor total: R$ ${Number(order.total_amount).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}.
Forma de Pagamento: ${order.payment_method || 'A combinar'}.

CLÁUSULA QUARTA – DANOS E REPOSIÇÃO
A LOCATÁRIA declara receber os equipamentos em perfeito estado. Em caso de perda, furto ou danos, a LOCATÁRIA indenizará o LOCADOR nos valores unitários de reposição:
${order.items?.map((i: any) => `- ${i.name}: R$ ${Number(i.replacement_value || 0).toLocaleString('pt-BR')}`).join('\n')}

CLÁUSULA QUINTA – DO FORO
Fica eleito o foro de ${locador.business_city || 'Comarca do Locador'} para dirimir dúvidas sobre este instrumento.

${locador.business_city || 'Brasil'}, ${format(new Date(), "dd 'de' MMMM 'de' yyyy", { locale: ptBR })}.
      `;

      const textLines = doc.splitTextToSize(corpoContrato, maxW);
      doc.text(textLines, margin, 35);

      const finalY = 40 + (textLines.length * 5);
      
      // Linhas de Assinatura
      doc.line(margin, finalY + 20, margin + 70, finalY + 20);
      doc.text("Assinatura do Locador", margin, finalY + 25);
      
      doc.line(pageWidth - 84, finalY + 20, pageWidth - margin, finalY + 20);
      doc.text("Assinatura do Locatário", pageWidth - 84, finalY + 25);

      // Página 2: Certificado Digital
      doc.addPage();
      doc.setFontSize(14);
      doc.setFont("helvetica", "bold");
      doc.text("CERTIFICADO DE ASSINATURA DIGITAL", pageWidth / 2, 20, { align: 'center' });
      doc.setFontSize(9);
      doc.setFont("helvetica", "normal");
      doc.text(`ID do Documento: ${order.order_id}`, margin, 40);
      doc.text(`IP do Signatário: ${order.signer_ip || '---'}`, margin, 48);
      doc.text(`Dispositivo: ${order.signer_user_agent || '---'}`, margin, 56, { maxWidth: maxW });
      doc.text(`Data/Hora: ${order.signed_at ? format(parseISO(order.signed_at), "dd/MM/yyyy HH:mm:ss") : 'Pendente'}`, margin, 68);
      
      if (order.signature_image) {
        doc.addImage(order.signature_image, 'PNG', margin, 75, 50, 20);
      }

      doc.save(`contrato-${order.order_id.split('-')[0]}.pdf`);
    } catch (e) { 
      console.error(e);
      showError("Erro ao gerar PDF"); 
    } finally { 
      setIsDownloading(false); 
    }
  };

  if (loading) return <div className="flex h-screen items-center justify-center"><Loader2 className="animate-spin text-blue-600" /></div>;

  return (
    <div className="min-h-screen bg-gray-50 py-10 px-4">
      <div className="mx-auto max-w-3xl bg-white p-8 rounded-xl shadow-lg border border-gray-100">
        <h1 className="text-2xl font-bold text-center text-gray-900 mb-8">Contrato de Locação Digital</h1>
        
        {!order.signed_at ? (
          <div className="space-y-6">
            <div className="bg-blue-50 p-4 rounded-lg border border-blue-100">
              <p className="text-sm text-blue-800">
                Olá <strong>{order.customer_name}</strong>, por favor revise os termos do contrato e realize a assinatura digital abaixo para prosseguir com a locação.
              </p>
            </div>
            
            <SignaturePad onSave={setCustomerSignature} />
            
            <div className="flex items-start gap-3 bg-gray-50 p-4 rounded-lg">
              <Checkbox id="terms" checked={agreed} onCheckedChange={(v) => setAgreed(!!v)} className="mt-1" />
              <label htmlFor="terms" className="text-sm text-gray-600 leading-tight cursor-pointer">
                Li e concordo com todos os termos, prazos e valores de reposição estabelecidos neste contrato de locação.
              </label>
            </div>
            
            <Button 
              onClick={handleSign} 
              className="w-full h-14 text-lg font-bold bg-blue-600 hover:bg-blue-700 transition-colors" 
              disabled={signing || !agreed || !customerSignature}
            >
              {signing ? <><Loader2 className="mr-2 h-5 w-5 animate-spin" /> Processando...</> : "Finalizar e Assinar Contrato"}
            </Button>
          </div>
        ) : (
          <div className="text-center space-y-6 py-8">
            <div className="flex flex-col items-center">
              <CheckCircle className="h-16 w-16 text-green-500 mb-4" />
              <Badge className="bg-green-100 text-green-700 hover:bg-green-100 border-green-200 px-4 py-1 text-sm font-bold">
                DOCUMENTO ASSINADO DIGITALMENTE
              </Badge>
            </div>
            <p className="text-gray-500">A assinatura foi registrada com sucesso. Você já pode baixar a sua via do contrato em PDF.</p>
            <Button 
              onClick={generatePDF} 
              variant="outline" 
              className="w-full h-14 border-blue-600 text-blue-600 hover:bg-blue-50 font-bold"
              disabled={isDownloading}
            >
              {isDownloading ? <Loader2 className="mr-2 h-5 w-5 animate-spin" /> : <Download className="mr-2 h-5 w-5" />}
              Baixar Contrato (PDF)
            </Button>
          </div>
        )}
      </div>
    </div>
  );
};

export default SignContract;