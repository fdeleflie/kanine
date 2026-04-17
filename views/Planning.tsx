
import React, { useState, useEffect } from 'react';
import { db } from '../services/database';
import { Appointment, Client, Invoice } from '../types';
import { 
  Calendar as CalendarIcon, 
  Clock, 
  ChevronLeft, 
  ChevronRight, 
  Trash2, 
  Plus, 
  Euro, 
  AlertTriangle,
  X,
  Edit,
  Printer
} from 'lucide-react';

import { ConfirmModal } from '../components/ConfirmModal';
import { WarningModal } from '../components/WarningModal';
import { PhotoThumbnail } from '../components/PhotoThumbnail';
import { compressImage } from '../utils/imageCompression';

const generateId = () => Math.random().toString(36).substring(2, 15) + Date.now().toString(36);

interface PlanningProps {
  onPrintInvoice?: (invoice: Invoice) => void;
  user?: any;
}

const Planning: React.FC<PlanningProps> = ({ onPrintInvoice, user }) => {
  const [view, setView] = useState<'day' | 'month' | 'year' | 'upcoming' | 'past'>('month');
  const [currentDate, setCurrentDate] = useState(new Date());
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isInvoiceModalOpen, setIsInvoiceModalOpen] = useState(false);
  const [selectedAppt, setSelectedAppt] = useState<Appointment | null>(null);
  const [editingAppt, setEditingAppt] = useState<Appointment | null>(null);
  
  const [invoiceAmount, setInvoiceAmount] = useState('50');
  const [invoiceDate, setInvoiceDate] = useState(new Date().toISOString().split('T')[0]);
  const [invoiceNotes, setInvoiceNotes] = useState('');
  const [invoiceService, setInvoiceService] = useState('');
  const [isCustomService, setIsCustomService] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState<Invoice['paymentMethod']>('Carte');
  const [confirmState, setConfirmState] = useState<{isOpen: boolean, title: string, message: string, onConfirm: () => void}>({
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

  const config = db.getConfig();

  const refreshData = async () => {
    setAppointments(await db.getAppointments());
    setClients(await db.getClients());
  };

  useEffect(() => {
    refreshData();
  }, [user]);

  const formatDate = (date: Date) => date.toISOString().split('T')[0];
  const dateStr = formatDate(currentDate);

  const getDaysInMonth = (date: Date) => {
    const year = date.getFullYear();
    const month = date.getMonth();
    const firstDay = new Date(year, month, 1).getDay();
    // Monday start adjust (0 is Sunday)
    const adjustedFirstDay = firstDay === 0 ? 6 : firstDay - 1;
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    return { adjustedFirstDay, daysInMonth };
  };

  const checkOverlap = (date: string, time: string, duration: number, excludeId?: string) => {
    const newStart = new Date(`${date}T${time}`).getTime();
    const newEnd = newStart + duration * 60000;

    return appointments.find(appt => {
      if (appt.id === excludeId) return false;
      if (appt.date !== date || appt.status === 'cancelled') return false;
      const existStart = new Date(`${appt.date}T${appt.time}`).getTime();
      const existEnd = existStart + (appt.duration || 60) * 60000;
      return (newStart < existEnd && newEnd > existStart);
    });
  };

  const handleSaveAppt = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const clientId = formData.get('client') as string;
    if (!clientId) return;
    
    const client = clients.find(c => c.id === clientId);
    if (!client) return;

    const date = formData.get('date') as string;
    const time = formData.get('time') as string;
    const duration = parseInt(formData.get('duration') as string);
    const id = editingAppt ? editingAppt.id : generateId();

    // BLOCAGE DÉFINITIF DES DOUBLONS
    const conflict = checkOverlap(date, time, duration, id);
    if (conflict) {
      setWarningState({
        isOpen: true,
        title: "Conflit détecté",
        message: `Déjà un rendez-vous sur ce créneau horaire pour ${conflict.petName} à ${conflict.time} (durée ${conflict.duration}min). Veuillez choisir un autre créneau.`
      });
      return; // Stop l'enregistrement
    }

    const newAppt: Appointment = {
      id,
      date,
      time,
      clientId: client.id,
      clientName: client.ownerName,
      petName: client.name,
      services: Array.from(formData.getAll('services')) as string[],
      notes: formData.get('notes') as string,
      duration,
      status: editingAppt ? editingAppt.status : 'pending',
      photoBefore: editingAppt?.photoBefore,
      photoAfter: editingAppt?.photoAfter
    };

    if (await db.saveAppointment(newAppt)) {
      refreshData();
      setIsModalOpen(false);
      setEditingAppt(null);
    } else {
      setWarningState({
        isOpen: true,
        title: "Mémoire Saturée",
        message: "Impossible d'enregistrer le rendez-vous. L'espace de stockage est plein."
      });
    }
  };

  const handleConfirmInvoice = async () => {
    if (!selectedAppt) return;
    const finalServices = invoiceService ? invoiceService.split(',').map(s => s.trim()).filter(Boolean) : ((selectedAppt.services && Array.isArray(selectedAppt.services)) ? selectedAppt.services : ((selectedAppt as any).service ? [(selectedAppt as any).service] : []));
    const newInvoice: Invoice = {
      id: generateId(),
      number: db.getNextInvoiceNumber(invoiceDate),
      date: invoiceDate,
      clientId: selectedAppt.clientId,
      petName: selectedAppt.petName,
      ownerName: selectedAppt.clientName,
      amount: parseFloat(invoiceAmount),
      paymentMethod,
      appointmentId: selectedAppt.id,
      notes: invoiceNotes || selectedAppt.notes,
      items: finalServices.map(s => ({ description: s, amount: parseFloat(invoiceAmount) / finalServices.length })),
      dueDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
      isProfessional: clients.find(c => c.id === selectedAppt.clientId)?.isProfessional
    };
    db.saveInvoice(newInvoice);
    await db.saveAppointment({ ...selectedAppt, status: 'invoiced' });
    refreshData();
    setIsInvoiceModalOpen(false);
    setConfirmState({
      isOpen: true,
      title: "Facture émise",
      message: "La facture a bien été générée. Voulez-vous l'imprimer maintenant ?",
      onConfirm: () => {
        onPrintInvoice?.(newInvoice);
      }
    });
  };

  const { adjustedFirstDay, daysInMonth } = getDaysInMonth(currentDate);
  const calendarDays = [];
  
  // Remplissage des cases vides au début
  for (let i = 0; i < adjustedFirstDay; i++) calendarDays.push(null);
  // Jours du mois
  for (let i = 1; i <= daysInMonth; i++) calendarDays.push(i);
  // Remplissage jusqu'à 42 pour avoir 6 lignes complètes systématiquement
  while (calendarDays.length < 42) calendarDays.push(null);

  return (
    <div className="space-y-6 animate-in fade-in duration-500 max-w-[1600px] mx-auto pb-10">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-white p-5 rounded-2xl shadow-sm border border-slate-100">
        <div className="flex items-center gap-6">
          <div className="flex bg-slate-50 p-1 rounded-xl font-bold border border-slate-100 shadow-inner">
            <button onClick={() => setView('day')} className={`px-5 py-2 rounded-lg text-xs transition-all ${view === 'day' ? 'bg-white shadow-sm text-emerald-600 border border-emerald-50' : 'text-slate-400 hover:text-slate-600'}`}>Jour</button>
            <button onClick={() => setView('upcoming')} className={`px-5 py-2 rounded-lg text-xs transition-all ${view === 'upcoming' ? 'bg-white shadow-sm text-emerald-600 border border-emerald-50' : 'text-slate-400 hover:text-slate-600'}`}>À venir</button>
            <button onClick={() => setView('past')} className={`px-5 py-2 rounded-lg text-xs transition-all ${view === 'past' ? 'bg-white shadow-sm text-emerald-600 border border-emerald-50' : 'text-slate-400 hover:text-slate-600'}`}>Historique</button>
          </div>
          
          {view === 'day' && (
            <div className="flex items-center gap-3">
              <button 
                onClick={() => {
                  const d = new Date(currentDate);
                  d.setDate(d.getDate() - 1);
                  setCurrentDate(d);
                }}
                className="p-2 text-slate-400 hover:text-emerald-600 bg-slate-50 rounded-xl transition-colors border border-slate-100 shadow-sm"
              >
                <ChevronLeft size={16} />
              </button>
              <h2 className="font-serif text-xl text-slate-800 italic px-2">{new Date(dateStr).toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' })}</h2>
              <button 
                onClick={() => {
                  const d = new Date(currentDate);
                  d.setDate(d.getDate() + 1);
                  setCurrentDate(d);
                }}
                className="p-2 text-slate-400 hover:text-emerald-600 bg-slate-50 rounded-xl transition-colors border border-slate-100 shadow-sm"
              >
                <ChevronRight size={16} />
              </button>
            </div>
          )}
        </div>

        <button 
          onClick={() => {
            setEditingAppt(null);
            setIsModalOpen(true);
          }}
          className="px-6 py-3 bg-slate-900 text-white rounded-xl font-bold text-xs tracking-tight hover:bg-emerald-700 transition-all flex items-center gap-2 shadow-xl shadow-slate-200"
        >
          <Plus size={16} /> Nouveau rendez-vous
        </button>
      </div>

      {view === 'day' ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
          <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100 h-fit lg:col-span-1">
            <h3 className="font-serif text-lg text-slate-700 mb-6">Agenda du jour</h3>
            <div className="space-y-1">
              {['08:00', '09:00', '10:00', '11:00', '12:00', '13:00', '14:00', '15:00', '16:00', '17:00' , '18:00', '19:00'].map(t => {
                const appts = appointments.filter(a => a.date === dateStr && a.time.startsWith(t.substring(0, 2)));
                return (
                  <div key={t} className="flex gap-4 min-h-[50px] border-b border-slate-50 last:border-0 py-2">
                    <span className="text-[10px] font-bold text-slate-300 w-10 py-1 tabular-nums">{t}</span>
                    <div className="flex-1 space-y-2">
                      {appts.map(a => (
                        <div key={a.id} className="bg-emerald-50/50 border border-emerald-100/50 p-3 rounded-xl flex justify-between items-center group cursor-pointer hover:bg-white hover:border-emerald-200 transition-all hover:shadow-sm" onClick={() => { setEditingAppt(a); setIsModalOpen(true); }}>
                          <div className="min-w-0">
                             <p className="text-sm font-bold text-emerald-900">{a.petName}</p>
                             <p className="text-[10px] text-emerald-500 font-medium tabular-nums">{a.time}</p>
                          </div>
                          <Edit size={12} className="text-emerald-300 opacity-0 group-hover:opacity-100 shrink-0" />
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
          
          <div className="lg:col-span-2 space-y-4">
            <h3 className="font-serif text-lg text-slate-700 px-2 italic">Détails des prestations</h3>
            {appointments
              .filter(a => a.date === dateStr)
              .sort((a, b) => a.time.localeCompare(b.time))
              .map(appt => (
                <div key={appt.id} className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm flex flex-col gap-5 hover:shadow-md transition-shadow">
                  <div className="flex justify-between items-start">
                    <div className="flex items-center gap-4">
                      <div className="w-12 h-12 bg-[#06281e] text-white rounded-xl flex items-center justify-center font-bold text-sm shadow-inner tabular-nums">
                        {appt.time}
                      </div>
                      <div>
                        <h4 className="font-serif text-xl text-slate-900 leading-tight">{appt.petName}</h4>
                        <p className="text-xs font-medium text-slate-400">{appt.clientName}</p>
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <button onClick={() => { setEditingAppt(appt); setIsModalOpen(true); }} className="p-2.5 text-slate-400 hover:text-emerald-600 hover:bg-emerald-50 rounded-xl transition-all"><Edit size={18}/></button>
                      <button onClick={() => {
                        setConfirmState({
                          isOpen: true,
                          title: "Supprimer",
                          message: "Voulez-vous supprimer ce rendez-vous ?",
                          onConfirm: async () => {
                            await db.deleteAppointment(appt.id);
                            refreshData();
                            setConfirmState(prev => ({ ...prev, isOpen: false }));
                          }
                        });
                      }} className="p-2.5 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-xl transition-all"><Trash2 size={18}/></button>
                    </div>
                  </div>

                  <div className="flex flex-wrap gap-2">
                     <span className="px-3 py-1 bg-emerald-50 text-emerald-700 text-[10px] font-bold rounded-full border border-emerald-100">
                        {(appt.services && Array.isArray(appt.services)) ? appt.services.join(', ') : ((appt as any).service || 'Service')}
                     </span>
                     <span className="px-3 py-1 bg-slate-50 text-slate-500 text-[10px] font-bold rounded-full border border-slate-100">
                        {appt.duration} MIN
                     </span>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="bg-slate-50 rounded-2xl p-3 flex flex-col items-center shadow-inner border border-slate-100/50">
                       <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2 cursor-pointer hover:text-emerald-600 transition-colors">
                          Avant le soin
                          <input type="file" className="hidden" accept="image/*" onChange={async (e) => {
                             const file = e.target.files?.[0]; if (!file) return;
                             const compressed = await compressImage(file);
                             await db.saveAppointment({ ...appt, photoBefore: compressed });
                             refreshData();
                          }} />
                       </label>
                       <div className="w-full aspect-square bg-white rounded-xl shadow-sm border border-slate-100 overflow-hidden">
                          <PhotoThumbnail imageRef={appt.photoBefore} />
                       </div>
                    </div>
                    <div className="bg-slate-50 rounded-2xl p-3 flex flex-col items-center shadow-inner border border-slate-100/50">
                       <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2 cursor-pointer hover:text-emerald-600 transition-colors">
                          Après le soin
                          <input type="file" className="hidden" accept="image/*" onChange={async (e) => {
                             const file = e.target.files?.[0]; if (!file) return;
                             const compressed = await compressImage(file);
                             await db.saveAppointment({ ...appt, photoAfter: compressed });
                             refreshData();
                          }} />
                       </label>
                       <div className="w-full aspect-square bg-white rounded-xl shadow-sm border border-slate-100 overflow-hidden">
                          <PhotoThumbnail imageRef={appt.photoAfter} />
                       </div>
                    </div>
                  </div>

                  <div className="pt-2">
                    {appt.status !== 'invoiced' ? (
                      <button onClick={() => { 
                        setSelectedAppt(appt); 
                        setInvoiceAmount('50'); 
                        setInvoiceDate(new Date().toISOString().split('T')[0]);
                        setInvoiceService((appt.services && Array.isArray(appt.services)) ? appt.services.join(', ') : ((appt as any).service || ''));
                        setIsCustomService(false);
                        setIsInvoiceModalOpen(true); 
                      }} className="w-full flex items-center justify-center gap-3 py-3.5 bg-emerald-600 text-white rounded-xl text-xs font-bold hover:bg-emerald-700 transition-all shadow-lg shadow-emerald-100">
                        <Euro size={16} /> Facturer la prestation
                      </button>
                    ) : (
                      <div className="flex items-center justify-between p-3 bg-emerald-50 rounded-xl border border-emerald-100 transition-all">
                         <span className="text-[10px] font-bold text-emerald-700 uppercase tracking-tight">Règlement complété</span>
                         <button onClick={() => { const inv = db.getInvoices().find(i => i.appointmentId === appt.id); if(inv) onPrintInvoice?.(inv); }} className="p-2 bg-white text-emerald-600 rounded-lg hover:bg-emerald-600 hover:text-white transition-all shadow-sm"><Printer size={18} /></button>
                      </div>
                    )}
                  </div>
                </div>
              ))}
          </div>
        </div>
      ) : (
        <div className="max-w-4xl mx-auto space-y-3 pb-10">
          {appointments
            .filter(a => {
              if (view === 'upcoming') return a.date >= formatDate(new Date());
              if (view === 'past') return a.date < formatDate(new Date());
              return true;
            })
            .sort((a, b) => view === 'past' ? b.date.localeCompare(a.date) || b.time.localeCompare(a.time) : a.date.localeCompare(b.date) || a.time.localeCompare(b.time))
            .map(appt => (
              <div key={appt.id} className="flex flex-col md:flex-row md:items-center gap-6 p-5 rounded-2xl border border-slate-100 bg-white hover:border-emerald-100 transition-all shadow-sm group relative overflow-hidden active:scale-[0.99] cursor-pointer" onClick={() => { setEditingAppt(appt); setIsModalOpen(true); }}>
                <div className="w-20 text-center border-r border-slate-50 pr-5 shrink-0">
                  <p className="font-serif text-[11px] text-emerald-600 italic mb-0.5">{new Date(appt.date).toLocaleDateString('fr-FR', { weekday: 'short', day: 'numeric' })}</p>
                  <p className="text-lg font-bold text-slate-800 tabular-nums">{appt.time}</p>
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-3 mb-1">
                    <h4 className="font-serif text-lg text-slate-900 leading-none">{appt.petName}</h4>
                    <span className="px-2.5 py-0.5 bg-slate-50 text-slate-500 text-[10px] font-bold rounded-full border border-slate-100 truncate max-w-[150px]">
                      {(appt.services && Array.isArray(appt.services)) ? appt.services.join(', ') : ((appt as any).service || 'N/A')}
                    </span>
                  </div>
                  <p className="text-xs text-slate-400 font-medium flex items-center gap-2 tracking-tight flex-wrap lowercase italic">
                    <Clock size={10}/> {appt.duration}min • {appt.clientName}
                    {(() => {
                      const client = clients.find(c => c.id === appt.clientId);
                      return client ? ` • ${client.species} (${client.breed})` : '';
                    })()}
                  </p>
                </div>
                
                <div className="flex items-center gap-3 shrink-0" onClick={e => e.stopPropagation()}>
                  {appt.status !== 'invoiced' ? (
                    <button onClick={() => { 
                      setSelectedAppt(appt); 
                      setInvoiceAmount('50'); 
                      setInvoiceService((appt.services && Array.isArray(appt.services)) ? appt.services.join(', ') : ((appt as any).service || ''));
                      setIsCustomService(false);
                      setIsInvoiceModalOpen(true); 
                    }} className="flex items-center gap-2 px-4 py-2 bg-emerald-600 text-white rounded-xl text-[10px] font-bold hover:bg-emerald-700 shadow-lg shadow-emerald-50 transition-all">
                      <Euro size={12} /> Facturer
                    </button>
                  ) : (
                    <div className="flex items-center gap-3">
                       <span className="text-[10px] font-bold text-emerald-600 bg-emerald-50 px-3 py-1 rounded-full border border-emerald-100 italic">Payé</span>
                       <button onClick={() => { const inv = db.getInvoices().find(i => i.appointmentId === appt.id); if(inv) onPrintInvoice?.(inv); }} className="p-2 bg-slate-50 text-slate-400 rounded-xl hover:bg-emerald-600 hover:text-white transition-all shadow-sm"><Printer size={18} /></button>
                    </div>
                  )}
                  <button onClick={() => { setEditingAppt(appt); setIsModalOpen(true); }} className="p-2.5 bg-slate-50 text-slate-300 rounded-xl hover:text-emerald-600 hover:bg-emerald-50 transition-all"><Edit size={18}/></button>
                </div>
              </div>
            ))}
        </div>
      )}

      {/* Modal Nouveau/Modifier RDV */}
      {isModalOpen && (
        <div className="fixed inset-0 z-[100] bg-slate-900/40 backdrop-blur-md flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-lg rounded-3xl shadow-2xl overflow-hidden border border-slate-100">
            <form key={editingAppt?.id || 'new'} onSubmit={handleSaveAppt} className="p-8 space-y-6">
              <div className="flex justify-between items-center mb-2">
                <h2 className="font-serif text-2xl text-slate-800 italic">{editingAppt ? 'Modifier le rendez-vous' : 'Prendre rendez-vous'}</h2>
                <button type="button" onClick={() => { setIsModalOpen(false); setEditingAppt(null); }} className="p-2 hover:bg-slate-50 rounded-full transition-colors"><X size={24}/></button>
              </div>

              <div className="space-y-5">
                <div className="space-y-1.5">
                  <label className="text-[11px] font-bold text-slate-400 uppercase tracking-widest px-1">Choix du client</label>
                  <select name="client" required defaultValue={editingAppt?.clientId || ''} className="w-full px-5 py-3.5 bg-slate-50 border border-slate-100 rounded-2xl font-medium text-sm text-slate-800 outline-none focus:ring-2 ring-emerald-100 transition-all shadow-inner">
                    <option value="">Sélectionner un client...</option>
                    {clients.map(c => <option key={c.id} value={c.id}>{c.name} • {c.ownerName}</option>)}
                  </select>
                </div>

                <div className="grid grid-cols-2 gap-5">
                  <div className="space-y-1.5">
                    <label className="text-[11px] font-bold text-slate-400 uppercase tracking-widest px-1">Date</label>
                    <input type="date" name="date" defaultValue={editingAppt?.date || dateStr} required className="w-full px-5 py-3.5 bg-slate-50 border border-slate-100 rounded-2xl font-medium text-sm text-slate-800 outline-none shadow-inner" />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-[11px] font-bold text-slate-400 uppercase tracking-widest px-1">Heure</label>
                    <input type="time" name="time" defaultValue={editingAppt?.time || "09:00"} required className="w-full px-5 py-3.5 bg-slate-50 border border-slate-100 rounded-2xl font-medium text-sm text-slate-800 outline-none shadow-inner" />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-5">
                  <div className="space-y-1.5">
                    <label className="text-[11px] font-bold text-slate-400 uppercase tracking-widest px-1">Services</label>
                    <div className="grid grid-cols-1 gap-1.5 max-h-40 overflow-y-auto pr-2 custom-scrollbar">
                      {config.services.map(s => (
                        <label key={s} className="flex items-center gap-3 px-4 py-2.5 bg-slate-50 border border-slate-100 rounded-xl cursor-pointer hover:bg-white hover:border-emerald-200 transition-all shadow-sm">
                          <input type="checkbox" name="services" value={s} defaultChecked={editingAppt?.services?.includes(s)} className="w-4 h-4 rounded-lg border-slate-300 text-emerald-600 focus:ring-emerald-200" />
                          <span className="text-xs font-semibold text-slate-700">{s}</span>
                        </label>
                      ))}
                    </div>
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-[11px] font-bold text-slate-400 uppercase tracking-widest px-1">Durée (minutes)</label>
                    <input type="number" name="duration" defaultValue={editingAppt?.duration || "60"} step="15" className="w-full px-5 py-3.5 bg-slate-50 border border-slate-100 rounded-2xl font-medium text-sm text-slate-800 outline-none shadow-inner" />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label className="text-[11px] font-bold text-slate-400 uppercase tracking-widest px-1">Notes ou particularités</label>
                  <textarea name="notes" defaultValue={editingAppt?.notes || ''} placeholder="Observations..." className="w-full px-5 py-3.5 bg-slate-50 border border-slate-100 rounded-2xl text-sm font-medium h-24 outline-none shadow-inner"></textarea>
                </div>
              </div>

              <button type="submit" className="w-full py-4 bg-slate-900 text-white rounded-2xl font-bold text-sm tracking-widest shadow-2xl shadow-slate-200 hover:bg-emerald-700 transition-all active:scale-[0.98]">
                {editingAppt ? 'Sauvegarder les modifications' : 'Enregistrer le rendez-vous'}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Modal Facturation Rapide */}
      {isInvoiceModalOpen && selectedAppt && (
        <div className="fixed inset-0 z-[100] bg-slate-900/40 backdrop-blur-md flex items-center justify-center p-4">
           <div className="bg-white w-full max-w-sm rounded-3xl shadow-2xl overflow-hidden border border-slate-100">
             <div className="p-8 space-y-6">
                <div className="flex justify-between items-center mb-2">
                   <h2 className="font-serif text-2xl text-slate-800 italic">Facturation</h2>
                   <button onClick={() => setIsInvoiceModalOpen(false)} className="p-2 hover:bg-slate-50 rounded-full"><X size={24}/></button>
                </div>
                
                <div className="p-4 bg-emerald-50/50 rounded-2xl border border-emerald-100 text-center">
                   <p className="text-[10px] font-bold text-emerald-600 uppercase tracking-widest mb-1">Prestation pour</p>
                   <p className="font-serif text-xl text-emerald-900 italic">{selectedAppt.petName}</p>
                </div>

                <div className="space-y-5">
                   <div className="space-y-1.5">
                      <label className="text-[11px] font-bold text-slate-400 uppercase tracking-widest px-1">Date de la facture</label>
                      <input type="date" value={invoiceDate} onChange={e => setInvoiceDate(e.target.value)} className="w-full px-5 py-3.5 bg-slate-50 border border-slate-100 rounded-2xl font-medium text-sm text-slate-800 outline-none" />
                   </div>

                   <div className="space-y-1.5">
                      <label className="text-[11px] font-bold text-slate-400 uppercase tracking-widest px-1">Libellé du service</label>
                      {isCustomService ? (
                        <div className="flex gap-2">
                          <input type="text" value={invoiceService} onChange={e => setInvoiceService(e.target.value)} placeholder="..." className="w-full px-5 py-3.5 bg-slate-50 border border-slate-100 rounded-2xl font-medium text-sm text-slate-800 outline-none shadow-inner" autoFocus />
                          <button onClick={() => { setIsCustomService(false); setInvoiceService((selectedAppt.services && Array.isArray(selectedAppt.services)) ? selectedAppt.services.join(', ') : ((selectedAppt as any).service || '')); }} className="px-4 py-2 bg-slate-100 text-slate-600 rounded-xl font-bold text-[10px]">RETOUR</button>
                        </div>
                      ) : (
                        <div className="flex gap-2">
                          <select value={invoiceService} onChange={e => setInvoiceService(e.target.value)} className="w-full px-5 py-3.5 bg-slate-50 border border-slate-100 rounded-2xl font-medium text-sm text-slate-800 outline-none shadow-inner">
                            {config.services.map(s => <option key={s} value={s}>{s}</option>)}
                          </select>
                          <button onClick={() => { setIsCustomService(true); setInvoiceService(''); }} className="px-4 py-2 bg-slate-100 text-slate-600 rounded-xl font-bold text-[10px]">AUTRE</button>
                        </div>
                      )}
                   </div>

                   <div className="space-y-1.5">
                      <label className="text-[11px] font-bold text-slate-400 uppercase tracking-widest px-1">Montant TTC</label>
                      <div className="relative">
                        <input type="number" value={invoiceAmount} onChange={e => setInvoiceAmount(e.target.value)} className="w-full px-5 py-5 bg-emerald-50 border border-emerald-100 rounded-2xl font-serif text-4xl text-emerald-700 text-center outline-none shadow-sm" />
                        <span className="absolute right-6 top-1/2 -translate-y-1/2 font-serif text-2xl text-emerald-300">€</span>
                      </div>
                   </div>

                   <div className="space-y-1.5">
                      <label className="text-[11px] font-bold text-slate-400 uppercase tracking-widest px-1">Mode de règlement</label>
                      <div className="grid grid-cols-2 gap-2">
                         {['Carte', 'Espèces', 'Chèque', 'Virement'].map(m => (
                           <button key={m} onClick={() => setPaymentMethod(m as any)} className={`py-3 rounded-xl text-[10px] font-bold uppercase border transition-all ${paymentMethod === m ? 'bg-slate-900 text-white border-slate-900 shadow-lg' : 'bg-white text-slate-400 border-slate-100 hover:bg-slate-50 hover:border-emerald-100 shadow-sm'}`}>
                             {m}
                           </button>
                         ))}
                      </div>
                   </div>
                </div>

                <button onClick={handleConfirmInvoice} className="w-full py-4 bg-emerald-600 text-white rounded-2xl font-bold text-sm tracking-widest shadow-xl shadow-emerald-100 hover:bg-emerald-700 transition-all active:scale-[0.98]">
                   Générer la facture
                </button>
             </div>
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

export default Planning;
