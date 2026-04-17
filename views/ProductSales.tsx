import React, { useState, useEffect } from 'react';
import { 
  Search, Plus, User, FileText, ShoppingBag, Trash2, Users as UsersIcon, History as HistoryIcon
} from 'lucide-react';
import { db } from '../services/database';
import { Client, Product, ProductInvoice, ProductInvoiceItem } from '../types';
import { ConfirmModal } from '../components/ConfirmModal';

const generateId = () => Math.random().toString(36).substring(2, 15) + Date.now().toString(36);

const ProductSales: React.FC<{ onPrintProductInvoice?: (inv: ProductInvoice) => void }> = ({ onPrintProductInvoice }) => {
  const [clients, setClients] = useState<Client[]>([]);
  const [search, setSearch] = useState('');
  const [selectedClient, setSelectedClient] = useState<Client | null>(null);
  const [history, setHistory] = useState<ProductInvoice[]>([]);
  const [isCreatingInvoice, setIsCreatingInvoice] = useState(false);
  const [config, setConfig] = useState<any>(null);
  
  // New Invoice State
  const [invoiceItems, setInvoiceItems] = useState<ProductInvoiceItem[]>([]);
  const [paymentMethod, setPaymentMethod] = useState<'Espèces' | 'Carte' | 'Chèque' | 'Virement'>('Carte');
  const [invoiceNotes, setInvoiceNotes] = useState('');

  const availableProducts = config?.products || [];

  useEffect(() => {
    const init = async () => {
      const [cls, cfg] = await Promise.all([
        db.getClients(),
        db.getConfig()
      ]);
      setClients(cls);
      setConfig(cfg);
    };
    init();
  }, []);

  useEffect(() => {
    if (selectedClient) {
      loadHistory(selectedClient.id);
    }
  }, [selectedClient]);

  const loadHistory = async (clientId: string) => {
    const allInvoices = await db.getProductInvoices();
    const filtered = allInvoices.filter(inv => inv.clientId === clientId);
    setHistory(filtered.sort((a, b) => b.date.localeCompare(a.date)));
  };

  const filteredClients = (clients || []).filter(c => 
    c.name.toLowerCase().includes(search.toLowerCase()) || 
    c.ownerName.toLowerCase().includes(search.toLowerCase())
  );

  const handleAddProduct = (product: Product) => {
    const existing = invoiceItems.find(i => i.productId === product.id);
    if (existing) {
      setInvoiceItems(invoiceItems.map(i => 
        i.productId === product.id ? { ...i, quantity: i.quantity + 1 } : i
      ));
    } else {
      setInvoiceItems([...invoiceItems, {
        productId: product.id,
        name: product.name,
        price: product.price,
        quantity: 1
      }]);
    }
  };

  const handleUpdateQuantity = (productId: string, delta: number) => {
    setInvoiceItems(invoiceItems.map(i => {
      if (i.productId === productId) {
        const newQ = i.quantity + delta;
        return newQ > 0 ? { ...i, quantity: newQ } : i;
      }
      return i;
    }));
  };

  const handleRemoveItem = (productId: string) => {
    setInvoiceItems(invoiceItems.filter(i => i.productId !== productId));
  };

  const totalAmount = invoiceItems.reduce((sum, item) => sum + (item.price * item.quantity), 0);

  const handleSaveInvoice = async () => {
    if (!selectedClient || invoiceItems.length === 0) return;

    const date = new Date().toISOString();
    const number = await db.getNextInvoiceNumber(date);

    const newInvoice: ProductInvoice = {
      id: generateId(),
      number,
      date,
      clientId: selectedClient.id,
      clientName: selectedClient.name,
      ownerName: selectedClient.ownerName,
      amount: totalAmount,
      paymentMethod,
      notes: invoiceNotes,
      items: invoiceItems
    };

    await db.saveProductInvoice(newInvoice);
    setIsCreatingInvoice(false);
    setInvoiceItems([]);
    setInvoiceNotes('');
    await loadHistory(selectedClient.id);
  };

  if (!config) return null;

  return (
    <div className="flex flex-col lg:flex-row gap-8 h-full min-h-0 max-w-[1600px] mx-auto overflow-hidden">
      {/* Sidebar de sélection client */}
      <div className={`w-full lg:w-[320px] bg-white rounded-2xl border border-slate-100 shadow-sm flex flex-col overflow-hidden ${selectedClient ? 'hidden lg:flex' : 'flex'}`}>
        <div className="p-6 border-b border-slate-50 space-y-5">
          <h2 className="font-serif text-xl text-slate-900 italic flex items-center gap-3">
            <ShoppingBag size={18} className="text-emerald-600" />
            Vente boutique
          </h2>
          <div className="relative">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-300" size={14} />
            <input 
              type="text" 
              placeholder="CLIENT..." 
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="w-full pl-10 pr-4 py-3 bg-slate-50 rounded-xl text-[10px] font-bold outline-none border border-transparent focus:border-emerald-100 focus:bg-white placeholder:text-slate-300 uppercase tracking-widest transition-all"
            />
          </div>
        </div>
        
        <div className="flex-1 overflow-y-auto p-4 space-y-2 custom-scrollbar">
          {filteredClients.map(client => (
            <button 
              key={client.id}
              onClick={() => setSelectedClient(client)}
              className={`w-full flex items-center gap-4 p-3 rounded-xl transition-all border ${selectedClient?.id === client.id ? 'bg-emerald-50 border-emerald-200 shadow-sm' : 'bg-white border-transparent hover:bg-slate-50'}`}
            >
              <div className="w-12 h-12 rounded-xl bg-slate-50 flex items-center justify-center shrink-0 border border-slate-100 overflow-hidden text-slate-300 shadow-inner">
                {client.photoProfile ? (
                  <img src={client.photoProfile} alt={client.name} className="w-full h-full object-cover" />
                ) : (
                  <User size={20} />
                )}
              </div>
              <div className="min-w-0 flex-1 text-left">
                <h3 className={`font-serif text-base leading-tight mb-0.5 ${selectedClient?.id === client.id ? 'text-emerald-900 italic' : 'text-slate-800'}`}>{client.name}</h3>
                <p className="text-[9px] font-bold truncate opacity-50 uppercase tracking-widest italic leading-none">
                  Prop. {client.ownerName}
                </p>
              </div>
            </button>
          ))}
          {filteredClients.length === 0 && (
            <div className="py-20 text-center">
              <p className="text-[10px] text-slate-300 font-bold uppercase tracking-widest italic">Aucun client</p>
            </div>
          )}
        </div>
      </div>

      {/* Main content area */}
      <div className={`flex-1 bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden flex flex-col ${!selectedClient ? 'hidden lg:flex' : 'flex'}`}>
        {selectedClient ? (
          <>
            <div className="p-8 md:p-10 border-b border-slate-50 bg-slate-50/20 flex flex-col md:flex-row justify-between items-center gap-6">
              <div className="flex items-center gap-6 w-full md:w-auto">
                <button onClick={() => setSelectedClient(null)} className="lg:hidden p-2 text-slate-400 hover:text-emerald-600 transition-colors">
                   <UsersIcon size={24} />
                </button>
                <div className="w-1.5 h-12 bg-emerald-600 rounded-full"></div>
                <div>
                  <h2 className="font-serif text-4xl md:text-5xl text-slate-900 italic leading-none mb-2">{selectedClient.name}</h2>
                  <p className="text-[11px] text-emerald-600 font-bold uppercase tracking-widest italic">Responsable • {selectedClient.ownerName}</p>
                </div>
              </div>
              {!isCreatingInvoice && (
                <button 
                  onClick={() => setIsCreatingInvoice(true)}
                  className="w-full md:w-auto px-10 py-4 bg-slate-900 text-white rounded-2xl font-bold text-xs uppercase tracking-widest hover:bg-emerald-700 transition-all flex items-center justify-center gap-3 shadow-2xl shadow-slate-200 active:scale-95"
                >
                  <Plus size={20} /> Nouvelle Transaction
                </button>
              )}
            </div>

            <div className="flex-1 overflow-y-auto p-8 md:p-12 scrollbar-thin">
              {isCreatingInvoice ? (
                <div className="h-full flex flex-col gap-12 animate-in fade-in slide-in-from-bottom-4 duration-500">
                  <div className="flex justify-between items-center bg-white p-6 rounded-3xl border border-slate-100 shadow-sm">
                    <h3 className="text-[11px] font-bold text-slate-400 uppercase tracking-widest flex items-center gap-4">
                      <ShoppingBag size={18} className="text-emerald-600" /> 
                      Établissement d'une vente boutique
                    </h3>
                    <button onClick={() => setIsCreatingInvoice(false)} className="px-5 py-2.5 text-[10px] font-bold text-slate-400 hover:text-red-500 uppercase tracking-widest border border-slate-100 hover:border-red-100 rounded-xl transition-all">ANNULER</button>
                  </div>

                  <div className="grid grid-cols-1 xl:grid-cols-5 gap-12 flex-1 min-h-0">
                    {/* Catalogue Produits */}
                    <div className="xl:col-span-3 flex flex-col gap-6">
                      <div className="flex items-baseline justify-between border-b border-slate-50 pb-3">
                        <h4 className="font-serif text-xl text-slate-800 italic">Articles du catalogue</h4>
                        <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">{availableProducts.length} ARTICLES</span>
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 overflow-y-auto pr-3 max-h-[600px] custom-scrollbar">
                        {availableProducts.map((p: any) => (
                          <button 
                            key={p.id}
                            onClick={() => handleAddProduct(p)}
                            className="flex flex-col justify-between p-6 bg-slate-50 rounded-2xl hover:bg-white border border-transparent hover:border-emerald-100 transition-all text-left group shadow-sm hover:shadow-xl hover:-translate-y-1"
                          >
                            <span className="font-serif text-lg text-slate-800 italic mb-4 group-hover:text-emerald-900 transition-colors">{p.name}</span>
                            <div className="flex justify-between items-end border-t border-slate-100 pt-4">
                              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest italic opacity-60">Stock: {p.stock || 0}</span>
                              <span className="font-bold text-emerald-600 text-lg tabular-nums">{p.price.toFixed(2)}€</span>
                            </div>
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Panier */}
                    <div className="xl:col-span-2 flex flex-col gap-6">
                      <div className="flex items-baseline justify-between border-b border-emerald-50 pb-3">
                        <h4 className="font-serif text-xl text-emerald-600 italic">Panier client</h4>
                        <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">{invoiceItems.length} SÉLECTION(S)</span>
                      </div>
                      <div className="bg-emerald-50/20 rounded-[2rem] p-8 border border-emerald-100/50 min-h-[500px] flex flex-col shadow-inner">
                        {invoiceItems.length === 0 ? (
                          <div className="flex-1 flex flex-col items-center justify-center text-emerald-200/50 gap-6">
                            <ShoppingBag size={64} strokeWidth={1} />
                            <p className="font-serif text-xl italic text-center">Le panier est<br/>actuellement vide</p>
                          </div>
                        ) : (
                          <div className="space-y-4 flex-1 overflow-y-auto max-h-[400px] mb-8 pr-3 custom-scrollbar">
                            {invoiceItems.map(item => (
                              <div key={item.productId} className="flex justify-between items-center bg-white p-5 rounded-2xl border border-emerald-50 shadow-sm animate-in slide-in-from-right-3">
                                <div className="flex-1 min-w-0 pr-6">
                                  <p className="font-serif text-base text-slate-800 italic leading-tight mb-1">{item.name}</p>
                                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest opacity-60 tabular-nums">{item.price.toFixed(2)} € l'unité</p>
                                </div>
                                <div className="flex items-center gap-4">
                                  <div className="flex items-center bg-slate-50 rounded-xl border border-slate-100 overflow-hidden shadow-inner">
                                    <button onClick={() => handleUpdateQuantity(item.productId, -1)} className="px-3 py-2 text-slate-400 hover:text-red-500 font-bold transition-colors transition-all">-</button>
                                    <span className="px-3 text-xs font-bold min-w-[35px] text-center text-slate-800 tabular-nums">{item.quantity}</span>
                                    <button onClick={() => handleUpdateQuantity(item.productId, 1)} className="px-3 py-2 text-slate-400 hover:text-emerald-500 font-bold transition-colors transition-all">+</button>
                                  </div>
                                  <button onClick={() => handleRemoveItem(item.productId)} className="text-slate-200 hover:text-red-500 p-2 transition-all hover:scale-110 shadow-sm bg-white rounded-lg border border-slate-50"><Trash2 size={16} /></button>
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                        
                        <div className="mt-auto pt-8 border-t border-emerald-100/50">
                          <div className="flex justify-between items-end mb-10">
                            <div>
                               <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2 opacity-60">Total de la vente</p>
                               <p className="font-serif text-sm text-emerald-600 italic leading-none">Net à encaisser • TTC</p>
                            </div>
                            <span className="font-serif text-5xl text-slate-900 tabular-nums leading-none tracking-tighter">
                               {totalAmount.toFixed(2)}<span className="text-2xl ml-1 italic opacity-40">€</span>
                            </span>
                          </div>
                          
                          <div className="space-y-8">
                            <div className="space-y-4">
                               <p className="text-[9px] font-bold text-slate-400 uppercase tracking-[0.2em] text-center italic">Mode de règlement</p>
                               <div className="grid grid-cols-2 gap-3">
                                {['Carte', 'Espèces', 'Chèque', 'Virement'].map(m => (
                                  <button 
                                    key={m} 
                                    onClick={() => setPaymentMethod(m as any)}
                                    className={`py-4 rounded-xl text-[10px] font-bold uppercase tracking-widest border transition-all ${paymentMethod === m ? 'bg-emerald-600 text-white border-emerald-600 shadow-xl shadow-emerald-100' : 'bg-white text-slate-400 border-slate-100 hover:bg-white hover:border-emerald-100 hover:text-emerald-600'}`}
                                  >
                                    {m}
                                  </button>
                                ))}
                               </div>
                            </div>
                            
                            <button 
                              onClick={handleSaveInvoice}
                              disabled={invoiceItems.length === 0}
                              className="w-full py-6 bg-slate-900 text-white rounded-2xl font-bold text-xs uppercase tracking-[0.3em] shadow-2xl hover:bg-emerald-800 transition-all active:scale-[0.98] disabled:opacity-30 disabled:grayscale disabled:cursor-not-allowed"
                            >
                              Finaliser la transaction
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="space-y-12 animate-in fade-in slide-in-from-bottom-2 duration-500">
                  <div className="flex items-center gap-4 border-b border-slate-50 pb-4">
                    <HistoryIcon size={20} className="text-emerald-600" /> 
                    <h3 className="font-serif text-xl text-slate-400 italic">Historique des acquisitions</h3>
                  </div>

                  {history.length === 0 ? (
                    <div className="py-40 text-center bg-slate-50/20 rounded-[3rem] border-2 border-dashed border-slate-100 flex flex-col items-center justify-center">
                       <HistoryIcon size={64} className="text-slate-100 mb-6" />
                       <p className="font-serif text-xl italic text-slate-300">Aucune transaction archivée pour ce client</p>
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 2xl:grid-cols-3 gap-8">
                      {history.map(inv => (
                        <div key={inv.id} className="bg-slate-50 p-8 rounded-[2rem] border border-slate-100 flex flex-col gap-6 cursor-pointer hover:bg-white hover:border-emerald-100 transition-all group relative overflow-hidden active:scale-[0.99] shadow-sm hover:shadow-xl" onClick={() => onPrintProductInvoice && onPrintProductInvoice(inv)}>
                          <div className="absolute top-0 right-0 p-6 opacity-0 group-hover:opacity-10 transition-opacity">
                             <FileText size={80} className="text-emerald-900" />
                          </div>
                          <div className="flex justify-between items-start z-10">
                            <div>
                               <div className="flex items-center gap-3 mb-2">
                                 <h4 className="font-serif text-lg text-slate-900 italic">{inv.number}</h4>
                                 <span className="text-[9px] font-bold bg-emerald-50 text-emerald-600 border border-emerald-100 px-3 py-1 rounded-full uppercase tracking-wider">{inv.paymentMethod}</span>
                               </div>
                               <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest opacity-60 italic">{new Date(inv.date).toLocaleDateString('fr-FR', { day: '2-digit', month: 'long', year: 'numeric' })}</p>
                            </div>
                            <div className="font-serif text-2xl text-emerald-600 italic tabular-nums leading-none">
                              {(inv.amount || 0).toFixed(2)}€
                            </div>
                          </div>
                          <div className="space-y-2 z-10 border-t border-slate-100 pt-5">
                            {inv.items.map((item, idx) => (
                              <div key={item.productId} className="flex justify-between items-center text-[10px] font-bold uppercase tracking-wider text-slate-500">
                                <span className="truncate pr-6 italic group-hover:text-slate-800 transition-colors">{item.name}</span>
                                <span className="shrink-0 opacity-40 group-hover:opacity-100 transition-opacity whitespace-nowrap">x {item.quantity}</span>
                              </div>
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          </>
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center text-slate-100 p-12 text-center bg-slate-50/10">
            <ShoppingBag size={100} className="mb-8 opacity-10 rotate-6" />
            <h3 className="font-serif text-3xl italic text-slate-300 opacity-40">Sélectionnez un porteur</h3>
            <p className="text-[11px] font-bold mt-6 uppercase tracking-[0.4em] opacity-30">EN ATTENTE DE SÉLECTION DANS LA LISTE</p>
          </div>
        )}
      </div>
    </div>
  );
};

// We need to import UsersIcon and HistoryIcon as they are used but not imported correctly
// Let's fix the imports in the file.
export default ProductSales;
