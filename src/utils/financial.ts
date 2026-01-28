import { differenceInDays, parseISO } from 'date-fns';

interface OrderItem {
  daily_price: number;
  quantity: number;
}

/**
 * Calcula o valor total de um pedido com base nas datas e itens.
 * Fórmula: (Duração em dias) * (Soma dos preços diários dos itens)
 * A duração é sempre de pelo menos 1 dia (datas inclusivas).
 */
export const calculateOrderTotal = (startDateStr: string, endDateStr: string, items: OrderItem[]): { durationInDays: number, subtotalDaily: number, totalAmount: number } => {
  if (!startDateStr || !endDateStr || items.length === 0) {
    return { durationInDays: 1, subtotalDaily: 0, totalAmount: 0 };
  }

  const start = parseISO(startDateStr);
  const end = parseISO(endDateStr);

  // Calcula a duração: diferençaInDays(end, start) + 1 (datas inclusivas)
  let durationInDays = differenceInDays(end, start);
  durationInDays = Math.max(1, durationInDays + 1);

  const subtotalDaily = items.reduce((acc, item) => acc + (item.daily_price * item.quantity), 0);
  const totalAmount = subtotalDaily * durationInDays;

  return { durationInDays, subtotalDaily, totalAmount };
};