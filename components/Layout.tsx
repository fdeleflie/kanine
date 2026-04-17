
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
      <aside className="hidden md:flex w-64 bg-slate-900 text-slate-300 flex-col no-print shrink-0">
        <div className="p-8 flex items-center gap-4 border-b border-slate-800">
          <div className="p-3 bg-indigo-600 rounded-2xl text-white shadow-xl shadow-indigo-900/40">
            <PawPrint size={28} />
          </div>
          <span className="font-black text-2xl tracking-tighter text-white uppercase italic">Ka'nine</span>
        </div>
        
        <nav className="flex-1 p-4 space-y-2 overflow-y-auto">
          {menuItems.map((item) => (
            <button
              key={item.id}
              onClick={() => setActiveTab(item.id)}
              className={`w-full flex items-center gap-4 px-6 py-4 rounded-2xl transition-all ${
                activeTab === item.id 
                ? 'bg-indigo-600 text-white shadow-2xl scale-[1.02]' 
                : 'hover:bg-slate-800 hover:text-white'
              }`}
            >
              <item.icon size={20} />
              <span className="font-bold text-sm tracking-tight">{item.label}</span>
            </button>
          ))}
          <button
              onClick={() => setActiveTab('audit')}
              className={`w-full flex items-center gap-4 px-6 py-4 rounded-2xl transition-all ${
                activeTab === 'audit' ? 'bg-indigo-600 text-white shadow-2xl scale-[1.02]' : 'hover:bg-slate-800 hover:text-white'
              }`}
            >
              <History size={20} />
              <span className="font-bold text-sm tracking-tight">Historique</span>
            </button>
          <button
              onClick={() => setActiveTab('backup')}
              className={`w-full flex items-center gap-4 px-6 py-4 rounded-2xl transition-all ${
                activeTab === 'backup' ? 'bg-indigo-600 text-white shadow-2xl scale-[1.02]' : 'hover:bg-slate-800 hover:text-white'
              }`}
            >
              <Database size={20} />
              <span className="font-bold text-sm tracking-tight">Sauvegarde</span>
            </button>
        </nav>

        <div className="p-4 border-t border-slate-800">
          <div className="text-[10px] text-center opacity-30 uppercase font-black tracking-widest leading-loose mt-4">
            Ka'nine & Patounes<br/>© 2024 Management
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col min-w-0 overflow-hidden bg-slate-50 relative pb-20 md:pb-0">
        <header className="h-16 bg-white border-b border-slate-200 flex items-center justify-between px-4 md:px-10 no-print shrink-0">
          <div className="flex items-center gap-3 md:hidden">
             <div className="p-2 bg-indigo-600 rounded-lg text-white">
                <PawPrint size={18} />
             </div>
             <span className="font-black text-lg tracking-tighter text-slate-900 lowercase italic">Kanine</span>
          </div>
          <h1 className="hidden md:block text-sm font-black text-slate-900 uppercase tracking-[0.2em] italic">
            {activeTab}
          </h1>
          <span className="text-[10px] font-black text-indigo-600 bg-indigo-50 px-3 md:px-5 py-2 rounded-full uppercase tracking-tighter border border-indigo-100 whitespace-nowrap">Mode Pro</span>
        </header>
        
        <div className="flex-1 overflow-y-auto p-4 md:p-10">
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
