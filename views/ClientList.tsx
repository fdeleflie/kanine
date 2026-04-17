
import React, { useState, useEffect } from 'react';
import { 
  Search, Plus, User, Camera, Trash2, Edit3, X, Maximize2, Download, Image as ImageIcon, Euro, 
  ChevronLeft, ChevronRight
} from 'lucide-react';
import { db } from '../services/database';
import { Client, Invoice, Appointment, ProductInvoice, Configuration } from '../types';
import { INITIAL_CONFIG } from '../constants';
import { compressImage } from '../utils/imageCompression';

import { ConfirmModal } from '../components/ConfirmModal';
import { WarningModal } from '../components/WarningModal';
import { PhotoThumbnail } from '../components/PhotoThumbnail';

const generateId = () => Math.random().toString(36).substring(2, 15) + Date.now().toString(36);

const ClientList: React.FC<{ user?: any, initialClientId?: string | null, onPrintInvoice: (inv: Invoice) => void, onPrintProductInvoice: (inv: ProductInvoice) => void }> = ({ user, initialClientId, onPrintInvoice, onPrintProductInvoice }) => {
  const [clients, setClients] = useState<Client[]>([]);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [productInvoices, setProductInvoices] = useState<ProductInvoice[]>([]);
  const [config, setConfig] = useState<Configuration>(INITIAL_CONFIG);
  const [search, setSearch] = useState('');
  const [selectedClient, setSelectedClient] = useState<Client | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [history, setHistory] = useState<(Appointment & { invoice?: Invoice })[]>([]);
  const [formSpecies, setFormSpecies] = useState<string>('Chien');
  const [selectedPhoto, setSelectedPhoto] = useState<string | null>(null);
  const [formPhotoProfile, setFormPhotoProfile] = useState<string | undefined>(undefined);
  const [confirmState, setConfirmState] = useState<{isOpen: boolean, title: string, message: React.ReactNode, onConfirm: () => void}>({
    isOpen: false,
    title: '',
    message: '',
    onConfirm: () => {}
  });
  const [warningState, setWarningState] = useState<{isOpen: boolean, title: string, message: string}>({
    isOpen: false,
    title: '',
    message: ''
  });

  const loadClients = async () => {
    const loaded = await db.getClients();
    setClients(loaded);
    return loaded;
  };

  const loadAllData = async () => {
    const [c, inv, pinv, cfg] = await Promise.all([
      db.getClients(),
      db.getInvoices(),
      db.getProductInvoices(),
      db.getConfig()
    ]);
    setClients(c || []);
    setInvoices(inv || []);
    setProductInvoices(pinv || []);
    if (cfg) setConfig(cfg);
    return { clients: c, invoices: inv, productInvoices: pinv, config: cfg };
  };

  useEffect(() => {
    loadAllData();
  }, [user]);

  useEffect(() => {
    if (selectedClient) {
      setFormPhotoProfile(selectedClient.photoProfile);
    } else {
      setFormPhotoProfile(undefined);
    }
  }, [selectedClient, isEditing]);

  useEffect(() => {
    const init = async () => {
      const { clients: loaded } = await loadAllData();
      if (initialClientId) {
        const found = loaded.find(c => c.id === initialClientId);
        if (found) { 
          setSelectedClient(found); 
          setFormSpecies(found.species); 
          setFormPhotoProfile(found.photoProfile);
          loadHistory(found.id); 
        }
      }
    };
    init();
  }, [initialClientId]);

  const loadHistory = async (clientId: string) => {
    const allAppts = (await db.getAppointments()).filter(a => a.clientId === clientId);
    const allInvoices = await db.getInvoices();
    const combined = allAppts.map(appt => ({
      ...appt,
      invoice: allInvoices.find(inv => inv.appointmentId === appt.id)
    })).sort((a, b) => b.date.localeCompare(a.date));
    setHistory(combined);
  };

  const filteredClients = clients.filter(c => 
    c.name.toLowerCase().includes(search.toLowerCase()) || 
    c.ownerName.toLowerCase().includes(search.toLowerCase())
  );

  const handleFormPhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const compressedBase64 = await compressImage(file);
      setFormPhotoProfile(compressedBase64);
    } catch (error) {
      console.error("Erreur lors de la compression de l'image:", error);
      setWarningState({
        isOpen: true,
        title: "Erreur Photo",
        message: "Impossible de traiter cette photo. Veuillez essayer avec une autre image."
      });
    } finally {
      e.target.value = '';
    }
  };

  const handleSaveClient = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    
    const newClient: Client = {
      id: selectedClient && isEditing ? selectedClient.id : generateId(),
      name: formData.get('name') as string,
      species: formData.get('species') as string,
      breed: formData.get('breed') as string,
      coatType: formData.get('coatType') as string,
      birthDate: formData.get('birthDate') as string,
      sex: formData.get('sex') as 'M' | 'F',
      weight: parseFloat(formData.get('weight') as string) || 0,
      ownerName: formData.get('ownerName') as string,
      phone: formData.get('phone') as string,
      email: formData.get('email') as string,
      address: formData.get('address') as string,
      particularities: Array.from(formData.getAll('particularities')) as string[],
      notes: formData.get('notes') as string,
      photoProfile: formPhotoProfile,
      createdAt: selectedClient?.createdAt || new Date().toISOString(),
      isProfessional: formData.get('isProfessional') === 'on'
    };

    try {
      const success = await db.saveClient(newClient);
      if (success) {
        loadClients(); // Rafraîchit l'état local des clients
        setSelectedClient(newClient);
        setIsEditing(false);
      } else {
        setWarningState({
          isOpen: true,
          title: "Erreur d'enregistrement",
          message: "Impossible d'enregistrer le client. Une erreur est survenue sur le serveur."
        });
      }
    } catch (error) {
      setWarningState({
        isOpen: true,
        title: "Erreur de connexion",
        message: "Impossible de contacter le serveur. Vérifiez votre connexion."
      });
    }
  };

  const handleDeleteClient = async () => {
    if (!selectedClient) return;
    
    const appts = (await db.getAppointments()).filter(a => a.clientId === selectedClient.id);
    const invs = (await db.getInvoices()).filter(i => i.clientId === selectedClient.id);
    
    setConfirmState({
      isOpen: true,
      title: "Supprimer le client",
      message: `Voulez-vous supprimer ${selectedClient.name} ? ${appts.length > 0 || invs.length > 0 ? `Cela supprimera également ${appts.length} rendez-vous et ${invs.length} factures.` : ''}`,
      onConfirm: async () => {
        await db.deleteClient(selectedClient.id);
        
        // MISE À JOUR FORCÉE DE L'INTERFACE
        await loadAllData();
        setSelectedClient(null);
        setHistory([]);
        setIsEditing(false);
      }
    });
  };

  const handlePetPhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !selectedClient) return;
    
    try {
      const compressedBase64 = await compressImage(file);
      const updatedClient = { ...selectedClient, photoProfile: compressedBase64 };
      if (await db.saveClient(updatedClient)) {
        setSelectedClient(updatedClient);
        loadClients();
      } else {
        setWarningState({
          isOpen: true,
          title: "Mémoire Saturée",
          message: "Impossible de sauvegarder la photo. L'espace de stockage est plein."
        });
      }
    } catch (error) {
      console.error("Erreur lors de la compression de l'image:", error);
      setWarningState({
        isOpen: true,
        title: "Erreur Photo",
        message: "Impossible de traiter cette photo."
      });
    } finally {
      e.target.value = '';
    }
  };

  const downloadImage = (base64: string, name: string) => {
    const link = document.createElement('a');
    link.href = base64;
    link.download = `kanine_${name}_${Date.now()}.png`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="flex flex-col lg:flex-row gap-8 h-full min-h-0 max-w-[1600px] mx-auto">
      {/* Sidebar - responsive width and height */}
      <div className={`w-full lg:w-[350px] flex flex-col gap-6 bg-white p-6 rounded-2xl shadow-sm border border-slate-100 overflow-hidden ${selectedClient && !isEditing ? 'hidden lg:flex' : 'flex'}`}>
        <div className="flex gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300" size={14} />
            <input type="text" placeholder="RECHERCHER..." className="w-full pl-10 pr-4 py-3 bg-slate-50 rounded-xl text-[10px] font-bold outline-none border border-transparent focus:border-emerald-100 focus:bg-white placeholder:text-slate-300 uppercase tracking-widest transition-all" value={search} onChange={e => setSearch(e.target.value)} />
          </div>
          <button onClick={() => { setSelectedClient(null); setIsEditing(true); setFormSpecies('Chien'); setHistory([]); setFormPhotoProfile(undefined); }} className="p-3 bg-slate-900 text-white rounded-xl shadow-lg shadow-slate-200 hover:bg-emerald-700 active:scale-95 transition-all"><Plus size={20} /></button>
        </div>
        <div className="flex-1 overflow-y-auto space-y-2.5 pr-1 custom-scrollbar">
          {filteredClients.map(client => (
            <button key={client.id} onClick={() => { setSelectedClient(client); setIsEditing(false); setFormSpecies(client.species); setFormPhotoProfile(client.photoProfile); loadHistory(client.id); }} className={`w-full text-left p-4 rounded-xl transition-all border ${selectedClient?.id === client.id ? 'bg-emerald-50 border-emerald-200 shadow-sm shadow-emerald-50/50' : 'bg-white border-slate-50 hover:bg-slate-50 text-slate-400'}`}>
              <h4 className={`font-serif text-lg leading-tight ${selectedClient?.id === client.id ? 'text-emerald-900 italic' : 'text-slate-800'}`}>{client.name}</h4>
              <p className="text-[10px] font-bold uppercase tracking-wider truncate opacity-60 flex items-center gap-2 mt-0.5">
                <span className={selectedClient?.id === client.id ? 'text-emerald-600' : ''}>{client.ownerName}</span>
                <span className="w-1 h-1 bg-slate-200 rounded-full"></span>
                <span>{client.species}</span>
              </p>
            </button>
          ))}
          {filteredClients.length === 0 && (
            <div className="py-20 text-center">
              <p className="text-xs text-slate-300 font-bold uppercase tracking-widest italic">Aucun résultat</p>
            </div>
          )}
        </div>
      </div>

      {/* Main Content Area */}
      <div className={`flex-1 bg-white rounded-2xl shadow-sm border border-slate-100 overflow-y-auto relative pb-20 ${!selectedClient && !isEditing ? 'hidden lg:block' : 'block'}`}>
        {isEditing ? (
          <div className="p-8 md:p-12 max-w-4xl mx-auto">
            <div className="flex justify-between items-center mb-12">
              <h2 className="font-serif text-3xl text-slate-900 italic flex items-center gap-4">
                <div className="w-1.5 h-10 bg-emerald-600 rounded-full"></div>
                {selectedClient ? 'Modifier la fiche client' : 'Accueillir un nouveau client'}
              </h2>
              <button type="button" onClick={() => setIsEditing(false)} className="px-5 py-2.5 text-xs font-bold text-slate-400 hover:text-red-500 uppercase tracking-widest border border-slate-100 hover:border-red-100 rounded-xl transition-all">ANNULER</button>
            </div>
            
            <form onSubmit={handleSaveClient} className="space-y-16">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-12 lg:gap-20">
              <div className="space-y-10">
                <h3 className="text-[11px] font-bold text-slate-400 uppercase tracking-widest border-b border-slate-50 pb-3 italic">Identité du compagnon</h3>
                <div className="flex items-center gap-8">
                  <div className="relative w-28 h-28 bg-slate-50 rounded-3xl flex items-center justify-center overflow-hidden border border-slate-100 group shadow-inner">
                    {formPhotoProfile ? (
                      <PhotoThumbnail imageRef={formPhotoProfile} alt="Profile" />
                    ) : (
                      <Camera className="text-slate-300" size={30} />
                    )}
                    <div className="absolute inset-0 bg-emerald-900/40 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-all">
                       <Plus size={24} className="text-white" />
                    </div>
                    <input type="file" name="photoProfile" onChange={handleFormPhotoUpload} className="absolute inset-0 opacity-0 cursor-pointer" accept="image/*" />
                  </div>
                  <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider leading-relaxed italic max-w-[150px]">
                    Ajouter une photo de profil pour personnaliser la fiche.
                  </div>
                </div>
                <div className="space-y-6">
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest px-1">Nom</label>
                    <input name="name" defaultValue={selectedClient?.name} placeholder="Nom de l'animal..." required className="w-full px-5 py-4 bg-slate-50 border border-transparent focus:border-emerald-100 focus:bg-white rounded-2xl font-bold text-slate-800 outline-none transition-all shadow-sm" />
                  </div>
                  <div className="grid grid-cols-2 gap-5">
                    <div className="space-y-1.5">
                      <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest px-1">Espèce</label>
                      <select name="species" value={formSpecies} onChange={e => setFormSpecies(e.target.value)} required className="w-full px-5 py-4 bg-slate-50 border border-transparent focus:border-emerald-100 focus:bg-white rounded-2xl font-bold text-slate-800 outline-none shadow-sm cursor-pointer">
                        {config.species.map(s => <option key={s} value={s}>{s}</option>)}
                      </select>
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest px-1">Race</label>
                      <select name="breed" defaultValue={selectedClient?.breed} required className="w-full px-5 py-4 bg-slate-50 border border-transparent focus:border-emerald-100 focus:bg-white rounded-2xl font-bold text-slate-800 outline-none shadow-sm cursor-pointer">
                        {(config.breeds[formSpecies] || ["Autre"]).map(b => <option key={b} value={b}>{b}</option>)}
                      </select>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-5">
                    <div className="space-y-1.5">
                      <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest px-1">Sexe</label>
                      <select name="sex" defaultValue={selectedClient?.sex || 'M'} required className="w-full px-5 py-4 bg-slate-50 border border-transparent focus:border-emerald-100 focus:bg-white rounded-2xl font-bold text-slate-800 outline-none shadow-sm cursor-pointer">
                        <option value="M">Mâle</option>
                        <option value="F">Femelle</option>
                      </select>
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest px-1">Poids (kg)</label>
                      <input type="number" name="weight" defaultValue={selectedClient?.weight} placeholder="0.0" step="0.1" className="w-full px-5 py-4 bg-slate-50 border border-transparent focus:border-emerald-100 focus:bg-white rounded-2xl font-bold text-slate-800 outline-none shadow-sm" />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-5">
                    <div className="space-y-1.5">
                      <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest px-1">Type de poil</label>
                      <select name="coatType" defaultValue={selectedClient?.coatType} required className="w-full px-5 py-4 bg-slate-50 border border-transparent focus:border-emerald-100 focus:bg-white rounded-2xl font-bold text-slate-800 outline-none shadow-sm cursor-pointer">
                        {config.coatTypes.map(c => <option key={c} value={c}>{c}</option>)}
                      </select>
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest px-1">Date de naissance</label>
                      <input type="date" name="birthDate" defaultValue={selectedClient?.birthDate} className="w-full px-5 py-4 bg-slate-50 border border-transparent focus:border-emerald-100 focus:bg-white rounded-2xl font-bold text-slate-800 outline-none shadow-sm" />
                    </div>
                  </div>
                </div>
              </div>

              <div className="space-y-10">
                <h3 className="text-[11px] font-bold text-slate-400 uppercase tracking-widest border-b border-slate-50 pb-3 italic">Informations propriétaire</h3>
                <div className="space-y-6">
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest px-1">Nom complet</label>
                    <input name="ownerName" defaultValue={selectedClient?.ownerName} placeholder="Nom & Prénom..." required className="w-full px-5 py-4 bg-slate-50 border border-transparent focus:border-emerald-100 focus:bg-white rounded-2xl font-bold text-slate-800 outline-none transition-all shadow-sm" />
                  </div>
                  <div className="grid grid-cols-2 gap-5">
                    <div className="space-y-1.5">
                      <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest px-1">Téléphone</label>
                      <input name="phone" defaultValue={selectedClient?.phone} placeholder="Ex: 06..." required className="w-full px-5 py-4 bg-slate-50 border border-transparent focus:border-emerald-100 focus:bg-white rounded-2xl font-bold text-slate-800 outline-none transition-all shadow-sm" />
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest px-1">Email</label>
                      <input type="email" name="email" defaultValue={selectedClient?.email} placeholder="contact@..." className="w-full px-5 py-4 bg-slate-50 border border-transparent focus:border-emerald-100 focus:bg-white rounded-2xl font-bold text-slate-800 outline-none transition-all shadow-sm" />
                    </div>
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest px-1">Adresse postale</label>
                    <input name="address" defaultValue={selectedClient?.address} placeholder="Domicile..." className="w-full px-5 py-4 bg-slate-50 border border-transparent focus:border-emerald-100 focus:bg-white rounded-2xl font-bold text-slate-800 outline-none transition-all shadow-sm" />
                  </div>
                  <label className="flex items-center gap-4 px-6 py-5 bg-slate-50 rounded-2xl cursor-pointer hover:bg-white border border-transparent hover:border-emerald-100 transition-all shadow-sm group">
                    <input type="checkbox" name="isProfessional" defaultChecked={selectedClient?.isProfessional} className="w-5 h-5 rounded-lg border-slate-200 text-emerald-600 focus:ring-emerald-200" />
                    <span className="text-xs font-bold text-slate-700 uppercase tracking-tight group-hover:text-emerald-700 transition-colors">Client professionnel</span>
                  </label>
                </div>
              </div>
            </div>

            <div className="space-y-8 mt-16">
              <h3 className="text-[11px] font-bold text-slate-400 uppercase tracking-widest italic px-2">Santé & Comportement</h3>
              <div className="flex flex-wrap gap-2.5">
                {config.particularities.map(p => (
                  <label key={p} className="flex items-center gap-3 px-5 py-3 bg-slate-50 rounded-xl cursor-pointer hover:bg-white border border-transparent hover:border-emerald-100 transition-all shadow-sm group">
                    <input type="checkbox" name="particularities" value={p} defaultChecked={selectedClient?.particularities.includes(p)} className="w-4 h-4 rounded-lg border-slate-200 text-emerald-600 focus:ring-emerald-200" />
                    <span className="text-[11px] font-bold uppercase tracking-wider text-slate-600 group-hover:text-emerald-700 transition-colors">{p}</span>
                  </label>
                ))}
              </div>
            </div>

            <div className="space-y-3 mt-12">
              <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest px-2 italic">Notes confidentielles</label>
              <textarea name="notes" defaultValue={selectedClient?.notes} placeholder="Informations importantes..." rows={4} className="w-full px-6 py-5 bg-slate-50 border border-transparent focus:border-emerald-100 focus:bg-white rounded-3xl text-sm font-medium outline-none h-40 transition-all shadow-inner"></textarea>
            </div>

            <button type="submit" className="w-full mt-12 py-5 bg-slate-900 text-white rounded-3xl font-bold text-sm uppercase tracking-widest shadow-2xl shadow-slate-200 hover:bg-emerald-700 transition-all active:scale-[0.98]">
              Finaliser l'enregistrement
            </button>
          </form>
          </div>
        ) : selectedClient ? (
          <div className="p-8 md:p-12 space-y-16 animate-in fade-in slide-in-from-right-4 duration-500">
            <div className="flex flex-col md:flex-row justify-between items-start gap-8 border-b border-slate-50 pb-12">
               <div className="flex flex-col md:flex-row items-center gap-8 md:gap-12 w-full md:w-auto">
                  <button 
                    onClick={() => setSelectedClient(null)} 
                    className="md:hidden self-start flex items-center gap-2 text-emerald-600 font-bold uppercase text-xs transition-all hover:-translate-x-1"
                  >
                    <ChevronLeft size={16} /> Retour
                  </button>
                  <div className="relative group w-32 h-32 md:w-44 md:h-44 bg-slate-50 rounded-3xl flex items-center justify-center shadow-inner overflow-hidden border-4 border-white shrink-0 shadow-xl group">
                    {selectedClient.photoProfile ? (
                       <div onClick={() => setSelectedPhoto(selectedClient.photoProfile!)} className="w-full h-full cursor-pointer">
                         <PhotoThumbnail imageRef={selectedClient.photoProfile} alt="Profile" />
                       </div>
                    ) : (
                       <User className="text-slate-200" size={60} />
                    )}
                    <label className="absolute inset-0 bg-emerald-900/40 opacity-0 group-hover:opacity-100 flex items-center justify-center cursor-pointer transition-opacity">
                       <Camera className="text-white" size={40} />
                       <input type="file" onChange={handlePetPhotoUpload} className="hidden" accept="image/*" />
                    </label>
                    {selectedClient.photoProfile && (
                      <button onClick={async (e) => {
                        e.stopPropagation();
                        const updatedClient = { ...selectedClient, photoProfile: undefined };
                        await db.saveClient(updatedClient);
                        setSelectedClient(updatedClient);
                        loadClients();
                      }} className="absolute top-3 right-3 p-2 bg-red-500 text-white rounded-full opacity-0 group-hover:opacity-100 transition-opacity hover:bg-red-600 shadow-xl">
                        <Trash2 size={16} />
                      </button>
                    )}
                  </div>
                  <div className="text-center md:text-left">
                    <h2 className="font-serif text-5xl md:text-7xl text-slate-900 italic mb-3">{selectedClient.name}</h2>
                    <div className="flex items-center justify-center md:justify-start gap-6">
                       <p className="text-xs font-bold text-emerald-600 uppercase tracking-widest">{selectedClient.breed} • {selectedClient.species}</p>
                       <span className={`px-4 py-1.5 rounded-full text-[10px] font-bold uppercase tracking-widest shadow-sm ${selectedClient.sex === 'M' ? 'bg-blue-50 text-blue-600 border border-blue-100' : 'bg-rose-50 text-rose-600 border border-rose-100'}`}>
                          {selectedClient.sex === 'M' ? 'Mâle' : 'Femelle'}
                       </span>
                    </div>
                  </div>
               </div>
               <div className="flex gap-3 w-full md:w-auto">
                 <button onClick={async () => {
                   const duplicatedClient = { ...selectedClient, id: generateId(), name: `${selectedClient.name} (Copie)`, createdAt: new Date().toISOString() };
                   await db.saveClient(duplicatedClient);
                   loadClients();
                   setSelectedClient(duplicatedClient);
                   setIsEditing(true);
                 }} className="flex-1 md:flex-none p-5 bg-slate-50 text-slate-400 rounded-2xl hover:text-emerald-600 hover:bg-white border border-slate-50 hover:border-emerald-100 shadow-sm transition-all" title="Dupliquer"><svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="mx-auto"><rect width="14" height="14" x="8" y="8" rx="2" ry="2"/><path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2"/></svg></button>
                 <button onClick={() => setIsEditing(true)} className="flex-1 md:flex-none p-5 bg-slate-50 text-slate-400 rounded-2xl hover:text-emerald-600 hover:bg-white border border-slate-50 hover:border-emerald-100 shadow-sm transition-all" title="Modifier"><Edit3 size={24} className="mx-auto"/></button>
                 <button onClick={handleDeleteClient} className="flex-1 md:flex-none p-5 bg-slate-50 text-rose-300 rounded-2xl hover:text-rose-600 hover:bg-white border border-slate-50 hover:border-rose-100 shadow-sm transition-all" title="Supprimer"><Trash2 size={24} className="mx-auto"/></button>
               </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-16">
               <div className="space-y-16">
                  <section className="space-y-8">
                    <h3 className="text-[11px] font-bold text-slate-400 uppercase tracking-widest border-b border-slate-50 pb-3 italic">Informations de contact</h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                      <div className="p-6 bg-slate-50 rounded-3xl border border-slate-100 group hover:bg-white hover:border-emerald-100 transition-all shadow-sm">
                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-3 opacity-60">Détenteur</p>
                        <p className="font-serif text-xl text-slate-800 italic">{selectedClient.ownerName}</p>
                      </div>
                      <div className="p-6 bg-slate-50 rounded-3xl border border-slate-100 group hover:bg-white hover:border-emerald-100 transition-all shadow-sm">
                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-3 opacity-60">Téléphone</p>
                        <p className="font-bold text-emerald-600 text-lg tabular-nums">{selectedClient.phone}</p>
                      </div>
                      {selectedClient.email && (
                        <div className="p-6 bg-slate-50 rounded-3xl border border-slate-100 col-span-2 group hover:bg-white hover:border-emerald-100 transition-all shadow-sm">
                          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-3 opacity-60">Email</p>
                          <p className="font-bold text-slate-800 text-sm whitespace-nowrap overflow-hidden text-ellipsis lowercase">{selectedClient.email}</p>
                        </div>
                      )}
                      {selectedClient.address && (
                        <div className="p-6 bg-slate-50 rounded-3xl border border-slate-100 col-span-2 group hover:bg-white hover:border-emerald-100 transition-all shadow-sm">
                          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-3 opacity-60">Adresse de résidence</p>
                          <p className="font-medium text-slate-600 text-xs leading-relaxed italic uppercase">{selectedClient.address}</p>
                        </div>
                      )}
                    </div>
                  </section>

                  <section className="space-y-8">
                    <h3 className="text-[11px] font-bold text-amber-600 uppercase tracking-widest border-b border-amber-100 pb-3 italic">Particularités & Santé</h3>
                    <div className="flex flex-wrap gap-2.5">
                        {selectedClient.particularities.map(p => (
                          <span key={p} className="px-4 py-2 bg-amber-50 text-amber-700 text-[10px] font-bold rounded-full uppercase tracking-wider border border-amber-200 shadow-sm">{p}</span>
                        ))}
                        {selectedClient.particularities.length === 0 && <p className="text-xs text-slate-300 font-bold uppercase italic tracking-widest px-2">Aucune particularité enregistrée</p>}
                    </div>
                    {selectedClient.notes && (
                      <div className="p-8 bg-amber-50/40 rounded-3xl border border-amber-200/50 shadow-inner">
                         <p className="text-sm font-medium text-amber-900 italic leading-relaxed text-center">"{selectedClient.notes}"</p>
                      </div>
                    )}
                  </section>
                  
                  <section className="space-y-8">
                    <h3 className="text-[11px] font-bold text-slate-400 uppercase tracking-widest border-b border-slate-50 pb-3 italic">Caractéristiques physiques</h3>
                    <div className="grid grid-cols-2 gap-5">
                       <div className="bg-slate-50 p-6 rounded-3xl border border-slate-100 shadow-sm">
                          <span className="text-[10px] font-bold text-slate-400 uppercase block mb-2">Pelage</span>
                          <span className="text-sm font-bold text-slate-800 uppercase tracking-wide">{selectedClient.coatType}</span>
                       </div>
                       <div className="bg-slate-50 p-6 rounded-3xl border border-slate-100 shadow-sm">
                          <span className="text-[10px] font-bold text-slate-400 uppercase block mb-2">Poids actuel</span>
                          <span className="text-sm font-bold text-slate-800 tabular-nums">{selectedClient.weight} kg</span>
                       </div>
                    </div>
                  </section>
               </div>

               <div className="space-y-12">
                  <h3 className="text-[11px] font-bold text-emerald-600 uppercase tracking-widest border-b border-emerald-50 pb-3 italic flex items-center gap-3"><ImageIcon size={18}/> Album de soins</h3>
                  <div className="space-y-8">
                    {history.length > 0 ? history.map(item => (
                      <div key={item.id} className="p-6 bg-slate-50 rounded-3xl space-y-5 border border-slate-100 hover:bg-white hover:border-emerald-100 transition-all group shadow-sm">
                        <div className="flex justify-between items-center">
                          <p className="font-serif text-lg text-slate-800 italic">{new Date(item.date).toLocaleDateString('fr-FR', { day: '2-digit', month: 'long', year: 'numeric' })}</p>
                          <span className="px-4 py-1.5 bg-white border border-emerald-50 rounded-full text-[10px] font-bold uppercase text-emerald-600 tracking-wider group-hover:bg-emerald-600 group-hover:text-white transition-all shadow-sm">{item.service}</span>
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                           <div className="relative aspect-square bg-white rounded-2xl overflow-hidden border border-slate-100 flex items-center justify-center grayscale hover:grayscale-0 transition-all cursor-pointer shadow-md group/photo" onClick={() => item.photoBefore && setSelectedPhoto(item.photoBefore)}>
                              {item.photoBefore ? <PhotoThumbnail imageRef={item.photoBefore} alt="Avant" /> : <div className="text-[10px] text-slate-300 uppercase font-bold italic tracking-widest">Avant</div>}
                              <div className="absolute top-3 left-3 px-2 py-0.5 bg-black/40 backdrop-blur-sm text-white text-[8px] font-black rounded uppercase tracking-tighter opacity-0 group-hover/photo:opacity-100 transition-opacity">AVANT</div>
                           </div>
                           <div className="relative aspect-square bg-white rounded-2xl overflow-hidden border border-slate-100 flex items-center justify-center grayscale hover:grayscale-0 transition-all cursor-pointer shadow-md group/photo" onClick={() => item.photoAfter && setSelectedPhoto(item.photoAfter)}>
                              {item.photoAfter ? <PhotoThumbnail imageRef={item.photoAfter} alt="Après" /> : <div className="text-[10px] text-slate-300 uppercase font-bold italic tracking-widest">Après</div>}
                              <div className="absolute top-3 left-3 px-2 py-0.5 bg-emerald-600 text-white text-[8px] font-black rounded uppercase tracking-tighter opacity-0 group-hover/photo:opacity-100 transition-opacity">APRÈS</div>
                           </div>
                        </div>
                      </div>
                    )) : (
                      <div className="py-20 text-center border-2 border-dashed border-slate-50 rounded-3xl">
                        <p className="text-xs text-slate-300 font-bold uppercase tracking-widest italic">Aucun historique disponible</p>
                      </div>
                    )}
                  </div>

                  <h3 className="text-[11px] font-bold text-emerald-600 uppercase tracking-widest border-b border-emerald-50 pb-3 italic flex items-center gap-3 mt-16">
                    <Euro size={18}/> Historique factures
                  </h3>
                  <div className="space-y-4">
                    {[...invoices.filter(i => i.clientId === selectedClient.id), ...productInvoices.filter(i => i.clientId === selectedClient.id)]
                       .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
                       .slice(0, 5)
                       .map(inv => {
                         const isProductInvoice = 'items' in inv && !('appointmentId' in inv);
                         return (
                           <div key={inv.id} className="p-5 bg-slate-50 rounded-2xl border border-slate-50 flex justify-between items-center cursor-pointer hover:bg-white hover:border-emerald-100 transition-all group shadow-sm" onClick={() => isProductInvoice ? onPrintProductInvoice(inv as ProductInvoice) : onPrintInvoice(inv as Invoice)}>
                             <div className="flex items-center gap-5">
                               <div className="w-12 h-12 bg-white rounded-xl border border-slate-100 flex items-center justify-center text-slate-400 group-hover:bg-emerald-50 group-hover:text-emerald-600 transition-all shadow-inner">
                                 {isProductInvoice ? <Download size={20} /> : <Euro size={20} />}
                               </div>
                               <div>
                                 <p className="font-bold text-slate-800 text-xs tracking-tight">{inv.number}</p>
                                 <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">{isProductInvoice ? 'Vente Boutique' : 'Prestation'}</p>
                               </div>
                             </div>
                             <div className="flex items-center gap-5">
                                <p className="font-bold text-emerald-600 text-lg tabular-nums">{inv.amount.toFixed(2)}€</p>
                                <ChevronRight size={18} className="text-slate-300 group-hover:text-emerald-600 group-hover:translate-x-1 transition-all" />
                             </div>
                           </div>
                         );
                       })}
                    {([...invoices.filter(i => i.clientId === selectedClient.id), ...productInvoices.filter(i => i.clientId === selectedClient.id)]).length === 0 && (
                      <p className="text-xs text-slate-300 font-bold uppercase italic tracking-widest text-center py-10 border border-slate-50 rounded-2xl">Aucune facture émise</p>
                    )}
                  </div>
               </div>
            </div>
          </div>
        ) : (
          <div className="h-full flex flex-col items-center justify-center text-slate-100 py-60">
            <User size={100} className="mb-8 opacity-10" />
            <p className="font-serif text-2xl italic text-slate-300 opacity-40">Choisissez un compagnon dans la liste</p>
          </div>
        )}
      </div>

      {selectedPhoto && (
        <div className="fixed inset-0 z-[999] bg-slate-900/95 flex flex-col items-center justify-center p-4 backdrop-blur-md">
           <button onClick={() => setSelectedPhoto(null)} className="absolute top-10 right-10 p-5 bg-white/10 text-white rounded-full hover:bg-white/20 transition-all shadow-2xl"><X size={32}/></button>
           <div className="max-w-5xl max-h-[80vh] flex items-center justify-center">
              <img src={selectedPhoto} className="max-w-full max-h-full object-contain rounded-3xl shadow-[0_0_100px_rgba(0,0,0,0.5)]" />
           </div>
           <div className="mt-10 flex gap-4">
              <button onClick={() => downloadImage(selectedPhoto, selectedClient?.name || 'animal')} className="px-12 py-5 bg-indigo-600 text-white rounded-[2rem] font-black flex items-center gap-4 shadow-2xl transition-transform hover:scale-105 active:scale-95 text-lg uppercase tracking-widest">
                 <Download size={28} /> Télécharger
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
      {/* Warning Modal */}
      <WarningModal 
        isOpen={warningState.isOpen}
        title={warningState.title}
        message={warningState.message}
        onClose={() => setWarningState(prev => ({ ...prev, isOpen: false }))}
      />
    </div>
  );
};

export default ClientList;
