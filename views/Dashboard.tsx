
import React, { useState } from 'react';
import { db } from '../services/database';
import { 
  Users, 
  Calendar as CalendarIcon, 
  Euro, 
  TrendingUp,
  FileSpreadsheet
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
    <div className="space-y-8 animate-in fade-in duration-500">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-white p-6 rounded-[2rem] shadow-sm border border-slate-100">
        <div className="flex flex-wrap items-center gap-4">
          <div className="flex bg-slate-100 p-1 rounded-xl text-[10px] font-black uppercase">
            <button onClick={() => setActivityType('all')} className={`px-4 py-2 rounded-lg transition-all ${activityType === 'all' ? 'bg-white shadow-sm text-indigo-600' : 'text-slate-500 hover:text-slate-700'}`}>Global</button>
            <button onClick={() => setActivityType('grooming')} className={`px-4 py-2 rounded-lg transition-all ${activityType === 'grooming' ? 'bg-white shadow-sm text-indigo-600' : 'text-slate-500 hover:text-slate-700'}`}>Toilettage</button>
            <button onClick={() => setActivityType('products')} className={`px-4 py-2 rounded-lg transition-all ${activityType === 'products' ? 'bg-white shadow-sm text-indigo-600' : 'text-slate-500 hover:text-slate-700'}`}>Produits</button>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-xs font-bold text-slate-500 uppercase">Année :</span>
            <select 
              value={selectedYear} 
              onChange={(e) => setSelectedYear(parseInt(e.target.value))}
              className="text-sm font-black text-slate-800 bg-slate-50 px-3 py-2 rounded-xl border-none outline-none cursor-pointer focus:ring-2 focus:ring-indigo-500"
            >
              {availableYears.map(year => (
                <option key={year} value={year}>{year}</option>
              ))}
            </select>
          </div>

          <div className="flex bg-slate-100 p-1 rounded-xl text-[10px] font-black uppercase">
            <button onClick={() => setPeriodType('year')} className={`px-4 py-2 rounded-lg transition-all ${periodType === 'year' ? 'bg-white shadow-sm text-indigo-600' : 'text-slate-500 hover:text-slate-700'}`}>Année</button>
            <button onClick={() => setPeriodType('quarter')} className={`px-4 py-2 rounded-lg transition-all ${periodType === 'quarter' ? 'bg-white shadow-sm text-indigo-600' : 'text-slate-500 hover:text-slate-700'}`}>Trimestre</button>
            <button onClick={() => setPeriodType('month')} className={`px-4 py-2 rounded-lg transition-all ${periodType === 'month' ? 'bg-white shadow-sm text-indigo-600' : 'text-slate-500 hover:text-slate-700'}`}>Mois</button>
          </div>

          {periodType === 'quarter' && (
            <select 
              value={selectedQuarter} 
              onChange={(e) => setSelectedQuarter(parseInt(e.target.value))}
              className="text-sm font-black text-slate-800 bg-slate-50 px-3 py-2 rounded-xl border-none outline-none cursor-pointer focus:ring-2 focus:ring-indigo-500"
            >
              <option value={1}>T1 (Jan-Mar)</option>
              <option value={2}>T2 (Avr-Juin)</option>
              <option value={3}>T3 (Juil-Sep)</option>
              <option value={4}>T4 (Oct-Déc)</option>
            </select>
          )}

          {periodType === 'month' && (
            <select 
              value={selectedMonth} 
              onChange={(e) => setSelectedMonth(parseInt(e.target.value))}
              className="text-sm font-black text-slate-800 bg-slate-50 px-3 py-2 rounded-xl border-none outline-none cursor-pointer focus:ring-2 focus:ring-indigo-500"
            >
              {['Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin', 'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre'].map((m, i) => (
                <option key={i} value={i}>{m}</option>
              ))}
            </select>
          )}
        </div>

        <button onClick={exportFinancials} className="flex items-center gap-2 px-6 py-3 bg-emerald-600 text-white rounded-xl font-bold shadow-lg shadow-emerald-100 hover:bg-emerald-700 transition-all text-sm w-full md:w-auto justify-center">
          <FileSpreadsheet size={18} /> Exporter la période
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {activityType !== 'products' && (
          <>
            <StatCard icon={<Users className="text-indigo-600" />} label="Base Clients" value={clients.length} color="bg-indigo-50" onClick={() => onNavigateToTab('clients')} />
            <StatCard icon={<CalendarIcon className="text-purple-600" />} label="RDV prévus" value={appointments.filter(a => a.status === 'pending').length} color="bg-purple-50" onClick={() => onNavigateToTab('planning')} />
          </>
        )}
        <StatCard icon={<Euro className="text-emerald-600" />} label="C.A. Période" value={`${periodRevenue.toFixed(2)}€`} color="bg-emerald-50" onClick={() => onNavigateToTab('invoices')} />
        <StatCard icon={<TrendingUp className="text-orange-600" />} label="C.A. Annuel" value={`${yearRevenue.toFixed(2)}€`} color="bg-orange-50" onClick={() => onNavigateToTab('invoices')} />
      </div>

      {activityType === 'products' ? (
        <div className="bg-white p-8 rounded-[2.5rem] shadow-sm border border-slate-100">
          <h3 className="text-lg font-black text-slate-800 uppercase tracking-tighter mb-8">Liste des ventes produits</h3>
          <div className="space-y-4">
            {filteredInvoices.map((inv: any) => (
              <div key={inv.id} onClick={() => onNavigateToClient(inv.clientId)} className="grid grid-cols-4 gap-4 p-4 bg-slate-50 rounded-2xl items-center text-sm cursor-pointer hover:bg-indigo-50 transition-colors">
                <span className="font-bold text-slate-800">{inv.clientName || 'Client inconnu'}</span>
                <span className="text-slate-600">{inv.notes || 'Vente produit'}</span>
                <span className="font-black text-emerald-600">{(inv.amount || 0).toFixed(2)}€</span>
                <span className="text-xs text-slate-400">{inv.date}</span>
              </div>
            ))}
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          <div className="lg:col-span-2 bg-white p-8 rounded-[2.5rem] shadow-sm border border-slate-100">
            <div className="flex justify-between items-center mb-8">
              <h3 className="text-lg font-black text-slate-800 uppercase tracking-tighter">Performance de la période</h3>
            </div>
            <div className="h-80">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={getChartData()}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                  <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{fill: '#94a3b8', fontSize: 10, fontWeight: 800}} dy={10} />
                  <YAxis axisLine={false} tickLine={false} tick={{fill: '#94a3b8', fontSize: 10, fontWeight: 800}} />
                  <Tooltip 
                    cursor={{fill: '#f8fafc'}}
                    contentStyle={{ borderRadius: '16px', border: 'none', boxShadow: '0 20px 25px -5px rgb(0 0 0 / 0.1)', padding: '16px' }}
                  />
                  <Bar dataKey="total" fill="#6366f1" radius={[8, 8, 0, 0]} barSize={periodType === 'month' ? 20 : 50}>
                    {getChartData().map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={index === getChartData().length - 1 ? '#4f46e5' : '#e2e8f0'} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="bg-white p-8 rounded-[2.5rem] shadow-sm border border-slate-100 flex flex-col">
            <h3 className="text-lg font-black text-slate-800 uppercase tracking-tighter mb-6">Répartition Encaissements</h3>
            <div className="space-y-4 flex-1">
              <PaymentSplit label="Carte Bancaire" value={filteredInvoices.filter(i => i.paymentMethod === 'Carte').reduce((a,b) => a+b.amount, 0)} color="bg-indigo-500" total={periodRevenue} />
              <PaymentSplit label="Espèces" value={filteredInvoices.filter(i => i.paymentMethod === 'Espèces').reduce((a,b) => a+b.amount, 0)} color="bg-emerald-500" total={periodRevenue} />
              <PaymentSplit label="Chèques / Vir." value={filteredInvoices.filter(i => ['Chèque', 'Virement'].includes(i.paymentMethod)).reduce((a,b) => a+b.amount, 0)} color="bg-amber-500" total={periodRevenue} />
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

const StatCard = ({ icon, label, value, color, onClick }: any) => (
  <div onClick={onClick} className={`bg-white p-6 rounded-3xl shadow-sm border border-slate-100 flex items-center gap-4 transition-transform hover:-translate-y-1 ${onClick ? 'cursor-pointer hover:shadow-md' : ''}`}>
    <div className={`p-4 rounded-2xl ${color}`}>{icon}</div>
    <div>
      <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest leading-tight mb-1">{label}</p>
      <p className="text-2xl font-black text-slate-900 leading-tight">{value}</p>
    </div>
  </div>
);

const PaymentSplit = ({ label, value, color, total }: any) => {
  const pct = total > 0 ? (value / total) * 100 : 0;
  return (
    <div className="space-y-2">
      <div className="flex justify-between text-xs font-black uppercase tracking-tighter">
        <span className="text-slate-500">{label}</span>
        <span className="text-slate-900">{value.toFixed(2)}€</span>
      </div>
      <div className="h-3 bg-slate-100 rounded-full overflow-hidden">
        <div className={`h-full ${color} rounded-full transition-all duration-1000`} style={{ width: `${pct}%` }}></div>
      </div>
    </div>
  );
};

export default Dashboard;
