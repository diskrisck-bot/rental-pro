import { format, differenceInDays, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface ContractItem {
  quantity: number;
  products: {
    name: string;
    price: number;
    valor_reposicao: number; // Novo campo
  };
}

interface ContractData {
  order_id: string;
  customer_name: string;
  customer_phone: string;
  customer_cpf: string;
  start_date: string;
  end_date: string;
  total_amount: number;
  forma_pagamento: string; // Novo campo
  
  // Owner Profile Data (from RPC/Settings)
  owner_name: string | null;
  owner_cnpj: string | null;
  owner_address: string | null;
  owner_phone: string | null;
  owner_city: string | null; // Novo campo
  owner_state: string | null; // Novo campo

  items: ContractItem[];
}

const formatCurrency = (value: number | string | null | undefined): string => {
  const num = Number(value) || 0;
  return `R$ ${num.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`;
};

const formatDate = (dateStr: string | null | undefined): string => {
  if (!dateStr) return '______';
  try {
    return format(parseISO(dateStr), 'dd/MM/yyyy', { locale: ptBR });
  } catch {
    return '______';
  }
};

const getDurationInDays = (startDateStr: string, endDateStr: string): number => {
  if (!startDateStr || !endDateStr) return 0;
  const start = parseISO(startDateStr);
  const end = parseISO(endDateStr);
  let duration = differenceInDays(end, start);
  return Math.max(1, duration + 1); // Duração mínima de 1 dia
};

const safeText = (text: string | null | undefined): string => {
  return text && text.trim() !== '' ? text : '______';
};

export const generateContractHTML = (data: ContractData): string => {
  const durationInDays = getDurationInDays(data.start_date, data.end_date);
  
  // --- Dados do Locador ---
  const locadorNome = safeText(data.owner_name);
  const locadorDocumento = safeText(data.owner_cnpj);
  const locadorEndereco = safeText(data.owner_address);
  const locadorCidade = safeText(data.owner_city);
  const locadorEstado = safeText(data.owner_state);
  
  // --- Dados do Locatário ---
  const locatarioNome = safeText(data.customer_name);
  const locatarioDocumento = safeText(data.customer_cpf);
  // Assumindo que o endereço do cliente não está no pedido, usamos um placeholder
  const locatarioEndereco = '______'; 
  
  // --- Lista de Itens (Cláusula Primeira) ---
  const itemListHTML = data.items.map(item => 
    `<li>${item.products.name} (Qtd: ${item.quantity})</li>`
  ).join('');

  // --- Lista de Valores de Reposição (Cláusula Quarta) ---
  const reposicaoList = data.items.map(item => 
    `${item.products.name} (Qtd: ${item.quantity}) (Valor Reposição: ${formatCurrency(item.products.valor_reposicao)})`
  ).join('<br>');

  const contractContent = `
    <style>
      body { font-family: Arial, sans-serif; line-height: 1.6; max-width: 800px; margin: 0 auto; padding: 20px; }
      h1 { text-align: center; color: #1e40af; margin-bottom: 30px; font-size: 24px; }
      h2 { font-size: 18px; margin-top: 25px; margin-bottom: 10px; border-bottom: 1px solid #ccc; padding-bottom: 5px; }
      p { margin-bottom: 10px; text-align: justify; }
      ul { list-style-type: none; padding-left: 0; }
      li { margin-bottom: 5px; }
      .signature-area { margin-top: 50px; display: flex; justify-content: space-around; text-align: center; }
      .signature-line { border-top: 1px solid #000; width: 45%; margin-top: 20px; }
      .data-field { font-weight: bold; }
      .warning { color: #b91c1c; font-weight: bold; }
    </style>
    
    <h1>CONTRATO DE LOCAÇÃO DE EQUIPAMENTOS</h1>

    <h2>QUALIFICAÇÃO DAS PARTES</h2>

    <p>
      <strong>LOCADOR:</strong> <span class="data-field">${locadorNome}</span>, inscrito no CPF/CNPJ sob o nº <span class="data-field">${locadorDocumento}</span>, residente e domiciliado na <span class="data-field">${locadorEndereco}</span>, doravante denominado simplesmente LOCADOR.
    </p>
    <p>
      <strong>LOCATÁRIA:</strong> <span class="data-field">${locatarioNome}</span>, inscrita no CNPJ/CPF sob o nº <span class="data-field">${locatarioDocumento}</span>, com sede/residência na <span class="data-field">${locatarioEndereco}</span>, neste ato representada por <span class="data-field">${locatarioNome}</span>.
    </p>

    <h2>CLÁUSULA PRIMEIRA – DO OBJETO</h2>
    <p>O presente contrato tem por objeto a locação dos equipamentos de propriedade do LOCADOR, discriminados abaixo:</p>
    <ul>
      ${itemListHTML}
    </ul>

    <h2>CLÁUSULA SEGUNDA – DO PRAZO</h2>
    <p>
      A locação terá a duração de <span class="data-field">${durationInDays}</span> dias, iniciando-se em <span class="data-field">${formatDate(data.start_date)}</span> e encerrando-se em <span class="data-field">${formatDate(data.end_date)}</span>, data em que os equipamentos deverão ser devolvidos nas mesmas condições em que foram entregues.
    </p>

    <h2>CLÁUSULA TERCEIRA – DO PREÇO E PAGAMENTO</h2>
    <p>
      Pela locação do objeto deste contrato, a LOCATÁRIA pagará ao LOCADOR o valor total de <span class="data-field">${formatCurrency(data.total_amount)}</span>.
    </p>
    <p>
      <strong>Forma de Pagamento:</strong> <span class="data-field">${safeText(data.forma_pagamento)}</span>.
    </p>
    <p>
      Atraso: O atraso no pagamento implicará em multa de 2% (dois por cento) sobre o débito e juros de 1% (um por cento) ao mês.
    </p>

    <h2>CLÁUSULA QUARTA – DA CONSERVAÇÃO E DANOS</h2>
    <p>
      A LOCATÁRIA declara receber os equipamentos em perfeito estado de conservação e funcionamento.
    </p>
    <p>
      Em caso de danos causados por mau uso, quebra, exposição a líquidos ou abertura do equipamento sem autorização de <span class="data-field">${locadorNome}</span>, a LOCATÁRIA arcará com os custos de reparo.
    </p>
    <p class="warning">
      Em caso de perda, furto ou roubo, a LOCATÁRIA deverá indenizar o LOCADOR no valor de reposição de:
      <br>
      <span class="data-field">${reposicaoList}</span>
    </p>

    <h2>CLÁUSULA QUINTA – DAS RESPONSABILIDADES</h2>
    <p>
      A LOCATÁRIA é a única responsável pelo uso dos equipamentos perante as autoridades, devendo respeitar a legislação vigente quanto ao uso dos equipamentos.
    </p>

    <h2>CLÁUSULA SEXTA – DA RESCISÃO</h2>
    <p>
      O contrato poderá ser rescindido caso qualquer uma das partes descumpra as cláusulas aqui estabelecidas.
    </p>

    <h2>CLÁUSULA SÉTIMA – DO FORO</h2>
    <p>
      Fica eleito o foro da comarca de <span class="data-field">${locadorCidade}</span> para dirimir eventuais dúvidas sobre este contrato.
    </p>

    <p style="text-align: center; margin-top: 40px;">
      ${locadorCidade}, ${formatDate(new Date().toISOString())}.
    </p>

    <div class="signature-area">
      <div>
        <div class="signature-line"></div>
        <p>${locadorNome} (Locador)</p>
      </div>
      <div>
        <div class="signature-line"></div>
        <p>${locatarioNome} (Locatária)</p>
      </div>
    </div>
  `;

  return contractContent;
};