
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
  Terminal, CheckCircle2, ShieldCheck, Search, Clock, FolderOpen, Settings, Edit, Scissors
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
  const [isAuthLoading, setIsAuthLoading] = useState(true);
  const [isMigrating, setIsMigrating] = useState(false);
  const [migrationMsg, setMigrationMsg] = useState('');

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (u) => {
      setUser(u);
      setIsAuthLoading(false);
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

  const updateBaseConfig = (key: string, value: any) => {
    const newConfig = { ...config, [key]: value };
    setConfig(newConfig);
    db.saveConfig(newConfig);
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
    <div className="max-w-5xl mx-auto space-y-4 pb-10">
      <div className="flex flex-col md:flex-row items-center justify-between mb-4 bg-white p-4 rounded-xl border border-slate-100 shadow-sm gap-4">
        <h2 className="text-sm font-black text-slate-800 uppercase flex items-center gap-2">
          <FileText className="text-indigo-600" size={18} /> Factures
        </h2>
        
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative">
             <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-300" size={14} />
             <input 
               type="text" 
               placeholder="Rechercher..." 
               className="pl-9 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-lg font-bold text-xs text-slate-700 outline-none focus:ring-1 focus:ring-indigo-500"
               value={searchQuery}
               onChange={(e) => setSearchQuery(e.target.value)}
             />
          </div>
          <div className="flex bg-slate-100 p-0.5 rounded-lg">
            <button 
              onClick={() => setInvoiceType('grooming')}
              className={`px-3 py-1.5 rounded-md font-bold text-[10px] uppercase transition-all ${invoiceType === 'grooming' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-500'}`}
            >
              Services
            </button>
            <button 
              onClick={() => setInvoiceType('products')}
              className={`px-3 py-1.5 rounded-md font-bold text-[10px] uppercase transition-all ${invoiceType === 'products' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-500'}`}
            >
              Boutique
            </button>
          </div>

          <select 
            value={invoiceFilterYear} 
            onChange={(e) => setInvoiceFilterYear(parseInt(e.target.value))}
            className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg font-bold text-xs text-slate-700 outline-none"
          >
            {years.map(y => <option key={y} value={y}>{y}</option>)}
          </select>

          <select 
            value={invoiceFilterMonth} 
            onChange={(e) => setInvoiceFilterMonth(e.target.value === 'all' ? 'all' : parseInt(e.target.value))}
            className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg font-bold text-xs text-slate-700 outline-none"
          >
            <option value="all">Tous les mois</option>
            {['Jan', 'Fév', 'Mar', 'Avr', 'Mai', 'Juin', 'Juil', 'Août', 'Sep', 'Oct', 'Nov', 'Déc'].map((m, i) => (
              <option key={i} value={i}>{m}</option>
            ))}
          </select>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-2">
        {filteredInvoices.length === 0 ? (
          <div className="text-center py-10 text-slate-400 text-xs italic bg-white rounded-xl border border-dashed border-slate-200">Aucun document pour cette période.</div>
        ) : (
          filteredInvoices.map(inv => (
          <div key={inv.id} className="bg-white p-4 rounded-xl border border-slate-100 shadow-sm hover:shadow-md transition-all flex items-center justify-between gap-4 group cursor-pointer" onClick={() => invoiceType === 'grooming' ? handlePrint(inv as Invoice) : handlePrintProductInvoice(inv as any)}>
            <div className="flex items-center gap-4">
              <div className="w-10 h-10 bg-slate-50 rounded-lg flex items-center justify-center text-slate-400 group-hover:text-indigo-600 transition-colors">
                <FileText size={18} />
              </div>
              <div>
                <div className="flex items-center gap-2">
                   <h3 className="font-black text-slate-900 uppercase text-xs tracking-tight">{inv.number}</h3>
                   <span className="text-[8px] font-black bg-emerald-50 text-emerald-600 px-1.5 py-0.5 rounded uppercase">{inv.paymentMethod}</span>
                </div>
                <p className="text-[10px] text-slate-500 font-bold">
                  {new Date(inv.date).toLocaleDateString('fr-FR')} • 
                  <span className="text-indigo-600 ml-1">{'petName' in inv ? inv.petName : inv.clientName}</span>
                </p>
              </div>
            </div>
            
            <div className="flex items-center gap-6">
               <div className="text-right">
                  <p className="text-sm font-black text-slate-900">{(inv.amount || 0).toFixed(2)}€</p>
               </div>
               <div className="flex gap-1">
                  <button onClick={(e) => { e.stopPropagation(); invoiceType === 'grooming' ? handlePrint(inv as Invoice) : handlePrintProductInvoice(inv as any); }} className="p-2 text-indigo-600 hover:bg-indigo-50 rounded-lg transition-all">
                    <Printer size={16} />
                  </button>
                  <button onClick={(e) => { 
                    e.stopPropagation();
                    setConfirmState({
                      isOpen: true,
                      title: "Supprimer",
                      message: "Supprimer définitivement cette facture ?",
                      onConfirm: () => {
                        if (invoiceType === 'grooming') {
                          db.deleteInvoice(inv.id);
                        } else {
                          db.deleteProductInvoice(inv.id);
                        }
                        window.location.reload();
                      }
                    });
                  }} className="p-2 text-red-400 hover:bg-red-50 rounded-lg transition-all">
                    <Trash2 size={16} />
                  </button>
               </div>
            </div>
          </div>
        )))}
      </div>
    </div>
  );
  };

  if (isAuthLoading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div className="w-12 h-12 border-4 border-emerald-100 border-t-emerald-600 rounded-full animate-spin"></div>
          <p className="font-serif text-lg italic text-slate-400">Chargement de votre salon...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-6 bg-[url('https://www.transparenttextures.com/patterns/cubes.png')]">
        <div className="max-w-md w-full bg-white rounded-[2.5rem] p-12 shadow-[0_20px_50px_rgba(0,0,0,0.05)] border border-slate-100 flex flex-col items-center">
          <div className="w-20 h-20 bg-emerald-600 rounded-3xl flex items-center justify-center mb-10 shadow-xl shadow-emerald-200 rotate-3">
             <Scissors size={40} className="text-white -rotate-3" />
          </div>
          
          <h1 className="font-serif text-4xl text-slate-900 italic mb-3 text-center">Ka'nine Smart</h1>
          <p className="text-slate-400 font-bold uppercase text-[10px] tracking-[0.3em] mb-12 text-center">Smart Grooming Management</p>
          
          <div className="w-full space-y-6">
            <div className="p-6 bg-slate-50 rounded-2xl border border-slate-100 italic font-serif text-slate-600 text-center leading-relaxed">
              "L'interface professionnelle dédiée aux experts du toilettage canin."
            </div>

            <button 
              onClick={handleSignIn}
              className="w-full py-5 bg-slate-900 text-white rounded-2xl font-black text-xs uppercase tracking-[0.2em] flex items-center justify-center gap-4 hover:bg-emerald-600 transition-all shadow-xl active:scale-95 group"
            >
              <LogIn size={20} className="group-hover:translate-x-1 transition-transform" />
              Se connecter avec Google
            </button>
          </div>
          
          <p className="mt-12 text-[9px] font-bold text-slate-300 uppercase tracking-widest">Version 2.5 • Édition Professionnelle</p>
        </div>
      </div>
    );
  }

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
        <div className="max-w-4xl mx-auto bg-white p-6 rounded-2xl border border-slate-100 shadow-sm">
           <h2 className="text-sm font-black mb-8 text-slate-800 uppercase flex items-center gap-2">
             <HistoryIcon className="text-indigo-600" size={18} /> Activité
           </h2>
           <div className="space-y-2">
              {db.getAuditLog().map((entry: any) => (
                <div key={entry.id} className="flex gap-4 p-3 bg-slate-50/50 rounded-xl border border-slate-100">
                   <div className="w-20 shrink-0 border-r border-slate-200">
                      <p className="text-[8px] font-black text-slate-400 uppercase">{new Date(entry.timestamp).toLocaleDateString()}</p>
                      <p className="text-[10px] font-bold text-slate-600">{new Date(entry.timestamp).toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'})}</p>
                   </div>
                   <div className="flex-1">
                      <span className="text-[8px] font-black text-indigo-600 bg-indigo-50 px-1.5 py-0.5 rounded uppercase mb-1 inline-block">{entry.action}</span>
                      <p className="text-xs font-bold text-slate-800 leading-tight">{entry.details}</p>
                   </div>
                   <div className="flex gap-1 self-start">
                    {entry.undoData && (
                      <button 
                        onClick={() => {
                          setConfirmState({
                            isOpen: true,
                            title: "Annuler",
                            message: "Voulez-vous annuler cette action ?",
                            onConfirm: () => {
                              const success = db.undoAction(entry.id);
                              if (success === false) {
                                setAlertState({ isOpen: true, title: "Erreur", message: "Impossible de restaurer." });
                              } else {
                                window.location.reload();
                              }
                            }
                          });
                        }}
                        className="px-2 py-1 bg-amber-100 text-amber-700 rounded-lg text-[10px] font-black uppercase tracking-tight hover:bg-amber-200 transition-all"
                      >
                        Undo
                      </button>
                    )}
                    <button 
                      onClick={() => {
                        setConfirmState({
                          isOpen: true,
                          title: "Supprimer",
                          message: "Supprimer cette entrée ?",
                          onConfirm: () => {
                            db.deleteAuditLogEntry(entry.id);
                            window.location.reload();
                          }
                        });
                      }}
                      className="p-1.5 text-red-400 hover:bg-red-50 rounded-lg transition-all"
                    >
                      <Trash2 size={14} />
                    </button>
                   </div>
                </div>
              ))}
           </div>
        </div>
      )}
      {activeTab === 'config' && (
        <div className="space-y-6">
           <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm flex flex-col md:flex-row items-center gap-8">
              <div className="w-32 h-32 bg-slate-50 rounded-2xl border-2 border-white shadow-inner flex items-center justify-center overflow-hidden relative group">
                 {config.logo ? <img src={config.logo} className="w-full h-full object-contain p-2" /> : <ImageIcon size={32} className="text-slate-200" />}
                 <label className="absolute inset-0 bg-black/50 flex items-center justify-center opacity-0 group-hover:opacity-100 cursor-pointer transition-opacity">
                    <Camera className="text-white" size={20} />
                    <input type="file" ref={logoInputRef} onChange={handleLogoUpload} className="hidden" accept="image/*" />
                 </label>
              </div>
              <div className="flex-1 space-y-2">
                 <h3 className="text-sm font-black text-slate-900 uppercase">Logo Entreprise</h3>
                 <p className="text-xs text-slate-500 font-medium">Affiché sur les factures PDF.</p>
                 <button onClick={() => logoInputRef.current?.click()} className="px-4 py-2 bg-indigo-600 text-white rounded-lg text-xs font-black uppercase tracking-widest hover:bg-indigo-700 transition-all">Parcourir</button>
              </div>
           </div>

           <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm space-y-4">
              <h3 className="text-sm font-black text-slate-900 uppercase flex items-center gap-2">
                <FileText className="text-indigo-600" size={18} /> Coordonnées
              </h3>
              
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                <ConfigInput label="Entreprise" value={config.companyName} onChange={(v: string) => updateBaseConfig('companyName', v)} placeholder="Ex: Ka'nine" />
                <ConfigInput label="Gérant" value={config.ownerName} onChange={(v: string) => updateBaseConfig('ownerName', v)} placeholder="Ex: Karine D." />
                <ConfigInput label="SIRET" value={config.siret} onChange={(v: string) => updateBaseConfig('siret', v)} placeholder="123 456 789 00012" />
                <ConfigInput label="Adresse" value={config.address} onChange={(v: string) => updateBaseConfig('address', v)} placeholder="Ville, CP..." />
                <ConfigInput label="Tél" value={config.phone} onChange={(v: string) => updateBaseConfig('phone', v)} placeholder="06..." />
                <ConfigInput label="Email" value={config.email} onChange={(v: string) => updateBaseConfig('email', v)} placeholder="contact@..." />
              </div>
           </div>

           <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 mb-10">
              <EditableConfigSection title="Espèces" items={config.species || []} onUpdate={(items: string[]) => { db.updateConfigItems('species', items); setConfig(db.getConfig()); }} />
              <EditableBreedsSection breeds={config.breeds || {}} species={config.species || []} onUpdate={(breeds: Record<string, string[]>) => { const newConfig = {...config, breeds}; db.saveConfig(newConfig); setConfig(newConfig); }} />
              <EditableConfigSection title="Poils" items={config.coatTypes || []} onUpdate={(items: string[]) => { db.updateConfigItems('coatTypes', items); setConfig(db.getConfig()); }} />
              <EditableConfigSection title="Particularités" items={config.particularities || []} onUpdate={(items: string[]) => { db.updateConfigItems('particularities', items); setConfig(db.getConfig()); }} />
              <EditableConfigSection title="Services" items={config.services || []} onUpdate={(items: string[]) => { db.updateConfigItems('services', items); setConfig(db.getConfig()); }} />
              <EditableProductsSection products={config.products || []} onUpdate={(items: any[]) => { db.updateConfigItems('products', items); setConfig(db.getConfig()); }} />
           </div>
        </div>
      )}
      {activeTab === 'backup' && (
        <div className="max-w-4xl mx-auto space-y-4 pb-10">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="bg-white p-6 rounded-xl border border-slate-100 shadow-sm flex flex-col items-center text-center">
              <div className="w-12 h-12 bg-emerald-50 text-emerald-600 rounded-lg flex items-center justify-center mb-4 border border-emerald-100">
                <Download size={20} />
              </div>
              <h3 className="text-xs font-black text-slate-800 uppercase tracking-widest mb-1">Export Manuel</h3>
              <p className="text-slate-500 mb-6 text-[10px] font-bold uppercase tracking-tight">Archive JSON locale sécurisée.</p>
              <div className="w-full space-y-2">
                <button onClick={handleExportAll} className="w-full py-2.5 bg-slate-900 text-white rounded-lg text-[10px] font-black uppercase tracking-widest hover:bg-black transition-all flex items-center justify-center gap-2">
                  <Save size={14} /> Pack complet (3 JSON)
                </button>
                <div className="h-px bg-slate-100 w-full my-1"></div>
                <button onClick={() => handleFileExport('full')} className="w-full py-2.5 bg-emerald-600 text-white rounded-lg text-[10px] font-black uppercase tracking-widest hover:bg-emerald-700 transition-all flex items-center justify-center gap-2">
                  <Save size={14} /> Full DB (.json)
                </button>
                <div className="grid grid-cols-2 gap-2">
                  <button onClick={() => handleFileExport('partial')} className="w-full py-2 bg-white text-emerald-600 border border-emerald-100 rounded-lg text-[9px] font-black uppercase hover:bg-emerald-50 transition-all flex items-center justify-center gap-2">
                    Données
                  </button>
                  <button onClick={() => handleFileExport('photos')} className="w-full py-2 bg-white text-blue-600 border border-blue-100 rounded-lg text-[9px] font-black uppercase hover:bg-blue-50 transition-all flex items-center justify-center gap-2">
                    Photos
                  </button>
                </div>
              </div>
            </div>

            <div className="bg-white p-6 rounded-xl border border-slate-100 shadow-sm flex flex-col space-y-4">
              <div className="flex items-center gap-3">
                <div className="p-2.5 bg-indigo-50 text-indigo-600 rounded-lg border border-indigo-100"><Upload size={18} /></div>
                <h3 className="text-sm font-black text-slate-800 uppercase tracking-widest">Importation</h3>
              </div>
              <p className="text-slate-500 text-[10px] font-bold uppercase leading-relaxed tracking-tight">Restaurez vos données depuis un fichier JSON précédemment exporté.</p>
              <input type="file" ref={fileInputRef} onChange={handleFileImport} accept=".json" className="hidden" />
              <div className="flex-1 flex flex-col justify-end">
                <button 
                  onClick={() => fileInputRef.current?.click()} 
                  disabled={isImporting}
                  className={`w-full py-4 rounded-xl font-black text-[10px] uppercase tracking-[0.2em] flex items-center justify-center gap-3 border-2 border-dashed transition-all ${isImporting ? 'bg-slate-50 border-slate-200 text-slate-400 cursor-not-allowed' : 'bg-indigo-50 border-indigo-200 text-indigo-700 hover:bg-indigo-100'}`}
                >
                  {isImporting ? "CHRGMENT..." : "DÉPOSER JSON"}
                </button>
              </div>
            </div>
          </div>

          <div className="bg-white p-6 rounded-xl border border-slate-100 shadow-sm space-y-6">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-50 pb-4">
              <div className="flex items-center gap-3">
                <div className="p-2.5 bg-blue-50 text-blue-600 rounded-lg border border-blue-100"><Clock size={18} /></div>
                <div>
                  <h3 className="text-sm font-black text-slate-800 uppercase tracking-widest">Backup Automatique</h3>
                  <p className="text-slate-500 text-[9px] font-bold uppercase tracking-tight">Background sync vers dossier local.</p>
                </div>
              </div>
              
              <div className="flex items-center gap-2">
                <button
                  onClick={() => updateAutoBackup({ enabled: !autoBackupConfig.enabled })}
                  className={`py-2 px-4 rounded-lg text-[9px] font-black uppercase tracking-widest transition-all ${autoBackupConfig.enabled ? 'bg-emerald-50 text-emerald-600 border border-emerald-100' : 'bg-slate-50 text-slate-500 border border-slate-200'}`}
                >
                  {autoBackupConfig.enabled ? 'ACTIF' : 'INACTIF'}
                </button>

                <button
                  onClick={() => {
                    if (!autoBackupConfig.enabled) {
                      updateAutoBackup({ enabled: true });
                    }
                    const action = (hasAutoBackupDir && autoBackupPermission !== 'granted') ? 'request' : 'pick';
                    handleAutoBackupSetup(action);
                  }}
                  className={`py-2 px-4 rounded-lg text-[9px] font-black uppercase tracking-widest transition-all ${hasAutoBackupDir && autoBackupPermission === 'granted' ? 'bg-indigo-50 text-indigo-600 border border-indigo-200' : 'bg-amber-50 text-amber-600 border border-amber-200'}`}
                >
                   {hasAutoBackupDir && autoBackupPermission === 'granted' ? "DOSSIER OK" : "SÉLEC. DOSSIER"}
                </button>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              {[
                { id: 'partial', label: 'Données', icon: <FileText size={14} /> },
                { id: 'full', label: 'Full DB', icon: <Save size={14} /> },
                { id: 'photos', label: 'Photos', icon: <ImageIcon size={14} /> }
              ].map((type) => {
                const schedule = autoBackupConfig.schedules?.[type.id as BackupType] || { enabled: false, frequency: 24 };
                return (
                  <div key={type.id} className={`p-3 rounded-lg border transition-all ${schedule.enabled ? 'bg-white border-slate-200 shadow-sm' : 'bg-slate-50/50 border-slate-100 opacity-60'}`}>
                    <div className="flex items-center justify-between mb-2">
                       <span className={`p-1.5 rounded ${schedule.enabled ? 'bg-indigo-50 text-indigo-600' : 'bg-slate-200 text-slate-400'}`}>
                          {type.icon}
                       </span>
                       <button
                          onClick={() => updateSchedule(type.id as BackupType, { enabled: !schedule.enabled })}
                          disabled={!autoBackupConfig.enabled}
                          className={`px-2 py-0.5 rounded text-[7px] font-black uppercase tracking-widest transition-all ${schedule.enabled ? 'bg-indigo-600 text-white' : 'bg-slate-200 text-slate-500'}`}
                        >
                          {schedule.enabled ? 'ON' : 'OFF'}
                       </button>
                    </div>
                    <h4 className="font-black text-slate-800 uppercase text-[9px] mb-1">{type.label}</h4>
                    <select
                      value={schedule.frequency}
                      onChange={(e) => updateSchedule(type.id as BackupType, { frequency: parseInt(e.target.value) })}
                      disabled={!autoBackupConfig.enabled || !schedule.enabled}
                      className="w-full p-1 bg-slate-50 border border-slate-100 rounded text-[8px] font-black uppercase outline-none mb-2"
                    >
                      <option value={4}>4h</option>
                      <option value={12}>12h</option>
                      <option value={24}>24h</option>
                      <option value={168}>1 sem</option>
                    </select>
                    {schedule.enabled && schedule.lastBackup && (
                      <p className="text-[7px] text-slate-400 font-bold uppercase tabular-nums">
                        Sync: {new Date(schedule.lastBackup).toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}
                      </p>
                    )}
                  </div>
                );
              })}
            </div>
            
            {autoBackupConfig.enabled && (!hasAutoBackupDir || autoBackupPermission !== 'granted') && (
              <p className="text-amber-600 text-[9px] mt-2 font-black uppercase flex items-center gap-2 italic">
                <AlertCircle size={10} /> Configuration du dossier requise
              </p>
            )}

            {window.self !== window.top && (
              <div className="p-3 bg-blue-50/50 border border-blue-100 rounded-lg flex items-start gap-2">
                <ShieldCheck className="text-blue-600 shrink-0" size={14} />
                <p className="text-blue-800 text-[8px] font-bold uppercase leading-normal tracking-tight">
                  <span className="font-black text-blue-900 border-b border-blue-200 mr-1">NOTE TECHNIQUE :</span> 
                  Activez via 'Ouvrir en nouvel onglet' pour autoriser l'accès aux dossiers locaux navigateur.
                </p>
              </div>
            )}
          </div>

          {(importLogs.length > 0 || isImporting) && (
            <div className="bg-[#0f172a] rounded-xl p-4 shadow-xl border border-slate-800">
               <div className="flex items-center justify-between mb-3 border-b border-slate-800 pb-2">
                  <div className="flex items-center gap-2 text-indigo-400">
                    <Terminal size={12} />
                    <span className="font-black text-[8px] uppercase tracking-[0.2em]">Live Monitoring</span>
                  </div>
                  <div className={`w-1.5 h-1.5 rounded-full ${isImporting ? 'bg-amber-500 animate-pulse' : 'bg-emerald-500'}`}></div>
               </div>
               <div className="space-y-1 font-mono text-[9px] h-32 overflow-y-auto pr-2 custom-scrollbar tabular-nums">
                  {importLogs.map((log, idx) => (
                    <div key={idx} className={`flex gap-2 ${log.includes('ERREUR') ? 'text-red-400 bg-red-400/5 p-1 rounded' : log.includes('SYNK') ? 'text-emerald-400' : 'text-slate-400'}`}>
                       <span className="opacity-30">{idx + 1}</span>
                       <span>{log}</span>
                    </div>
                  ))}
               </div>
            </div>
          )}
          
          <div className="bg-red-50/50 p-4 rounded-xl border border-red-100 flex items-center justify-between gap-4">
             <div className="flex items-center gap-3">
                <AlertCircle className="text-red-400" size={24} />
                <div>
                   <p className="font-black text-red-900 uppercase text-[10px] tracking-widest italic">Hard Reset</p>
                   <p className="text-[8px] text-red-600 font-bold uppercase tracking-tight">Efface toutes les données locales.</p>
                </div>
             </div>
             <button onClick={() => {
               setConfirmState({
                 isOpen: true,
                 title: "Hard Reset",
                 message: "Toutes les données seront supprimées. Confirmer ?",
                 onConfirm: () => {
                   db.resetAll();
                   window.location.reload();
                 }
               });
             }} className="px-4 py-2 bg-white text-red-600 border border-red-100 rounded-lg font-black text-[9px] uppercase tracking-widest hover:bg-red-600 hover:text-white transition-all">
                RAZ COMPLÈTE
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

const ConfigInput = ({ label, value, onChange, placeholder }: any) => (
  <div className="space-y-1.5">
    <label className="block text-[9px] font-bold text-slate-400 uppercase tracking-widest italic">{label}</label>
    <input 
      type="text" 
      value={value || ''} 
      onChange={e => onChange(e.target.value)} 
      className="w-full px-4 py-3 bg-slate-50 border border-slate-100 rounded-xl text-xs font-bold focus:ring-1 focus:ring-emerald-500 focus:bg-white focus:border-emerald-200 outline-none transition-all placeholder:text-slate-200" 
      placeholder={placeholder} 
    />
  </div>
);

const EditableConfigSection = ({ title, items, onUpdate }: any) => {
  const [val, setVal] = useState('');
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [editVal, setEditVal] = useState('');

  const handleEditSave = (index: number) => {
    const newItems = [...items];
    newItems[index] = editVal;
    onUpdate(newItems);
    setEditingIndex(null);
  };

  return (
    <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm flex flex-col min-h-[350px]">
      <h3 className="font-serif text-lg text-slate-900 italic mb-4 border-b border-slate-50 pb-3">{title}</h3>
      <div className="flex-1 space-y-1.5 mb-5 overflow-y-auto pr-1 custom-scrollbar">
        {items.map((it: string, idx: number) => (
          <div key={`${it}-${idx}`} className="flex justify-between items-center p-3 bg-slate-50 rounded-xl group hover:bg-white border border-transparent hover:border-emerald-100 transition-all">
            {editingIndex === idx ? (
              <input 
                autoFocus 
                value={editVal} 
                onChange={e => setEditVal(e.target.value)} 
                onBlur={() => handleEditSave(idx)}
                onKeyPress={e => e.key === 'Enter' && handleEditSave(idx)}
                className="flex-1 bg-white px-2 py-1 rounded border border-emerald-100 outline-none text-[11px] font-bold text-slate-800"
              />
            ) : (
              <div className="flex-1 flex items-center justify-between min-w-0 pr-2">
                <span className="text-[11px] font-bold text-slate-700 uppercase tracking-tight truncate">{it}</span>
                <button 
                  onClick={() => { setEditingIndex(idx); setEditVal(it); }}
                  className="p-1.5 text-slate-200 hover:text-emerald-600 opacity-0 group-hover:opacity-100 transition-all"
                >
                  <Edit size={12} />
                </button>
              </div>
            )}
            <button onClick={() => onUpdate(items.filter((_: string, i: number) => i !== idx))} className="text-slate-100 hover:text-red-400 p-1.5 transition-colors"><Trash2 size={12}/></button>
          </div>
        ))}
      </div>
      <div className="flex gap-2 pt-4 border-t border-slate-50">
        <input type="text" value={val} onChange={e => setVal(e.target.value)} onKeyPress={e => e.key === 'Enter' && val && (onUpdate([...items, val]), setVal(''))} className="flex-1 px-4 py-2.5 bg-slate-50 border border-slate-100 rounded-xl text-[10px] font-bold uppercase outline-none focus:bg-white focus:ring-1 focus:ring-emerald-500 transition-all" placeholder="AJOUTER..." />
        <button onClick={() => { if(val) onUpdate([...items, val]); setVal(''); }} className="w-10 h-10 bg-slate-900 text-white rounded-xl flex items-center justify-center shadow-lg hover:bg-emerald-600 transition-all cursor-pointer">+</button>
      </div>
    </div>
  );
};

const EditableBreedsSection = ({ breeds, species, onUpdate }: any) => {
  const [selectedSpecies, setSelectedSpecies] = useState(species[0] || '');
  const [newBreed, setNewBreed] = useState('');
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [editVal, setEditVal] = useState('');

  const handleAdd = () => {
    if (newBreed && selectedSpecies) {
      const currentBreeds = breeds[selectedSpecies] || [];
      onUpdate({ ...breeds, [selectedSpecies]: [...currentBreeds, newBreed] });
      setNewBreed('');
    }
  };

  const handleEditSave = (index: number) => {
    const currentBreeds = [...(breeds[selectedSpecies] || [])];
    currentBreeds[index] = editVal;
    onUpdate({ ...breeds, [selectedSpecies]: currentBreeds });
    setEditingIndex(null);
  };

  return (
    <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm flex flex-col min-h-[350px]">
      <h3 className="font-serif text-lg text-slate-900 italic mb-4 border-b border-slate-50 pb-3">Races par espèce</h3>
      <select value={selectedSpecies} onChange={e => setSelectedSpecies(e.target.value)} className="w-full p-3 mb-4 bg-slate-50 border border-slate-100 rounded-xl text-[10px] font-bold uppercase text-slate-800 outline-none focus:ring-1 focus:ring-emerald-500 transition-all">
        {species.map((s: string) => <option key={s} value={s}>{s}</option>)}
      </select>
      <div className="flex-1 space-y-1.5 mb-5 overflow-y-auto pr-1 custom-scrollbar">
        {(breeds[selectedSpecies] || []).map((b: string, idx: number) => (
          <div key={`${b}-${idx}`} className="flex justify-between items-center p-3 bg-slate-50 rounded-xl group hover:bg-white border border-transparent hover:border-emerald-100 transition-all">
            {editingIndex === idx ? (
              <input 
                autoFocus 
                value={editVal} 
                onChange={e => setEditVal(e.target.value)} 
                onBlur={() => handleEditSave(idx)}
                onKeyPress={e => e.key === 'Enter' && handleEditSave(idx)}
                className="flex-1 bg-white px-2 py-1 rounded border border-emerald-100 outline-none text-[11px] font-bold text-slate-800"
              />
            ) : (
              <div className="flex-1 flex items-center justify-between min-w-0 pr-2">
                <span className="text-[11px] font-bold text-slate-700 uppercase tracking-tight truncate">{b}</span>
                <button 
                  onClick={() => { setEditingIndex(idx); setEditVal(b); }}
                  className="p-1.5 text-slate-200 hover:text-emerald-600 opacity-0 group-hover:opacity-100 transition-all"
                >
                  <Edit size={12} />
                </button>
              </div>
            )}
            <button onClick={() => onUpdate({ ...breeds, [selectedSpecies]: (breeds[selectedSpecies] || []).filter((_: string, i: number) => i !== idx) })} className="text-slate-100 hover:text-red-400 p-1.5 transition-colors"><Trash2 size={12}/></button>
          </div>
        ))}
      </div>
      <div className="flex gap-2 pt-4 border-t border-slate-50">
        <input type="text" value={newBreed} onChange={e => setNewBreed(e.target.value)} onKeyPress={e => e.key === 'Enter' && newBreed && handleAdd()} className="flex-1 px-4 py-2.5 bg-slate-50 border border-slate-100 rounded-xl text-[10px] font-bold uppercase outline-none focus:bg-white focus:ring-1 focus:ring-emerald-500 transition-all" placeholder="RACE..." />
        <button onClick={handleAdd} className="w-10 h-10 bg-slate-900 text-white rounded-xl flex items-center justify-center shadow-lg hover:bg-emerald-600 transition-all cursor-pointer">+</button>
      </div>
    </div>
  );
};

const EditableProductsSection = ({ products, onUpdate }: any) => {
  const [name, setName] = useState('');
  const [price, setPrice] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const [editPrice, setEditPrice] = useState('');

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

  const handleEditSave = (id: string) => {
    const newProducts = products.map((p: any) => p.id === id ? { ...p, name: editName, price: parseFloat(editPrice) } : p);
    onUpdate(newProducts);
    setEditingId(null);
  };

  return (
    <div className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm flex flex-col min-h-[400px] col-span-1 md:col-span-2 lg:col-span-3 xl:col-span-4">
      <h3 className="font-serif text-2xl text-slate-900 italic mb-6 border-b border-slate-50 pb-4">Boutique & Articles</h3>
      <div className="flex-1 space-y-2 mb-6 overflow-y-auto pr-2 custom-scrollbar">
        {products.map((p: any) => (
          <div key={p.id} className="flex justify-between items-center p-4 bg-slate-50 rounded-2xl group hover:bg-white border border-transparent hover:border-emerald-100 transition-all shadow-sm">
            {editingId === p.id ? (
              <div className="flex gap-3 flex-1">
                <input value={editName} onChange={e => setEditName(e.target.value)} className="flex-1 bg-white px-4 py-2 rounded-xl border border-emerald-200 outline-none text-[11px] font-bold text-slate-800" />
                <input value={editPrice} onChange={e => setEditPrice(e.target.value)} className="w-24 bg-white px-4 py-2 rounded-xl border border-emerald-200 outline-none text-[11px] font-bold text-slate-800" />
                <button onClick={() => handleEditSave(p.id)} className="p-2 text-emerald-600 bg-emerald-50 rounded-xl hover:bg-emerald-100 transition-colors"><CheckCircle2 size={18}/></button>
              </div>
            ) : (
              <div className="flex-1 flex items-center justify-between min-w-0 pr-6">
                <div className="flex flex-col">
                  <span className="font-serif text-lg text-slate-800 italic leading-tight">{p.name}</span>
                  <span className="text-[11px] text-emerald-600 font-bold tabular-nums mt-1">{p.price.toFixed(2)} €</span>
                </div>
                <button 
                  onClick={() => { setEditingId(p.id); setEditName(p.name); setEditPrice(p.price.toString()); }}
                  className="p-2 text-slate-200 hover:text-emerald-600 opacity-0 group-hover:opacity-100 transition-all bg-white rounded-xl shadow-sm border border-slate-50"
                >
                  <Edit size={14} />
                </button>
              </div>
            )}
            <button onClick={() => onUpdate(products.filter((i: any) => i.id !== p.id))} className="text-slate-200 hover:text-red-400 p-2 transition-colors"><Trash2 size={16}/></button>
          </div>
        ))}
      </div>
      <div className="flex gap-3 pt-6 border-t border-slate-100">
        <input type="text" value={name} onChange={e => setName(e.target.value)} className="flex-1 px-5 py-4 bg-slate-50 border border-slate-100 rounded-2xl text-[11px] font-bold uppercase outline-none focus:bg-white focus:ring-1 focus:ring-emerald-500 transition-all" placeholder="DÉSIGNATION DE L'ARTICLE..." />
        <input type="number" step="0.01" value={price} onChange={e => setPrice(e.target.value)} className="w-32 px-5 py-4 bg-slate-50 border border-slate-100 rounded-2xl text-[11px] font-bold outline-none focus:bg-white focus:ring-1 focus:ring-emerald-500 transition-all" placeholder="PRIX €" />
        <button onClick={handleAdd} className="px-8 bg-slate-900 text-white rounded-2xl font-bold uppercase text-[10px] tracking-widest shadow-xl hover:bg-emerald-700 transition-all active:scale-95">Ajouter au catalogue</button>
      </div>
    </div>
  );
};

export default App;
