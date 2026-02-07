"use client";

import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Loader2, CheckCircle, AlertTriangle, Download, Building, Phone, MapPin, User } from 'lucide-react';
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
    if (!orderId) return;
    setLoading(true);
    try {
      // 1. Busca os dados do pedido via RPC (Seguro para acesso público)
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
        status: rawOrder?.status || 'draft',
        fulfillment_type: rawOrder?.fulfillment_type || 'reservation',
        user_id: rawOrder?.user_id || rawOrder?.created_by || '',
        items: rawOrder?.items || []
      };

      setOrder(orderData);
      setCustomerSignature(orderData?.signature_image);

      // 2. Busca Perfil do Locador (Empresa)
      if (orderData?.user_id) {
        const { data: profileData, error: profileError } = await supabase
          .from('profiles')
          .select('business_name, business_cnpj, business_address, business_phone, signature_url')
          .eq('id', orderData.user_id)
          .single();

        if (profileError) {
          console.warn("[SignContract] Erro silencioso ao buscar perfil do locador:", profileError.message);
          // Fallback para dados vindos do RPC se houver falha de RLS no perfil direto
          setLocador({
            business_name: rawOrder?.owner_name || null,
            business_cnpj: rawOrder?.owner_cnpj || null,
            business_address: rawOrder?.owner_address || null,
            business_phone: rawOrder?.owner_phone || null,
            signature_url: rawOrder?.owner_signature || null
          });
        } else {
          setLocador(profileData);
        }
      }

    } catch (error: any) {
      console.error("[SignContract] Critical Error:", error.message);
      showError("Não foi possível carregar o contrato. Verifique o link.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [orderId]);

  const handleSign = async () => {
    if (!orderId || !order || !customerSignature) return;
    if (!agreed) {
      showError("Você deve concordar com os termos do contrato.");
      return;
    }

    setSigning(true);
    try {
      const ipRes = await fetch('https://api.ipify.org?format=json');
      const ipData = await ipRes.json();
      
      const newStatus = order?.fulfillment_type === 'immediate' ? 'picked_up' : 'reserved';
      
      const { error } = await supabase
        .from('orders')
        .update({
          signed_at: new Date().toISOString(),
          signer_ip: ipData?.ip || '0.0.0.0',
          signer_user_agent: navigator.userAgent,
          signature_image: customerSignature,
          status: newStatus,
          picked_up_at: newStatus === 'picked_up' ? new Date().toISOString() : null
        })
        .eq('id', orderId);

      if (error) throw error;

      showSuccess("Contrato assinado com sucesso!");
      fetchData(); 
    } catch (error: any) {
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
      
      const profile = locador || {};
      const isFinal = !!order.signed_at;
      
      // Função para adicionar rodapé com marca d'água
      const addWatermark = (doc: jsPDF, pageNumber: number) => {
        doc.setPage(pageNumber);
        doc.setFontSize(8);
        doc.setTextColor(150, 150, 150);
        const watermarkText = "Gerado e Assinado digitalmente via RentalPro (rentalpro.com.br)";
        doc.text(watermarkText, pageWidth / 2, pageHeight - 10, { align: 'center' });
      };
      
      // --- 1. Conteúdo do Contrato (Página 1) ---
      
      doc.setFontSize(20);
      doc.setTextColor(30, 58, 138);
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
      doc.text(`Nome: ${order.customer_name || 'N/A'}`, pageWidth / 2 + 10, 42);
      doc.text(`CPF: ${order.customer_cpf || 'N/A'}`, pageWidth / 2 + 10, 49);
      doc.text(`Telefone: ${order.customer_phone || 'N/A'}`, pageWidth / 2 + 10, 56);
      
      // Período e Valor
      doc.setFontSize(12);
      doc.text(`Pedido: #${order.id.split('-')[0]}`, 14, 75);
      doc.text(`Período: ${format(parseISO(order.start_date), "dd/MM/yyyy")} a ${format(parseISO(order.end_date), "dd/MM/yyyy")}`, 14, 82);

      // Tabela de Itens
      const tableData = order.items.map((item: any) => [
        item.products?.name || 'Produto',
        item.quantity,
        `R$ ${Number(item.products?.price || 0).toFixed(2)}`
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
      doc.text(`VALOR TOTAL: R$ ${Number(order.total_amount).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`, pageWidth - 14, finalY + 15, { align: 'right' });

      // Assinaturas (Locador e Locatário)
      let currentY = finalY + 40;
      
      // Assinatura do Locador (Dono)
      doc.setFontSize(10);
      doc.setFont("helvetica", "normal");
      doc.text("__________________________________________", pageWidth - 80, currentY);
      doc.text("Assinatura do Locador (RentalPro)", pageWidth - 80, currentY + 5);
      
      if (profile.signature_url) {
        doc.addImage(profile.signature_url, 'PNG', pageWidth - 80, currentY - 25, 60, 25);
      } else {
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

      // Add watermark to all pages
      const totalPages = doc.internal.pages.length;
      for (let i = 1; i <= totalPages; i++) {
        addWatermark(doc, i);
      }

      doc.save(`contrato-assinado-${order.id.split('-')[0]}.pdf`);
      showSuccess("Download do contrato finalizado iniciado.");
    } catch (error: any) {
      showError("Erro ao gerar PDF final: " + error.message);
    } finally {
      setIsDownloading(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-gray-50 gap-4">
        <Loader2 className="h-10 w-10 animate-spin text-blue-600" />
        <p className="text-muted-foreground font-medium">Carregando contrato...</p>
      </div>
    );
  }

  if (!order) {
    return (
      <div className="min-h-screen flex items-center justify-center p-8 bg-gray-50">
        <div className="text-center bg-white p-10 rounded-2xl shadow-xl border border-red-100 max-w-md">
          <AlertTriangle className="h-16 w-16 text-red-500 mx-auto mb-6" />
          <h1 className="text-2xl font-bold text-gray-900">Contrato não encontrado</h1>
          <p className="text-muted-foreground mt-3">Este contrato pode ter sido removido ou o link está incorreto.</p>
          <Button variant="outline" className="mt-8 w-full" onClick={() => window.location.reload()}>Tentar Novamente</Button>
        </div>
      </div>
    );
  }

  const isSigned = !!order?.signed_at;

  return (
    <div className="min-h-screen bg-gray-100 py-8 px-4 md:py-12">
      <div className="max-w-3xl mx-auto bg-white rounded-2xl shadow-xl overflow-hidden border border-gray-200">
        
        {/* Cabeçalho de Status */}
        <div className={cn(
          "p-6 text-center border-b",
          isSigned ? "bg-green-50 border-green-100" : "bg-blue-50 border-blue-100"
        )}>
          <h1 className="text-2xl font-bold text-gray-900">Contrato de Locação Digital</h1>
          <p className="text-sm text-gray-500 mt-1">Pedido #{order?.id?.split('-')[0] || '---'}</p>
          <div className="mt-3">
            {isSigned ? (
              <Badge className="bg-green-600 text-white hover:bg-green-700 py-1 px-4 gap-2">
                <CheckCircle className="h-4 w-4" /> CONTRATO ASSINADO
              </Badge>
            ) : (
              <Badge variant="outline" className="border-blue-600 text-blue-600 py-1 px-4 gap-2">
                <AlertTriangle className="h-4 w-4" /> AGUARDANDO ASSINATURA
              </Badge>
            )}
          </div>
        </div>

        <div className="p-6 md:p-10 space-y-8">
          
          {/* SEÇÃO 1: DADOS DO LOCADOR */}
          <div className="space-y-4">
            <h2 className="text-sm font-bold uppercase tracking-wider text-gray-400 flex items-center gap-2">
              <Building className="h-4 w-4" /> 1. Locador (Empresa)
            </h2>
            <div className="bg-gray-50 rounded-xl p-5 border border-gray-100">
              <p className="text-lg font-bold text-blue-900">{locador?.business_name || 'Nome da Empresa não configurado'}</p>
              <div className="mt-3 grid grid-cols-1 md:grid-cols-2 gap-3 text-sm text-gray-600">
                <div className="flex items-center gap-2">
                  <span className="font-semibold">CNPJ/CPF:</span> {locador?.business_cnpj || '---'}
                </div>
                <div className="flex items-center gap-2">
                  <Phone className="h-3 w-3" /> {locador?.business_phone || '---'}
                </div>
                <div className="flex items-center gap-2 col-span-full">
                  <MapPin className="h-3 w-3" /> {locador?.business_address || 'Endereço não informado'}
                </div>
              </div>
            </div>
          </div>

          {/* SEÇÃO 2: DADOS DO LOCATÁRIO */}
          <div className="space-y-4">
            <h2 className="text-sm font-bold uppercase tracking-wider text-gray-400 flex items-center gap-2">
              <User className="h-4 w-4" /> 2. Locatário (Cliente)
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="border rounded-xl p-4">
                <p className="text-xs text-gray-500 font-bold uppercase">Nome Completo</p>
                <p className="font-medium">{order?.customer_name || '---'}</p>
              </div>
              <div className="border rounded-xl p-4">
                <p className="text-xs text-gray-500 font-bold uppercase">Documento (CPF/CNPJ)</p>
                <p className="font-medium">{order?.customer_cpf || 'Não informado'}</p>
              </div>
            </div>
          </div>

          {/* SEÇÃO 3: ITENS E PERÍODO */}
          <div className="space-y-4">
            <h2 className="text-sm font-bold uppercase tracking-wider text-gray-400">3. Objeto da Locação e Valores</h2>
            <div className="border rounded-xl overflow-hidden">
              <div className="bg-gray-50 p-4 border-b flex justify-between items-center">
                <span className="text-sm font-semibold">Resumo do Período</span>
                <span className="text-sm font-bold text-blue-600">
                  {order?.start_date ? format(parseISO(order.start_date), "dd/MM/yy") : '---'} - {order?.end_date ? format(parseISO(order.end_date), "dd/MM/yy") : '---'}
                </span>
              </div>
              <div className="divide-y">
                {order?.items?.map((item, idx) => (
                  <div key={idx} className="p-4 flex justify-between items-center text-sm">
                    <span>{item?.products?.name || 'Produto'} <span className="text-gray-400 font-mono">x{item?.quantity || 0}</span></span>
                    <span className="font-medium">R$ {Number(item?.products?.price || 0).toFixed(2)} /dia</span>
                  </div>
                ))}
              </div>
              <div className="bg-blue-600 p-4 text-white flex justify-between items-center">
                <span className="font-bold">VALOR TOTAL</span>
                <span className="text-xl font-black">R$ {Number(order?.total_amount || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
              </div>
            </div>
          </div>

          {/* SEÇÃO 4: ASSINATURAS */}
          <div className="pt-8 border-t space-y-8">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              
              {/* Assinatura do Locador */}
              <div className="space-y-3">
                <p className="text-xs font-bold uppercase text-gray-400">Assinatura do Locador</p>
                <div className="h-32 border-2 border-dashed border-gray-100 rounded-xl flex flex-col items-center justify-center bg-gray-50 p-4">
                  {locador?.signature_url ? (
                    <img src={locador.signature_url} alt="Assinatura Locador" className="max-h-full object-contain" />
                  ) : (
                    <p className="text-lg font-serif italic text-gray-400">{locador?.business_name || 'Assinatura Padrão'}</p>
                  )}
                  <div className="mt-2 text-[10px] text-gray-400 uppercase font-bold">Assinado Digitalmente</div>
                </div>
              </div>

              {/* Assinatura do Locatário */}
              <div className="space-y-3">
                <p className="text-xs font-bold uppercase text-gray-400">Sua Assinatura (Locatário)</p>
                {isSigned ? (
                  <div className="h-32 border-2 border-dashed border-green-100 rounded-xl flex items-center justify-center bg-green-50 p-4">
                    <img src={order?.signature_image || ''} alt="Sua Assinatura" className="max-h-full object-contain" />
                  </div>
                ) : (
                  <SignaturePad onSave={setCustomerSignature} initialSignature={customerSignature} disabled={signing} />
                )}
              </div>
            </div>

            {!isSigned && (
              <div className="space-y-4 bg-orange-50 border border-orange-100 p-6 rounded-2xl">
                <div className="flex items-start gap-3">
                  <Checkbox id="terms" checked={agreed} onCheckedChange={(val) => setAgreed(!!val)} className="mt-1" />
                  <label htmlFor="terms" className="text-sm text-orange-900 leading-relaxed cursor-pointer">
                    Confirmo que recebi os itens em perfeito estado e concordo com todos os termos de locação, responsabilidades por danos e prazos de devolução estabelecidos neste instrumento.
                  </label>
                </div>
                <Button 
                  onClick={handleSign} 
                  disabled={!agreed || !customerSignature || signing}
                  className="w-full h-14 bg-blue-600 hover:bg-blue-700 text-lg font-bold shadow-lg shadow-blue-100 active:scale-[0.98] transition-all"
                >
                  {signing ? <Loader2 className="mr-2 h-5 w-5 animate-spin" /> : <CheckCircle className="mr-2 h-5 w-5" />}
                  {signing ? 'Processando Assinatura...' : 'Finalizar e Assinar Contrato'}
                </Button>
              </div>
            )}

            {isSigned && (
              <Button 
                onClick={generatePDF} 
                disabled={isDownloading}
                variant="outline"
                className="w-full h-14 border-green-600 text-green-600 hover:bg-green-50 font-bold gap-2"
              >
                {isDownloading ? <Loader2 className="h-5 w-5 animate-spin" /> : <Download className="h-5 w-5" />}
                Baixar Via do Contrato (PDF)
              </Button>
            )}
          </div>

        </div>
      </div>
      <div className="mt-8 text-center text-gray-400 text-xs">
        Documento gerado eletronicamente via <span className="font-bold">RentalPro</span>
      </div>
    </div>
  );
};

export default SignContract;