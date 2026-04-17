
import React, { useState, useRef, useEffect } from 'react';
import Layout from './components/Layout';
import Dashboard from './views/Dashboard';
import ClientList from './views/ClientList';
import Planning from './views/Planning';
import ProductSales from './views/ProductSales';
import InvoicePDF from './components/InvoicePDF';
import ProductInvoicePDF from './components/ProductInvoicePDF';
import { db } from './services/database';
import { 
  Trash2, Printer, Download, Upload, FileText, 
  Database, History as HistoryIcon,
  AlertCircle, Save, Camera, ImageIcon, X,
  Terminal, CheckCircle2, ShieldCheck, Search, Clock, FolderOpen, Settings
} from 'lucide-react';
import { Invoice, ProductInvoice, AutoBackupConfig, BackupType, BackupSchedule } from './types';
import { createRoot } from 'react-dom/client';
import { ConfirmModal } from './components/ConfirmModal';
import { AlertModal } from './components/AlertModal';
import { auth, signInWithPopup, signOut, googleProvider, User, onAuthStateChanged } from './firebase';
import { LogIn, LogOut, Cloud, CloudOff, RefreshCw } from 'lucide-react';

const App: React.FC = () => {
  const [activeTab, setActiveTab] = useState('dashboard');
  const [selectedClientId, setSelectedClientId] = useState<string | null>(null);
  const [config, setConfig] = useState(db.getConfig());
  const [importLogs, setImportLogs] = useState<string[]>([]);
  const [isImporting, setIsImporting] = useState(false);
  
  // Invoice Filters
  const [invoiceFilterYear, setInvoiceFilterYear] = useState<number>(new Date().getFullYear());
  const [invoiceFilterMonth, setInvoiceFilterMonth] = useState<number | 'all'>('all');
  const [invoiceType, setInvoiceType] = useState<'grooming' | 'products'>('grooming');
  const [searchQuery, setSearchQuery] = useState('');

  const [confirmState, setConfirmState] = useState<{isOpen: boolean, title: string, message: string, onConfirm: () => void}>({
    isOpen: false,
    title: '',
    message: '',
    onConfirm: () => {}
  });

  const [alertState, setAlertState] = useState<{isOpen: boolean, title: string, message: React.ReactNode}>({
    isOpen: false,
    title: '',
    message: ''
  });

  const [user, setUser] = useState<User | null>(null);
  const [isMigrating, setIsMigrating] = useState(false);
  const [migrationMsg, setMigrationMsg] = useState('');

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (u) => {
      setUser(u);
    });
    return () => unsubscribe();
  }, []);

  const handleSignIn = async () => {
    try {
      await signInWithPopup(auth, googleProvider);
    } catch (e) {
      console.error("Login failed:", e);
    }
  };

  const handleSignOut = async () => {
    await signOut(auth);
  };

  const handleMigration = async () => {
    setIsMigrating(true);
    const success = await db.migrateToFirebase((msg) => setMigrationMsg(msg));
    setIsMigrating(false);
    if (success) {
      setAlertState({
        isOpen: true,
        title: "Migration Réussie",
        message: "Vos données sont maintenant synchronisées sur Firebase !"
      });
    }
  };

  const [autoBackupConfig, setAutoBackupConfig] = useState<AutoBackupConfig>(() => {
    const existing = config.autoBackup;
    
    const defaultSchedules = {
      full: { enabled: false, frequency: 168 },
      partial: { enabled: existing?.enabled || false, frequency: (existing as any)?.frequency || 4 },
      photos: { enabled: false, frequency: 24 }
    };

    if (existing && (existing as any).schedules) {
      return {
        ...existing,
        schedules: {
          ...defaultSchedules,
          ...(existing as any).schedules
        }
      };
    }
    
    // Migration or default
    return {
      enabled: existing?.enabled || false,
      schedules: defaultSchedules
    };
  });
  const [hasAutoBackupDir, setHasAutoBackupDir] = useState(false);
  const [autoBackupPermission, setAutoBackupPermission] = useState<'granted' | 'prompt' | 'denied' | null>(null);

  useEffect(() => {
    db.getAutoBackupDirectory().then(async handle => {
      setHasAutoBackupDir(!!handle);
      if (handle && typeof handle.queryPermission === 'function') {
        try {
          const perm = await handle.queryPermission({ mode: 'readwrite' });
          setAutoBackupPermission(perm);
        } catch (e) {
          console.error("Error querying permission:", e);
        }
      } else if (handle) {
        // Handle is invalid
        setHasAutoBackupDir(false);
      }
    });

    // Check for auto-backup every 5 minutes
    const interval = setInterval(() => {
      db.performAutoBackupIfDue();
    }, 5 * 60 * 1000);

    // Also check on startup
    db.performAutoBackupIfDue();

    return () => clearInterval(interval);
  }, []);

  const handleAutoBackupSetup = async (action: 'request' | 'pick') => {
    if (typeof (window as any).showDirectoryPicker === 'function') {
      try {
        if (action === 'request') {
          const handle = await db.getAutoBackupDirectory();
          if (handle && typeof handle.requestPermission === 'function') {
            const perm = await handle.requestPermission({ mode: 'readwrite' });
            setAutoBackupPermission(perm);
            if (perm === 'granted') {
              setAlertState({ isOpen: true, title: "Succès", message: "Permission accordée avec succès !" });
            } else {
              setAlertState({ isOpen: true, title: "Erreur", message: "Permission refusée." });
            }
          } else {
            setAlertState({ isOpen: true, title: "Erreur", message: "Impossible de récupérer le dossier. Veuillez le choisir à nouveau." });
            setHasAutoBackupDir(false);
          }
        } else {
          const handle = await (window as any).showDirectoryPicker({ mode: 'readwrite' });
          await db.setAutoBackupDirectory(handle);
          setHasAutoBackupDir(true);
          setAutoBackupPermission('granted');
          setAlertState({ isOpen: true, title: "Succès", message: "Dossier de sauvegarde automatique configuré avec succès !" });
        }
      } catch (err: any) {
        console.error("Directory picker error:", err);
        const isSecurityError = err?.name === 'SecurityError' || 
                                err?.message?.toLowerCase().includes('cross-origin') || 
                                err?.message?.toLowerCase().includes('iframe') ||
                                err?.message?.toLowerCase().includes('sub frames');

        if (isSecurityError) {
          setAlertState({ 
            isOpen: true, 
            title: "Action bloquée par le navigateur", 
            message: (
              <div className="space-y-3">
                <p>Pour des raisons de sécurité, la sélection de dossier est bloquée quand l'application est affichée dans cet aperçu.</p>
                <p className="font-black text-indigo-600">Solution : Cliquez sur le bouton "Open in new tab" (en haut à droite) pour ouvrir l'application normalement, puis réessayez.</p>
              </div>
            )
          });
        } else if (err?.name !== 'AbortError') {
          setAlertState({ isOpen: true, title: "Erreur", message: "Erreur lors de la sélection du dossier : " + (err?.message || "Erreur inconnue") });
        }
      }
    } else {
      setAlertState({ isOpen: true, title: "Non supporté", message: "Votre navigateur ne supporte pas la sélection de dossier pour la sauvegarde automatique." });
    }
  };

  const updateAutoBackup = (updates: Partial<AutoBackupConfig>) => {
    const newConfig = { ...autoBackupConfig, ...updates };
    setAutoBackupConfig(newConfig);
    const fullConfig = { ...config, autoBackup: newConfig };
    setConfig(fullConfig);
    db.saveConfig(fullConfig);
  };

  const updateSchedule = (type: BackupType, updates: Partial<BackupSchedule>) => {
    const newSchedules = {
      ...(autoBackupConfig.schedules || {}),
      [type]: { ...(autoBackupConfig.schedules?.[type] || { enabled: false, frequency: 24 }), ...updates }
    };
    updateAutoBackup({ schedules: newSchedules as any });
  };
  
  const fileInputRef = useRef<HTMLInputElement>(null);
  const logoInputRef = useRef<HTMLInputElement>(null);

  const handlePrint = (invoice: Invoice) => {
    const clients = db.getClients();
    const client = clients.find(c => c.id === invoice.clientId);
    const printWindow = window.open('', '_blank', 'width=900,height=1200');
    if (!printWindow) return;
    printWindow.document.write(`
      <html><head><title>Facture ${invoice.number}</title><script src="https://cdn.tailwindcss.com"></script></head>
      <body><div id="root"></div></body></html>
    `);
    setTimeout(() => {
      const container = printWindow.document.getElementById('root');
      if (container) {
        const root = createRoot(container);
        root.render(<InvoicePDF invoice={invoice} client={client} />);
        setTimeout(() => printWindow.print(), 800);
      }
    }, 100);
  };

  const handlePrintProductInvoice = (invoice: ProductInvoice) => {
    const clients = db.getClients();
    const client = clients.find(c => c.id === invoice.clientId);
    const printWindow = window.open('', '_blank', 'width=900,height=1200');
    if (!printWindow) return;
    printWindow.document.write(`
      <html><head><title>Facture ${invoice.number}</title><script src="https://cdn.tailwindcss.com"></script></head>
      <body><div id="root"></div></body></html>
    `);
    setTimeout(() => {
      const container = printWindow.document.getElementById('root');
      if (container) {
        const root = createRoot(container);
        root.render(<ProductInvoicePDF invoice={invoice} client={client} />);
        setTimeout(() => printWindow.print(), 800);
      }
    }, 100);
  };

  const handleFileExport = async (type: BackupType) => {
    try {
      const json = await db.exportAsJSON({ 
        excludePhotos: type === 'partial',
        photosOnly: type === 'photos'
      });
      const blob = new Blob([json], { type: 'application/json' });
      const filename = `kanine_sauvegarde_${type}_${new Date().toISOString().split('T')[0]}.json`;

      if ('showSaveFilePicker' in window) {
        try {
          const handle = await (window as any).showSaveFilePicker({
            suggestedName: filename,
            types: [{
              description: 'Fichier JSON',
              accept: { 'application/json': ['.json'] },
            }],
          });
          const writable = await handle.createWritable();
          await writable.write(blob);
          await writable.close();
          return;
        } catch (err: any) {
          if (err.name === 'AbortError') return;
          console.warn('showSaveFilePicker failed, falling back to traditional download', err);
        }
      }

      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = filename;
      
      document.body.appendChild(link);
      link.click();
      
      setTimeout(() => {
        document.body.removeChild(link);
        window.URL.revokeObjectURL(url);
      }, 1000);
    } catch (e) {
      setAlertState({ isOpen: true, title: "Erreur", message: "Erreur lors de la génération du fichier : " + e });
    }
  };

  const handleExportAll = async () => {
    const types: BackupType[] = ['full', 'partial', 'photos'];
    for (const type of types) {
      await handleFileExport(type);
      // Small delay to avoid browser blocking multiple downloads
      await new Promise(resolve => setTimeout(resolve, 500));
    }
  };

  const handleFileImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsImporting(true);
    setImportLogs([`[INFO] Début lecture : ${file.name} (${(file.size / 1024 / 1024).toFixed(2)} Mo)`]);

    const reader = new FileReader();
    reader.onload = async (event) => {
      const content = event.target?.result as string;
      const result = await db.importFullData(content);
      setImportLogs(result.logs);
      if (result.success) {
        // Alerte de succès avant rechargement
        setTimeout(() => {
          setAlertState({ isOpen: true, title: "Succès", message: "Importation réussie. L'application va redémarrer." });
          setTimeout(() => window.location.reload(), 2000);
        }, 1500);
      }
      setIsImporting(false);
    };
    reader.onerror = () => {
      setImportLogs(prev => [...prev, "ERREUR CRITIQUE : Impossible de lire physiquement le fichier."]);
      setIsImporting(false);
    };
    reader.readAsText(file);
  };

  const handleLogoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onloadend = () => {
      const base64 = reader.result as string;
      const newConfig = { ...config, logo: base64 };
      db.saveConfig(newConfig);
      setConfig(newConfig);
      setAlertState({ isOpen: true, title: "Succès", message: "Logo mis à jour." });
    };
    reader.readAsDataURL(file);
  };

  const renderInvoicesList = () => {
    const groomingInvoices = db.getInvoices();
    const productInvoices = db.getProductInvoices();
    
    const invoices = invoiceType === 'grooming' ? groomingInvoices : productInvoices;
    const years = Array.from(new Set(invoices.map(inv => new Date(inv.date).getFullYear()))).sort((a, b) => b - a);
    
    const filteredInvoices = invoices.filter(inv => {
      const d = new Date(inv.date);
      if (d.getFullYear() !== invoiceFilterYear) return false;
      if (invoiceFilterMonth !== 'all' && d.getMonth() !== invoiceFilterMonth) return false;
      
      const searchLower = searchQuery.toLowerCase();
      const petName = ('petName' in inv ? inv.petName : '') || '';
      const clientName = ('clientName' in inv ? inv.clientName : '') || '';
      const ownerName = inv.ownerName || '';
      const matchesSearch = (inv.number || '').toLowerCase().includes(searchLower) || 
                            ownerName.toLowerCase().includes(searchLower) || 
                            petName.toLowerCase().includes(searchLower) ||
                            clientName.toLowerCase().includes(searchLower);
      return matchesSearch;
    }).reverse();

    return (
    <div className="max-w-6xl mx-auto space-y-6 pb-10">
      <div className="flex flex-col md:flex-row items-center justify-between mb-8 bg-white p-8 rounded-[2rem] border border-slate-100 shadow-sm gap-4">
        <h2 className="text-2xl font-black text-slate-800 uppercase flex items-center gap-3">
          <FileText className="text-indigo-600" /> Historique Facturation
        </h2>
        
        <div className="flex flex-wrap items-center gap-4">
          <div className="relative">
             <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300" size={18} />
             <input 
               type="text" 
               placeholder="Rechercher..." 
               className="pl-12 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl font-bold text-sm text-slate-700 outline-none focus:ring-2 focus:ring-indigo-500"
               value={searchQuery}
               onChange={(e) => setSearchQuery(e.target.value)}
             />
          </div>
          <div className="flex bg-slate-100 p-1 rounded-xl">
            <button 
              onClick={() => setInvoiceType('grooming')}
              className={`px-4 py-2 rounded-lg font-bold text-sm transition-all ${invoiceType === 'grooming' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
            >
              Toilettage
            </button>
            <button 
              onClick={() => setInvoiceType('products')}
              className={`px-4 py-2 rounded-lg font-bold text-sm transition-all ${invoiceType === 'products' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
            >
              Produits
            </button>
          </div>

          <select 
            value={invoiceFilterYear} 
            onChange={(e) => setInvoiceFilterYear(parseInt(e.target.value))}
            className="px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl font-bold text-slate-700 outline-none focus:ring-2 focus:ring-indigo-500"
          >
            {years.map(y => <option key={y} value={y}>{y}</option>)}
            {!years.includes(new Date().getFullYear()) && <option value={new Date().getFullYear()}>{new Date().getFullYear()}</option>}
          </select>

          <select 
            value={invoiceFilterMonth} 
            onChange={(e) => setInvoiceFilterMonth(e.target.value === 'all' ? 'all' : parseInt(e.target.value))}
            className="px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl font-bold text-slate-700 outline-none focus:ring-2 focus:ring-indigo-500"
          >
            <option value="all">Toute l'année</option>
            {['Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin', 'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre'].map((m, i) => (
              <option key={i} value={i}>{m}</option>
            ))}
          </select>

          <span className="bg-indigo-50 text-indigo-600 px-5 py-2 rounded-full text-[10px] font-black uppercase tracking-widest">
            {filteredInvoices.length} Documents
          </span>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4">
        {filteredInvoices.length === 0 ? (
          <div className="text-center py-20 text-slate-400 font-medium italic">Aucune facture pour cette période.</div>
        ) : (
          filteredInvoices.map(inv => (
          <div key={inv.id} className="bg-white p-6 rounded-[2rem] border border-slate-100 shadow-sm hover:shadow-xl transition-all flex flex-col md:flex-row md:items-center justify-between gap-6 group cursor-pointer" onClick={() => invoiceType === 'grooming' ? handlePrint(inv as Invoice) : handlePrintProductInvoice(inv as any)}>
            <div className="flex items-center gap-6">
              <div className="w-14 h-14 bg-slate-50 rounded-2xl flex items-center justify-center text-slate-400 group-hover:bg-indigo-50 group-hover:text-indigo-600 transition-colors">
                <FileText size={24} />
              </div>
              <div>
                <div className="flex items-center gap-2 mb-1">
                   <h3 className="font-black text-slate-900 uppercase tracking-tighter">{inv.number}</h3>
                   <span className="text-[9px] font-black bg-emerald-50 text-emerald-600 px-2 py-0.5 rounded uppercase">{inv.paymentMethod}</span>
                </div>
                <p className="text-xs text-slate-500 font-bold">Le {new Date(inv.date).toLocaleDateString('fr-FR', { day: '2-digit', month: 'long', year: 'numeric' })} • <span className="text-indigo-600 uppercase italic font-black">{'petName' in inv ? inv.petName : inv.clientName}</span></p>
              </div>
            </div>
            
            <div className="flex items-center justify-between md:justify-end gap-10 border-t md:border-t-0 pt-4 md:pt-0">
               <div className="text-right">
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Montant TTC</p>
                  <p className="text-2xl font-black text-slate-900">{(inv.amount || 0).toFixed(2)}€</p>
               </div>
               <div className="flex gap-2">
                  <button onClick={(e) => { e.stopPropagation(); invoiceType === 'grooming' ? handlePrint(inv as Invoice) : handlePrintProductInvoice(inv as any); }} className="p-4 bg-indigo-600 text-white rounded-2xl hover:bg-indigo-700 shadow-lg shadow-indigo-100 transition-all active:scale-90" title="Imprimer / Télécharger (PDF)">
                    <Printer size={20} />
                  </button>
                  <button onClick={(e) => { 
                    e.stopPropagation();
                    setConfirmState({
                      isOpen: true,
                      title: "Supprimer la facture",
                      message: "Voulez-vous vraiment supprimer cette facture ?",
                      onConfirm: () => {
                        if (invoiceType === 'grooming') {
                          db.deleteInvoice(inv.id);
                        } else {
                          db.deleteProductInvoice(inv.id);
                        }
                        window.location.reload();
                      }
                    });
                  }} className="p-4 text-red-400 hover:bg-red-50 rounded-2xl transition-all" title="Supprimer">
                    <Trash2 size={20} />
                  </button>
               </div>
            </div>
          </div>
        )))}
      </div>
    </div>
  );
  };

  return (
    <Layout activeTab={activeTab} setActiveTab={(t) => { setSelectedClientId(null); setActiveTab(t); }}>
      <AlertModal 
        isOpen={alertState.isOpen} 
        title={alertState.title} 
        message={alertState.message} 
        onClose={() => setAlertState(prev => ({ ...prev, isOpen: false }))} 
      />
      {activeTab === 'dashboard' && <Dashboard user={user} onNavigateToClient={(id) => { setSelectedClientId(id); setActiveTab('clients'); }} onNavigateToTab={(tab) => setActiveTab(tab)} />}
      {activeTab === 'clients' && <ClientList user={user} initialClientId={selectedClientId} onPrintInvoice={handlePrint} onPrintProductInvoice={handlePrintProductInvoice} />}
      {activeTab === 'planning' && <Planning user={user} onPrintInvoice={handlePrint} />}
      {activeTab === 'products' && <ProductSales onPrintProductInvoice={handlePrintProductInvoice} />}
      {activeTab === 'invoices' && renderInvoicesList()}
      {activeTab === 'audit' && (
        <div className="max-w-4xl mx-auto bg-white p-10 rounded-[3rem] border border-slate-100 shadow-sm">
           <h2 className="text-2xl font-black mb-10 text-slate-800 uppercase flex items-center gap-3">
             <HistoryIcon className="text-indigo-600" /> Journal Activité
           </h2>
           <div className="space-y-4">
              {db.getAuditLog().map((entry: any) => (
                <div key={entry.id} className="flex gap-6 p-5 bg-slate-50/50 rounded-3xl border border-slate-100">
                   <div className="w-24 shrink-0 border-r border-slate-200">
                      <p className="text-[10px] font-black text-slate-400 uppercase">{new Date(entry.timestamp).toLocaleDateString()}</p>
                      <p className="text-xs font-bold text-slate-600">{new Date(entry.timestamp).toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'})}</p>
                   </div>
                   <div className="flex-1">
                      <span className="text-[9px] font-black text-indigo-600 bg-indigo-50 px-2 py-1 rounded uppercase mb-2 inline-block tracking-widest">{entry.action}</span>
                      <p className="text-sm font-bold text-slate-800">{entry.details}</p>
                   </div>
                   <div className="flex gap-2 self-start">
                    {entry.undoData && (
                      <button 
                        onClick={() => {
                          setConfirmState({
                            isOpen: true,
                            title: "Restaurer l'action",
                            message: "Voulez-vous vraiment restaurer cette action ?",
                            onConfirm: () => {
                              const success = db.undoAction(entry.id);
                              if (success === false) {
                                setAlertState({ isOpen: true, title: "Erreur", message: "Impossible de restaurer cette action (données de restauration manquantes pour les anciennes actions)." });
                              } else {
                                window.location.reload();
                              }
                            }
                          });
                        }}
                        className="px-4 py-2 bg-amber-100 text-amber-700 rounded-xl text-xs font-bold hover:bg-amber-200 transition-all"
                      >
                        Restaurer
                      </button>
                    )}
                    <button 
                      onClick={() => {
                        setConfirmState({
                          isOpen: true,
                          title: "Supprimer l'entrée",
                          message: "Voulez-vous vraiment supprimer cette entrée du journal ?",
                          onConfirm: () => {
                            db.deleteAuditLogEntry(entry.id);
                            window.location.reload();
                          }
                        });
                      }}
                      className="p-2 text-red-400 hover:bg-red-50 rounded-xl transition-all"
                      title="Supprimer définitivement"
                    >
                      <Trash2 size={16} />
                    </button>
                   </div>
                </div>
              ))}
           </div>
        </div>
      )}
      {activeTab === 'config' && (
        <div className="space-y-10">
           <div className="bg-white p-10 rounded-[3rem] border border-slate-100 shadow-sm flex flex-col md:flex-row items-center gap-10">
              <div className="w-48 h-48 bg-slate-50 rounded-[2.5rem] border-4 border-white shadow-inner flex items-center justify-center overflow-hidden relative group">
                 {config.logo ? <img src={config.logo} className="w-full h-full object-contain p-4" /> : <ImageIcon size={60} className="text-slate-200" />}
                 <label className="absolute inset-0 bg-black/50 flex items-center justify-center opacity-0 group-hover:opacity-100 cursor-pointer transition-opacity">
                    <Camera className="text-white" />
                    <input type="file" ref={logoInputRef} onChange={handleLogoUpload} className="hidden" accept="image/*" />
                 </label>
              </div>
              <div className="flex-1 space-y-4">
                 <h3 className="text-2xl font-black text-slate-900 uppercase tracking-tighter">Logo de l'entreprise</h3>
                 <p className="text-sm text-slate-500 font-medium">Ce logo sera utilisé sur toutes vos factures PDF.</p>
                 <button onClick={() => logoInputRef.current?.click()} className="px-8 py-3 bg-indigo-600 text-white rounded-xl font-bold hover:bg-indigo-700 transition-all">Charger mon logo</button>
              </div>
           </div>

           <div className="bg-white p-10 rounded-[3rem] border border-slate-100 shadow-sm space-y-6">
              <h3 className="text-2xl font-black text-slate-900 uppercase tracking-tighter flex items-center gap-3">
                <FileText className="text-indigo-600" /> Informations de l'entreprise
              </h3>
              <p className="text-sm text-slate-500 font-medium mb-6">Ces informations apparaîtront sur vos factures.</p>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="block text-xs font-black text-slate-400 uppercase tracking-widest mb-2">Nom commercial</label>
                  <input type="text" value={config.companyName || ''} onChange={e => { const newConfig = {...config, companyName: e.target.value}; setConfig(newConfig); db.saveConfig(newConfig); }} className="w-full p-4 bg-slate-50 border border-slate-200 rounded-2xl focus:ring-2 focus:ring-indigo-500 outline-none transition-all" placeholder="Ex: Ka'nine" />
                </div>
                <div>
                  <label className="block text-xs font-black text-slate-400 uppercase tracking-widest mb-2">Nom et Prénom du dirigeant</label>
                  <input type="text" value={config.ownerName || ''} onChange={e => { const newConfig = {...config, ownerName: e.target.value}; setConfig(newConfig); db.saveConfig(newConfig); }} className="w-full p-4 bg-slate-50 border border-slate-200 rounded-2xl focus:ring-2 focus:ring-indigo-500 outline-none transition-all" placeholder="Ex: Karine DELEFLIE" />
                </div>
                <div>
                  <label className="block text-xs font-black text-slate-400 uppercase tracking-widest mb-2">Numéro SIRET / SIREN</label>
                  <input type="text" value={config.siret || ''} onChange={e => { const newConfig = {...config, siret: e.target.value}; setConfig(newConfig); db.saveConfig(newConfig); }} className="w-full p-4 bg-slate-50 border border-slate-200 rounded-2xl focus:ring-2 focus:ring-indigo-500 outline-none transition-all" placeholder="Ex: 123 456 789 00012" />
                </div>
                <div>
                  <label className="block text-xs font-black text-slate-400 uppercase tracking-widest mb-2">Adresse</label>
                  <input type="text" value={config.address || ''} onChange={e => { const newConfig = {...config, address: e.target.value}; setConfig(newConfig); db.saveConfig(newConfig); }} className="w-full p-4 bg-slate-50 border border-slate-200 rounded-2xl focus:ring-2 focus:ring-indigo-500 outline-none transition-all" placeholder="Adresse complète" />
                </div>
                <div>
                  <label className="block text-xs font-black text-slate-400 uppercase tracking-widest mb-2">Téléphone</label>
                  <input type="text" value={config.phone || ''} onChange={e => { const newConfig = {...config, phone: e.target.value}; setConfig(newConfig); db.saveConfig(newConfig); }} className="w-full p-4 bg-slate-50 border border-slate-200 rounded-2xl focus:ring-2 focus:ring-indigo-500 outline-none transition-all" placeholder="Ex: 06 12 34 56 78" />
                </div>
                <div>
                  <label className="block text-xs font-black text-slate-400 uppercase tracking-widest mb-2">Email</label>
                  <input type="text" value={config.email || ''} onChange={e => { const newConfig = {...config, email: e.target.value}; setConfig(newConfig); db.saveConfig(newConfig); }} className="w-full p-4 bg-slate-50 border border-slate-200 rounded-2xl focus:ring-2 focus:ring-indigo-500 outline-none transition-all" placeholder="Ex: contact@kanine.fr" />
                </div>
              </div>
           </div>

           <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8 mb-10">
              <EditableConfigSection title="Espèces" items={config.species} onUpdate={(items: string[]) => { db.updateConfigItems('species', items); setConfig(db.getConfig()); }} />
              <EditableBreedsSection breeds={config.breeds} species={config.species} onUpdate={(breeds: Record<string, string[]>) => { const newConfig = {...config, breeds}; db.saveConfig(newConfig); setConfig(newConfig); }} />
              <EditableConfigSection title="Types de Poil" items={config.coatTypes} onUpdate={(items: string[]) => { db.updateConfigItems('coatTypes', items); setConfig(db.getConfig()); }} />
              <EditableConfigSection title="Particularités" items={config.particularities} onUpdate={(items: string[]) => { db.updateConfigItems('particularities', items); setConfig(db.getConfig()); }} />
              <EditableConfigSection title="Prestations" items={config.services} onUpdate={(items: string[]) => { db.updateConfigItems('services', items); setConfig(db.getConfig()); }} />
              <EditableProductsSection products={config.products || []} onUpdate={(items: any[]) => { db.updateConfigItems('products', items); setConfig(db.getConfig()); }} />
           </div>
        </div>
      )}
      {activeTab === 'backup' && (
        <div className="max-w-5xl mx-auto space-y-8 pb-20">
          {/* Section Firebase Cloud Migration */}
          <div className="bg-gradient-to-br from-indigo-600 to-indigo-800 p-8 md:p-12 rounded-[3rem] text-white shadow-2xl relative overflow-hidden">
             <div className="absolute top-0 right-0 p-12 opacity-10 rotate-12">
               <Cloud size={200} />
             </div>
             
             <div className="relative z-10 flex flex-col items-center text-center">
                <div className={`p-4 bg-white/20 rounded-2xl mb-6 ${user ? 'text-emerald-300' : 'text-white'}`}>
                   {user ? <Cloud size={32} /> : <CloudOff size={32} />}
                </div>
                <h2 className="text-3xl font-black uppercase tracking-tighter mb-4 italic">Synchronisation Cloud (Firebase)</h2>
                <p className="text-indigo-100 max-w-xl mb-10 font-medium italic">
                   {user 
                    ? `Connecté en tant que ${user.email}. Vos données sont maintenant synchronisées sur tous vos appareils.`
                    : "Connectez-vous pour sauvegarder vos données en ligne et les retrouver sur tous vos appareils (Téléphone, Tablette, PC)."}
                </p>

                {!user ? (
                   <button onClick={handleSignIn} className="bg-white text-indigo-600 px-10 py-5 rounded-[2rem] font-black uppercase tracking-widest hover:scale-105 transition-all shadow-xl flex items-center gap-3">
                      <LogIn size={20} /> Se connecter avec Google
                   </button>
                ) : (
                   <div className="flex flex-col items-center gap-4 w-full max-w-md">
                      <div className="flex flex-wrap justify-center gap-4">
                        <button 
                          onClick={handleMigration} 
                          disabled={isMigrating}
                          className={`bg-emerald-500 text-white px-10 py-5 rounded-[2rem] font-black uppercase tracking-widest hover:scale-105 transition-all shadow-xl flex items-center gap-3 ${isMigrating ? 'opacity-50 cursor-not-allowed' : ''}`}
                        >
                           {isMigrating ? <RefreshCw className="animate-spin" size={20} /> : <RefreshCw size={20} />}
                           {isMigrating ? "Migration..." : "Migrer mes données"}
                        </button>
                        <button onClick={handleSignOut} className="bg-indigo-900/40 text-white border border-white/20 px-8 py-5 rounded-[2rem] font-black uppercase tracking-widest hover:bg-red-500/20 hover:border-red-500/50 transition-all flex items-center gap-3 text-xs">
                           <LogOut size={16} /> Déconnexion
                        </button>
                      </div>
                      {migrationMsg && <p className="text-xs font-mono bg-black/20 p-4 rounded-xl w-full text-indigo-200 mt-4">{migrationMsg}</p>}
                   </div>
                )}
             </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            <div className="bg-white p-10 rounded-[3rem] border border-slate-100 shadow-sm flex flex-col items-center text-center">
              <div className="w-20 h-20 bg-emerald-50 text-emerald-600 rounded-3xl flex items-center justify-center mb-6">
                <Download size={32} />
              </div>
              <h3 className="text-2xl font-black text-slate-800 uppercase tracking-tighter mb-2">Sauvegarder</h3>
              <p className="text-slate-500 mb-8 text-sm font-medium">Archivez vos données locales dans un fichier JSON sécurisé.</p>
              <div className="w-full space-y-3">
                <button onClick={handleExportAll} className="w-full py-4 bg-slate-800 text-white rounded-2xl font-black shadow-xl hover:bg-slate-900 transition-all flex items-center justify-center gap-3 mb-4">
                  <Save size={20} /> Tout Sauvegarder (3 fichiers)
                </button>
                <div className="h-px bg-slate-100 w-full my-4"></div>
                <button onClick={() => handleFileExport('full')} className="w-full py-4 bg-emerald-600 text-white rounded-2xl font-black shadow-xl hover:bg-emerald-700 transition-all flex items-center justify-center gap-3">
                  <Save size={20} /> Sauvegarde Complète
                </button>
                <button onClick={() => handleFileExport('partial')} className="w-full py-4 bg-white text-emerald-600 border-2 border-emerald-100 rounded-2xl font-black hover:bg-emerald-50 transition-all flex items-center justify-center gap-3">
                  <FileText size={20} /> Sauvegarde Partielle (Données)
                </button>
                <button onClick={() => handleFileExport('photos')} className="w-full py-4 bg-white text-blue-600 border-2 border-blue-100 rounded-2xl font-black hover:bg-blue-50 transition-all flex items-center justify-center gap-3">
                  <ImageIcon size={20} /> Sauvegarde Photos Uniquement
                </button>
              </div>
            </div>

            <div className="bg-white p-10 rounded-[3rem] border border-slate-100 shadow-sm flex flex-col space-y-6">
              <div className="flex items-center gap-4">
                <div className="p-4 bg-indigo-50 text-indigo-600 rounded-2xl"><Upload size={24} /></div>
                <h3 className="text-xl font-black text-slate-800 uppercase tracking-tighter">Restauration</h3>
              </div>
              <p className="text-slate-500 text-sm font-medium">Récupérez une base de données existante depuis un fichier .json.</p>
              <input type="file" ref={fileInputRef} onChange={handleFileImport} accept=".json" className="hidden" />
              <button 
                onClick={() => fileInputRef.current?.click()} 
                disabled={isImporting}
                className={`w-full py-5 rounded-2xl font-black flex items-center justify-center gap-3 border-2 border-dashed transition-all ${isImporting ? 'bg-slate-50 border-slate-200 text-slate-400 cursor-not-allowed' : 'bg-indigo-50 border-indigo-200 text-indigo-700 hover:bg-indigo-100'}`}
              >
                {isImporting ? "Chargement..." : "Importer un fichier"}
              </button>
            </div>
          </div>

          <div className="bg-white p-10 rounded-[3rem] border border-slate-100 shadow-sm space-y-8">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
              <div className="flex items-center gap-4">
                <div className="p-4 bg-blue-50 text-blue-600 rounded-2xl"><Clock size={24} /></div>
                <div>
                  <h3 className="text-xl font-black text-slate-800 uppercase tracking-tighter">Sauvegarde Automatique</h3>
                  <p className="text-slate-500 text-sm font-medium">Planifiez des sauvegardes régulières en arrière-plan.</p>
                </div>
              </div>
              
              <div className="flex items-center gap-4">
                <button
                  onClick={() => updateAutoBackup({ enabled: !autoBackupConfig.enabled })}
                  className={`py-3 px-6 rounded-xl font-black transition-all flex items-center justify-center gap-2 ${autoBackupConfig.enabled ? 'bg-emerald-50 text-emerald-600 border border-emerald-200' : 'bg-slate-50 text-slate-500 border border-slate-200'}`}
                >
                  {autoBackupConfig.enabled ? <><CheckCircle2 size={18} /> Service Actif</> : <><X size={18} /> Service Inactif</>}
                </button>

                <button
                  onClick={() => {
                    if (!autoBackupConfig.enabled) {
                      updateAutoBackup({ enabled: true });
                    }
                    const action = (hasAutoBackupDir && autoBackupPermission !== 'granted') ? 'request' : 'pick';
                    handleAutoBackupSetup(action);
                  }}
                  className={`py-3 px-6 rounded-xl font-black transition-all flex items-center justify-center gap-2 ${hasAutoBackupDir && autoBackupPermission === 'granted' ? 'bg-indigo-50 text-indigo-600 border border-indigo-200' : 'bg-amber-50 text-amber-600 border border-amber-200'}`}
                >
                  <FolderOpen size={18} />
                  {hasAutoBackupDir && autoBackupPermission === 'granted' ? "Dossier OK" : "Dossier ?"}
                </button>
              </div>
            </div>

            <div className="grid grid-cols-1 gap-6">
              {[
                { id: 'partial', label: 'Partielle (Sans Photos)', icon: <FileText size={18} />, desc: 'Données clients, rdv et factures uniquement.' },
                { id: 'full', label: 'Complète (Tout)', icon: <Save size={18} />, desc: 'L\'intégralité de votre base de données.' },
                { id: 'photos', label: 'Photos Uniquement', icon: <ImageIcon size={18} />, desc: 'Uniquement les fichiers images (profils et rdv).' }
              ].map((type) => {
                const schedule = autoBackupConfig.schedules?.[type.id as BackupType] || { enabled: false, frequency: 24 };
                return (
                  <div key={type.id} className={`p-6 rounded-3xl border transition-all ${schedule.enabled ? 'bg-white border-slate-200 shadow-sm' : 'bg-slate-50/50 border-slate-100 opacity-60'}`}>
                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                      <div className="flex items-center gap-4">
                        <div className={`p-3 rounded-2xl ${schedule.enabled ? 'bg-indigo-50 text-indigo-600' : 'bg-slate-200 text-slate-400'}`}>
                          {type.icon}
                        </div>
                        <div>
                          <h4 className="font-black text-slate-800 uppercase text-sm tracking-tight">{type.label}</h4>
                          <p className="text-xs text-slate-500 font-medium">{type.desc}</p>
                        </div>
                      </div>

                      <div className="flex items-center gap-4">
                        <div className="flex flex-col gap-1">
                          <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Fréquence</label>
                          <select
                            value={schedule.frequency}
                            onChange={(e) => updateSchedule(type.id as BackupType, { frequency: parseInt(e.target.value) })}
                            disabled={!autoBackupConfig.enabled}
                            className="p-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold outline-none"
                          >
                            <option value={4}>Toutes les 4h</option>
                            <option value={12}>Toutes les 12h</option>
                            <option value={24}>Tous les jours</option>
                            <option value={48}>Tous les 2 jours</option>
                            <option value={168}>Toutes les semaines</option>
                          </select>
                        </div>

                        <button
                          onClick={() => updateSchedule(type.id as BackupType, { enabled: !schedule.enabled })}
                          disabled={!autoBackupConfig.enabled}
                          className={`mt-4 px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${schedule.enabled ? 'bg-indigo-600 text-white' : 'bg-slate-200 text-slate-500'}`}
                        >
                          {schedule.enabled ? 'Activé' : 'Désactivé'}
                        </button>
                      </div>
                    </div>
                    {schedule.enabled && schedule.lastBackup && (
                      <p className="text-[10px] text-slate-400 mt-4 font-bold flex items-center gap-1">
                        <Clock size={12} /> Dernier : {new Date(schedule.lastBackup).toLocaleString('fr-FR')}
                      </p>
                    )}
                  </div>
                );
              })}
            </div>
            
            {autoBackupConfig.enabled && !hasAutoBackupDir && (
              <p className="text-amber-600 text-sm mt-4 font-medium flex items-center gap-2">
                <AlertCircle size={16} /> Vous devez choisir un dossier pour activer la sauvegarde automatique.
              </p>
            )}
            {autoBackupConfig.enabled && hasAutoBackupDir && autoBackupPermission !== 'granted' && (
              <p className="text-amber-600 text-sm mt-4 font-medium flex items-center gap-2">
                <AlertCircle size={16} /> Veuillez cliquer sur "Dossier ?" pour autoriser l'accès.
              </p>
            )}

            {window.self !== window.top && (
              <div className="mt-6 p-4 bg-blue-50 border border-blue-100 rounded-2xl flex items-start gap-3">
                <ShieldCheck className="text-blue-600 shrink-0" size={20} />
                <div className="space-y-1">
                  <p className="text-blue-900 text-sm font-black uppercase tracking-tight">Mode Aperçu Détecté</p>
                  <p className="text-blue-800 text-xs font-medium leading-relaxed">
                    Pour configurer la sauvegarde automatique, vous devez <strong>ouvrir l'application dans un nouvel onglet</strong> (bouton en haut à droite de cet écran). Les navigateurs bloquent l'accès aux dossiers quand l'application est affichée dans un cadre (iframe).
                  </p>
                </div>
              </div>
            )}
          </div>

          {/* Console de Débogage Technique */}
          {(importLogs.length > 0 || isImporting) && (
            <div className="bg-[#0f172a] rounded-[2.5rem] p-8 shadow-2xl border border-slate-800">
               <div className="flex items-center justify-between mb-6 border-b border-slate-800 pb-4">
                  <div className="flex items-center gap-3 text-indigo-400">
                    <Terminal size={18} />
                    <span className="font-black text-[10px] uppercase tracking-widest">Moniteur de Synchronisation</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className={`w-2 h-2 rounded-full ${isImporting ? 'bg-amber-500 animate-pulse' : 'bg-emerald-500'}`}></div>
                    <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">{isImporting ? 'Travail en cours' : 'Prêt'}</span>
                  </div>
               </div>
               <div className="space-y-2 font-mono text-[10px] h-48 overflow-y-auto pr-4 custom-scrollbar">
                  {importLogs.map((log, idx) => (
                    <div key={idx} className={`flex gap-3 ${log.includes('ERREUR') ? 'text-red-400 bg-red-400/5 p-2 rounded' : log.includes('SYNK') ? 'text-emerald-400' : 'text-slate-400'}`}>
                       <span className="opacity-30">{idx + 1}.</span>
                       <span>{log}</span>
                    </div>
                  ))}
                  {isImporting && <div className="text-indigo-400 italic">Traitement des métadonnées...</div>}
               </div>
            </div>
          )}
          
          <div className="bg-red-50 p-8 rounded-[2.5rem] border border-red-100 flex flex-col md:flex-row items-center justify-between gap-6">
             <div className="flex items-center gap-4">
                <AlertCircle className="text-red-500" size={32} />
                <div className="text-left">
                   <p className="font-black text-red-900 uppercase tracking-tighter italic">Réinitialisation d'usine</p>
                   <p className="text-xs text-red-600 font-medium">Efface tous les clients, photos et factures stockés sur cet appareil.</p>
                </div>
             </div>
             <button onClick={() => {
               setConfirmState({
                 isOpen: true,
                 title: "Réinitialisation d'usine",
                 message: "Êtes-vous sûr de vouloir tout effacer ? Cette action est irréversible.",
                 onConfirm: () => {
                   db.resetAll();
                   window.location.reload();
                 }
               });
             }} className="px-8 py-4 bg-white text-red-600 border border-red-200 rounded-2xl font-black text-[10px] uppercase tracking-widest hover:bg-red-600 hover:text-white transition-all shadow-sm">
                Remise à zéro complète
             </button>
          </div>
        </div>
      )}
      
      {/* Confirm Modal */}
      <ConfirmModal 
        isOpen={confirmState.isOpen}
        title={confirmState.title}
        message={confirmState.message}
        onConfirm={confirmState.onConfirm}
        onCancel={() => setConfirmState(prev => ({ ...prev, isOpen: false }))}
      />
    </Layout>
  );
};

const EditableConfigSection = ({ title, items, onUpdate }: any) => {
  const [val, setVal] = useState('');
  return (
    <div className="bg-white p-8 rounded-[2.5rem] border border-slate-100 shadow-sm flex flex-col min-h-[400px]">
      <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-8 border-b pb-2">{title}</h3>
      <div className="flex-1 space-y-2 mb-8 overflow-y-auto pr-2">
        {items.map((it: string) => (
          <div key={it} className="flex justify-between items-center p-3 bg-slate-50 rounded-xl group hover:bg-white border border-transparent hover:border-indigo-100 transition-all">
            <span className="text-sm font-bold text-slate-800">{it}</span>
            <button onClick={() => onUpdate(items.filter((i: string) => i !== it))} className="text-red-400 opacity-0 group-hover:opacity-100 p-2 hover:bg-red-50 rounded-lg"><Trash2 size={14}/></button>
          </div>
        ))}
      </div>
      <div className="flex gap-2">
        <input type="text" value={val} onChange={e => setVal(e.target.value)} onKeyPress={e => e.key === 'Enter' && val && (onUpdate([...items, val]), setVal(''))} className="flex-1 px-4 py-3 bg-slate-50 border border-slate-100 rounded-xl text-sm font-bold outline-none" placeholder="Ajouter..." />
        <button onClick={() => { if(val) onUpdate([...items, val]); setVal(''); }} className="w-12 h-12 bg-indigo-600 text-white rounded-xl flex items-center justify-center shadow-lg">+</button>
      </div>
    </div>
  );
};

const EditableBreedsSection = ({ breeds, species, onUpdate }: any) => {
  const [selectedSpecies, setSelectedSpecies] = useState(species[0] || '');
  const [newBreed, setNewBreed] = useState('');

  const handleAdd = () => {
    if (newBreed && selectedSpecies) {
      const currentBreeds = breeds[selectedSpecies] || [];
      onUpdate({ ...breeds, [selectedSpecies]: [...currentBreeds, newBreed] });
      setNewBreed('');
    }
  };

  return (
    <div className="bg-white p-8 rounded-[2.5rem] border border-slate-100 shadow-sm flex flex-col min-h-[400px]">
      <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-8 border-b pb-2">Races</h3>
      <select value={selectedSpecies} onChange={e => setSelectedSpecies(e.target.value)} className="w-full p-4 mb-4 bg-slate-50 border border-slate-200 rounded-2xl font-black text-slate-800">
        {species.map((s: string) => <option key={s} value={s}>{s}</option>)}
      </select>
      <div className="flex-1 space-y-2 mb-8 overflow-y-auto pr-2">
        {(breeds[selectedSpecies] || []).map((b: string) => (
          <div key={b} className="flex justify-between items-center p-3 bg-slate-50 rounded-xl group hover:bg-white border border-transparent hover:border-indigo-100 transition-all">
            <span className="text-sm font-bold text-slate-800">{b}</span>
            <button onClick={() => onUpdate({ ...breeds, [selectedSpecies]: (breeds[selectedSpecies] || []).filter((i: string) => i !== b) })} className="text-red-400 opacity-0 group-hover:opacity-100 p-2 hover:bg-red-50 rounded-lg"><Trash2 size={14}/></button>
          </div>
        ))}
      </div>
      <div className="flex gap-2">
        <input type="text" value={newBreed} onChange={e => setNewBreed(e.target.value)} className="flex-1 px-4 py-3 bg-slate-50 border border-slate-100 rounded-xl text-sm font-bold outline-none" placeholder="Ajouter race..." />
        <button onClick={handleAdd} className="w-12 h-12 bg-indigo-600 text-white rounded-xl flex items-center justify-center shadow-lg">+</button>
      </div>
    </div>
  );
};

const EditableProductsSection = ({ products, onUpdate }: any) => {
  const [name, setName] = useState('');
  const [price, setPrice] = useState('');

  const handleAdd = () => {
    if (name && price) {
      const newProduct = {
        id: Math.random().toString(36).substring(2, 15),
        name,
        price: parseFloat(price)
      };
      onUpdate([...products, newProduct]);
      setName('');
      setPrice('');
    }
  };

  return (
    <div className="bg-white p-8 rounded-[2.5rem] border border-slate-100 shadow-sm flex flex-col min-h-[400px] col-span-1 md:col-span-2 lg:col-span-4">
      <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-8 border-b pb-2">Produits (Boutique)</h3>
      <div className="flex-1 space-y-2 mb-8 overflow-y-auto pr-2">
        {products.map((p: any) => (
          <div key={p.id} className="flex justify-between items-center p-3 bg-slate-50 rounded-xl group hover:bg-white border border-transparent hover:border-indigo-100 transition-all">
            <div className="flex flex-col">
              <span className="text-sm font-bold text-slate-800">{p.name}</span>
              <span className="text-xs text-slate-500">{p.price.toFixed(2)} €</span>
            </div>
            <button onClick={() => onUpdate(products.filter((i: any) => i.id !== p.id))} className="text-red-400 opacity-0 group-hover:opacity-100 p-2 hover:bg-red-50 rounded-lg"><Trash2 size={14}/></button>
          </div>
        ))}
      </div>
      <div className="flex gap-2 flex-wrap">
        <input type="text" value={name} onChange={e => setName(e.target.value)} className="flex-1 min-w-[150px] px-4 py-3 bg-slate-50 border border-slate-100 rounded-xl text-sm font-bold outline-none" placeholder="Nom du produit..." />
        <input type="number" step="0.01" value={price} onChange={e => setPrice(e.target.value)} className="w-24 px-4 py-3 bg-slate-50 border border-slate-100 rounded-xl text-sm font-bold outline-none" placeholder="Prix €" />
        <button onClick={handleAdd} className="w-12 h-12 bg-indigo-600 text-white rounded-xl flex items-center justify-center shadow-lg">+</button>
      </div>
    </div>
  );
};

export default App;
