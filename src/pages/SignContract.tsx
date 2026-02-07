"use client";

import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Loader2, CheckCircle, AlertTriangle, Download, MessageCircle, Building } from 'lucide-react';
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

interface ProductItem {
  name: string;
  price: number;
}

interface OrderItem {
  quantity: number;
  products: ProductItem;
}

interface ContractData {
  order_id: string;
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
  fulfillment_type: 'immediate' | 'reservation';
  
  // Owner Profile Data
  owner_name: string | null;
  owner_cnpj: string | null;
  owner_address: string | null;
  owner_phone: string | null;
  owner_signature: string | null;

  items: OrderItem[];
}

const SignContract = () => {
  const { orderId } = useParams<{ orderId: string }>();
  const navigate = useNavigate();
  const [data, setData] = useState<ContractData | null>(null);
  const [loading, setLoading] = useState(true);
  const [signing, setSigning] = useState(false);
  const [customerSignature, setCustomerSignature] = useState<string | null>(null);
  const [agreed, setAgreed] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);

  const fetchContractData = async () => {
    if (!orderId) return;
    setLoading(true);
    try {
      // 1. Busca os dados do pedido via RPC (necessário para ignorar RLS e pegar itens)
      const { data: rpcData, error: rpcError } = await supabase.rpc('get_contract_data', { 
        p_order_id: orderId 
      });

      if (rpcError) throw rpcError;
      if (!rpcData || rpcData.length === 0) throw new Error("Contrato não encontrado.");

      const baseContract = rpcData[0];

      // 2. Busca o pedido bruto para pegar o 'user_id' e 'fulfillment_type' (campos às vezes omitidos no RPC)
      // Nota: Usamos a tabela orders diretamente para garantir que pegamos o dono correto
      const { data: orderRaw, error: orderError } = await supabase
        .from('orders')
        .select('user_id, fulfillment_type')
        .eq('id', orderId)
        .single();

      if (orderError) {
        console.warn("[SignContract] Erro ao buscar user_id do pedido:", orderError.message);
      }

      const targetUserId = orderRaw?.user_id || baseContract.user_id;

      // 3. Busca o perfil do DONO do pedido (Locador)
      // Se o RPC falhou em trazer o dono, tentamos buscar manualmente pelo ID do dono do pedido
      let ownerInfo = {
        name: baseContract.owner_name,
        cnpj: baseContract.owner_cnpj,
        address: baseContract.owner_address,
        phone: baseContract.owner_phone,
        signature: baseContract.owner_signature
      };

      if (!ownerInfo.name && targetUserId) {
        const { data: profileData, error: profileError } = await supabase
          .from('profiles')
          .select('business_name, business_cnpj, business_address, business_phone, signature_url')
          .eq('id', targetUserId)
          .single();
        
        if (!profileError && profileData) {
          ownerInfo = {
            name: profileData.business_name,
            cnpj: profileData.business_cnpj,
            address: profileData.business_address,
            phone: profileData.business_phone,
            signature: profileData.signature_url
          };
        }
      }

      const contractData: ContractData = {
        ...baseContract,
        fulfillment_type: orderRaw?.fulfillment_type || baseContract.fulfillment_type || 'reservation',
        owner_name: ownerInfo.name,
        owner_cnpj: ownerInfo.cnpj,
        owner_address: ownerInfo.address,
        owner_phone: ownerInfo.phone,
        owner_signature: ownerInfo.signature,
      };
      
      setData(contractData);
      setCustomerSignature(contractData.signature_image);
    } catch (error: any) {
      showError(error.message);
      setData(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchContractData();
  }, [orderId]);

  const handleSign = async () => {
    if (!orderId || !data || !customerSignature) return;
    if (!agreed) {
      showError("Você deve concordar com os termos do contrato.");
      return;
    }

    setSigning(true);
    try {
      const ipResponse = await fetch('https://api.ipify.org?format=json');
      const ipData = await ipResponse.json();
      const signer_ip = ipData.ip;
      const signer_user_agent = navigator.userAgent;
      
      const newStatus = data.fulfillment_type === 'immediate' ? 'picked_up' : 'reserved';
      
      const updatePayload: any = {
        signed_at: new Date().toISOString(),
        signer_ip: signer_ip,
        signer_user_agent: signer_user_agent,
        signature_image: customerSignature,
        status: newStatus
      };
      
      if (newStatus === 'picked_up') {
          updatePayload.picked_up_at = new Date().toISOString();
      }
      
      const { error } = await supabase
        .from('orders')
        .update(updatePayload)
        .eq('id', orderId);

      if (error) throw error;

      showSuccess("Contrato assinado com sucesso!");
      fetchContractData(); 
    } catch (error: any) {
      showError("Erro ao assinar contrato: " + error.message);
    } finally {
      setSigning(false);
    }
  };

  const generateFinalPDF = async (contractData: ContractData) => {
    setIsDownloading(true);
    try {
      const doc = new jsPDF();
      const pageWidth = doc.internal.pageSize.getWidth();
      const pageHeight = doc.internal.pageSize.getHeight();
      
      const addWatermark = (doc: jsPDF, pageNumber: number) => {
        doc.setPage(pageNumber);
        doc.setFontSize(8);
        doc.setTextColor(150, 150, 150);
        const watermarkText = "Gerado e Assinado digitalmente via RentalPro (rentalpro.com.br)";
        const textWidth = doc.getStringUnitWidth(watermarkText) * doc.getFontSize() / doc.internal.scaleFactor;
        const x = (pageWidth - textWidth) / 2;
        const y = pageHeight - 10;
        doc.text(watermarkText, pageWidth / 2, y, { align: 'center' });
      };
      
      doc.setFontSize(20);
      doc.setTextColor(30, 58, 138);
      doc.text("CONTRATO DE LOCAÇÃO", pageWidth / 2, 20, { align: 'center' });
      
      doc.setFontSize(12);
      doc.setTextColor(0, 0, 0);
      doc.setFont("helvetica", "bold");
      doc.text("LOCADOR (EMPRESA)", 14, 35);
      doc.setFont("helvetica", "normal");
      doc.text(`Nome: ${contractData.owner_name || 'N/A'}`, 14, 42);
      doc.text(`CNPJ/CPF: ${contractData.owner_cnpj || 'N/A'}`, 14, 49);
      doc.text(`Endereço: ${contractData.owner_address || 'N/A'}`, 14, 56);
      doc.text(`Telefone: ${contractData.owner_phone || 'N/A'}`, 14, 63);
      
      doc.setFont("helvetica", "bold");
      doc.text("LOCATÁRIO (CLIENTE)", pageWidth / 2 + 10, 35);
      doc.setFont("helvetica", "normal");
      doc.text(`Nome: ${contractData.customer_name}`, pageWidth / 2 + 10, 42);
      doc.text(`CPF: ${contractData.customer_cpf || 'N/A'}`, pageWidth / 2 + 10, 49);
      doc.text(`Telefone: ${contractData.customer_phone || 'N/A'}`, pageWidth / 2 + 10, 56);
      
      doc.setFontSize(12);
      doc.text(`Pedido: #${contractData.order_id.split('-')[0]}`, 14, 75);
      doc.text(`Período: ${format(parseISO(contractData.start_date), "dd/MM/yyyy")} a ${format(parseISO(contractData.end_date), "dd/MM/yyyy")}`, 14, 82);
      
      const tableData = contractData.items.map((item: any) => [
        item.products.name,
        item.quantity,
        `R$ ${Number(item.products.price).toFixed(2)}`
      ]);

      autoTable(doc, {
        startY: 90,
        head: [['Produto', 'Qtd', 'Preço/Dia']],
        body: tableData,
        headStyles: { fillStyle: 'F', fillColor: [37, 99, 235] },
      });

      const finalY = (doc as any).lastAutoTable.finalY || 120;
      doc.setFontSize(14);
      doc.setFont("helvetica", "bold");
      doc.text(`VALOR TOTAL: R$ ${Number(contractData.total_amount).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`, pageWidth - 14, finalY + 15, { align: 'right' });

      let currentY = finalY + 40;
      doc.setFontSize(10);
      doc.setFont("helvetica", "normal");
      doc.text("__________________________________________", pageWidth - 80, currentY);
      doc.text("Assinatura do Locador (RentalPro)", pageWidth - 80, currentY + 5);
      
      if (contractData.owner_signature) {
        doc.addImage(contractData.owner_signature, 'PNG', pageWidth - 80, currentY - 25, 60, 25);
      }

      doc.text("__________________________________________", 14, currentY);
      doc.text("Assinatura do Locatário (Cliente)", 14, currentY + 5);
      
      if (contractData.signature_image) {
        doc.addImage(contractData.signature_image, 'PNG', 14, currentY - 25, 60, 25);
      }
      
      const totalPages = doc.internal.pages.length;
      for (let i = 1; i <= totalPages; i++) {
        addWatermark(doc, i);
      }

      doc.save(`contrato-assinado-${contractData.order_id.split('-')[0]}.pdf`);
    } catch (error: any) {
      showError("Erro ao gerar PDF: " + error.message);
    } finally {
      setIsDownloading(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <Loader2 className="h-10 w-10 animate-spin text-blue-600" />
      </div>
    );
  }

  if (!data || !orderId) {
    return (
      <div className="min-h-screen flex items-center justify-center p-8 text-center bg-gray-50">
        <div className="bg-white p-8 rounded-xl shadow-lg border border-red-100">
          <AlertTriangle className="h-10 w-10 text-red-500 mx-auto mb-4" />
          <h1 className="text-2xl font-bold mb-2">Contrato Não Encontrado</h1>
          <p className="text-muted-foreground">Verifique o link ou se o pedido foi excluído.</p>
        </div>
      </div>
    );
  }

  const isSigned = !!data.signed_at;

  return (
    <div className="min-h-screen flex flex-col items-center p-4 md:p-8 bg-gray-100">
      <div className="w-full max-w-3xl bg-white rounded-xl shadow-2xl p-6 md:p-10 space-y-8">
        
        <div className="text-center space-y-2">
          <h1 className="text-3xl font-bold text-blue-600">Contrato de Locação</h1>
          <p className="text-lg text-gray-700">Pedido #{data.order_id.split('-')[0]}</p>
          {isSigned ? (
            <Badge className="bg-green-100 text-green-800 border-green-200 text-base py-1 px-3">
              <CheckCircle className="h-4 w-4 mr-2" /> ASSINADO DIGITALMENTE
            </Badge>
          ) : (
            <p className="text-orange-600 font-semibold flex items-center justify-center gap-2">
              <AlertTriangle className="h-4 w-4" /> Aguardando sua assinatura
            </p>
          )}
        </div>

        {/* Detalhes do Locador resolvidos dinamicamente */}
        <div className="border rounded-xl p-4 bg-gray-50 space-y-2">
          <p className="text-sm font-bold text-gray-700 flex items-center gap-2">
            <Building className="h-4 w-4"/> Locador (Empresa)
          </p>
          <p className="text-sm font-semibold text-blue-900">{data.owner_name || 'Nome da Empresa não configurado.'}</p>
          <p className="text-xs text-muted-foreground">CNPJ/CPF: {data.owner_cnpj || 'N/A'} | Tel: {data.owner_phone || 'N/A'}</p>
          <p className="text-xs text-muted-foreground">Endereço: {data.owner_address || 'Endereço não informado.'}</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 border-b pb-4">
          <div className="space-y-1">
            <p className="text-sm font-semibold text-muted-foreground">Locatário (Cliente)</p>
            <p className="text-lg font-medium">{data.customer_name}</p>
            <p className="text-sm text-gray-500">CPF: {data.customer_cpf}</p>
            <p className="text-sm text-gray-500">Tel: {data.customer_phone}</p>
          </div>
          <div className="space-y-1">
            <p className="text-sm font-semibold text-muted-foreground">Período</p>
            <p className="text-lg font-medium">
              {format(parseISO(data.start_date), "dd/MM/yyyy", { locale: ptBR })}
              <span className="mx-2 text-gray-400">→</span>
              {format(parseISO(data.end_date), "dd/MM/yyyy", { locale: ptBR })}
            </p>
            <p className="text-sm font-bold text-blue-600">
              Total: R$ {Number(data.total_amount).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
            </p>
          </div>
        </div>

        <div className="space-y-3">
          <h3 className="text-xl font-bold text-gray-700">Itens da Locação</h3>
          <div className="border rounded-lg divide-y bg-gray-50">
            {data.items.map((item, idx) => (
              <div key={idx} className="p-4 flex justify-between items-center">
                <div className="space-y-1">
                  <p className="font-medium text-base">{item.products.name} x {item.quantity}</p>
                  <p className="text-xs text-muted-foreground">
                    Diária: R$ {Number(item.products.price).toFixed(2)}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
        
        <div className="space-y-4 pt-4 border-t">
          <h3 className="text-xl font-bold text-gray-700">Assinaturas</h3>
          
          <div className="border rounded-xl p-4 bg-blue-50 border-blue-100">
            <p className="text-sm font-semibold text-blue-800 mb-2">Locador (Digitalmente Assinado)</p>
            <div className="h-[60px] flex items-center justify-center">
              {data.owner_signature ? (
                <img 
                  src={data.owner_signature} 
                  alt="Assinatura do Locador" 
                  className="max-h-full max-w-full object-contain"
                />
              ) : (
                <p className="text-sm text-muted-foreground italic font-serif">{data.owner_name || 'Assinatura Padrão'}</p>
              )}
            </div>
          </div>

          <div className="border rounded-xl p-4 bg-white shadow-md">
            <p className="text-sm font-semibold text-gray-800 mb-2">Locatário (Sua Assinatura)</p>
            
            {isSigned ? (
              <div className="h-[60px] flex items-center justify-center">
                <img 
                  src={data.signature_image || ''} 
                  alt="Sua Assinatura" 
                  className="max-h-full max-w-full object-contain"
                />
              </div>
            ) : (
              <SignaturePad 
                onSave={setCustomerSignature}
                initialSignature={customerSignature}
                disabled={signing || isSigned}
              />
            )}
          </div>
        </div>

        <div className="space-y-4 pt-4 border-t">
          {!isSigned ? (
            <>
              <div className="flex items-center space-x-2">
                <Checkbox 
                  id="terms" 
                  checked={agreed} 
                  onCheckedChange={(checked) => setAgreed(!!checked)}
                />
                <label
                  htmlFor="terms"
                  className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                >
                  Li e concordo com os termos do contrato de locação.
                </label>
              </div>
              <Button 
                onClick={handleSign} 
                disabled={!agreed || !customerSignature || signing}
                className="w-full h-12 bg-blue-600 hover:bg-blue-700"
              >
                {signing ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <CheckCircle className="mr-2 h-5 w-5" />}
                {signing ? 'Salvando...' : 'Assinar Digitalmente'}
              </Button>
            </>
          ) : (
            <Button 
              onClick={() => generateFinalPDF(data)} 
              disabled={isDownloading}
              className="w-full h-12 bg-green-600 hover:bg-green-700"
            >
              {isDownloading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Download className="mr-2 h-5 w-5" />}
              Baixar Contrato Finalizado (PDF)
            </Button>
          )}
        </div>
      </div>
    </div>
  );
};

export default SignContract;