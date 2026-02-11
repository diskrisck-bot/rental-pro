/**
 * Formata um número ou string numérica para o padrão R$ 0.000,00
 */
export const formatCurrencyBRL = (value: number | string): string => {
  if (typeof value === 'number') {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
    }).format(value);
  }

  // Se for string (input), remove tudo que não é dígito
  const cleanValue = value.replace(/\D/g, '');
  const numberValue = parseFloat(cleanValue) / 100;

  if (isNaN(numberValue)) return 'R$ 0,00';

  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(numberValue);
};

/**
 * Converte uma string formatada (R$ 1.200,50) em um número float (1200.50)
 */
export const parseCurrencyBRL = (value: string): number => {
  const cleanValue = value.replace(/\D/g, '');
  return parseFloat(cleanValue) / 100 || 0;
};