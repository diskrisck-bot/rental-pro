// ... (MANTENHA OS OUTROS COMPONENTES IGUAIS: MetricCard, ReturnsAlertWidget, QuickInventoryWidget) ...

// Widget de Timeline (Central) - ATUALIZADO PARA CONTRATOS
const TimelineWidget = ({ activeOrders }: any) => {
  const navigate = useNavigate();
  const today = startOfDay(new Date());
  const days = eachDayOfInterval({ start: today, end: addDays(today, 6) }); // 7 dias

  // Ordena pedidos por data de início
  const sortedOrders = useMemo(() => {
    return (activeOrders || []).sort((a: any, b: any) => new Date(a.start_date).getTime() - new Date(b.start_date).getTime());
  }, [activeOrders]);

  return (
    <Card className="h-full border border-gray-200 shadow-hard bg-white overflow-hidden flex flex-col rounded-xl">
      <CardHeader className="pb-2 border-b border-gray-100 bg-white z-20">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <CardTitle className="text-lg font-extrabold text-[#1A237E]">Timeline de Contratos</CardTitle>
            <Badge variant="outline" className="text-xs font-bold text-gray-500 border-gray-300">Próximos 7 dias</Badge>
          </div>
          <Button variant="outline" size="sm" onClick={() => navigate('/timeline')} className="text-xs font-bold uppercase tracking-wide border-gray-300 text-gray-600 hover:text-[#1A237E]">
             Expandir <ChevronRight className="h-3 w-3 ml-1" />
          </Button>
        </div>
      </CardHeader>
      
      <div className="flex-1 overflow-x-auto overflow-y-auto relative bg-gray-50/50">
        <div className="min-w-[600px]">
            {/* Header Dias */}
            <div className="flex border-b border-gray-200 bg-white sticky top-0 z-10 shadow-sm">
                <div className="w-40 p-3 text-xs font-extrabold text-gray-400 border-r border-gray-200 bg-gray-50 sticky left-0 z-20 uppercase tracking-wider">Contrato</div>
                {days.map(day => {
                    const isToday = isSameDay(day, today);
                    return (
                        <div key={day.toString()} className={`flex-1 min-w-[60px] p-2 text-center border-r border-gray-100 ${isToday ? 'bg-blue-50/50' : ''}`}>
                            <div className={`text-[10px] font-black uppercase ${isToday ? 'text-[#1A237E]' : 'text-gray-400'}`}>{format(day, 'EEE', { locale: ptBR })}</div>
                            <div className={`text-sm font-extrabold ${isToday ? 'text-[#F57C00]' : 'text-gray-700'}`}>{format(day, 'dd')}</div>
                        </div>
                    );
                })}
            </div>

            {/* Linhas (Pedidos) */}
            {sortedOrders.length === 0 ? <div className="p-8 text-center text-gray-400 text-sm">Sem contratos ativos na semana.</div> :
             sortedOrders.map((order: any) => {
                const start = parseISO(order.start_date);
                const end = parseISO(order.end_date);
                
                // Lógica de posicionamento simplificada para widget
                let startIndex = days.findIndex(d => isSameDay(d, start));
                let endIndex = days.findIndex(d => isSameDay(d, end));
                
                if (isBefore(start, today)) startIndex = 0;
                if (isAfter(end, days[days.length-1])) endIndex = 6;
                
                // Se não colide com a semana, não mostra
                if (isAfter(start, days[days.length-1]) || isBefore(end, today)) return null;

                const width = (endIndex - startIndex + 1) * 100 / 7; 
                const left = (startIndex) * 100 / 7;
                
                const isEndsToday = isSameDay(end, today);

                return (
                    <div key={order.id} className="flex border-b border-gray-200 last:border-0 hover:bg-white transition-colors group h-12 relative bg-white">
                        <div className="w-40 p-3 text-xs font-bold text-gray-700 border-r border-gray-200 bg-white sticky left-0 z-10 truncate flex items-center shadow-[2px_0_5px_-2px_rgba(0,0,0,0.1)]">
                            {order.customer_name}
                        </div>
                        <div className="flex-1 flex relative">
                            {days.map(day => (
                                <div key={day.toString()} className={`flex-1 min-w-[60px] border-r border-gray-100 ${isSameDay(day, today) ? 'bg-blue-50/20' : ''}`} />
                            ))}
                            
                            <div 
                                className={cn(
                                    "absolute top-2 h-8 rounded mx-0.5 text-[10px] font-bold text-white flex items-center px-2 shadow-sm overflow-hidden whitespace-nowrap",
                                    isEndsToday ? "bg-[#D32F2F]" : "bg-[#10B981]"
                                )}
                                style={{ left: `${left}%`, width: `${width}%`, maxWidth: '100%' }}
                                title={order.customer_name}
                            >
                                {isEndsToday && <AlertTriangle className="h-3 w-3 mr-1 text-white" />}
                                {order.customer_name}
                            </div>
                        </div>
                    </div>
                )
            })}
        </div>
      </div>
    </Card>
  );
};

const Dashboard = () => {
  const { data: businessName } = useQuery({ queryKey: ['businessName'], queryFn: fetchBusinessName });
  
  // Queries
  const { data: orders } = useQuery({
    queryKey: ['dashboardOrders'],
    queryFn: async () => {
        const { data } = await supabase.from('orders').select('*').neq('status', 'canceled');
        return data || [];
    }
  });

  const { data: products } = useQuery({
    queryKey: ['dashboardProducts'],
    queryFn: async () => {
        const { data } = await supabase.from('products').select('*').order('name');
        return data || [];
    }
  });

  // Query modificada para pegar pedidos ativos + itens
  const { data: activeOrders } = useQuery({
    queryKey: ['dashboardActiveOrders'],
    queryFn: async () => {
        const today = new Date().toISOString();
        const { data } = await supabase
            .from('orders') // Busca ORDERS direto
            .select('*, order_items(quantity, product_id)')
            .in('status', ['signed', 'reserved', 'picked_up'])
            // .gte('end_date', today) // Removido para garantir visibilidade
        return data || [];
    }
  });
  
  // Necessário para o widget de inventário que espera order_items "flat"
  const flatOrderItems = useMemo(() => {
      if(!activeOrders) return [];
      return activeOrders.flatMap((order: any) => 
          order.order_items.map((item: any) => ({
              ...item,
              orders: {
                  start_date: order.start_date,
                  end_date: order.end_date,
                  status: order.status
              }
          }))
      );
  }, [activeOrders]);

  const metrics = useMemo(() => {
    if (!orders) return { revenue: 0, active: 0, future: 0, clients: 0, itemsOut: 0 };

    const revenue = orders.filter(o => o.status !== 'draft').reduce((acc, curr) => acc + (Number(curr.total_amount) || 0), 0);
    const active = orders.filter(o => ['signed', 'reserved', 'picked_up'].includes(o.status)).length;
    
    const today = startOfDay(new Date());
    const future = orders.filter(o => {
        const start = new Date(o.start_date);
        return ['signed', 'reserved'].includes(o.status) && isAfter(start, today);
    }).length;

    const clients = new Set(orders.filter(o => o.status !== 'draft').map(o => o.customer_cpf)).size;
    
    // Calcula itens fora baseado nos activeOrders
    const itemsOut = activeOrders?.reduce((acc: number, order: any) => {
        const orderTotal = order.order_items.reduce((sum: number, item: any) => sum + item.quantity, 0);
        return acc + orderTotal;
    }, 0) || 0;

    return { revenue, active, future, clients, itemsOut };
  }, [orders, activeOrders]);

  const formatCurrency = (val: number) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val);

  return (
    <div className="p-6 md:p-10 space-y-8 bg-[#F4F5F7] min-h-screen font-sans">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-3xl font-extrabold tracking-tight text-[#1A237E] uppercase">Dashboard</h1>
          <p className="text-gray-500 mt-1 font-medium">Visão tática: {businessName || 'Minha Locadora'}</p>
        </div>
        <div className="flex gap-3">
            <CreateOrderDialog onOrderCreated={() => window.location.reload()}> 
                <Button className="bg-[#F57C00] hover:bg-orange-700 text-white font-bold uppercase tracking-wide h-12 px-6 shadow-hard rounded-lg transition-all active:translate-y-1">
                    + Novo Pedido
                </Button>
            </CreateOrderDialog>
        </div>
      </div>

      <ReturnsAlertWidget orders={orders || []} />

      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
        <MetricCard title="Receita Total" value={formatCurrency(metrics.revenue)} subtext="Acumulado" icon={DollarSign} variant="primary" />
        <MetricCard title="Contratos Ativos" value={metrics.active} subtext="Em andamento" icon={FileText} variant="secondary" />
        <MetricCard title="Itens Alugados" value={metrics.itemsOut} subtext="Equipamentos fora" icon={Box} variant="primary" />
        <MetricCard title="Clientes" value={metrics.clients} subtext="Base total" icon={Users} variant="secondary" />
      </div>

      <div className="grid gap-6 grid-cols-1 lg:grid-cols-12">
        <div className="lg:col-span-8 h-full min-h-[400px]">
            {/* Widget atualizado recebendo activeOrders diretamente */}
            <TimelineWidget activeOrders={activeOrders} />
        </div>
        <div className="lg:col-span-4 h-full min-h-[400px]">
            {/* Widget de inventário precisa dos items flat */}
            <QuickInventoryWidget products={products} activeOrders={flatOrderItems} />
        </div>
      </div>
    </div>
  );
};

export default Dashboard;