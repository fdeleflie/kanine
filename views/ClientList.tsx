
import React, { useState, useEffect } from 'react';
import { 
  Search, Plus, User, Camera, Trash2, Edit3, X, Maximize2, Download, Image as ImageIcon, Euro, 
  ChevronLeft
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
    <div className="flex flex-col lg:flex-row gap-8 h-full min-h-0">
      {/* Sidebar - responsive width and height */}
      <div className={`w-full lg:w-96 flex flex-col gap-4 bg-white p-6 rounded-[2.5rem] shadow-sm border border-slate-100 overflow-hidden ${selectedClient && !isEditing ? 'hidden lg:flex' : 'flex'}`}>
        <div className="flex gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300" size={18} />
            <input type="text" placeholder="Rechercher..." className="w-full pl-12 pr-4 py-3 bg-slate-50 rounded-2xl text-sm font-bold outline-none border border-transparent focus:border-indigo-100" value={search} onChange={e => setSearch(e.target.value)} />
          </div>
          <button onClick={() => { setSelectedClient(null); setIsEditing(true); setFormSpecies('Chien'); setHistory([]); setFormPhotoProfile(undefined); }} className="p-3 bg-indigo-600 text-white rounded-2xl shadow-lg shadow-indigo-100 hover:scale-105 transition-all"><Plus size={24} /></button>
        </div>
        <div className="flex-1 overflow-y-auto space-y-3 pr-2 scrollbar-thin scrollbar-thumb-slate-200">
          {filteredClients.map(client => (
            <button key={client.id} onClick={() => { setSelectedClient(client); setIsEditing(false); setFormSpecies(client.species); setFormPhotoProfile(client.photoProfile); loadHistory(client.id); }} className={`w-full text-left p-5 rounded-2xl transition-all border-2 ${selectedClient?.id === client.id ? 'bg-indigo-50 border-indigo-200' : 'bg-white border-transparent hover:bg-slate-50'}`}>
              <h4 className="font-black text-slate-800 uppercase tracking-tighter italic whitespace-nowrap overflow-hidden text-ellipsis">{client.name}</h4>
              <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest truncate">{client.ownerName} • {client.species}</p>
            </button>
          ))}
          {filteredClients.length === 0 && (
            <div className="py-10 text-center text-slate-300 font-black uppercase text-[10px] tracking-widest">
              Aucun résultat
            </div>
          )}
        </div>
      </div>

      {/* Main Content Area */}
      <div className={`flex-1 bg-white rounded-[2.5rem] md:rounded-[3.5rem] shadow-sm border border-slate-100 overflow-y-auto relative ${!selectedClient && !isEditing ? 'hidden lg:block' : 'block'}`}>
        {isEditing ? (
          <div className="p-6 md:p-10">
            <div className="flex justify-between items-center mb-10">
              <h2 className="text-2xl md:text-3xl font-black text-slate-900 uppercase tracking-tighter italic">{selectedClient ? 'Modifier Client' : 'Nouveau Client'}</h2>
              <button type="button" onClick={() => setIsEditing(false)} className="p-3 text-slate-300 hover:bg-slate-100 rounded-2xl transition-colors"><X size={24}/></button>
            </div>
            
            <form onSubmit={handleSaveClient} className="space-y-10">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
              <div className="space-y-6">
                <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-widest border-b pb-2">Animal</h3>
                <div className="flex items-center gap-6 mb-4">
                  <div className="relative w-24 h-24 bg-slate-100 rounded-3xl flex items-center justify-center overflow-hidden border-2 border-slate-200">
                    {formPhotoProfile ? (
                      <PhotoThumbnail imageRef={formPhotoProfile} alt="Profile" />
                    ) : (
                      <Camera className="text-slate-400" size={32} />
                    )}
                    <input type="file" name="photoProfile" onChange={handleFormPhotoUpload} className="absolute inset-0 opacity-0 cursor-pointer" accept="image/*" />
                  </div>
                  <div className="text-xs font-bold text-slate-500 uppercase tracking-widest">
                    Photo de profil<br/>(Optionnel)
                  </div>
                </div>
                <div className="space-y-4">
                  <input name="name" defaultValue={selectedClient?.name} placeholder="Nom de l'animal" required className="w-full px-6 py-4 bg-slate-50 border border-slate-100 rounded-2xl font-black text-slate-800 outline-none" />
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1">
                      <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1">Espèce</label>
                      <select name="species" value={formSpecies} onChange={e => setFormSpecies(e.target.value)} required className="w-full px-6 py-4 bg-slate-50 border border-slate-100 rounded-2xl font-black text-slate-800">
                        {config.species.map(s => <option key={s} value={s}>{s}</option>)}
                      </select>
                    </div>
                    <div className="space-y-1">
                      <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1">Race</label>
                      <select name="breed" defaultValue={selectedClient?.breed} required className="w-full px-6 py-4 bg-slate-50 border border-slate-100 rounded-2xl font-black text-slate-800">
                        {(config.breeds[formSpecies] || ["Autre"]).map(b => <option key={b} value={b}>{b}</option>)}
                      </select>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1">
                      <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1">Sexe</label>
                      <select name="sex" defaultValue={selectedClient?.sex || 'M'} required className="w-full px-6 py-4 bg-slate-50 border border-slate-100 rounded-2xl font-black text-slate-800">
                        <option value="M">Mâle</option>
                        <option value="F">Femelle</option>
                      </select>
                    </div>
                    <div className="space-y-1">
                      <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1">Poids (kg)</label>
                      <input type="number" name="weight" defaultValue={selectedClient?.weight} placeholder="Poids" className="w-full px-6 py-4 bg-slate-50 border border-slate-100 rounded-2xl font-black text-slate-800" />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1">
                      <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1">Type de poil</label>
                      <select name="coatType" defaultValue={selectedClient?.coatType} required className="w-full px-6 py-4 bg-slate-50 border border-slate-100 rounded-2xl font-black text-slate-800">
                        {config.coatTypes.map(c => <option key={c} value={c}>{c}</option>)}
                      </select>
                    </div>
                    <div className="space-y-1">
                      <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1">Date de naissance</label>
                      <input type="date" name="birthDate" defaultValue={selectedClient?.birthDate} className="w-full px-6 py-4 bg-slate-50 border border-slate-100 rounded-2xl font-black text-slate-800" />
                    </div>
                  </div>
                </div>
              </div>

              <div className="space-y-6">
                <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-widest border-b pb-2">Propriétaire</h3>
                <div className="space-y-4">
                  <input name="ownerName" defaultValue={selectedClient?.ownerName} placeholder="Nom Complet" required className="w-full px-6 py-4 bg-slate-50 border border-slate-100 rounded-2xl font-black text-slate-800" />
                  <div className="grid grid-cols-2 gap-4">
                    <input name="phone" defaultValue={selectedClient?.phone} placeholder="Téléphone" required className="w-full px-6 py-4 bg-slate-50 border border-slate-100 rounded-2xl font-black text-slate-800" />
                    <input type="email" name="email" defaultValue={selectedClient?.email} placeholder="Email" className="w-full px-6 py-4 bg-slate-50 border border-slate-100 rounded-2xl font-black text-slate-800" />
                  </div>
                  <input name="address" defaultValue={selectedClient?.address} placeholder="Adresse" className="w-full px-6 py-4 bg-slate-50 border border-slate-100 rounded-2xl font-black text-slate-800" />
                  <label className="flex items-center gap-3 px-5 py-3 bg-slate-50 rounded-2xl cursor-pointer hover:bg-indigo-50 border border-transparent hover:border-indigo-100 transition-all">
                    <input type="checkbox" name="isProfessional" defaultChecked={selectedClient?.isProfessional} className="w-5 h-5 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500" />
                    <span className="text-xs font-black uppercase tracking-widest text-slate-700">Client Professionnel</span>
                  </label>
                </div>
              </div>
            </div>

            <div className="space-y-4">
              <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1">Particularités</h3>
              <div className="flex flex-wrap gap-3">
                {config.particularities.map(p => (
                  <label key={p} className="flex items-center gap-3 px-5 py-3 bg-slate-50 rounded-2xl cursor-pointer hover:bg-indigo-50 border border-transparent hover:border-indigo-100 transition-all">
                    <input type="checkbox" name="particularities" value={p} defaultChecked={selectedClient?.particularities.includes(p)} className="w-5 h-5 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500" />
                    <span className="text-xs font-black uppercase tracking-widest text-slate-700">{p}</span>
                  </label>
                ))}
              </div>
            </div>

            <textarea name="notes" defaultValue={selectedClient?.notes} placeholder="Notes et recommandations médicales ou comportementales..." rows={4} className="w-full px-6 py-4 bg-slate-50 border border-slate-100 rounded-2xl text-sm font-medium outline-none h-32"></textarea>

            <button type="submit" className="w-full py-6 bg-slate-900 text-white rounded-[2rem] font-black text-xl uppercase tracking-widest shadow-2xl hover:bg-slate-800 transition-all active:scale-[0.98]">Enregistrer la Fiche</button>
          </form>
          </div>
        ) : selectedClient ? (
          <div className="p-6 md:p-10 space-y-12">
            <div className="flex flex-col md:flex-row justify-between items-start gap-4">
               <div className="flex flex-col md:flex-row items-center gap-6 md:gap-8 w-full md:w-auto">
                  <button 
                    onClick={() => setSelectedClient(null)} 
                    className="md:hidden self-start flex items-center gap-2 text-indigo-600 font-black uppercase text-xs tracking-widest mb-4 transition-all hover:translate-x-[-4px]"
                  >
                    <ChevronLeft size={16} /> Retour à la liste
                  </button>
                  <div className="relative group w-24 h-24 md:w-32 md:h-32 bg-indigo-50 rounded-[2.5rem] md:rounded-[3rem] flex items-center justify-center shadow-inner overflow-hidden border-4 border-white shrink-0">
                    {selectedClient.photoProfile ? (
                       <div onClick={() => setSelectedPhoto(selectedClient.photoProfile!)} className="w-full h-full cursor-pointer">
                         <PhotoThumbnail imageRef={selectedClient.photoProfile} alt="Profile" />
                       </div>
                    ) : (
                       <User className="text-indigo-200" size={50} />
                    )}
                    <label className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center cursor-pointer transition-opacity">
                       <Camera className="text-white" size={32} />
                       <input type="file" onChange={handlePetPhotoUpload} className="hidden" accept="image/*" />
                    </label>
                    {selectedClient.photoProfile && (
                      <button onClick={async (e) => {
                        e.stopPropagation();
                        const updatedClient = { ...selectedClient, photoProfile: undefined };
                        await db.saveClient(updatedClient);
                        setSelectedClient(updatedClient);
                        loadClients();
                      }} className="absolute top-2 right-2 p-1.5 bg-red-500 text-white rounded-full opacity-0 group-hover:opacity-100 transition-opacity hover:bg-red-600 shadow-lg">
                        <Trash2 size={14} />
                      </button>
                    )}
                  </div>
                  <div>
                    <h2 className="text-5xl font-black text-slate-900 leading-tight uppercase tracking-tighter italic">{selectedClient.name}</h2>
                    <p className="text-sm font-black text-indigo-600 uppercase tracking-[0.3em]">{selectedClient.breed} • {selectedClient.species}</p>
                  </div>
               </div>
               <div className="flex gap-3">
                 <button onClick={async () => {
                   const duplicatedClient = { ...selectedClient, id: generateId(), name: `${selectedClient.name} (Copie)`, createdAt: new Date().toISOString() };
                   await db.saveClient(duplicatedClient);
                   loadClients();
                   setSelectedClient(duplicatedClient);
                   setIsEditing(true);
                 }} className="p-4 bg-slate-50 text-slate-600 rounded-[1.5rem] hover:bg-indigo-50 transition-all" title="Dupliquer"><svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="lucide lucide-copy"><rect width="14" height="14" x="8" y="8" rx="2" ry="2"/><path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2"/></svg></button>
                 <button onClick={() => setIsEditing(true)} className="p-4 bg-slate-50 text-slate-600 rounded-[1.5rem] hover:bg-indigo-50 transition-all" title="Modifier"><Edit3 size={24}/></button>
                 <button onClick={handleDeleteClient} className="p-4 bg-slate-50 text-red-400 rounded-[1.5rem] hover:bg-red-50 transition-all" title="Supprimer"><Trash2 size={24}/></button>
               </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-12">
               <div className="space-y-10">
                  <section className="space-y-4">
                    <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-widest border-b pb-2">Informations Générales</h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <div className="p-6 bg-slate-50 rounded-3xl border border-slate-100">
                        <p className="text-[10px] font-black text-slate-400 uppercase mb-2">Propriétaire</p>
                        <p className="font-black text-slate-800 uppercase tracking-tighter">{selectedClient.ownerName}</p>
                      </div>
                      <div className="p-6 bg-slate-50 rounded-3xl border border-slate-100">
                        <p className="text-[10px] font-black text-slate-400 uppercase mb-2">Contact</p>
                        <p className="font-black text-slate-800 tracking-tighter">{selectedClient.phone}</p>
                      </div>
                    </div>
                  </section>
                  <section className="space-y-4">
                    <h3 className="text-[10px] font-black text-amber-500 uppercase tracking-widest border-b pb-2">Observations / Santé</h3>
                    <div className="flex flex-wrap gap-2">
                        {selectedClient.particularities.map(p => (
                          <span key={p} className="px-4 py-2 bg-amber-50 text-amber-700 text-[10px] font-black rounded-xl uppercase tracking-widest border border-amber-100">{p}</span>
                        ))}
                    </div>
                    {selectedClient.notes && (
                      <div className="p-6 bg-slate-50 rounded-3xl border border-slate-100">
                         <p className="text-sm font-medium text-slate-600 italic leading-relaxed">"{selectedClient.notes}"</p>
                      </div>
                    )}
                  </section>
               </div>

               <div className="space-y-6">
                  <h3 className="text-[10px] font-black text-indigo-400 uppercase tracking-widest border-b pb-2 flex items-center gap-2"><ImageIcon size={16}/> Album de Soins</h3>
                  <div className="space-y-6">
                    {history.length > 0 ? history.map(item => (
                      <div key={item.id} className="p-6 bg-slate-50 rounded-[2rem] space-y-5 border border-slate-100">
                        <div className="flex justify-between items-center">
                          <p className="text-xs font-black text-slate-900 tracking-widest">{new Date(item.date).toLocaleDateString('fr-FR', { day: '2-digit', month: 'long', year: 'numeric' })}</p>
                          <span className="px-4 py-1.5 bg-white border border-indigo-100 rounded-full text-[9px] font-black uppercase text-indigo-600 tracking-widest">{item.service}</span>
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                           <div className="aspect-square bg-white rounded-2xl overflow-hidden border border-slate-200 flex items-center justify-center">
                              {item.photoBefore ? <PhotoThumbnail imageRef={item.photoBefore} alt="Avant" /> : <div className="text-[10px] text-slate-300 uppercase font-black">Avant</div>}
                           </div>
                           <div className="aspect-square bg-white rounded-2xl overflow-hidden border border-slate-200 flex items-center justify-center">
                              {item.photoAfter ? <PhotoThumbnail imageRef={item.photoAfter} alt="Après" /> : <div className="text-[10px] text-slate-300 uppercase font-black">Après</div>}
                           </div>
                        </div>
                      </div>
                    )) : (
                      <div className="p-10 text-center border-2 border-dashed border-slate-100 rounded-[2rem]">
                        <p className="text-[10px] font-black text-slate-300 uppercase tracking-[0.2em]">Aucun soin enregistré</p>
                      </div>
                    )}
                  </div>

                  <h3 className="text-[10px] font-black text-emerald-500 uppercase tracking-widest border-b pb-2 flex items-center gap-2 mt-10">
                    <Euro size={16}/> Factures
                  </h3>
                  <div className="space-y-4">
                    {[...invoices.filter(i => i.clientId === selectedClient.id), ...productInvoices.filter(i => i.clientId === selectedClient.id)]
                       .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
                       .map(inv => {
                         const isProductInvoice = 'items' in inv && !('appointmentId' in inv);
                         return (
                           <div key={inv.id} className="p-4 bg-slate-50 rounded-2xl border border-slate-100 flex justify-between items-center cursor-pointer hover:bg-indigo-50 transition-colors" onClick={() => isProductInvoice ? onPrintProductInvoice(inv as ProductInvoice) : onPrintInvoice(inv as Invoice)}>
                             <div>
                               <p className="font-black text-slate-800 text-sm">{inv.number}</p>
                               <p className="text-[10px] text-slate-500 uppercase font-bold">{isProductInvoice ? 'Vente Produits' : 'Soin Toilettage'}</p>
                             </div>
                             <p className="font-black text-emerald-600">{(inv.amount || 0).toFixed(2)}€</p>
                           </div>
                         );
                       })}
                  </div>
               </div>
            </div>
          </div>
        ) : (
          <div className="h-full flex flex-col items-center justify-center text-slate-200 py-40">
            <User size={120} className="opacity-10 mb-6" />
            <h3 className="text-2xl font-black uppercase tracking-tighter">Sélectionnez un client</h3>
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
