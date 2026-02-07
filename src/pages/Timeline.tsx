"use client";

import React, { useState, useMemo } from 'react';
import { ChevronLeft, ChevronRight, Calendar as CalendarIcon, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { format, addDays, startOfToday, eachDayOfInterval, isSameDay, isBefore, isAfter, parseISO, startOfDay } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase'; // Import direto
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { cn } from '@/lib/utils';
import { Link } from 'react-router-dom';

const DAY_WIDTH_PX = 120;

// Função auxiliar para calcular a posição e largura do bloco na timeline
const getBlockPosition = (startDateStr: string, endDateStr: string, days: Date[]) => {
  const startDate = parseISO(startDateStr);
  const endDate = parseISO(endDateStr);
  
  let startIndex = days.findIndex(d => isSameDay(d, startDate));
  let endIndex = days.findIndex(d => isSameDay(d, endDate));

  const startsBefore = isBefore(startDate, startOfDay(days[0]));
  const endsAfter = isAfter(endDate, startOfDay(days[days.length - 1]));

  if (startIndex === -1 && startsBefore) startIndex = 0;
  if (endIndex === -1 && endsAfter) endIndex = days.length - 1;

  if (startIndex === -1 || endIndex === -1 || startIndex > endIndex) return null;

  const duration = endIndex - startIndex + 1;
  return { left: startIndex * DAY_WIDTH_PX, width: duration * DAY_WIDTH_PX };
};

const Timeline = () => {
  const [viewStartDay, setViewStartDay] = useState(startOfToday());
  const [selectedDate, setSelectedDate] = useState<Date | undefined>(startOfToday());

  const days = useMemo(() => eachDayOfInterval({ start: viewStartDay, end: addDays(viewStartDay, 14) }), [viewStartDay]);

  // 1. BUSCA PRODUTOS (Sem filtro 'active' para garantir que apareçam)
  const { data: products, isLoading: loadingProducts } = useQuery({
    queryKey: ['timeline_products'],
    queryFn: async () => {
      // Removido .eq('active', true) para evitar sumiço
      const { data } = await supabase.from('products').select('*').order('name');
      return data || [];
    }
  });

  // 2. BUSCA PEDIDOS ATIVOS (Assinados, Reservados ou Na Rua)
  const { data: orderItems, isLoading: loadingOrders } = useQuery({
    queryKey: ['timeline_orders', viewStartDay],
    queryFn: async () => {
      const rangeStart = viewStartDay.toISOString();
      const rangeEnd = addDays(viewStartDay, 15).toISOString();

      const { data } = await supabase
        .from('order_items')
        .select(`
            quantity, 
            product_id, 
            orders!inner(id, customer_name, status, start_date, end_date)
        `)
        // AQUI ESTÁ O SEGREDO: Inclui 'signed' (Assinado)
        .in('orders.status', ['signed', 'reserved', 'picked_up']) 
        // Otimização: carrega apenas o que colide com a tela atual
        .lte('orders.start_date', rangeEnd) 
        .gte('orders.end_date', rangeStart);

      return data || [];
    }
  });

  const isLoading = loadingProducts || loadingOrders;

  // Dias com eventos (bolinha no calendário)
  const daysWithEvents = useMemo(() => {
    const dates = new Set<string>();
    orderItems?.forEach(item => {
      try {
        const start = parseISO(item.orders.start_date);
        const end = parseISO(item.orders.end_date);
        if(isBefore(end, start)) return;
        eachDayOfInterval({ start, end }).forEach(day => dates.add(format(day, 'yyyy-MM-dd')));
      } catch (e) {}
    });
    return dates;
  }, [orderItems]);

  const handleDateSelect = (date: Date | undefined) => {
    if (date) { setSelectedDate(date); setViewStartDay(startOfDay(date)); }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'signed': return { bg: 'bg-green-500/90', border: 'border-green-600', text: 'text-white', label: 'ASSINADO' };
      case 'picked_up': return { bg: 'bg-purple-500/90', border: 'border-purple-600', text: 'text-white', label: 'NA RUA' };
      case 'reserved': return { bg: 'bg-blue-500/90', border: 'border-blue-600', text: 'text-white', label: 'RESERVADO' };
      default: return { bg: 'bg-gray-400/90', border: 'border-gray-500', text: 'text-gray-900', label: 'RASCUNHO' };
    }
  };

  if (loadingProducts && !products) return <div className="flex justify-center p-20"><Loader2 className="animate-spin h-8 w-8 text-blue-600"/></div>;

  return (
    <div className="p-4 md:p-8 space-y-6 h-screen flex flex-col bg-gray-50/30">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
            <h1 className="text-2xl md:text-3xl font-bold tracking-tight text-gray-900">Timeline</h1>
            <p className="text-muted-foreground">Visualize a ocupação dos seus produtos.</p>
        </div>
        
        <div className="flex items-center gap-2 bg-white border rounded-xl p-1 shadow-sm">
          <Button variant="ghost" size="icon" onClick={() => setViewStartDay(d => addDays(d, -15))}><ChevronLeft className="h-4 w-4" /></Button>
          <Popover>
            <PopoverTrigger asChild>
              <Button variant={"outline"} className={cn("w-[180px] justify-start text-left font-medium", !selectedDate && "text-muted-foreground")}>
                <CalendarIcon className="mr-2 h-4 w-4" />{selectedDate ? format(selectedDate, "MMMM yyyy", { locale: ptBR }) : <span>Selecione</span>}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="end">
              <Calendar mode="single" selected={selectedDate} onSelect={handleDateSelect} initialFocus locale={ptBR} modifiers={{ event: (day) => daysWithEvents.has(format(day, 'yyyy-MM-dd')) }} modifiersStyles={{ event: { border: '2px solid hsl(221 83% 53%)', borderRadius: '50%' } }} />
            </PopoverContent>
          </Popover>
          <Button variant="ghost" size="icon" onClick={() => setViewStartDay(d => addDays(d, 15))}><ChevronRight className="h-4 w-4" /></Button>
        </div>
      </div>

      <div className="flex-1 bg-white border rounded-xl overflow-hidden relative shadow-sm">
        <div className="overflow-x-auto h-full">
          <div className="inline-block min-w-full">
            {/* Header das Datas */}
            <div className="flex sticky top-0 z-20 bg-gray-50 border-b shadow-sm">
              <div className="w-64 p-4 border-r font-semibold text-gray-500 bg-gray-50 sticky left-0 z-30">Produtos / Ativos</div>
              {days.map((day) => (
                <div key={day.toString()} className={`flex-1 min-w-[120px] p-4 text-center border-r last:border-r-0 ${isSameDay(day, new Date()) ? 'bg-blue-50/50' : ''}`}>
                  <div className="text-xs uppercase text-gray-400 font-bold">{format(day, 'EEE', { locale: ptBR })}</div>
                  <div className={`text-lg font-bold ${isSameDay(day, new Date()) ? 'text-blue-600' : ''}`}>{format(day, 'dd')}</div>
                </div>
              ))}
            </div>

            {/* Linhas dos Produtos */}
            {products?.length === 0 ? <div className="p-10 text-center text-gray-400">Nenhum produto encontrado.</div> : 
             products?.map((product: any) => {
               const allocations = orderItems?.filter((item: any) => item.product_id === product.id) || [];
               
               return (
                 <div key={product.id} className="flex border-b last:border-b-0 hover:bg-gray-50/50 transition-colors group">
                   {/* Coluna Fixa do Nome */}
                   <div className="w-64 p-4 border-r font-medium text-gray-700 bg-white sticky left-0 z-10 group-hover:bg-gray-50/50">
                     {product.name}
                     <div className="flex gap-2 mt-1">
                        <span className="text-[10px] px-1.5 py-0.5 bg-gray-100 rounded text-gray-500 border">Total: {product.total_quantity}</span>
                     </div>
                   </div>
                   
                   {/* Grade de Dias */}
                   <div className="flex flex-1 relative h-16">
                     {days.map((day) => (
                        <div key={day.toString()} className={`flex-1 min-w-[120px] border-r last:border-r-0 ${isSameDay(day, new Date()) ? 'bg-blue-50/30' : ''}`} />
                     ))}
                     
                     {/* Blocos de Pedidos */}
                     {allocations.map((item: any, index: number) => {
                       const order = item.orders;
                       const position = getBlockPosition(order.start_date, order.end_date, days);
                       if (!position) return null;
                       const colorConfig = getStatusColor(order.status);

                       return (
                         <Link 
                           key={order.id + index} 
                           to={`/orders?id=${order.id}`}
                           className={cn(
                             `absolute top-2 h-12 rounded-md border shadow-sm flex items-center px-3 text-xs font-bold overflow-hidden whitespace-nowrap z-10 transition-all cursor-pointer hover:shadow-md hover:scale-[1.01]`,
                             colorConfig.bg, colorConfig.border, colorConfig.text
                           )}
                           style={{ left: `${position.left + 2}px`, width: `${position.width - 4}px` }} // +2 -4 para margem visual
                           title={`Cliente: ${order.customer_name} | Período: ${format(parseISO(order.start_date), 'dd/MM')} a ${format(parseISO(order.end_date), 'dd/MM')}`}
                         >
                           <span className="mr-1 opacity-70">#{order.id.split('-')[0]}</span>
                           {order.customer_name} (x{item.quantity})
                         </Link>
                       );
                     })}
                   </div>
                 </div>
               );
             })}
          </div>
        </div>
      </div>
    </div>
  );
};

export default Timeline;