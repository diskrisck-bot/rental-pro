"use client";

import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { Loader2, CheckCircle, AlertTriangle, Download, Building, User } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { format, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import SignaturePad from '@/components/settings/SignaturePad';
import { showError, showSuccess } from '@/utils/toast';
import { Badge } from '@/components/ui/badge';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { cn } from '@/lib/utils';

// Interfaces
interface ProductItem {
  name: string;
  price: number;
}

interface OrderItem {
  quantity: number;
  products: ProductItem;
}

interface LocadorData {
  business_name: string | null;
  business_cnpj: string | null;
  business_address: string | null;
  business_phone: string | null;
  signature_url: string | null;
}

interface ContractData {
  id: string;
  customer_name: string;
  customer_phone: string;
  customer_cpf: string;
  start_date: string;
  end_date: string;
  total_amount: number;
  signed_at: string | null;
  signature_image: string | null;
  signer_ip: string | null;
  signer_user_agent: string | null;
  status: string;
  fulfillment_type: string;
  user_id: string; 
  items: OrderItem[];
}

const SignContract = () => {
  const { orderId } = useParams<{ orderId: string }>();
  const [order, setOrder] = useState<ContractData | null>(null);
  const [locador, setLocador] = useState<LocadorData | null>(null);
  const [loading, setLoading] = useState(true);
  const [signing, setSigning] = useState(false);
  const [customerSignature, setCustomerSignature] = useState<string | null>(null);
  const [agreed, setAgreed] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);

  const fetchData = async () => {
    if (!orderId) {
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      // Busca os dados via RPC (Seguro para acesso público)
      const { data: rpcData, error: rpcError } = await supabase.rpc('get_contract_data', { 
        p_order_id: orderId 
      });

      if (rpcError) throw rpcError;
      if (!rpcData || rpcData.length === 0) throw new Error("Contrato não encontrado.");

      const rawOrder = rpcData[0];
      
      const orderData: ContractData = {
        id: rawOrder?.order_id || '',
        customer_name: rawOrder?.customer_name || 'Cliente',
        customer_phone: rawOrder?.customer_phone || '',
        customer_cpf: rawOrder?.customer_cpf || '',
        start_date: rawOrder?.start_date || new Date().toISOString(),
        end_date: rawOrder?.end_date || new Date().toISOString(),
        total_amount: rawOrder?.total_amount || 0,
        signed_at: rawOrder?.signed_at || null,
        signature_image: rawOrder?.signature_image || null,
        signer_ip: rawOrder?.signer_ip || null,
        signer_user_agent: rawOrder?.signer_user_agent || null,
        status: rawOrder?.status || 'draft',
        fulfillment_type: rawOrder?.fulfillment_type || 'reservation',
        user_id: rawOrder?.user_id || rawOrder?.created_by || '',
        items: rawOrder?.items || []
      };

      setOrder(orderData);
      setCustomerSignature(orderData?.signature_image);

      setLocador({
        business_name: rawOrder?.owner_name || null,
        business_cnpj: rawOrder?.owner_cnpj || null,
        business_address: rawOrder?.owner_address || null,
        business_phone: rawOrder?.owner_phone || null,
        signature_url: rawOrder?.owner_signature || null
      });

    } catch (error: any) {
      console.error("[SignContract] Critical Error:", error.message);
      showError("Não foi possível carregar o contrato.");
    } finally {
      setLoading(false); 
    }
  };

  useEffect(() => {
    fetchData();
  }, [orderId]);

  // FUNÇÃO DE ASSINATURA AJUSTADA (RPC)
  const handleSign = async () => {
    if (!orderId || !order || !customerSignature) return;
    if (!agreed) {
      showError("Você deve concordar com os termos do contrato.");
      return;
    }

    setSigning(true);
    try {
      // Captura IP do cliente
      const ipRes = await fetch('https://api.ipify.org?format=json');
      const ipData = await ipRes.json();
      
      // Chamada da Função SQL via RPC para ignorar RLS e atualizar status
      const { error } = await supabase.rpc('sign_order_contract', {
        target_order_id: orderId,
        signature_data: customerSignature,
        client_ip: ipData?.ip || '0.0.0.0',
        client_agent: navigator.userAgent
      });

      if (error) throw error;

      showSuccess("Contrato assinado com sucesso!");
      fetchData(); // Recarrega para mostrar status "Assinado" e habilitar PDF
    } catch (error: any) {
      console.error("[Signature Error]", error.message);
      showError("Erro ao assinar: " + error.message);
    } finally {
      setSigning(false);
    }
  };
  
  const generatePDF = async () => {
    if (!order || !locador) return;
    setIsDownloading(true);
    
    try {
      const doc = new jsPDF();
      const pageWidth = doc.internal.pageSize.getWidth();
      const pageHeight = doc.internal.pageSize.getHeight();
      const isFinal = !!order.signed_at;
      
      const addWatermark = (doc: jsPDF, pageNumber: number) => {
        doc.setPage(pageNumber);
        doc.setFontSize(8);
        doc.setTextColor(150, 150, 150);
        doc.text("Gerado via RentalPro (rentalpro.com.br)", pageWidth / 2, pageHeight - 10, { align: 'center' });
      };
      
      // Cabeçalho PDF
      doc.setFontSize(20);
      doc.setTextColor(30, 58, 138);
      doc.text("CONTRATO DE LOCAÇÃO", pageWidth / 2, 20, { align: 'center' });
      
      // Dados Locador
      doc.setFontSize(12);
      doc.setTextColor(0, 0, 0);
      doc.setFont("helvetica", "bold");
      doc.text("LOCADOR (EMPRESA)", 14, 35);
      doc.setFont("helvetica", "normal");
      doc.text(`Nome: ${locador.business_name || 'N/A'}`, 14, 42);
      doc.text(`CNPJ: ${locador.business_cnpj || 'N/A'}`, 14, 49);
      
      // Dados Locatário
      doc.setFont("helvetica", "bold");
      doc.text("LOCATÁRIO (CLIENTE)", pageWidth / 2 + 10, 35);
      doc.setFont("helvetica", "normal");
      doc.text(`Nome: ${order.customer_name}`, pageWidth / 2 + 10, 42);
      doc.text(`CPF: ${order.customer_cpf}`, pageWidth / 2 + 10, 49);
      
      // Tabela de Itens
      autoTable(doc, {
        startY: 90,
        head: [['Produto', 'Qtd', 'Preço/Dia']],
        body: order.items.map(i => [i.products.name, i.quantity, `R$ ${i.products.price.toFixed(2)}`]),
        headStyles: { fillColor: [37, 99, 235] },
      });

      const finalY = (doc as any).lastAutoTable.finalY || 120;
      doc.setFont("helvetica", "bold");
      doc.text(`VALOR TOTAL: R$ ${order.total_amount.toLocaleString('pt-BR')}`, pageWidth - 14, finalY + 15, { align: 'right' });

      // Certificado Digital (Página 2)
      if (isFinal && order.signed_at) {
        doc.addPage();
        doc.setFontSize(16);
        doc.text("CERTIFICADO DE ASSINATURA", pageWidth / 2, 20, { align: 'center' });
        doc.setFontSize(10);
        doc.setFont("helvetica", "normal");
        doc.text(`Assinado em: ${format(parseISO(order.signed_at), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}`, 14, 40);
        doc.text(`IP: ${order.signer_ip}`, 14, 50);
        doc.addImage(order.signature_image!, 'PNG', 14, 60, 50, 20);
      }

      for (let i = 1; i <= doc.internal.pages.length; i++) addWatermark(doc, i);
      doc.save(`contrato-${order.id.split('-')[0]}.pdf`);
    } catch (e) { showError("Erro ao gerar PDF"); } finally { setIsDownloading(false); }
  };

  if (loading) return <div className="min-h-screen flex items-center justify-center"><Loader2 className="animate-spin" /></div>;

  const isSigned = !!order?.signed_at;

  return (
    <div className="min-h-screen bg-gray-50 py-12 px-4">
      <div className="max-w-3xl mx-auto bg-white rounded-2xl shadow-xl overflow-hidden">
        
        {/* Header de Status */}
        <div className={cn("p-6 text-center border-b", isSigned ? "bg-green-50" : "bg-blue-50")}>
          <h1 className="text-2xl font-bold">Contrato Digital RentalPro</h1>
          <div className="mt-3">
            {isSigned ? (
              <Badge className="bg-green-600 text-white"><CheckCircle className="mr-2 h-4 w-4" /> ASSINADO</Badge>
            ) : (
              <Badge variant="outline" className="text-blue-600 border-blue-600">AGUARDANDO ASSINATURA</Badge>
            )}
          </div>
        </div>

        <div className="p-8 space-y-8">
          {/* Seção Dados Cliente */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="p-4 border rounded-xl bg-gray-50">
              <p className="text-xs font-bold text-gray-400">LOCATÁRIO</p>
              <p className="font-semibold">{order?.customer_name}</p>
              <p className="text-sm text-gray-500">{order?.customer_cpf}</p>
            </div>
            <div className="p-4 border rounded-xl bg-gray-50">
              <p className="text-xs font-bold text-gray-400">TOTAL DO ALUGUEL</p>
              <p className="font-bold text-xl text-blue-600">R$ {order?.total_amount.toLocaleString('pt-BR')}</p>
            </div>
          </div>

          {/* Assinatura */}
          <div className="pt-8 border-t">
            <p className="text-sm font-bold mb-4">ASSINATURA DO CLIENTE</p>
            {isSigned ? (
              <div className="h-32 border border-green-200 bg-green-50 rounded-xl flex items-center justify-center p-4">
                <img src={order?.signature_image || ''} className="max-h-full" alt="Assinatura" />
              </div>
            ) : (
              <div className="space-y-6">
                <SignaturePad onSave={setCustomerSignature} />
                <div className="flex items-start gap-3 bg-blue-50 p-4 rounded-xl">
                  <Checkbox id="terms" checked={agreed} onCheckedChange={(v) => setAgreed(!!v)} />
                  <label htmlFor="terms" className="text-sm text-blue-900">
                    Concordo com os termos de locação e responsabilidades por danos.
                  </label>
                </div>
                <Button 
                  onClick={handleSign} 
                  disabled={!agreed || !customerSignature || signing}
                  className="w-full h-14 text-lg bg-blue-600"
                >
                  {signing ? <Loader2 className="animate-spin" /> : "Finalizar e Assinar Contrato"}
                </Button>
              </div>
            )}

            {isSigned && (
              <Button onClick={generatePDF} variant="outline" className="w-full h-14 mt-4 text-green-600 border-green-600">
                <Download className="mr-2 h-5 w-5" /> Baixar PDF Assinado
              </Button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default SignContract;