"use client";

import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { Loader2, CheckCircle, Printer, FileCheck } from 'lucide-react';
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
      setOrder(raw); 
      setCustomerSignature(raw.signature_image);
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

  // Monta o texto para a TELA e serve de base para o PDF (Sincronizado com OrderDetailsSheet)
  const buildContractText = () => {
    if (!order || !locador) return { header: '', intro: '', clauses: [], footer: '', audit: null };
    
    const dias = differenceInDays(parseISO(order.end_date), parseISO(order.start_date)) + 1;
    const formatMoney = (val: any) => Number(val).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
    const listaItens = order.items?.map((i: any) => `• ${i.quantity}x ${i.name} (Valor de Reposição: ${formatMoney(i.replacement_value)})`).join('\n');
    
    // Se estiver assinado, cria o bloco de auditoria para exibir NA TELA também
    let auditBlock = null;
    if (order.signed_at) {
        auditBlock = `
---------------------------------------------------
REGISTRO DE ASSINATURA DIGITAL
---------------------------------------------------
ID do Documento: ${order.order_id}
Assinado em: ${format(parseISO(order.signed_at), "dd/MM/yyyy 'às' HH:mm:ss", { locale: ptBR })}
IP de Origem: ${order.signer_ip || "IP Validado"}
Dispositivo: ${order.client_agent ? order.client_agent.substring(0, 50) + "..." : "Web Client"}
Status: VÁLIDO E CONCLUÍDO
---------------------------------------------------
`;
    }

    return {
      header: "CONTRATO DE LOCAÇÃO DE BENS MÓVEIS",
      intro: `IDENTIFICAÇÃO DAS PARTES\n\nLOCADOR: ${locador.name}, CNPJ ${locador.cnpj}.\n\nLOCATÁRIO: ${order.customer_name}, CPF/CNPJ ${order.customer_cpf || 'Não inf.'}.`,
      clauses: [
        { title: "CLÁUSULA 1 - DO OBJETO DA LOCAÇÃO", text: `O presente instrumento tem como objeto o aluguel dos seguintes bens móveis, que o LOCATÁRIO declara receber em perfeito estado de funcionamento e conservação:\n\n${listaItens}\n\nParágrafo Único: O valor de reposição de cada item é o valor que será cobrado integralmente do LOCATÁRIO em caso de perda, roubo, furto ou dano irreparável.` },
        { title: "CLÁUSULA 2 - DO PRAZO E ENTREGA", text: `A locação vigorará pelo período de ${dias} diária(s), iniciando-se em ${format(parseISO(order.start_date), "dd/MM/yyyy")} e encerrando-se em ${format(parseISO(order.end_date), "dd/MM/yyyy")}, devendo os bens ser devolvidos na data final até as 18:00h. O atraso na devolução configurará apropriação indébita e gerará cobrança de novas diárias, sem prejuízo de multa de 10% sobre o valor total do contrato.` },
        { title: "CLÁUSULA 3 - DO PREÇO E PAGAMENTO", text: `O valor total da locação é de ${formatMoney(order.total_amount)}, a ser pago via ${order.payment_method || 'combinar'}. O não pagamento na data acordada acarretará juros de mora de 1% (um por cento) ao mês e multa de 2% (dois por cento) sobre o valor devido.` },
        { title: "CLÁUSULA 4 - DA RESPONSABILIDADE E USO", text: "O LOCATÁRIO declara receber os bens em perfeito estado de funcionamento e conservação. É de inteira responsabilidade do LOCATÁRIO a guarda e o uso correto dos equipamentos. Em caso de dano, avaria, roubo ou furto, o LOCATÁRIO arcará com o custo integral de reparo ou reposição do bem por um novo, de mesma marca e modelo, conforme os valores de reposição listados na Cláusula 1." },
        { title: "CLÁUSULA 5 - DO TRANSPORTE", text: `O transporte dos equipamentos (retirada e devolução) corre por conta e risco do LOCATÁRIO, salvo disposição em contrário expressa neste contrato. Método acordado: ${order.delivery_method || 'Retirada pelo Cliente (Balcão)'}.` },
        { title: "CLÁUSULA 6 - DA RESCISÃO", text: "O descumprimento de qualquer cláusula contratual ensejará a rescisão imediata deste contrato e a retomada dos bens pelo LOCADOR, sem prejuízo das penalidades cabíveis." },
        { title: "CLÁUSULA 7 - DO FORO", text: `Fica eleito o foro da comarca de ${locador.city} para dirimir quaisquer dúvidas oriundas deste contrato, renunciando a qualquer outro, por mais privilegiado que seja.` }
      ],
      footer: `${locador.city}, ${format(new Date(), "dd 'de' MMMM 'de' yyyy", { locale: ptBR })}.`,
      audit: auditBlock 
    };
  };

  // GERADOR DE PDF COM AUDITORIA TÉCNICA
  const generatePDF = async () => {
    if (!order || !locador) return;
    setIsDownloading(true);
    const doc = new jsPDF({ format: 'a4', unit: 'mm' });
    
    // Configurações visuais
    const primaryColor = [30, 58, 138]; 
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

    // --- CAPA E CORPO DO CONTRATO ---
    printTitle("CONTRATO DE LOCAÇÃO DE BENS MÓVEIS");
    
    // Resumo das Partes
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

    // --- ASSINATURAS ---
    currentY += 25; if (currentY > 240) { doc.addPage(); currentY = 40; }
    const yAssin = currentY; const yImg = yAssin - 25;
    
    if (locador.signature) { try { doc.addImage(locador.signature, 'PNG', margin + 10, yImg, 40, 20); } catch (e) {} }
    doc.setDrawColor(0,0,0); doc.line(margin, yAssin, margin + 70, yAssin); doc.setFont("helvetica","bold"); doc.setFontSize(8); doc.text("LOCADOR", margin, yAssin+5);
    
    if (order.signature_image) { try { doc.addImage(order.signature_image, 'PNG', 130, yImg, 40, 20); } catch (e) {} }
    doc.line(120, yAssin, 190, yAssin); doc.text("LOCATÁRIO", 120, yAssin+5);

    // Metadata visual logo abaixo da assinatura (Mini-log)
    if (order.signed_at) {
        doc.setFont("courier", "normal"); doc.setFontSize(6); doc.setTextColor(100, 100, 100);
        doc.text(`Digitalmente assinado: ${format(parseISO(order.signed_at), "dd/MM/yyyy HH:mm:ss")}`, 120, yAssin + 8);
        doc.text(`IP: ${order.signer_ip || "IP Registrado"}`, 120, yAssin + 11);
    }

    // --- PÁGINA EXTRA: RELATÓRIO DE AUDITORIA ---
    if (order.signed_at) {
      doc.addPage(); 
      currentY = 20;
      
      doc.setFont("helvetica", "bold"); doc.setFontSize(14); doc.setTextColor(primaryColor[0], primaryColor[1], primaryColor[2]);
      doc.text("RELATÓRIO DE ASSINATURA DIGITAL", pageWidth/2, currentY, { align: "center" });
      currentY += 20;

      doc.setFillColor(240, 240, 240);
      doc.rect(margin, currentY, maxLineWidth, 90, 'FD');
      
      doc.setTextColor(0,0,0);
      let logY = currentY + 10;
      const logLine = (label: string, value: string) => {
          doc.setFont("courier", "bold"); doc.setFontSize(10);
          doc.text(label, margin + 5, logY);
          doc.setFont("courier", "normal");
          doc.text(value, margin + 50, logY);
          logY += 8;
      };

      logLine("ID Único:", order.order_id);
      logLine("Data/Hora:", format(parseISO(order.signed_at), "dd/MM/yyyy HH:mm:ss") + " (Horário Local)");
      logLine("Endereço IP:", order.signer_ip || "Não capturado");
      logLine("Status:", "ASSINADO E VÁLIDO");
      
      logY += 5;
      doc.setFont("courier", "bold"); doc.text("User Agent / Dispositivo:", margin + 5, logY);
      logY += 5;
      doc.setFont("courier", "normal"); doc.setFontSize(8);
      const ua = order.client_agent || navigator.userAgent || "N/A";
      const uaLines = doc.splitTextToSize(ua, maxLineWidth - 10);
      doc.text(uaLines, margin + 5, logY);
      logY += (uaLines.length * 4) + 10;

      if (order.signature_image) {
        doc.setFont("courier", "bold"); doc.setFontSize(10);
        doc.text("Evidência Visual:", margin + 5, logY);
        doc.addImage(order.signature_image, 'PNG', margin + 50, logY - 5, 40, 20);
      }
      
      const hashY = currentY + 85;
      doc.setFontSize(6); doc.setTextColor(150,150,150);
      doc.text(`Hash de Segurança: ${btoa(order.order_id + order.signed_at).substring(0,60)}...`, margin + 5, hashY);
    }
    
    doc.save(`Contrato-${order.order_id.split('-')[0]}.pdf`); 
    setIsDownloading(false);
  };

  const handleSign = async () => { 
    if (!customerSignature || !agreed) return; 
    setSigning(true); 
    try { 
      const ipData = await fetch('https://api.ipify.org?format=json').then(r => r.json()).catch(()=>({ip:'127.0.0.1'})); 
      await supabase.rpc('sign_order_contract', { 
        target_order_id: orderId, 
        signature_data: customerSignature, 
        client_ip: ipData.ip, 
        client_agent: navigator.userAgent 
      }); 
      showSuccess("Assinado com sucesso!"); 
      fetchData(); 
    } catch (e) { showError("Erro ao assinar."); } finally { setLoading(false); } 
  };

  if (loading) return <div className="flex h-screen items-center justify-center"><Loader2 className="animate-spin" /></div>;
  const contractContent = buildContractText();

  return (
    <div className="min-h-screen bg-gray-100 py-8 px-4 flex justify-center items-start">
      <div className="w-full max-w-4xl bg-white shadow-xl rounded-xl overflow-hidden border border-gray-200">
        <div className="bg-slate-900 text-white p-6 text-center"><h1 className="text-xl font-bold uppercase">Contrato Digital</h1></div>
        <div className="p-8 space-y-6">
          <div className="bg-slate-50 border p-6 h-96 overflow-y-auto shadow-inner rounded-lg">
             <div className="font-serif text-sm leading-relaxed whitespace-pre-wrap text-gray-800">
               <p className="text-center font-bold text-lg mb-4 text-black">{contractContent.header}</p>
               <p className="mb-4">{contractContent.intro}</p>
               {contractContent.clauses?.map((c: any, i: number) => (<div key={i} className="mb-4"><strong className="text-black">{c.title}</strong><br/>{c.text}</div>))}
               <p className="mt-4">{contractContent.footer}</p>
               
               {contractContent.audit && (
                   <div className="mt-8 p-4 bg-gray-200 border border-gray-300 rounded text-xs font-mono text-gray-600 whitespace-pre">
                       {contractContent.audit}
                   </div>
               )}
             </div>
          </div>

          {!order.signed_at ? (
            <div className="bg-blue-50 p-6 rounded-xl space-y-4">
               <div className="flex gap-2"><Checkbox id="t" checked={agreed} onCheckedChange={(v)=>setAgreed(!!v)}/><label htmlFor="t" className="text-sm font-medium">Li e concordo com os termos.</label></div>
               <div className="bg-white border rounded">
                   <SignaturePad onSave={setCustomerSignature} isSaving={signing} />
               </div>
               <Button onClick={handleSign} disabled={signing || !agreed || !customerSignature} className="w-full h-12 bg-blue-900 hover:bg-blue-800 text-white font-bold text-lg rounded-xl shadow-lg">
                   {signing ? <Loader2 className="animate-spin" /> : "ASSINAR DIGITALMENTE"}
               </Button>
            </div>
          ) : (
            <div className="text-center py-6 space-y-4 animate-in fade-in zoom-in duration-500">
              <div className="flex flex-col items-center justify-center text-green-600">
                  <FileCheck className="h-20 w-20 mb-2"/>
                  <h2 className="text-2xl font-bold">Documento Assinado e Registrado!</h2>
                  <p className="text-sm text-gray-500">A validade jurídica foi garantida com carimbo de tempo e IP.</p>
              </div>
              <Button onClick={generatePDF} className="w-full border-2 border-blue-900 bg-white text-blue-900 hover:bg-blue-50 h-14 font-bold text-lg rounded-xl">
                  <Printer className="mr-2 h-5 w-5"/> Baixar Cópia Oficial (PDF)
              </Button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default SignContract;