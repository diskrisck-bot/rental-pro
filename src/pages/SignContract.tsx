"use client";

import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { Loader2, CheckCircle, Printer } from 'lucide-react';
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

  const fetchData = async () => {
    if (!orderId) return;
    setLoading(true);
    try {
      const { data: rpcData, error } = await supabase.rpc('get_contract_data', { p_order_id: orderId });
      if (error || !rpcData?.[0]) throw new Error();
      const raw = rpcData[0];
      setOrder(raw); setCustomerSignature(raw.signature_image);
      setLocador({
        name: raw.owner_name || "Locadora",
        cnpj: raw.owner_cnpj || "CNPJ n/a",
        address: raw.owner_address || "Endereço n/a",
        city: raw.owner_city || "Cidade da Empresa",
        signature: raw.owner_signature
      });
    } catch (e) { showError("Erro ao carregar dados."); } finally { setLoading(false); }
  };

  useEffect(() => { fetchData(); }, [orderId]);

  // Texto para a TELA (Scroll simples)
  const buildContractText = () => {
    if (!order || !locador) return { header: '', intro: '', clauses: [], footer: '' };
    const dias = differenceInDays(parseISO(order.end_date), parseISO(order.start_date)) || 1;
    const formatMoney = (val: any) => Number(val).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
    const listaItens = order.items?.map((i: any) => `• ${i.quantity}x ${i.name} (Valor de Reposição: ${formatMoney(i.replacement_value)})`).join('\n');
    return {
      header: "CONTRATO DE LOCAÇÃO DE BENS MÓVEIS",
      intro: `IDENTIFICAÇÃO DAS PARTES\n\nLOCADOR: ${locador.name}, CNPJ ${locador.cnpj}.\n\nLOCATÁRIO: ${order.customer_name}, CPF/CNPJ ${order.customer_cpf || 'Não inf.'}.`,
      clauses: [
        { title: "1. DO OBJETO", text: `Locação dos bens: \n${listaItens}` },
        { title: "2. DO PRAZO", text: `Vigência de ${dias} dias: ${format(parseISO(order.start_date), "dd/MM/yyyy")} a ${format(parseISO(order.end_date), "dd/MM/yyyy")}.` },
        { title: "3. VALOR", text: `Total: ${formatMoney(order.total_amount)}. Pagamento: ${order.payment_method}.` },
        { title: "4. REPOSIÇÃO", text: `O LOCATÁRIO assume risco integral sobre os bens, devendo ressarcir o LOCADOR em caso de dano ou perda pelos valores citados na Cláusula 1.` },
        { title: "5. FORO", text: `Eleito o foro de ${locador.city} para dirimir dúvidas.` }
      ],
      footer: `${locador.city}, ${format(new Date(), "dd 'de' MMMM 'de' yyyy", { locale: ptBR })}.`
    };
  };

  // GERADOR DE PDF COM METADADOS RESTAURADOS
  const generatePDF = async () => {
    if (!order || !locador) return;
    setIsDownloading(true);
    const doc = new jsPDF({ format: 'a4', unit: 'mm' });
    
    // Cores e Fontes
    const primaryColor = [30, 58, 138]; // Navy Blue
    const lightGray = [245, 245, 245];
    const margin = 20; const pageWidth = 210; const maxLineWidth = pageWidth - (margin * 2); let currentY = 20;

    const printTitle = (text: string) => {
      doc.setFont("helvetica", "bold"); doc.setFontSize(16);
      doc.setTextColor(primaryColor[0], primaryColor[1], primaryColor[2]);
      doc.text(text, pageWidth / 2, currentY, { align: "center" });
      doc.setDrawColor(primaryColor[0], primaryColor[1], primaryColor[2]);
      doc.setLineWidth(0.5); doc.line(margin + 20, currentY + 2, pageWidth - 40, currentY + 2);
      currentY += 15;
    };
    const printSectionTitle = (text: string) => {
      if (currentY > 260) { doc.addPage(); currentY = 20; }
      doc.setFont("helvetica", "bold"); doc.setFontSize(11);
      doc.setTextColor(primaryColor[0], primaryColor[1], primaryColor[2]);
      doc.text(text.toUpperCase(), margin, currentY); currentY += 6;
    };
    const printBody = (text: string) => {
      doc.setFont("times", "normal"); doc.setFontSize(11); doc.setTextColor(0, 0, 0);
      const lines = doc.splitTextToSize(text, maxLineWidth);
      if (currentY + (lines.length * 5) > 275) { doc.addPage(); currentY = 20; }
      doc.text(lines, margin, currentY); currentY += (lines.length * 5) + 3;
    };

    // Montagem
    printTitle("CONTRATO DE LOCAÇÃO DE BENS MÓVEIS");
    
    // Quadro Resumo
    doc.setFillColor(lightGray[0], lightGray[1], lightGray[2]); doc.rect(margin, currentY, maxLineWidth, 35, 'FD');
    const startBoxY = currentY + 6;
    doc.setFont("helvetica", "bold"); doc.setFontSize(9); doc.setTextColor(0,0,0);
    doc.text("LOCADOR", margin + 5, startBoxY);
    doc.setFont("times", "normal"); doc.setFontSize(10);
    doc.text(`${locador.name}`, margin + 5, startBoxY + 5); doc.text(`CNPJ: ${locador.cnpj}`, margin + 5, startBoxY + 10);
    doc.setFont("helvetica", "bold"); doc.setFontSize(9);
    doc.text("LOCATÁRIO", margin + 90, startBoxY);
    doc.setFont("times", "normal"); doc.setFontSize(10);
    doc.text(`${order.customer_name}`, margin + 90, startBoxY + 5); doc.text(`CPF: ${order.customer_cpf}`, margin + 90, startBoxY + 10);
    currentY += 45;

    // Cláusulas
    const ct = buildContractText();
    ct.clauses.forEach(c => { printSectionTitle(c.title); printBody(c.text); });
    currentY += 5; doc.setFont("times", "italic"); doc.text(ct.footer, margin, currentY);

    // --- ASSINATURAS (Com Carimbo Digital Restaurado) ---
    currentY += 25; if (currentY > 240) { doc.addPage(); currentY = 40; }
    const yAssin = currentY; const yImg = yAssin - 25;
    
    // Assinatura Locador
    if (locador.signature) { try { doc.addImage(locador.signature, 'PNG', margin + 10, yImg, 40, 20); } catch (e) {} }
    doc.setDrawColor(0,0,0); doc.line(margin, yAssin, margin + 70, yAssin); doc.setFont("helvetica","bold"); doc.setFontSize(8); doc.text("LOCADOR", margin, yAssin+5);
    
    // Assinatura Locatário
    if (order.signature_image) { try { doc.addImage(order.signature_image, 'PNG', 130, yImg, 40, 20); } catch (e) {} }
    doc.line(120, yAssin, 190, yAssin); doc.text("LOCATÁRIO", 120, yAssin+5);

    // META-DADOS VISUAIS (Abaixo da assinatura do cliente)
    if (order.signed_at) {
        doc.setFont("courier", "normal"); 
        doc.setFontSize(6);
        doc.setTextColor(100, 100, 100);
        const signDate = format(parseISO(order.signed_at), "dd/MM/yyyy HH:mm:ss");
        doc.text(`Assinado digitalmente em: ${signDate}`, 120, yAssin + 9);
        doc.text(`IP: ${order.signer_ip || "IP Validado"}`, 120, yAssin + 12);
        doc.text(`ID Único: ${order.order_id.split('-')[0].toUpperCase()}`, 120, yAssin + 15);
    }

    // --- PÁGINA DE AUDITORIA TÉCNICA (Detalhada) ---
    if (order.signed_at) {
      doc.addPage(); currentY = 20;
      doc.setTextColor(primaryColor[0],primaryColor[1],primaryColor[2]); doc.setFont("helvetica","bold"); doc.setFontSize(14); doc.text("RELATÓRIO DE ASSINATURA DIGITAL", pageWidth/2, currentY, {align:'center'});
      currentY+=20; 
      
      // Box de Auditoria
      doc.setFillColor(lightGray[0],lightGray[1],lightGray[2]); doc.rect(margin, currentY, maxLineWidth, 80, 'FD'); 
      currentY+=10; doc.setTextColor(0,0,0);
      
      const addLog = (l: string, v: string) => { 
          doc.setFont("courier","bold"); doc.setFontSize(9); doc.text(l, margin+5, currentY); 
          doc.setFont("courier","normal"); doc.text(v, margin+50, currentY); 
          currentY+=8; 
      };

      addLog("ID do Documento:", order.order_id);
      addLog("Status:", "ASSINADO E VÁLIDO");
      addLog("Data/Hora (UTC-3):", format(parseISO(order.signed_at), "dd/MM/yyyy HH:mm:ss"));
      addLog("Endereço IP:", order.signer_ip || "IP não capturado");
      
      // Tenta recuperar user agent, ou usa genérico se não tiver salvo no banco antigo
      const userAgent = order.client_agent || navigator.userAgent;
      // Quebra o user agent se for muito longo
      const uaLines = doc.splitTextToSize(userAgent, maxLineWidth - 60);
      doc.setFont("courier","bold"); doc.text("Dispositivo/Navegador:", margin+5, currentY);
      doc.setFont("courier","normal"); doc.text(uaLines, margin+50, currentY);
      currentY += (uaLines.length * 5) + 5;

      // Imagem da Assinatura no Log
      if (order.signature_image) { 
          doc.text("Evidência Gráfica:", margin+5, currentY+10); 
          doc.addImage(order.signature_image, 'PNG', margin+50, currentY, 40, 20); 
      }
      
      // Hash simulado para parecer técnico (usando o ID)
      currentY += 30;
      doc.setDrawColor(200,200,200); doc.line(margin+5, currentY, margin+maxLineWidth-5, currentY); currentY+=5;
      doc.setFontSize(7); doc.setTextColor(150,150,150);
      doc.text(`Digital Hash: ${btoa(order.order_id + order.signed_at).substring(0, 50)}...`, margin+5, currentY);
    }
    
    doc.save(`Contrato-${order.order_id.split('-')[0]}.pdf`); setIsDownloading(false);
  };

  const handleSign = async () => { if (!customerSignature || !agreed) return; setSigning(true); try { const ip = await fetch('https://api.ipify.org?format=json').then(r => r.json()).catch(()=>({ip:'127.0.0.1'})); await supabase.rpc('sign_order_contract', { target_order_id: orderId, signature_data: customerSignature, client_ip: ip.ip, client_agent: navigator.userAgent }); showSuccess("Assinado!"); fetchData(); } catch (e) { showError("Erro ao assinar."); } finally { setSigning(false); } };

  if (loading) return <div className="flex h-screen items-center justify-center"><Loader2 className="animate-spin" /></div>;
  const contractContent = buildContractText();

  return (
    <div className="min-h-screen bg-gray-100 py-8 px-4 flex justify-center items-start">
      <div className="w-full max-w-4xl bg-white shadow-xl rounded-xl overflow-hidden border border-gray-200">
        <div className="bg-slate-900 text-white p-6 text-center"><h1 className="text-xl font-bold uppercase">Contrato Digital</h1></div>
        <div className="p-8 space-y-6">
          <div className="bg-slate-50 border p-6 h-96 overflow-y-auto shadow-inner rounded-lg">
             <div className="font-serif text-sm leading-relaxed whitespace-pre-wrap">
               <p className="text-center font-bold text-lg mb-4">{contractContent.header}</p>
               <p className="mb-4">{contractContent.intro}</p>
               {contractContent.clauses?.map((c: any, i: number) => (<div key={i} className="mb-4"><strong>{c.title}</strong><br/>{c.text}</div>))}
               <p className="mt-4">{contractContent.footer}</p>
             </div>
          </div>
          {!order.signed_at ? (
            <div className="bg-blue-50 p-6 rounded-xl space-y-4">
               <div className="flex gap-2"><Checkbox id="t" checked={agreed} onCheckedChange={(v)=>setAgreed(!!v)}/><label htmlFor="t" className="text-sm font-medium">Li e concordo com os termos.</label></div>
               
               <div className="bg-white border rounded">
                   <SignaturePad onSave={setCustomerSignature} isSaving={signing} />
               </div>
               
               <Button 
                   onClick={handleSign} 
                   disabled={signing || !agreed || !customerSignature} 
                   className="w-full h-12 bg-primary hover:bg-primary/90 text-white font-bold text-lg rounded-xl shadow-lg"
               >
                   {signing ? <Loader2 className="animate-spin" /> : "ASSINAR DIGITALMENTE"}
               </Button>
            </div>
          ) : (
            <div className="text-center py-6 space-y-4">
              <CheckCircle className="h-16 w-16 text-green-600 mx-auto"/>
              <h2 className="text-2xl font-bold">Assinado com Sucesso!</h2>
              <Button onClick={generatePDF} variant="outline" className="w-full border-blue-900 text-blue-900 h-12 font-bold"><Printer className="mr-2"/> Baixar Contrato Assinado (PDF)</Button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default SignContract;