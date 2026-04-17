
import React from 'react';
import { 
  LayoutDashboard, 
  Users, 
  Calendar, 
  Settings, 
  FileText, 
  Database,
  PawPrint,
  History,
  ShoppingBag
} from 'lucide-react';

interface LayoutProps {
  children: React.ReactNode;
  activeTab: string;
  setActiveTab: (tab: string) => void;
}

const Layout: React.FC<LayoutProps> = ({ children, activeTab, setActiveTab }) => {
  const menuItems = [
    { id: 'dashboard', label: 'Dashboard', short: 'Dash', icon: LayoutDashboard },
    { id: 'clients', label: 'Clients', short: 'Clients', icon: Users },
    { id: 'planning', label: 'Planning', short: 'RDV', icon: Calendar },
    { id: 'invoices', label: 'Factures', short: 'Fact.', icon: FileText },
    { id: 'products', label: 'Boutique', short: 'Shop', icon: ShoppingBag },
    { id: 'config', label: 'Reglages', short: 'Config', icon: Settings },
  ];

  return (
    <div className="flex flex-col md:flex-row h-screen overflow-hidden">
      {/* Sidebar - Desktop */}
      <aside className="hidden md:flex w-64 bg-[#06281e] text-slate-300 flex-col no-print shrink-0">
        <div className="p-8 flex items-center gap-4 border-b border-emerald-900/30">
          <div className="p-3 bg-emerald-500 rounded-2xl text-white shadow-xl shadow-emerald-900/40">
            <PawPrint size={28} />
          </div>
          <span className="font-serif text-2xl text-white italic">Ka'nine</span>
        </div>
        
        <nav className="flex-1 p-4 space-y-1 overflow-y-auto">
          {menuItems.map((item) => (
            <button
              key={item.id}
              onClick={() => setActiveTab(item.id)}
              className={`w-full flex items-center gap-4 px-6 py-3.5 rounded-xl transition-all ${
                activeTab === item.id 
                ? 'bg-emerald-600/20 text-emerald-400 border border-emerald-500/20 shadow-sm' 
                : 'text-slate-400 hover:bg-emerald-900/20 hover:text-emerald-300'
              }`}
            >
              <item.icon size={18} strokeWidth={activeTab === item.id ? 2.5 : 2} />
              <span className={`text-sm tracking-tight ${activeTab === item.id ? 'font-bold' : 'font-medium'}`}>{item.label}</span>
            </button>
          ))}
          <button
              onClick={() => setActiveTab('audit')}
              className={`w-full flex items-center gap-4 px-6 py-3.5 rounded-xl transition-all ${
                activeTab === 'audit' 
                ? 'bg-emerald-600/20 text-emerald-400 border border-emerald-500/20 shadow-sm' 
                : 'text-slate-400 hover:bg-emerald-900/20 hover:text-emerald-300'
              }`}
            >
              <History size={18} strokeWidth={activeTab === 'audit' ? 2.5 : 2} />
              <span className={`text-sm tracking-tight ${activeTab === 'audit' ? 'font-bold' : 'font-medium'}`}>Historique</span>
            </button>
          <button
              onClick={() => setActiveTab('backup')}
              className={`w-full flex items-center gap-4 px-6 py-3.5 rounded-xl transition-all ${
                activeTab === 'backup' 
                ? 'bg-emerald-600/20 text-emerald-400 border border-emerald-500/20 shadow-sm' 
                : 'text-slate-400 hover:bg-emerald-900/20 hover:text-emerald-300'
              }`}
            >
              <Database size={18} strokeWidth={activeTab === 'backup' ? 2.5 : 2} />
              <span className={`text-sm tracking-tight ${activeTab === 'backup' ? 'font-bold' : 'font-medium'}`}>Sauvegarde</span>
            </button>
        </nav>

        <div className="p-4 border-t border-emerald-900/30">
          <div className="text-[10px] text-center opacity-30 uppercase font-black tracking-widest leading-loose mt-4 text-emerald-100">
            Ka'nine & Patounes<br/>© 2024 Management
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col min-w-0 overflow-hidden bg-slate-50 relative pb-20 md:pb-0">
        <header className="h-16 bg-white border-b border-slate-100 flex items-center justify-between px-4 md:px-8 no-print shrink-0 shadow-sm">
          <div className="flex items-center gap-2 md:hidden">
             <div className="p-2 bg-emerald-600 rounded-lg text-white">
                <PawPrint size={16} />
             </div>
             <span className="font-serif text-lg tracking-tight text-slate-900 lowercase italic">Kanine</span>
          </div>
          <h1 className="hidden md:block text-2xl font-serif text-slate-800 tracking-tight">
            {menuItems.find(i => i.id === activeTab)?.label || activeTab}
          </h1>
        </header>
        
        <div className="flex-1 overflow-y-auto p-4 md:p-8">
          {children}
        </div>

        {/* Bottom Nav - Mobile */}
        <nav className="md:hidden fixed bottom-0 left-0 right-0 bg-white border-t border-slate-200 flex justify-around p-2 no-print z-50">
           {menuItems.map((item) => (
             <button
               key={item.id}
               onClick={() => setActiveTab(item.id)}
               className={`flex flex-col items-center gap-1 p-2 rounded-xl transition-all ${
                 activeTab === item.id ? 'text-indigo-600 scale-110' : 'text-slate-400'
               }`}
             >
               <item.icon size={20} strokeWidth={activeTab === item.id ? 2.5 : 2} />
               <span className="text-[9px] font-black uppercase tracking-tighter">{item.short}</span>
             </button>
           ))}
        </nav>
      </main>
    </div>
  );
};

export default Layout;
