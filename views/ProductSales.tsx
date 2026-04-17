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
    <div className="flex flex-col lg:flex-row gap-8 h-[calc(100vh-8rem)]">
      {/* Liste des clients */}
      <div className="w-full lg:w-1/3 flex flex-col bg-white rounded-[3rem] border border-slate-100 shadow-sm overflow-hidden shrink-0">
        <div className="p-8 border-b border-slate-100 bg-slate-50/50">
          <h2 className="text-2xl font-black text-slate-800 uppercase tracking-tighter mb-6 flex items-center gap-3">
            <UsersIcon className="text-indigo-600" /> Clients
          </h2>
          <div className="relative">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={20} />
            <input
              type="text"
              placeholder="Rechercher un client..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-12 pr-4 py-4 bg-white border border-slate-200 rounded-2xl focus:ring-2 focus:ring-indigo-500 outline-none font-bold text-slate-700 shadow-sm transition-all"
            />
          </div>
        </div>
        
        <div className="flex-1 overflow-y-auto p-4 space-y-2">
          {filteredClients.map(client => (
            <button
              key={client.id}
              onClick={() => { setSelectedClient(client); setIsCreatingInvoice(false); }}
              className={`w-full text-left p-4 rounded-2xl transition-all flex items-center gap-4 ${
                selectedClient?.id === client.id 
                ? 'bg-indigo-600 text-white shadow-xl scale-[1.02]' 
                : 'hover:bg-slate-50 border border-transparent hover:border-slate-200'
              }`}
            >
              <div className={`w-12 h-12 rounded-xl flex items-center justify-center shrink-0 ${
                selectedClient?.id === client.id ? 'bg-white/20' : 'bg-indigo-50 text-indigo-600'
              }`}>
                {client.photoProfile ? (
                  <img src={client.photoProfile} alt={client.name} className="w-full h-full object-cover rounded-xl" />
                ) : (
                  <User size={20} />
                )}
              </div>
              <div className="min-w-0 flex-1">
                <h3 className="font-black uppercase truncate">{client.name}</h3>
                <p className={`text-xs font-bold truncate ${selectedClient?.id === client.id ? 'text-indigo-100' : 'text-slate-500'}`}>
                  {client.ownerName}
                </p>
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* Détails du client et facturation */}
      <div className="flex-1 bg-white rounded-[3rem] border border-slate-100 shadow-sm overflow-hidden flex flex-col">
        {selectedClient ? (
          <>
            <div className="p-8 border-b border-slate-100 bg-slate-50/50 flex justify-between items-center">
              <div>
                <h2 className="text-3xl font-black text-slate-800 uppercase tracking-tighter">{selectedClient.name}</h2>
                <p className="text-slate-500 font-bold">{selectedClient.ownerName}</p>
              </div>
              {!isCreatingInvoice && (
                <button 
                  onClick={() => setIsCreatingInvoice(true)}
                  className="px-6 py-3 bg-indigo-600 text-white rounded-xl font-bold hover:bg-indigo-700 transition-all flex items-center gap-2 shadow-lg shadow-indigo-200"
                >
                  <Plus size={20} /> Nouvelle Vente
                </button>
              )}
            </div>

            <div className="flex-1 overflow-y-auto p-8">
              {isCreatingInvoice ? (
                <div className="space-y-8">
                  <div className="flex justify-between items-center">
                    <h3 className="text-xl font-black text-slate-800 uppercase flex items-center gap-2">
                      <ShoppingBag className="text-indigo-600" /> Créer une vente
                    </h3>
                    <button onClick={() => setIsCreatingInvoice(false)} className="text-slate-400 hover:text-slate-600 font-bold text-sm">Annuler</button>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                    {/* Catalogue Produits */}
                    <div className="space-y-4">
                      <h4 className="text-xs font-black text-slate-400 uppercase tracking-widest">Catalogue</h4>
                      <div className="grid grid-cols-1 gap-3">
                        {availableProducts.map((p: any) => (
                          <button 
                            key={p.id}
                            onClick={() => handleAddProduct(p)}
                            className="flex justify-between items-center p-4 bg-slate-50 rounded-2xl hover:bg-indigo-50 hover:text-indigo-700 transition-all border border-slate-100 hover:border-indigo-200 text-left"
                          >
                            <span className="font-bold">{p.name}</span>
                            <span className="font-black text-indigo-600">{p.price.toFixed(2)} €</span>
                          </button>
                        ))}
                        {availableProducts.length === 0 && (
                          <p className="text-sm text-slate-500 italic">Aucun produit configuré. Allez dans Configuration pour en ajouter.</p>
                        )}
                      </div>
                    </div>

                    {/* Panier */}
                    <div className="space-y-4">
                      <h4 className="text-xs font-black text-slate-400 uppercase tracking-widest">Panier</h4>
                      <div className="bg-slate-50 rounded-2xl p-4 border border-slate-100 min-h-[200px] flex flex-col">
                        {invoiceItems.length === 0 ? (
                          <div className="flex-1 flex items-center justify-center text-slate-400 text-sm font-medium italic">
                            Le panier est vide
                          </div>
                        ) : (
                          <div className="space-y-3 flex-1">
                            {invoiceItems.map(item => (
                              <div key={item.productId} className="flex justify-between items-center bg-white p-3 rounded-xl border border-slate-100 shadow-sm">
                                <div className="flex-1 min-w-0 pr-4">
                                  <p className="font-bold text-sm truncate">{item.name}</p>
                                  <p className="text-xs text-slate-500">{item.price.toFixed(2)} € / u</p>
                                </div>
                                <div className="flex items-center gap-3">
                                  <div className="flex items-center bg-slate-50 rounded-lg border border-slate-200">
                                    <button onClick={() => handleUpdateQuantity(item.productId, -1)} className="px-2 py-1 text-slate-600 hover:text-indigo-600 font-bold">-</button>
                                    <span className="px-2 text-sm font-black w-8 text-center">{item.quantity}</span>
                                    <button onClick={() => handleUpdateQuantity(item.productId, 1)} className="px-2 py-1 text-slate-600 hover:text-indigo-600 font-bold">+</button>
                                  </div>
                                  <button onClick={() => handleRemoveItem(item.productId)} className="text-red-400 hover:text-red-600 p-1"><Trash2 size={16} /></button>
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                        
                        <div className="mt-6 pt-4 border-t border-slate-200">
                          <div className="flex justify-between items-center mb-4">
                            <span className="font-black text-slate-500 uppercase">Total</span>
                            <span className="text-2xl font-black text-indigo-600">{totalAmount.toFixed(2)} €</span>
                          </div>
                          
                          <div className="space-y-4">
                            <select 
                              value={paymentMethod} 
                              onChange={(e) => setPaymentMethod(e.target.value as any)}
                              className="w-full p-3 bg-white border border-slate-200 rounded-xl font-bold text-slate-700 outline-none focus:ring-2 focus:ring-indigo-500"
                            >
                              <option value="Carte">Carte Bancaire</option>
                              <option value="Espèces">Espèces</option>
                              <option value="Chèque">Chèque</option>
                              <option value="Virement">Virement</option>
                            </select>
                            
                            <textarea 
                              placeholder="Notes (optionnel)"
                              value={invoiceNotes}
                              onChange={(e) => setInvoiceNotes(e.target.value)}
                              className="w-full p-3 bg-white border border-slate-200 rounded-xl font-medium text-sm outline-none focus:ring-2 focus:ring-indigo-500 resize-none h-20"
                            />
                            
                            <button 
                              onClick={handleSaveInvoice}
                              disabled={invoiceItems.length === 0}
                              className="w-full py-4 bg-emerald-500 text-white rounded-xl font-black uppercase tracking-widest hover:bg-emerald-600 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                              Valider la vente
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="space-y-6">
                  <h3 className="text-xl font-black text-slate-800 uppercase flex items-center gap-2">
                    <HistoryIcon className="text-indigo-600" /> Historique des achats
                  </h3>
                  {history.length === 0 ? (
                    <div className="text-center py-12 text-slate-400 font-medium italic">Aucun achat enregistré pour ce client.</div>
                  ) : (
                    <div className="grid grid-cols-1 gap-4">
                      {history.map(inv => (
                        <div key={inv.id} className="bg-slate-50 p-6 rounded-2xl border border-slate-100 flex flex-col md:flex-row md:items-center justify-between gap-4 cursor-pointer hover:bg-indigo-50 transition-colors" onClick={() => onPrintProductInvoice && onPrintProductInvoice(inv)}>
                          <div>
                            <div className="flex items-center gap-2 mb-1">
                              <h4 className="font-black text-slate-800 uppercase">{inv.number}</h4>
                              <span className="text-[10px] font-black bg-indigo-100 text-indigo-700 px-2 py-0.5 rounded uppercase">{inv.paymentMethod}</span>
                            </div>
                            <p className="text-xs text-slate-500 font-bold mb-2">Le {new Date(inv.date).toLocaleDateString()}</p>
                            <div className="text-sm text-slate-600">
                              {inv.items.map(item => (
                                <div key={item.productId}>• {item.quantity}x {item.name}</div>
                              ))}
                            </div>
                          </div>
                          <div className="text-xl font-black text-emerald-600">
                            {(inv.amount || 0).toFixed(2)} €
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
          <div className="flex-1 flex flex-col items-center justify-center text-slate-400 p-8 text-center">
            <ShoppingBag size={64} className="mb-4 opacity-20" />
            <p className="text-xl font-black uppercase tracking-widest text-slate-300">Sélectionnez un client</p>
            <p className="text-sm font-medium mt-2">pour gérer ses achats de produits</p>
          </div>
        )}
      </div>
    </div>
  );
};

// We need to import UsersIcon and HistoryIcon as they are used but not imported correctly
// Let's fix the imports in the file.
export default ProductSales;
