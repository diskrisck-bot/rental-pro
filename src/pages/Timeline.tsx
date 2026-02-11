"use client";

import React, { useState, useMemo } from 'react';
import { ChevronLeft, ChevronRight, Calendar as CalendarIcon, Loader2, User, Box, AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { format, addDays, startOfToday, eachDayOfInterval, isSameDay, isBefore, isAfter, parseISO, startOfDay, endOfDay } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { cn } from '@/lib/utils';
import { Link } from 'react-router-dom';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';

const DAY_WIDTH_PX = 120;

const getBlockPosition = (startDateStr: string, endDateStr: string, days: Date[], status: string) => {
  const today = startOfToday();
  const startDate = parseISO(startDateStr);
  let endDate = parseISO(endDateStr);

  // LÓGICA CRÍTICA: Se está na rua e a data de fim já passou, a "data visual" de fim é HOJE
  if (status === 'picked_up' && isBefore(endDate, today)) {
    endDate = today;
  }
  
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
  const today = startOfToday();

  const days = useMemo(() => eachDayOfInterval({ start: viewStartDay, end: addDays(viewStartDay, 14) }), [viewStartDay]);

  // QUERY AJUSTADA: Busca o que termina no futuro OU o que está na rua (mesmo que vencido)
  const { data: orders, isLoading } = useQuery({
    queryKey: ['timeline_orders_view', viewStartDay],
    queryFn: async () => {
      const rangeStart = viewStartDay.toISOString();
      const rangeEnd = addDays(viewStartDay, 15).toISOString();

      // Filtro complexo: (status = picked_up) OU (end_date >= rangeStart)
      const { data } = await supabase
        .from('orders')
        .select(`
            *,
            order_items (
                quantity,
                products (name)
            )
        `)
        .or(`status.eq.picked_up,end_date.gte.${rangeStart}`)
        .lte('start_date', rangeEnd)
        .order('start_date', { ascending: true });

      return data || [];
    }
  });

  const handleDateSelect = (date: Date | undefined) => {
    if (date) { setSelectedDate(date); setViewStartDay(startOfDay(date)); }
  };

  const getStatusConfig = (status: string, endDateStr: string) => {
    const endDate = parseISO(endDateStr);
    const isEndingToday = isSameDay(endDate, today);
    const isOverdue = isBefore(endDate, today) && status === 'picked_up';
    
    if (isOverdue) {
        return { 
          bg: 'bg-destructive', 
          border: 'border-destructive/80', 
          text: 'text-white', 
          label: 'ATRASADO',
          icon: <AlertTriangle className="h-3 w-3 mr-1 animate-pulse" />
        };
    }

    if (isEndingToday && status === 'picked_up') {
        return { 
          bg: 'bg-destructive', 
          border: 'border-destructive/80', 
          text: 'text-white', 
          label: 'VENCE HOJE',
          icon: <Clock className="h-3 w-3 mr-1" />
        };
    }

    return { 
      bg: status === 'picked_up' ? 'bg-primary' : 'bg-secondary', 
      border: status === 'picked_up' ? 'border-primary/80' : 'border-secondary/80', 
      text: 'text-white', 
      label: status === 'picked_up' ? 'NA RUA' : 'RESERVADO',
      icon: null
    };
  };

  return (
    <div className="p-4 md:p-8 space-y-6 h-screen flex flex-col bg-background">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
            <h1 className="text-2xl md:text-3xl font-extrabold tracking-tight text-foreground uppercase">Timeline de Uso</h1>
            <p className="text-muted-foreground font-medium">Visualização de equipamentos na rua e reservas futuras.</p>
        </div>
        
        <div className="flex items-center gap-2 bg-card border border-border rounded-[var(--radius)] p-1 shadow-sm">
          <Button variant="ghost" size="icon" onClick={() => setViewStartDay(d => addDays(d, -15))}><ChevronLeft className="h-5 w-5 text-foreground" /></Button>
          <Popover>
            <PopoverTrigger asChild>
              <Button variant={"outline"} className={cn("w-[180px] justify-start text-left font-bold text-foreground border-border")}>
                <CalendarIcon className="mr-2 h-4 w-4" />{selectedDate ? format(selectedDate, "MMMM yyyy", { locale: ptBR }) : <span>Selecione</span>}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="end">
              <Calendar mode="single" selected={selectedDate} onSelect={handleDateSelect} initialFocus locale={ptBR} />
            </PopoverContent>
          </Popover>
          <Button variant="ghost" size="icon" onClick={() => setViewStartDay(d => addDays(d, 15))}><ChevronRight className="h-5 w-5 text-foreground" /></Button>
        </div>
      </div>

      <div className="flex-1 bg-card border border-border rounded-[var(--radius)] overflow-hidden relative shadow-custom">
        <div className="overflow-x-auto h-full">
          <div className="inline-block min-w-full">
            {/* Header Dias */}
            <div className="flex sticky top-0 z-20 bg-muted border-b border-border shadow-sm">
              <div className="w-72 p-4 border-r border-border font-extrabold text-foreground bg-muted sticky left-0 z-30 uppercase tracking-wide flex items-center gap-2">
                <User className="h-4 w-4" /> Cliente / Contrato
              </div>
              {days.map((day) => (
                <div key={day.toString()} className={`flex-1 min-w-[120px] p-4 text-center border-r border-border/50 last:border-r-0 ${isSameDay(day, today) ? 'bg-primary/10' : ''}`}>
                  <div className="text-xs uppercase text-muted-foreground font-bold">{format(day, 'EEE', { locale: ptBR })}</div>
                  <div className={`text-xl font-black ${isSameDay(day, today) ? 'text-primary' : 'text-foreground'}`}>{format(day, 'dd')}</div>
                </div>
              ))}
            </div>

            {/* Linhas dos Contratos */}
            {isLoading ? <div className="flex justify-center p-20"><Loader2 className="animate-spin h-8 w-8 text-primary"/></div> : 
             orders?.length === 0 ? <div className="p-10 text-center text-muted-foreground font-medium">Nenhum equipamento na rua ou reserva neste período.</div> : 
             orders?.map((order: any) => {
               const position = getBlockPosition(order.start_date, order.end_date, days, order.status);
               const style = getStatusConfig(order.status, order.end_date);
               
               return (
                 <div key={order.id} className="flex border-b border-border/50 last:border-b-0 hover:bg-muted/50 transition-colors group h-16 relative">
                   {/* Coluna Fixa do Cliente */}
                   <div className="w-72 p-3 border-r border-border bg-card sticky left-0 z-10 group-hover:bg-muted/50 flex flex-col justify-center shadow-[2px_0_5px_-2px_rgba(0,0,0,0.1)]">
                     <span className="font-bold text-foreground truncate" title={order.customer_name}>{order.customer_name}</span>
                     <span className="text-xs text-muted-foreground font-medium">#{order.id.split('-')[0]}</span>
                   </div>
                   
                   {/* Grade e Barra */}
                   <div className="flex flex-1 relative h-full items-center">
                     {days.map((day) => (
                        <div key={day.toString()} className={`flex-1 min-w-[120px] h-full border-r border-border/50 last:border-r-0 ${isSameDay(day, today) ? 'bg-primary/10' : ''}`} />
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
                               {style.icon}
                               {style.label}
                             </Link>
                           </TooltipTrigger>
                           <TooltipContent className="bg-foreground text-white border-none p-4 rounded-lg shadow-xl">
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

const Clock = ({ className }: { className?: string }) => (
  <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
);

export default Timeline;