"use client";

import React, { useState, useMemo } from 'react';
import { ChevronLeft, ChevronRight, Calendar as CalendarIcon, Loader2, User, Box } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { format, addDays, startOfToday, eachDayOfInterval, isSameDay, isBefore, isAfter, parseISO, startOfDay, isWithinInterval } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { cn } from '@/lib/utils';
import { Link } from 'react-router-dom';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';

const DAY_WIDTH_PX = 120;

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

  // QUERY: Busca PEDIDOS (Orders) em vez de produtos
  const { data: orders, isLoading } = useQuery({
    queryKey: ['timeline_orders_view', viewStartDay],
    queryFn: async () => {
      const rangeStart = viewStartDay.toISOString();
      const rangeEnd = addDays(viewStartDay, 15).toISOString();

      const { data } = await supabase
        .from('orders')
        .select(`
            *,
            order_items (
                quantity,
                products (name)
            )
        `)
        .in('status', ['signed', 'reserved', 'picked_up'])
        .lte('start_date', rangeEnd)
        .gte('end_date', rangeStart)
        .order('start_date', { ascending: true }); // Ordena por data de início

      return data || [];
    }
  });

  const handleDateSelect = (date: Date | undefined) => {
    if (date) { setSelectedDate(date); setViewStartDay(startOfDay(date)); }
  };

  const getStatusConfig = (status: string, endDate: string) => {
    const isEndingToday = isSameDay(parseISO(endDate), startOfToday());
    
    if (isEndingToday && status !== 'returned') {
        return { bg: 'bg-destructive', border: 'border-destructive/80', text: 'text-white', label: 'VENCE HOJE' };
    }

    switch (status) {
      case 'signed': return { bg: 'bg-green-600', border: 'border-green-700', text: 'text-white', label: 'ASSINADO' };
      case 'picked_up': return { bg: 'bg-primary', border: 'border-primary/80', text: 'text-white', label: 'NA RUA' };
      case 'reserved': return { bg: 'bg-secondary', border: 'border-secondary/80', text: 'text-white', label: 'RESERVADO' };
      default: return { bg: 'bg-gray-400', border: 'border-gray-500', text: 'text-gray-900', label: status };
    }
  };

  return (
    <div className="p-4 md:p-8 space-y-6 h-screen flex flex-col bg-background">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
            <h1 className="text-2xl md:text-3xl font-extrabold tracking-tight text-foreground uppercase">Timeline de Contratos</h1>
            <p className="text-muted-foreground font-medium">Gestão visual por contrato e período.</p>
        </div>
        
        <div className="flex items-center gap-2 bg-card border border-border rounded-[var(--radius)] p-1 shadow-sm">
          <Button variant="ghost" size="icon" onClick={() => setViewStartDay(d => addDays(d, -15))}><ChevronLeft className="h-5 w-5 text-secondary" /></Button>
          <Popover>
            <PopoverTrigger asChild>
              <Button variant={"outline"} className={cn("w-[180px] justify-start text-left font-bold text-secondary border-border")}>
                <CalendarIcon className="mr-2 h-4 w-4" />{selectedDate ? format(selectedDate, "MMMM yyyy", { locale: ptBR }) : <span>Selecione</span>}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="end">
              <Calendar mode="single" selected={selectedDate} onSelect={handleDateSelect} initialFocus locale={ptBR} />
            </PopoverContent>
          </Popover>
          <Button variant="ghost" size="icon" onClick={() => setViewStartDay(d => addDays(d, 15))}><ChevronRight className="h-5 w-5 text-secondary" /></Button>
        </div>
      </div>

      <div className="flex-1 bg-card border border-border rounded-[var(--radius)] overflow-hidden relative shadow-hard">
        <div className="overflow-x-auto h-full">
          <div className="inline-block min-w-full">
            {/* Header Dias */}
            <div className="flex sticky top-0 z-20 bg-muted border-b border-border shadow-sm">
              <div className="w-72 p-4 border-r border-border font-extrabold text-secondary bg-muted sticky left-0 z-30 uppercase tracking-wide flex items-center gap-2">
                <User className="h-4 w-4" /> Cliente / Contrato
              </div>
              {days.map((day) => (
                <div key={day.toString()} className={`flex-1 min-w-[120px] p-4 text-center border-r border-border/50 last:border-r-0 ${isSameDay(day, new Date()) ? 'bg-primary/10' : ''}`}>
                  <div className="text-xs uppercase text-muted-foreground font-bold">{format(day, 'EEE', { locale: ptBR })}</div>
                  <div className={`text-xl font-black ${isSameDay(day, new Date()) ? 'text-primary' : 'text-foreground'}`}>{format(day, 'dd')}</div>
                </div>
              ))}
            </div>

            {/* Linhas dos Contratos */}
            {isLoading ? <div className="flex justify-center p-20"><Loader2 className="animate-spin h-8 w-8 text-secondary"/></div> : 
             orders?.length === 0 ? <div className="p-10 text-center text-muted-foreground font-medium">Nenhum contrato ativo neste período.</div> : 
             orders?.map((order: any) => {
               const position = getBlockPosition(order.start_date, order.end_date, days);
               const style = getStatusConfig(order.status, order.end_date);
               
               return (
                 <div key={order.id} className="flex border-b border-border/50 last:border-b-0 hover:bg-muted/50 transition-colors group h-16 relative">
                   {/* Coluna Fixa do Cliente */}
                   <div className="w-72 p-3 border-r border-border bg-card sticky left-0 z-10 group-hover:bg-muted/50 flex flex-col justify-center shadow-[2px_0_5px_-2px_rgba(0,0,0,0.1)]">
                     <span className="font-bold text-secondary truncate" title={order.customer_name}>{order.customer_name}</span>
                     <span className="text-xs text-muted-foreground font-medium">#{order.id.split('-')[0]}</span>
                   </div>
                   
                   {/* Grade e Barra */}
                   <div className="flex flex-1 relative h-full items-center">
                     {days.map((day) => (
                        <div key={day.toString()} className={`flex-1 min-w-[120px] h-full border-r border-border/50 last:border-r-0 ${isSameDay(day, new Date()) ? 'bg-primary/10' : ''}`} />
                     ))}
                     
                     {position && (
                       <TooltipProvider delayDuration={0}>
                         <Tooltip>
                           <TooltipTrigger asChild>
                             <Link 
                               to={`/orders?id=${order.id}`}
                               className={cn(
                                 `absolute h-10 rounded-[var(--radius)] border-l-4 shadow-sm flex items-center px-3 text-xs font-bold overflow-hidden whitespace-nowrap z-10 transition-all cursor-pointer hover:shadow-md hover:scale-[1.01] uppercase tracking-wide`,
                                 style.bg, style.border, style.text
                               )}
                               style={{ left: `${position.left + 4}px`, width: `${position.width - 8}px` }}
                             >
                               {style.label}
                             </Link>
                           </TooltipTrigger>
                           <TooltipContent className="bg-secondary text-white border-none p-4 rounded-lg shadow-xl">
                             <div className="font-bold mb-2 text-lg border-b border-primary/50 pb-1">{order.customer_name}</div>
                             <div className="text-xs text-muted-foreground mb-2 font-mono">
                               {format(parseISO(order.start_date), 'dd/MM')} até {format(parseISO(order.end_date), 'dd/MM')}
                             </div>
                             <div className="space-y-1">
                               {order.order_items?.map((item: any, idx: number) => (
                                 <div key={idx} className="flex items-center gap-2 text-sm">
                                   <Box className="h-3 w-3 text-primary" /> 
                                   <span className="font-bold">{item.quantity}x</span> {item.products?.name}
                                 </div>
                               ))}
                             </div>
                           </TooltipContent>
                         </Tooltip>
                       </TooltipProvider>
                     )}
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