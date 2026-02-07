"use client";

import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { Loader2, CheckCircle, Download, FileText, ShieldCheck } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { format, parseISO, differenceInDays } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import SignaturePad from '@/components/settings/SignaturePad';
import { showError, showSuccess } from '@/utils/toast';
import { Badge } from '@/components/ui/badge';
import jsPDF from 'jspdf';

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
        business_city: raw.owner_city,
        signature_url: raw.owner_signature
      });
    } catch (error: any) {
      showError("Erro ao carregar dados.");
    } finally { setLoading(false); }
  };

  useEffect(() => { fetchData(); }, [orderId]);

  const getContractText = () => {
    if (!order || !locador) return "";
    const dias = differenceInDays(parseISO(order.end_date), parseISO(order.start_date)) || 0;
    
    return `
CONTRATO DE LOCAÇÃO DE EQUIPAMENTOS

LOCADOR: ${locador.business_name || '---'}, inscrito no CNPJ/CPF sob o nº ${locador.business_cnpj || '---'}, com sede em ${locador.business_address || '---'}, na cidade de ${locador.business_city || '---'}.

LOCATÁRIA: ${order.customer_name || '---'}, inscrita no CNPJ/CPF sob o nº ${order.customer_cpf || '---'}, residente em ${order.customer_address || '---'}.

CLÁUSULA PRIMEIRA – DO OBJETO
O presente contrato tem por objeto a locação dos seguintes itens:
${order.items?.map((i: any) => `- ${i.quantity}x ${i.name}`).join('\n')}

CLÁUSULA SEGUNDA – DO PRAZO
A locação terá a duração de ${dias} dias, iniciando-se em ${format(parseISO(order.start_date), "dd/MM/yyyy")} e encerrando-se em ${format(parseISO(order.end_date), "dd/MM/yyyy")}.

CLÁUSULA TERCEIRA – DO PREÇO E PAGAMENTO
Pela locação, a LOCATÁRIA pagará o valor total de R$ ${Number(order.total_amount).toLocaleString('pt-BR', { minimumFractionDigits: 2 })} via ${order.payment_method || 'forma a combinar'}.

CLÁUSULA QUARTA – DA CONSERVAÇÃO E DANOS
Em caso de danos, furto ou roubo, a LOCATÁRIA indenizará o LOCADOR nos valores de reposição:
${order.items?.map((i: any) => `- ${i.name}: R$ ${Number(i.replacement_value || 0).toLocaleString('pt-BR')}`).join('\n')}

CLÁUSULA QUINTA – DO FORO
Fica eleito o foro da comarca de ${locador.business_city || 'Comarca do Locador'} para dirimir dúvidas.

${locador.business_city || 'Brasil'}, ${format(new Date(), "dd 'de' MMMM 'de' yyyy", { locale: ptBR })}.
    `;
  };

  const generatePDF = async () => {
    if (!order || !locador) return;
    setIsDownloading(true);
    try {
      const doc = new jsPDF();
      const margin = 14;
      const maxW = doc.internal.pageSize.getWidth() - (margin * 2);
      
      doc.setFontSize(14); doc.setFont("helvetica", "bold");
      doc.text("CONTRATO DE LOCAÇÃO DIGITAL", 105, 20, { align: 'center' });

      doc.setFontSize(10); doc.setFont("helvetica", "normal");
      const textLines = doc.splitTextToSize(getContractText(), maxW);
      doc.text(textLines, margin, 35);

      const finalY = 40 + (textLines.length * 5);
      doc.line(margin, finalY + 20, margin + 70, finalY + 20);
      doc.text("Assinatura do Locador", margin, finalY + 25);
      doc.line(130, finalY + 20, 200, finalY + 20);
      doc.text("Assinatura do Locatário", 130, finalY + 25);

      doc.addPage();
      doc.setFontSize(14); doc.text("CERTIFICADO DE AUDITORIA", 105, 20, { align: 'center' });
      doc.setFontSize(9);
      doc.text(`ID do Documento: ${order.order_id}`, margin, 40);
      doc.text(`IP: ${order.signer_ip || '---'} | Data: ${order.signed_at ? format(parseISO(order.signed_at), "dd/MM/yyyy HH:mm") : 'Pendente'}`, margin, 48);
      if (order.signature_image) doc.addImage(order.signature_image, 'PNG', margin, 60, 50, 20);

      doc.save(`contrato-${order.order_id.split('-')[0]}.pdf`);
    } catch (e) { showError("Erro ao gerar PDF"); } finally { setIsDownloading(false); }
  };

  const handleSign = async () => {
    if (!orderId || !customerSignature || !agreed) return;
    setSigning(true);
    try {
      const ipRes = await fetch('https://api.ipify.org?format=json');
      const ipData = await ipRes.json();
      await supabase.rpc('sign_order_contract', {
        target_order_id: orderId,
        signature_data: customerSignature,
        client_ip: ipData?.ip || '0.0.0.0',
        client_agent: navigator.userAgent
      });
      showSuccess("Contrato assinado!");
      fetchData();
    } catch (error: any) { showError("Erro ao assinar"); } finally { setSigning(false); }
  };

  if (loading) return <div className="flex h-screen items-center justify-center"><Loader2 className="animate-spin text-blue-600" /></div>;

  return (
    <div className="min-h-screen bg-gray-50 py-6 px-4">
      <div className="mx-auto max-w-3xl bg-white rounded-xl shadow-lg border border-gray-200 overflow-hidden">
        <div className="bg-blue-600 p-4 text-white text-center">
          <h1 className="text-xl font-bold font-serif">Contrato RentalPro</h1>
        </div>

        <div className="p-6 space-y-6">
          {!order.signed_at && (
            <div className="space-y-4">
              <h2 className="text-sm font-bold text-gray-500 uppercase flex items-center gap-2">
                <FileText className="h-4 w-4" /> Termos do Contrato
              </h2>
              <div className="bg-gray-50 p-6 border rounded-lg h-72 overflow-y-auto text-sm leading-relaxed text-gray-800 whitespace-pre-wrap font-serif">
                {getContractText()}
              </div>
            </div>
          )}

          {!order.signed_at ? (
            <div className="space-y-6">
              <div className="p-4 bg-blue-50 border border-blue-100 rounded-lg flex items-start gap-3">
                <Checkbox id="terms" checked={agreed} onCheckedChange={(v) => setAgreed(!!v)} className="mt-1" />
                <label htmlFor="terms" className="text-sm text-blue-900 cursor-pointer">
                  Confirmo que li e aceito todas as cláusulas e valores de reposição.
                </label>
              </div>
              
              <div className="space-y-2">
                <p className="text-xs font-bold text-gray-400 uppercase">Assine no campo abaixo</p>
                <SignaturePad onSave={setCustomerSignature} />
              </div>

              <Button onClick={handleSign} disabled={signing || !agreed || !customerSignature} className="w-full h-14 text-lg bg-blue-600 font-bold">
                {signing ? "Processando..." : <><ShieldCheck className="mr-2" /> Assinar Digitalmente</>}
              </Button>
            </div>
          ) : (
            <div className="text-center py-10 space-y-6">
              <CheckCircle className="h-16 w-16 text-green-600 mx-auto" />
              <h2 className="text-2xl font-bold text-gray-900">Documento Assinado com Sucesso</h2>
              <Button onClick={generatePDF} variant="outline" className="w-full h-14 border-blue-600 text-blue-600 font-bold">
                {isDownloading ? <Loader2 className="animate-spin" /> : <Download className="mr-2" />} Baixar PDF Completo
              </Button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default SignContract;