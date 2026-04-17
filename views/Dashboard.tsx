
import React, { useState } from 'react';
import { db } from '../services/database';
import { 
  Users, 
  Calendar as CalendarIcon, 
  Euro, 
  TrendingUp,
  FileSpreadsheet,
  Trash2,
  Plus,
  LogIn
} from 'lucide-react';
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
  Cell
} from 'recharts';

const Dashboard: React.FC<{ user?: any, onNavigateToClient: (id: string) => void, onNavigateToTab: (tab: string) => void }> = ({ user, onNavigateToClient, onNavigateToTab }) => {
  const [clients, setClients] = useState<any[]>([]);
  const [appointments, setAppointments] = useState<any[]>([]);
  const [invoices, setInvoices] = useState<any[]>([]);
  const [productInvoices, setProductInvoices] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const loadData = async () => {
    setIsLoading(true);
    const [c, a, i, pi] = await Promise.all([
      db.getClients(),
      db.getAppointments(),
      db.getInvoices(),
      db.getProductInvoices()
    ]);
    setClients(c);
    setAppointments(a);
    setInvoices(i);
    setProductInvoices(pi);
    setIsLoading(false);
  };

  React.useEffect(() => {
    loadData();
  }, [user]);
  
  const currentYear = new Date().getFullYear();
  const currentMonth = new Date().getMonth(); // 0-11
  const currentQuarter = Math.floor(currentMonth / 3) + 1; // 1-4

  const [selectedYear, setSelectedYear] = useState<number>(currentYear);
  const [periodType, setPeriodType] = useState<'year' | 'quarter' | 'month'>('year');
  const [selectedQuarter, setSelectedQuarter] = useState<number>(currentQuarter);
  const [selectedMonth, setSelectedMonth] = useState<number>(currentMonth);
  const [activityType, setActivityType] = useState<'grooming' | 'products' | 'all'>('grooming');

  const groomingInvoices = invoices || [];
  const pInvoices = productInvoices || [];
  
  const allInvoices = activityType === 'all' 
    ? [...groomingInvoices, ...pInvoices] 
    : activityType === 'grooming' 
      ? groomingInvoices 
      : pInvoices;

  const invoiceYears = Array.from(new Set([...groomingInvoices, ...pInvoices].map(inv => parseInt((inv.date || '').substring(0, 4))))).filter(y => !isNaN(y));
  const minYear = Math.min(...invoiceYears, currentYear - 5);
  const maxYear = Math.max(...invoiceYears, currentYear + 1);
  const availableYears = [];
  for (let y = maxYear; y >= minYear; y--) {
    availableYears.push(y);
  }

  // Filter invoices based on global selection
  const filteredInvoices = allInvoices.filter(inv => {
    if (!inv.date) return false;
    const invYear = parseInt(inv.date.substring(0, 4));
    if (invYear !== selectedYear) return false;

    if (periodType === 'year') return true;

    const invMonth = parseInt(inv.date.substring(5, 7)) - 1; // 0-11
    
    if (periodType === 'quarter') {
      const invQuarter = Math.floor(invMonth / 3) + 1;
      return invQuarter === selectedQuarter;
    }

    if (periodType === 'month') {
      return invMonth === selectedMonth;
    }

    return true;
  });

  const periodRevenue = filteredInvoices.reduce((acc, inv) => acc + inv.amount, 0);
  const yearRevenue = allInvoices
    .filter(inv => (inv.date || '').startsWith(selectedYear.toString()))
    .reduce((acc, inv) => acc + inv.amount, 0);

  const getChartData = () => {
    if (periodType === 'year' || periodType === 'quarter') {
      const monthsData: Record<number, number> = {};
      
      let startMonth = 0;
      let endMonth = 11;
      
      if (periodType === 'quarter') {
        startMonth = (selectedQuarter - 1) * 3;
        endMonth = startMonth + 2;
      }

      for (let i = startMonth; i <= endMonth; i++) {
        monthsData[i] = 0;
      }

      filteredInvoices.forEach(inv => {
        const m = parseInt(inv.date.substring(5, 7)) - 1;
        if (m >= startMonth && m <= endMonth) {
          monthsData[m] += inv.amount;
        }
      });

      const monthNames = ['Jan', 'Fév', 'Mar', 'Avr', 'Mai', 'Juin', 'Juil', 'Aoû', 'Sep', 'Oct', 'Nov', 'Déc'];
      return Object.entries(monthsData).map(([m, total]) => ({
        name: monthNames[parseInt(m)],
        total
      }));
    } else {
      // Month view: group by day
      const daysData: Record<number, number> = {};
      const daysInMonth = new Date(selectedYear, selectedMonth + 1, 0).getDate();
      for (let i = 1; i <= daysInMonth; i++) {
        daysData[i] = 0;
      }
      filteredInvoices.forEach(inv => {
        const d = parseInt(inv.date.substring(8, 10));
        daysData[d] += inv.amount;
      });
      return Object.entries(daysData).map(([d, total]) => ({
        name: d,
        total
      }));
    }
  };

  const exportFinancials = () => {
    const headers = ["ID", "Facture", "Date", "Animal", "Propriétaire", "Soin/Produits", "Montant", "Règlement"];
    const rows = filteredInvoices.map(inv => [
      inv.id,
      inv.number,
      inv.date,
      'petName' in inv ? inv.petName : 'N/A',
      'ownerName' in inv ? inv.ownerName : inv.clientName,
      inv.notes || ('items' in inv ? 'Vente Produits' : 'Soin toilettage'),
      inv.amount.toString(),
      inv.paymentMethod
    ]);
    
    const csvContent = "data:text/csv;charset=utf-8," 
      + [headers, ...rows].map(e => e.join(";")).join("\n");
      
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    
    let periodLabel = selectedYear.toString();
    if (periodType === 'quarter') periodLabel += `_T${selectedQuarter}`;
    if (periodType === 'month') periodLabel += `_M${(selectedMonth + 1).toString().padStart(2, '0')}`;
    
    link.setAttribute("download", `comptabilite_kanine_${periodLabel}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-500 max-w-[1600px] mx-auto pb-10">
      {/* Header & Filters */}
      <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4 bg-white p-5 rounded-2xl shadow-sm border border-slate-100">
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex bg-slate-50 p-1.5 rounded-xl text-[10px] font-bold border border-slate-100 shadow-inner">
            <button onClick={() => setActivityType('all')} className={`px-4 py-2 rounded-lg transition-all ${activityType === 'all' ? 'bg-white shadow-sm text-emerald-600 font-bold border border-emerald-50' : 'text-slate-400 hover:text-slate-600'}`}>Global</button>
            <button onClick={() => setActivityType('grooming')} className={`px-4 py-2 rounded-lg transition-all ${activityType === 'grooming' ? 'bg-white shadow-sm text-emerald-600 font-bold border border-emerald-50' : 'text-slate-400 hover:text-slate-600'}`}>Services</button>
            <button onClick={() => setActivityType('products')} className={`px-4 py-2 rounded-lg transition-all ${activityType === 'products' ? 'bg-white shadow-sm text-emerald-600 font-bold border border-emerald-50' : 'text-slate-400 hover:text-slate-600'}`}>Boutique</button>
          </div>

          <div className="flex items-center gap-2 bg-slate-50 p-1.5 rounded-xl border border-slate-100 shadow-inner">
            <div className="flex text-[10px] font-bold">
              <button onClick={() => setPeriodType('year')} className={`px-3 py-2 rounded-lg transition-all ${periodType === 'year' ? 'bg-white shadow-sm text-emerald-600 font-bold border border-emerald-50' : 'text-slate-400'}`}>Année</button>
              <button onClick={() => setPeriodType('quarter')} className={`px-3 py-2 rounded-lg transition-all ${periodType === 'quarter' ? 'bg-white shadow-sm text-emerald-600 font-bold border border-emerald-50' : 'text-slate-400'}`}>Trim.</button>
              <button onClick={() => setPeriodType('month')} className={`px-3 py-2 rounded-lg transition-all ${periodType === 'month' ? 'bg-white shadow-sm text-emerald-600 font-bold border border-emerald-50' : 'text-slate-400'}`}>Mois</button>
            </div>
            <div className="w-px h-4 bg-slate-200 mx-1"></div>
            <select 
              value={selectedYear} 
              onChange={(e) => setSelectedYear(parseInt(e.target.value))}
              className="text-[11px] font-bold text-slate-700 bg-transparent px-2 py-1 outline-none cursor-pointer tracking-tight"
            >
              {availableYears.map(year => (
                <option key={year} value={year}>{year}</option>
              ))}
            </select>
          </div>

          {periodType === 'quarter' && (
            <select 
              value={selectedQuarter} 
              onChange={(e) => setSelectedQuarter(parseInt(e.target.value))}
              className="text-[11px] font-bold text-slate-700 bg-slate-50 px-4 py-3 rounded-xl border border-slate-100 outline-none cursor-pointer shadow-sm focus:ring-2 focus:ring-emerald-100"
            >
              <option value={1}>T1: JAN - MAR</option>
              <option value={2}>T2: AVR - JUN</option>
              <option value={3}>T3: JUL - SEP</option>
              <option value={4}>T4: OCT - DEC</option>
            </select>
          )}

          {periodType === 'month' && (
            <select 
              value={selectedMonth} 
              onChange={(e) => setSelectedMonth(parseInt(e.target.value))}
              className="text-[11px] font-bold text-slate-700 bg-slate-50 px-4 py-3 rounded-xl border border-slate-100 outline-none cursor-pointer shadow-sm focus:ring-2 focus:ring-emerald-100 transition-all font-serif italic"
            >
              {['Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin', 'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre'].map((m, i) => (
                <option key={i} value={i}>{m}</option>
              ))}
            </select>
          )}
        </div>

        <button onClick={exportFinancials} className="flex items-center gap-2 px-8 py-3 bg-slate-900 text-white rounded-xl font-bold shadow-lg shadow-slate-200 hover:bg-emerald-700 transition-all text-xs tracking-tight w-full lg:w-auto justify-center group">
          <FileSpreadsheet size={16} className="group-hover:scale-110 transition-transform" /> Exporter les données
        </button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        {activityType !== 'products' && (
          <>
            <StatCard icon={<Users size={18} className="text-emerald-600" />} label="Clients enregistrés" value={clients.length} color="bg-emerald-50" onClick={() => onNavigateToTab('clients')} />
            <StatCard icon={<CalendarIcon size={18} className="text-emerald-600" />} label="RDV prévus" value={appointments.filter(a => a.status === 'pending').length} color="bg-emerald-50" onClick={() => onNavigateToTab('planning')} />
          </>
        )}
        <StatCard icon={<Euro size={18} className="text-emerald-600" />} label="Chiffre d'affaires" value={`${periodRevenue.toFixed(2)}€`} color="bg-emerald-50" onClick={() => onNavigateToTab('invoices')} />
        <StatCard icon={<TrendingUp size={18} className="text-emerald-600" />} label="Total annuel" value={`${yearRevenue.toFixed(2)}€`} color="bg-emerald-50" onClick={() => onNavigateToTab('invoices')} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 bg-white p-6 rounded-2xl shadow-sm border border-slate-100 flex flex-col">
          <div className="flex justify-between items-center mb-8">
            <h3 className="font-serif text-xl text-slate-700">Progression de l'activité</h3>
          </div>
          <div className="flex-1 h-[320px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={getChartData()}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{fontSize: 10, fill: '#94a3b8'}} dy={12} />
                <YAxis axisLine={false} tickLine={false} tick={{fontSize: 10, fill: '#94a3b8'}} />
                <Tooltip 
                  cursor={{fill: '#f0fdf4'}}
                  contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)', padding: '12px' }}
                  labelStyle={{ fontSize: '12px', fontWeight: 'bold', color: '#065f46' }}
                />
                <Bar dataKey="total" radius={[6, 6, 0, 0]}>
                  {getChartData().map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={index === getChartData().length - 1 ? '#10b981' : '#f1f5f9'} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100 flex flex-col">
          <h3 className="font-serif text-xl text-slate-700 mb-8">Modes de règlements</h3>
          <div className="space-y-8 flex-1">
            {['Carte', 'Espèces', 'Chèque', 'Virement'].map(method => {
              const amount = filteredInvoices.filter(inv => inv.paymentMethod === method).reduce((acc, inv) => acc + inv.amount, 0);
              const colors = { 'Carte': 'bg-emerald-500', 'Espèces': 'bg-teal-500', 'Chèque': 'bg-emerald-700', 'Virement': 'bg-emerald-300' };
              return (
                <PaymentSplit 
                  key={method}
                  label={method} 
                  value={amount} 
                  total={periodRevenue} 
                  color={colors[method as keyof typeof colors]} 
                />
              );
            })}
          </div>
          <div className="mt-8 pt-6 border-t border-slate-50">
             <div className="flex justify-between items-end">
                <div>
                   <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Total période</p>
                   <p className="text-3xl font-serif text-slate-900">{periodRevenue.toFixed(2)}€</p>
                </div>
                <div className="text-right">
                   <p className="text-[10px] font-bold text-emerald-600 uppercase tracking-wider mb-1">Status</p>
                   <p className="text-[10px] font-bold text-emerald-700 bg-emerald-50 px-3 py-1 rounded-full">Clôturé</p>
                </div>
             </div>
          </div>
        </div>
      </div>

      {activityType === 'products' && (
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100">
          <h3 className="font-serif text-xl text-slate-700 mb-8">Dernières ventes</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredInvoices.map((inv: any) => (
              <div key={inv.id} onClick={() => onNavigateToClient(inv.clientId)} className="flex items-center justify-between p-4 bg-slate-50 rounded-xl cursor-pointer hover:bg-white border border-transparent hover:border-emerald-100 transition-all group hover:shadow-md">
                <div className="flex items-center gap-3">
                   <div className="w-10 h-10 bg-white rounded-xl flex items-center justify-center text-slate-400 group-hover:text-emerald-600 transition-colors shadow-sm">
                      <LogIn size={18} />
                   </div>
                   <div>
                      <p className="text-xs font-bold text-slate-800">{inv.clientName || 'Client inconnu'}</p>
                      <p className="text-[10px] font-medium text-slate-400">{inv.date}</p>
                   </div>
                </div>
                <div className="text-right">
                   <p className="text-sm font-bold text-emerald-600">{inv.amount.toFixed(2)}€</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

const StatCard = ({ icon, label, value, color, onClick }: any) => (
  <div onClick={onClick} className={`bg-white p-5 rounded-2xl shadow-sm border border-slate-100 flex items-center gap-5 transition-all hover:border-emerald-100 hover:shadow-lg active:scale-95 group ${onClick ? 'cursor-pointer' : ''}`}>
    <div className={`p-4 rounded-xl transition-all group-hover:scale-110 ${color}`}>{icon}</div>
    <div>
      <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1 opacity-70 italic">{label}</p>
      <p className="text-2xl font-serif text-slate-900 leading-none tracking-tight tabular-nums">{value}</p>
    </div>
  </div>
);

const PaymentSplit = ({ label, value, color, total }: any) => {
  const pct = total > 0 ? (value / total) * 100 : 0;
  return (
    <div className="space-y-2">
      <div className="flex justify-between text-xs font-medium">
        <span className="text-slate-500">{label}</span>
        <span className="text-slate-900 font-bold">{value.toFixed(2)}€</span>
      </div>
      <div className="h-2.5 bg-slate-100 rounded-full overflow-hidden">
        <div className={`h-full ${color} rounded-full transition-all duration-1000`} style={{ width: `${pct}%` }}></div>
      </div>
    </div>
  );
};

export default Dashboard;
