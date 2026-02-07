"use client";

import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { Loader2, CheckCircle, Download, FileText, ShieldCheck, Printer } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { format, parseISO, differenceInDays } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import SignaturePad from '@/components/settings/SignaturePad';
import { showError, showSuccess } from '@/utils/toast';
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

  // 1. BUSCAR DADOS
  const fetchData = async () => {
    if (!orderId) return;
    setLoading(true);
    try {
      const { data: rpcData, error } = await supabase.rpc('get_contract_data', { p_order_id: orderId });
      
      if (error) throw error;
      if (!rpcData || rpcData.length === 0) throw new Error("Pedido não encontrado.");

      const raw = rpcData[0];
      setOrder(raw);
      setCustomerSignature(raw.signature_image);
      
      setLocador({
        name: raw.owner_name || "Locadora (Nome não configurado)",
        cnpj: raw.owner_cnpj || "CNPJ não informado",
        address: raw.owner_address || "Endereço da empresa",
        city: raw.owner_city || "Cidade da Empresa",
        signature: raw.owner_signature // Importante para o PDF
      });
    } catch (e) {
      showError("Erro ao carregar dados do contrato.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchData(); }, [orderId]);

  // 2. FUNÇÃO QUE GERA O TEXTO JURÍDICO (Visualização Tela)
  const buildContractText = () => {
    if (!order || !locador) return "";
    
    const dias = differenceInDays(parseISO(order.end_date), parseISO(order.start_date)) || 1;
    const formatMoney = (val: any) => Number(val).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
    const listaItens = order.items?.map((i: any) => `• ${i.quantity}x ${i.name} (Reposição: ${formatMoney(i.replacement_value)})`).join('\n');

    return {
      header: "CONTRATO DE LOCAÇÃO DE BENS MÓVEIS",
      intro: `IDENTIFICAÇÃO DAS PARTES\n\nLOCADOR: ${locador.name}, pessoa jurídica de direito privado, inscrita no CNPJ sob o nº ${locador.cnpj}, com sede em ${locador.address}, doravante denominada LOCADORA.\n\nLOCATÁRIO: ${order.customer_name}, inscrito(a) no CPF/CNPJ sob o nº ${order.customer_cpf || 'Não informado'}, residente e domiciliado(a) em ${order.customer_address || 'Endereço não informado'}, doravante denominado(a) LOCATÁRIO.`,
      clauses: [
        { title: "CLÁUSULA PRIMEIRA – DO OBJETO", text: `O presente contrato tem como objeto a locação dos bens descritos abaixo, de propriedade da LOCADORA, que o LOCATÁRIO declara receber em perfeito estado de conservação e funcionamento:\n\n${listaItens}` },
        { title: "CLÁUSULA SEGUNDA – DO PRAZO", text: `O prazo de locação é de ${dias} diária(s), iniciando-se no dia ${format(parseISO(order.start_date), "dd/MM/yyyy")} e encerrando-se impreterivelmente no dia ${format(parseISO(order.end_date), "dd/MM/yyyy")}.` },
        { title: "CLÁUSULA TERCEIRA – DO VALOR", text: `Pela locação, o LOCATÁRIO pagará à LOCADORA a importância total de ${formatMoney(order.total_amount)}. Forma de pagamento: ${order.payment_method || 'A combinar'}.` },
        { title: "CLÁUSULA QUARTA – DA RESPONSABILIDADE E REPOSIÇÃO", text: `O LOCATÁRIO assume total responsabilidade pela guarda e conservação dos bens locados. Em caso de perda, roubo, furto ou danos irreparáveis, fica obrigado a indenizar a LOCADORA pelo VALOR DE REPOSIÇÃO indicado na Cláusula Primeira, sem prejuízo do pagamento das diárias até a efetiva reposição.` },
        { title: "CLÁUSULA QUINTA – DO FORO", text: `As partes elegem o foro da Comarca de ${locador.city} para dirimir quaisquer dúvidas oriundas deste contrato.` }
      ],
      footer: `E, por estarem justos e contratados, assinam o presente documento eletronicamente.\n\n${locador.city}, ${format(new Date(), "dd 'de' MMMM 'de' yyyy", { locale: ptBR })}.`
    };
  };

  // 3. GERADOR DE PDF PROFISSIONAL (Igual ao do Dono)
  const generatePDF = async () => {
    if (!order || !locador) return;
    setIsDownloading(true);

    const doc = new jsPDF({ format: 'a4', unit: 'mm' });
    const content = buildContractText();
    
    const margin = 20;
    const pageWidth = 210;
    const maxLineWidth = pageWidth - (margin * 2);
    let currentY = 20;

    const printText = (text: string, fontSize = 10, fontStyle = "normal", align = "left") => {
      doc.setFont("helvetica", fontStyle);
      doc.setFontSize(fontSize);
      const lines = doc.splitTextToSize(text, maxLineWidth);
      if (currentY + (lines.length * 5) > 280) { doc.addPage(); currentY = 20; }
      doc.text(lines, align === "center" ? pageWidth / 2 : margin, currentY, { align: align as any });
      currentY += (lines.length * 4) + 4;
    };

    // --- CONTEÚDO ---
    printText(content.header, 14, "bold", "center");
    currentY += 5;
    printText(content.intro, 10, "normal", "justify");
    currentY += 5;

    content.clauses.forEach(clause => {
      printText(clause.title, 10, "bold", "left");
      printText(clause.text, 10, "normal", "left");
      currentY += 2;
    });

    currentY += 5;
    printText(content.footer, 10, "normal", "left");

    // --- ASSINATURAS (Página 1) ---
    currentY += 30;
    if (currentY > 250) { doc.addPage(); currentY = 40; }

    const yLinha = currentY;
    const yImagem = currentY - 25;

    // Assinatura Locador
    if (locador.signature) {
       try { doc.addImage(locador.signature, 'PNG', margin + 5, yImagem, 50, 25); } catch (e) {}
    }
    doc.line(margin, yLinha, margin + 70, yLinha);
    doc.setFontSize(8); doc.text("LOCADOR", margin, yLinha + 5);

    // Assinatura Cliente
    if (order.signature_image) {
       try { doc.addImage(order.signature_image, 'PNG', 120 + 5, yImagem, 50, 25); } catch (e) {}
    }
    doc.line(120, yLinha, 190, yLinha);
    doc.text("LOCATÁRIO", 120, yLinha + 5);

    // --- AUDITORIA (Página 2) ---
    doc.addPage();
    currentY = 20;
    printText("CERTIFICADO DE ASSINATURA DIGITAL", 14, "bold", "center");
    currentY += 10;
    
    doc.setDrawColor(200);
    doc.setFillColor(245, 245, 245);
    doc.rect(margin, currentY, maxLineWidth, 60, 'FD');
    currentY += 10;
    
    const addLog = (label: string, value: string) => {
      doc.setFont("courier", "bold"); doc.text(label, margin + 5, currentY);
      doc.setFont("courier", "normal"); doc.text(value, margin + 45, currentY);
      currentY += 7;
    };

    addLog("ID do Pedido:", order.order_id);
    addLog("Data/Hora:", order.signed_at ? format(parseISO(order.signed_at), "dd/MM/yyyy HH:mm:ss") : "Pendente");
    addLog("IP do Cliente:", order.signer_ip || "N/A");
    addLog("Navegador:", (order.signer_user_agent || "N/A").substring(0, 30) + "...");
    
    if (order.signature_image) {
        currentY += 5;
        doc.text("Rubrica Capturada:", margin + 5, currentY);
        doc.addImage(order.signature_image, 'PNG', margin + 5, currentY + 5, 40, 20);
    }

    doc.save(`Contrato-${order.order_id.split('-')[0]}.pdf`);
    setIsDownloading(false);
  };

  // 4. FUNÇÃO DE ASSINATURA
  const handleSign = async () => {
    if (!customerSignature || !agreed) return;
    setSigning(true);
    try {
      const ip = await fetch('https://api.ipify.org?format=json').then(r => r.json()).catch(() => ({ ip: 'IP Oculto' }));
      
      const { error } = await supabase.rpc('sign_order_contract', {
        target_order_id: orderId,
        signature_data: customerSignature,
        client_ip: ip.ip || '0.0.0.0',
        client_agent: navigator.userAgent
      });

      if (error) throw error;
      
      showSuccess("Assinado com sucesso!");
      fetchData(); 
    } catch (e) {
      showError("Erro ao salvar assinatura.");
    } finally {
      setSigning(false);
    }
  };

  if (loading) return <div className="flex h-screen items-center justify-center"><Loader2 className="animate-spin text-blue-600" /></div>;

  const contractContent = buildContractText();

  return (
    <div className="min-h-screen bg-gray-100 py-8 px-4 flex justify-center items-start">
      <div className="w-full max-w-4xl bg-white shadow-xl rounded-xl overflow-hidden border border-gray-200">
        
        {/* CABEÇALHO */}
        <div className="bg-slate-900 text-white p-6 text-center">
          <h1 className="text-xl font-bold uppercase tracking-wider">
            {order.signed_at ? "Contrato Vigente" : "Revisão e Assinatura"}
          </h1>
          <p className="text-slate-400 text-sm mt-1">Pedido #{order.order_id.split('-')[0]}</p>
        </div>

        <div className="p-6 md:p-8 space-y-8">
          
          {/* VISUALIZADOR DE TELA */}
          <div className="space-y-3">
            <div className="flex items-center gap-2 text-slate-700 font-bold border-b pb-2">
              <FileText className="w-5 h-5" />
              <h2>Termos do Contrato</h2>
            </div>
            
            <div className="bg-slate-50 border border-slate-200 rounded-lg p-6 h-96 overflow-y-auto shadow-inner">
              <div className="font-serif text-sm leading-relaxed text-slate-800 whitespace-pre-wrap">
                <p className="text-center font-bold mb-4 text-base">{contractContent.header}</p>
                <p className="mb-4 text-justify">{contractContent.intro}</p>
                {contractContent.clauses?.map((c: any, idx: number) => (
                  <div key={idx} className="mb-4">
                    <strong className="block mb-1">{c.title}</strong>
                    <span className="text-justify block">{c.text}</span>
                  </div>
                ))}
                <p className="mt-6 font-bold">{contractContent.footer}</p>
              </div>
            </div>
          </div>

          {/* AÇÕES */}
          {!order.signed_at ? (
            <div className="bg-blue-50 p-6 rounded-xl border border-blue-100 space-y-6 animate-in fade-in slide-in-from-bottom-4">
              <div className="flex items-start gap-3">
                <Checkbox id="terms" checked={agreed} onCheckedChange={(v) => setAgreed(!!v)} className="mt-1" />
                <label htmlFor="terms" className="text-sm text-blue-900 font-medium cursor-pointer leading-tight">
                  Li o contrato acima na íntegra e concordo com todas as cláusulas, prazos e valores de reposição estipulados.
                </label>
              </div>

              <div className="space-y-2">
                <label className="text-xs font-bold text-slate-500 uppercase">Sua Assinatura Digital</label>
                <div className="bg-white rounded-lg border border-slate-200 shadow-sm">
                  <SignaturePad onSave={setCustomerSignature} />
                </div>
              </div>

              <Button 
                onClick={handleSign} 
                disabled={signing || !agreed || !customerSignature} 
                className="w-full h-14 bg-blue-600 hover:bg-blue-700 text-lg font-bold shadow-lg transition-all"
              >
                {signing ? <><Loader2 className="animate-spin mr-2" /> Processando...</> : <><ShieldCheck className="mr-2" /> ASSINAR CONTRATO</>}
              </Button>
            </div>
          ) : (
            <div className="text-center py-6 space-y-6">
              <div className="inline-flex items-center justify-center p-4 bg-green-100 rounded-full mb-2">
                <CheckCircle className="h-12 w-12 text-green-600" />
              </div>
              <div>
                <h2 className="text-2xl font-bold text-slate-800">Assinatura Recebida!</h2>
                <p className="text-slate-500">Este contrato tem validade jurídica garantida.</p>
              </div>
              
              <Button 
                onClick={generatePDF} 
                variant="outline" 
                className="w-full md:w-2/3 h-14 border-2 border-slate-800 text-slate-800 font-bold hover:bg-slate-50"
              >
                {isDownloading ? <Loader2 className="animate-spin mr-2" /> : <Printer className="mr-2" />}
                BAIXAR VIA EM PDF (A4)
              </Button>
            </div>
          )}

        </div>
      </div>
    </div>
  );
};

export default SignContract;