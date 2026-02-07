"use client";

import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { Loader2, CheckCircle, AlertTriangle, Download, Building, Phone, MapPin, User, FileSignature } from 'lucide-react';
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

// --- INTERFACES ---

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
  email?: string | null;
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
  
  // Estados
  const [order, setOrder] = useState<ContractData | null>(null);
  const [locador, setLocador] = useState<LocadorData | null>(null);
  const [loading, setLoading] = useState(true);
  const [signing, setSigning] = useState(false);
  const [customerSignature, setCustomerSignature] = useState<string | null>(null);
  const [agreed, setAgreed] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);

  // --- BUSCA DE DADOS (CRÍTICO) ---
  const fetchData = async () => {
    if (!orderId) return;
    setLoading(true);
    
    try {
      // 1. Busca os dados do pedido
      // Usamos RPC se disponível, ou fallback para select direto (agora que liberamos acesso no SQL)
      let rawOrder = null;

      const { data: rpcData, error: rpcError } = await supabase.rpc('get_contract_data', { 
        p_order_id: orderId 
      });

      if (!rpcError && rpcData && rpcData.length > 0) {
        rawOrder = rpcData[0];
      } else {
        // Fallback: Tenta buscar direto na tabela orders se o RPC falhar
        console.log("RPC falhou ou vazio, tentando busca direta...");
        const { data: directData, error: directError } = await supabase
          .from('orders')
          .select(`
            *,
            items:order_items(
              quantity,
              products(name, price)
            )
          `)
          .eq('id', orderId)
          .single();
          
        if (directError) throw directError;
        rawOrder = directData;
      }

      if (!rawOrder) throw new Error("Contrato não encontrado.");

      // Normaliza os dados do pedido
      const orderData: ContractData = {
        id: rawOrder.order_id || rawOrder.id,
        customer_name: rawOrder.customer_name,
        customer_phone: rawOrder.customer_phone,
        customer_cpf: rawOrder.customer_cpf,
        start_date: rawOrder.start_date,
        end_date: rawOrder.end_date,
        total_amount: rawOrder.total_amount,
        signed_at: rawOrder.signed_at,
        signature_image: rawOrder.signature_image,
        signer_ip: rawOrder.signer_ip,
        signer_user_agent: rawOrder.signer_user_agent,
        status: rawOrder.status,
        fulfillment_type: rawOrder.fulfillment_type || 'reservation',
        user_id: rawOrder.user_id || rawOrder.created_by, // Garante que pega o ID do dono
        items: rawOrder.items || []
      };

      setOrder(orderData);
      setCustomerSignature(orderData.signature_image);

      // 2. BUSCA O PERFIL DO DONO DA EMPRESA (LOCADOR)
      // Aqui acontece a mágica para mostrar seus dados
      if (orderData.user_id) {
        console.log("Buscando perfil da empresa para ID:", orderData.user_id);
        
        const { data: profileData, error: profileError } = await supabase
          .from('profiles')
          .select('*') // Pega business_name, cnpj, signature_url, etc.
          .eq('id', orderData.user_id)
          .single();

        if (profileError) {
          console.warn("Erro ao buscar perfil:", profileError.message);
        } else if (profileData) {
          console.log("Perfil carregado:", profileData);
          setLocador(profileData);
        }
      } else {
        console.error("ERRO: Pedido sem user_id vinculado.");
      }

    } catch (error: any) {
      console.error("[SignContract] Erro Fatal:", error.message);
      showError("Não foi possível carregar o contrato. Verifique o link.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [orderId]);

  // --- ASSINATURA ---
  const handleSign = async () => {
    if (!orderId || !order || !customerSignature) return;
    if (!agreed) {
      showError("Você deve concordar com os termos do contrato.");
      return;
    }

    setSigning(true);
    try {
      // Tenta pegar o IP (opcional)
      let ip = '0.0.0.0';
      try {
        const ipRes = await fetch('https://api.ipify.org?format=json');
        const ipData = await ipRes.json();
        ip = ipData.ip;
      } catch (e) { console.warn("Erro ao pegar IP", e); }
      
      const newStatus = order.fulfillment_type === 'immediate' ? 'picked_up' : 'reserved';
      
      const { error } = await supabase
        .from('orders')
        .update({
          signed_at: new Date().toISOString(),
          signer_ip: ip,
          signer_user_agent: navigator.userAgent,
          signature_image: customerSignature,
          status: newStatus,
          picked_up_at: newStatus === 'picked_up' ? new Date().toISOString() : null
        })
        .eq('id', orderId);

      if (error) throw error;

      showSuccess("Contrato assinado com sucesso!");
      fetchData(); // Recarrega para mostrar a tela de sucesso
    } catch (error: any) {
      showError("Erro ao assinar: " + error.message);
    } finally {
      setSigning(false);
    }
  };
  
  // --- GERAÇÃO DE PDF ---
  const generatePDF = async () => {
    if (!order || !locador) return;
    setIsDownloading(true);
    
    try {
      const doc = new jsPDF();
      const pageWidth = doc.internal.pageSize.getWidth();
      const pageHeight = doc.internal.pageSize.getHeight();
      
      const profile = locador || {};
      const isFinal = !!order.signed_at;
      
      // Rodapé / Marca d'água
      const addWatermark = (doc: jsPDF, pageNumber: number) => {
        doc.setPage(pageNumber);
        doc.setFontSize(8);
        doc.setTextColor(150, 150, 150);
        doc.text("Gerado e Assinado digitalmente via RentalPro", pageWidth / 2, pageHeight - 10, { align: 'center' });
      };
      
      // Cabeçalho
      doc.setFontSize(20);
      doc.setTextColor(30, 58, 138);
      doc.text("CONTRATO DE LOCAÇÃO", pageWidth / 2, 20, { align: 'center' });
      
      // Locador
      doc.setFontSize(12);
      doc.setTextColor(0, 0, 0);
      doc.setFont("helvetica", "bold");
      doc.text("LOCADOR (EMPRESA)", 14, 35);
      doc.setFont("helvetica", "normal");
      doc.text(`Nome: ${profile.business_name || 'N/A'}`, 14, 42);
      doc.text(`CNPJ: ${profile.business_cnpj || 'N/A'}`, 14, 49);
      doc.text(`Endereço: ${profile.business_address || 'N/A'}`, 14, 56);
      doc.text(`Contato: ${profile.business_phone || 'N/A'}`, 14, 63);
      
      // Locatário
      doc.setFont("helvetica", "bold");
      doc.text("LOCATÁRIO (CLIENTE)", pageWidth / 2 + 10, 35);
      doc.setFont("helvetica", "normal");
      doc.text(`Nome: ${order.customer_name || 'N/A'}`, pageWidth / 2 + 10, 42);
      doc.text(`CPF: ${order.customer_cpf || 'N/A'}`, pageWidth / 2 + 10, 49);
      doc.text(`Telefone: ${order.customer_phone || 'N/A'}`, pageWidth / 2 + 10, 56);
      
      // Detalhes
      doc.setFontSize(12);
      doc.text(`Pedido: #${order.id.split('-')[0]}`, 14, 75);
      doc.text(`Período: ${format(parseISO(order.start_date), "dd/MM/yyyy")} a ${format(parseISO(order.end_date), "dd/MM/yyyy")}`, 14, 82);

      // Tabela
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
      doc.text(`TOTAL: R$ ${Number(order.total_amount).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`, pageWidth - 14, finalY + 15, { align: 'right' });

      // Área de Assinaturas
      let currentY = finalY + 40;
      if (currentY > pageHeight - 60) {
          doc.addPage();
          currentY = 40;
      }
      
      // Assinatura Locador
      doc.setFontSize(10);
      doc.setFont("helvetica", "normal");
      doc.text("__________________________________________", pageWidth - 80, currentY);
      doc.text("Assinatura do Locador", pageWidth - 80, currentY + 5);
      
      if (profile.signature_url) {
        try {
            doc.addImage(profile.signature_url, 'PNG', pageWidth - 80, currentY - 25, 60, 25);
        } catch (e) { console.warn("Erro ao add img locador no pdf", e); }
      } else {
        doc.setFont("times", "italic");
        doc.text(profile.business_name || 'Assinado Digitalmente', pageWidth - 80, currentY - 10);
        doc.setFont("helvetica", "normal");
      }

      // Assinatura Cliente
      doc.text("__________________________________________", 14, currentY);
      doc.text("Assinatura do Locatário", 14, currentY + 5);
      
      if (order.signature_image) {
        try {
            doc.addImage(order.signature_image, 'PNG', 14, currentY - 25, 60, 25);
        } catch (e) { console.warn("Erro ao add img cliente no pdf", e); }
      }

      // Certificado
      if (isFinal && order.signed_at) {
        doc.addPage();
        doc.setFontSize(18);
        doc.setTextColor(30, 58, 138);
        doc.text("CERTIFICADO DE ASSINATURA", pageWidth / 2, 20, { align: 'center' });
        doc.setFontSize(10);
        doc.setTextColor(0, 0, 0);
        const auditY = 40;
        doc.text(`Hash: ${order.id}`, 14, auditY);
        doc.text(`Assinado em: ${format(parseISO(order.signed_at), "dd/MM/yyyy HH:mm:ss")}`, 14, auditY + 10);
        doc.text(`IP: ${order.signer_ip || 'N/A'}`, 14, auditY + 20);
        doc.text(`User Agent: ${order.signer_user_agent || 'N/A'}`, 14, auditY + 30, { maxWidth: pageWidth - 28 });
      }

      const totalPages = doc.internal.pages.length;
      for (let i = 1; i <= totalPages; i++) {
        addWatermark(doc, i);
      }

      doc.save(`contrato-${order.id.split('-')[0]}.pdf`);
      showSuccess("PDF gerado!");
    } catch (error: any) {
      showError("Erro no PDF: " + error.message);
    } finally {
      setIsDownloading(false);
    }
  };

  // --- RENDERIZAÇÃO ---
  if (loading) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-gray-50 gap-4">
        <Loader2 className="h-10 w-10 animate-spin text-blue-600" />
        <p className="text-muted-foreground font-medium">Buscando contrato...</p>
      </div>
    );
  }

  if (!order) {
    return (
      <div className="min-h-screen flex items-center justify-center p-8 bg-gray-50">
        <div className="text-center bg-white p-10 rounded-2xl shadow-xl border border-red-100 max-w-md">
          <AlertTriangle className="h-16 w-16 text-red-500 mx-auto mb-6" />
          <h1 className="text-2xl font-bold text-gray-900">Contrato Indisponível</h1>
          <p className="text-muted-foreground mt-3">Verifique o link ou entre em contato com a locadora.</p>
          <Button variant="outline" className="mt-8 w-full" onClick={() => window.location.reload()}>Recarregar</Button>
        </div>
      </div>
    );
  }

  const isSigned = !!order?.signed_at;

  return (
    <div className="min-h-screen bg-gray-100 py-8 px-4 md:py-12 font-sans">
      <div className="max-w-3xl mx-auto bg-white rounded-2xl shadow-xl overflow-hidden border border-gray-200">
        
        {/* Cabeçalho */}
        <div className={cn(
          "p-6 text-center border-b",
          isSigned ? "bg-green-50 border-green-100" : "bg-blue-50 border-blue-100"
        )}>
          <h1 className="text-2xl font-bold text-gray-900">Contrato de Locação</h1>
          <p className="text-sm text-gray-500 mt-1">Pedido #{order?.id?.split('-')[0]}</p>
          <div className="mt-3 flex justify-center">
            {isSigned ? (
              <Badge className="bg-green-600 text-white py-1 px-4 gap-2 text-sm">
                <CheckCircle className="h-4 w-4" /> ASSINADO
              </Badge>
            ) : (
              <Badge variant="outline" className="border-blue-600 text-blue-600 py-1 px-4 gap-2 text-sm">
                <FileSignature className="h-4 w-4" /> AGUARDANDO ASSINATURA
              </Badge>
            )}
          </div>
        </div>

        <div className="p-6 md:p-10 space-y-8">
          
          {/* 1. LOCADOR */}
          <div className="space-y-4">
            <h2 className="text-xs font-bold uppercase tracking-wider text-gray-400 flex items-center gap-2">
              <Building className="h-4 w-4" /> 1. Locador (Empresa)
            </h2>
            <div className="bg-gray-50 rounded-xl p-5 border border-gray-100 shadow-sm">
              {/* NOME DA EMPRESA */}
              <p className="text-xl font-bold text-blue-900 mb-2">
                {locador?.business_name || <span className="text-gray-400 italic">Carregando dados da empresa...</span>}
              </p>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-y-2 gap-x-4 text-sm text-gray-600">
                <div className="flex items-center gap-2">
                  <span className="font-semibold w-16">CNPJ:</span> 
                  <span>{locador?.business_cnpj || '---'}</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="font-semibold w-16">Telefone:</span> 
                  <span className="flex items-center gap-1"><Phone className="h-3 w-3" /> {locador?.business_phone || '---'}</span>
                </div>
                <div className="flex items-center gap-2 col-span-full">
                  <span className="font-semibold w-16">Endereço:</span> 
                  <span className="flex items-center gap-1"><MapPin className="h-3 w-3" /> {locador?.business_address || '---'}</span>
                </div>
              </div>
            </div>
          </div>

          {/* 2. LOCATÁRIO */}
          <div className="space-y-4">
            <h2 className="text-xs font-bold uppercase tracking-wider text-gray-400 flex items-center gap-2">
              <User className="h-4 w-4" /> 2. Locatário (Cliente)
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="border rounded-xl p-4 bg-white">
                <p className="text-xs text-gray-500 font-bold uppercase mb-1">Nome Completo</p>
                <p className="font-medium text-gray-900">{order.customer_name}</p>
              </div>
              <div className="border rounded-xl p-4 bg-white">
                <p className="text-xs text-gray-500 font-bold uppercase mb-1">Documento</p>
                <p className="font-medium text-gray-900">{order.customer_cpf}</p>
              </div>
            </div>
          </div>

          {/* 3. RESUMO DO PEDIDO */}
          <div className="space-y-4">
            <h2 className="text-xs font-bold uppercase tracking-wider text-gray-400">3. Detalhes da Locação</h2>
            <div className="border rounded-xl overflow-hidden shadow-sm">
              <div className="bg-gray-50 p-4 border-b flex flex-wrap justify-between items-center gap-2">
                <span className="text-sm font-semibold text-gray-600">Período Selecionado</span>
                <span className="text-sm font-bold text-blue-700 bg-blue-50 px-3 py-1 rounded-full border border-blue-100">
                  {format(parseISO(order.start_date), "dd/MM/yy")} até {format(parseISO(order.end_date), "dd/MM/yy")}
                </span>
              </div>
              <div className="divide-y divide-gray-100">
                {order.items.map((item, idx) => (
                  <div key={idx} className="p-4 flex justify-between items-center text-sm hover:bg-gray-50 transition-colors">
                    <div className="flex items-center gap-3">
                      <div className="h-8 w-8 bg-blue-100 text-blue-600 rounded-lg flex items-center justify-center font-bold text-xs">
                        {item.quantity}x
                      </div>
                      <span className="font-medium text-gray-700">{item.products?.name}</span>
                    </div>
                    <span className="font-semibold text-gray-900">R$ {Number(item.products?.price).toFixed(2)}</span>
                  </div>
                ))}
              </div>
              <div className="bg-gray-900 p-4 text-white flex justify-between items-center">
                <span className="font-medium text-gray-300">Total Estimado</span>
                <span className="text-xl font-bold">R$ {Number(order.total_amount).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
              </div>
            </div>
          </div>

          {/* 4. ASSINATURAS */}
          <div className="pt-8 border-t space-y-8">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              
              {/* Assinatura EMPRESA */}
              <div className="space-y-3">
                <p className="text-xs font-bold uppercase text-gray-400 text-center md:text-left">Locador (Empresa)</p>
                <div className="h-40 border-2 border-dashed border-gray-200 rounded-xl flex flex-col items-center justify-center bg-gray-50 p-6 relative overflow-hidden">
                  {locador?.signature_url ? (
                    <img 
                      src={locador.signature_url} 
                      alt="Assinatura Locador" 
                      className="h-full w-auto object-contain max-w-full" 
                    />
                  ) : (
                    <div className="text-center z-10">
                      <p className="text-2xl font-serif italic text-gray-400 mb-1">
                        {locador?.business_name ? locador.business_name.split(' ')[0] : 'Assinatura'}
                      </p>
                      <p className="text-[10px] text-gray-300 uppercase">Assinado Digitalmente</p>
                    </div>
                  )}
                </div>
              </div>

              {/* Assinatura CLIENTE */}
              <div className="space-y-3">
                <p className="text-xs font-bold uppercase text-gray-400 text-center md:text-left">Locatário (Você)</p>
                {isSigned ? (
                  <div className="h-40 border-2 border-dashed border-green-200 rounded-xl flex items-center justify-center bg-green-50 p-6">
                    <img src={order.signature_image || ''} alt="Sua Assinatura" className="h-full w-auto object-contain max-w-full" />
                  </div>
                ) : (
                  <div className="h-40">
                    <SignaturePad 
                      onSave={setCustomerSignature} 
                      initialSignature={customerSignature} 
                      disabled={signing} 
                    />
                  </div>
                )}
              </div>
            </div>

            {/* Checkbox e Botão de Ação */}
            {!isSigned && (
              <div className="space-y-4 bg-orange-50 border border-orange-100 p-6 rounded-2xl animate-in fade-in slide-in-from-bottom-4 duration-500">
                <div className="flex items-start gap-3">
                  <Checkbox 
                    id="terms" 
                    checked={agreed} 
                    onCheckedChange={(val) => setAgreed(!!val)} 
                    className="mt-1 data-[state=checked]:bg-blue-600 border-orange-300" 
                  />
                  <label htmlFor="terms" className="text-sm text-orange-900 leading-relaxed cursor-pointer select-none">
                    Declaro que li e concordo com os termos do contrato, recebendo os equipamentos em perfeito estado de funcionamento e conservação.
                  </label>
                </div>
                <Button 
                  onClick={handleSign} 
                  disabled={!agreed || !customerSignature || signing}
                  className={cn(
                    "w-full h-14 text-lg font-bold shadow-lg transition-all",
                    agreed && customerSignature 
                      ? "bg-blue-600 hover:bg-blue-700 shadow-blue-200 hover:shadow-blue-300 hover:-translate-y-1" 
                      : "bg-gray-300 cursor-not-allowed text-gray-500"
                  )}
                >
                  {signing ? (
                    <>
                      <Loader2 className="mr-2 h-5 w-5 animate-spin" /> Processando...
                    </>
                  ) : (
                    <>
                      <FileSignature className="mr-2 h-5 w-5" /> Finalizar e Assinar
                    </>
                  )}
                </Button>
              </div>
            )}

            {isSigned && (
              <Button 
                onClick={generatePDF} 
                disabled={isDownloading}
                className="w-full h-14 bg-green-600 hover:bg-green-700 text-white font-bold gap-2 text-lg shadow-lg shadow-green-200"
              >
                {isDownloading ? <Loader2 className="h-5 w-5 animate-spin" /> : <Download className="h-5 w-5" />}
                Baixar Contrato Assinado (PDF)
              </Button>
            )}
          </div>

        </div>
      </div>
      
      <div className="mt-8 text-center space-y-2">
        <p className="text-gray-400 text-xs">Plataforma segura de locação</p>
        <div className="flex justify-center items-center gap-2 text-gray-300 font-bold text-sm">
           RentalPro
        </div>
      </div>
    </div>
  );
};

export default SignContract;