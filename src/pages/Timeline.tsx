"use client";

import React from 'react';
import { ChevronLeft, ChevronRight, Calendar as CalendarIcon, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { format, addDays, startOfToday, eachDayOfInterval, isSameDay, isBefore, isAfter, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { useQuery } from '@tanstack/react-query';
import { fetchTimelineData } from '@/integrations/supabase/queries';

// Define a largura de cada coluna de dia em pixels (deve corresponder ao CSS min-w-[120px])
const DAY_WIDTH_PX = 120;

// Função auxiliar para calcular a posição e largura de um bloco de alocação na timeline
const getBlockPosition = (startDateStr: string, endDateStr: string, days: Date[]) => {
  const startDate = parseISO(startDateStr);
  const endDate = parseISO(endDateStr);

  // Encontra o índice de início e fim no array de dias visíveis
  let startIndex = days.findIndex(d => isSameDay(d, startDate));
  let endIndex = days.findIndex(d => isSameDay(d, endDate));

  // Ajusta se a alocação começa antes ou termina depois do range visível
  const startsBefore = isBefore(startDate, days[0]);
  const endsAfter = isAfter(endDate, days[days.length - 1]);

  if (startIndex === -1 && startsBefore) {
    startIndex = 0;
  }
  if (endIndex === -1 && endsAfter) {
    endIndex = days.length - 1;
  }

  // Se a alocação estiver completamente fora do range visível
  if (startIndex === -1 || endIndex === -1 || startIndex > endIndex) {
    return null;
  }

  // Calcula a duração visível (inclusive)
  const duration = endIndex - startIndex + 1;

  // Calcula a posição (left offset) e largura
  const left = startIndex * DAY_WIDTH_PX;
  const width = duration * DAY_WIDTH_PX;

  return { left, width };
};

const Timeline = () => {
  // Configuração de datas (15 dias a partir de hoje)
  const today = startOfToday();
  const days = eachDayOfInterval({
    start: today,
    end: addDays(today, 14),
  });

  const { data, isLoading, isError } = useQuery({
    queryKey: ['timelineData'],
    queryFn: fetchTimelineData,
  });

  const products = data?.products || [];
  const orderItems = data?.orderItems || [];

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'reserved': return { bg: 'bg-yellow-400/90', border: 'border-yellow-500', text: 'text-yellow-900', label: 'RESERVADO' };
      case 'picked_up': return { bg: 'bg-blue-500/90', border: 'border-blue-600', text: 'text-white', label: 'RETIRADO' };
      default: return { bg: 'bg-gray-400/90', border: 'border-gray-500', text: 'text-gray-900', label: 'RASCUNHO' };
    }
  };

  if (isError) {
    return (
      <div className="p-8 text-center text-red-500">
        Erro ao carregar dados da Timeline.
      </div>
    );
  }

  return (
    <div className="p-8 space-y-6 h-screen flex flex-col">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Timeline</h1>
          <p className="text-muted-foreground">Disponibilidade e agendamentos em tempo real.</p>
        </div>
        <div className="flex items-center gap-2 bg-white border rounded-lg p-1">
          <Button variant="ghost" size="icon"><ChevronLeft className="h-4 w-4" /></Button>
          <span className="px-4 font-medium">{format(today, 'MMMM yyyy', { locale: ptBR })}</span>
          <Button variant="ghost" size="icon"><ChevronRight className="h-4 w-4" /></Button>
        </div>
      </div>

      <div className="flex-1 bg-white border rounded-xl overflow-auto relative">
        <div className="inline-block min-w-full">
          {/* Header das Datas */}
          <div className="flex sticky top-0 z-20 bg-gray-50 border-b">
            <div className="w-64 p-4 border-r font-semibold text-gray-500 bg-gray-50 sticky left-0 z-30">Ativos</div>
            {days.map((day) => (
              <div key={day.toString()} className="flex-1 min-w-[120px] p-4 text-center border-r last:border-r-0">
                <div className="text-xs uppercase text-gray-400 font-bold">{format(day, 'EEE', { locale: ptBR })}</div>
                <div className="text-lg font-semibold">{format(day, 'dd')}</div>
              </div>
            ))}
          </div>

          {/* Linhas da Timeline */}
          {isLoading ? (
            <div className="flex items-center justify-center h-48">
              <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
            </div>
          ) : products.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">Nenhum produto cadastrado para exibir na timeline.</div>
          ) : (
            products.map((product) => {
              // Filtra as alocações (orderItems) para este produto
              const allocations = orderItems.filter(item => item.product_id === product.id);

              return (
                <div key={product.id} className="flex border-b last:border-b-0 hover:bg-gray-50 transition-colors group">
                  <div className="w-64 p-4 border-r font-medium text-gray-700 bg-white sticky left-0 z-10 group-hover:bg-gray-50">
                    {product.name}
                    {product.type === 'bulk' && <span className="block text-xs text-blue-500 font-normal">Capacidade: {product.total_quantity}</span>}
                  </div>
                  <div className="flex flex-1 relative h-16">
                    {/* Células de fundo (Grid) */}
                    {days.map((day) => (
                      <div key={day.toString()} className="flex-1 min-w-[120px] border-r last:border-r-0 bg-grid-pattern opacity-10" />
                    ))}
                    
                    {/* Blocos de Agendamento (Alocações) */}
                    {allocations.map((item, index) => {
                      const order = item.orders;
                      const position = getBlockPosition(order.start_date, order.end_date, days);
                      
                      if (!position) return null;

                      const colorConfig = getStatusColor(order.status);

                      return (
                        <div 
                          key={order.id + index}
                          className={`absolute top-2 h-12 rounded-md border shadow-sm flex items-center px-3 text-xs font-bold overflow-hidden whitespace-nowrap z-10 transition-all ${colorConfig.bg} ${colorConfig.border} ${colorConfig.text}`}
                          style={{ left: `${position.left}px`, width: `${position.width}px` }}
                          title={`${product.name} alugado por ${order.customer_name} de ${format(parseISO(order.start_date), 'dd/MM')} a ${format(parseISO(order.end_date), 'dd/MM')}`}
                        >
                          {colorConfig.label}: {order.customer_name} (x{item.quantity})
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
};

export default Timeline;