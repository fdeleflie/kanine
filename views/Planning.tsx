
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
  Printer,
  AlertTriangle,
  X,
  Edit
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
    <div className="space-y-6 flex flex-col h-full min-h-0 bg-slate-50/50 p-6 rounded-[2.5rem]">
      <div className="flex flex-col lg:flex-row items-center justify-between gap-4 shrink-0">
        <div className="flex items-center gap-2 bg-white p-1.5 rounded-2xl shadow-sm border border-slate-100 flex-wrap">
          <button onClick={() => setView('day')} className={`px-4 py-2 rounded-xl text-xs font-black transition-all uppercase tracking-widest ${view === 'day' ? 'bg-indigo-600 text-white shadow-lg' : 'text-slate-400 hover:bg-slate-50'}`}>Jour</button>
          <button onClick={() => setView('month')} className={`px-4 py-2 rounded-xl text-xs font-black transition-all uppercase tracking-widest ${view === 'month' ? 'bg-indigo-600 text-white shadow-lg' : 'text-slate-400 hover:bg-slate-50'}`}>Mois</button>
          <button onClick={() => setView('year')} className={`px-4 py-2 rounded-xl text-xs font-black transition-all uppercase tracking-widest ${view === 'year' ? 'bg-indigo-600 text-white shadow-lg' : 'text-slate-400 hover:bg-slate-50'}`}>Année</button>
          <button onClick={() => setView('upcoming')} className={`px-4 py-2 rounded-xl text-xs font-black transition-all uppercase tracking-widest ${view === 'upcoming' ? 'bg-indigo-600 text-white shadow-lg' : 'text-slate-400 hover:bg-slate-50'}`}>À Venir</button>
          <button onClick={() => setView('past')} className={`px-4 py-2 rounded-xl text-xs font-black transition-all uppercase tracking-widest ${view === 'past' ? 'bg-indigo-600 text-white shadow-lg' : 'text-slate-400 hover:bg-slate-50'}`}>Passés</button>
        </div>

        <div className="flex items-center gap-6">
          <div className="flex items-center gap-4 bg-white px-6 py-2 rounded-2xl border border-slate-100 shadow-sm">
            <button onClick={() => { 
              const d = new Date(currentDate); 
              d.setMonth(d.getMonth() - 1); 
              setCurrentDate(d); 
            }} className="p-2 hover:bg-slate-50 rounded-full transition-colors"><ChevronLeft size={20} /></button>
            <div className="flex items-center gap-2">
              <select 
                value={currentDate.getMonth()} 
                onChange={(e) => {
                  const d = new Date(currentDate);
                  d.setMonth(parseInt(e.target.value));
                  setCurrentDate(d);
                }}
                className="text-sm font-black text-slate-900 uppercase tracking-tighter bg-transparent outline-none cursor-pointer appearance-none text-center"
              >
                {Array.from({ length: 12 }).map((_, i) => (
                  <option key={i} value={i}>
                    {new Date(2000, i, 1).toLocaleDateString('fr-FR', { month: 'long' })}
                  </option>
                ))}
              </select>
              <select 
                value={currentDate.getFullYear()} 
                onChange={(e) => {
                  const d = new Date(currentDate);
                  d.setFullYear(parseInt(e.target.value));
                  setCurrentDate(d);
                }}
                className="text-sm font-black text-slate-900 uppercase tracking-tighter bg-transparent outline-none cursor-pointer appearance-none text-center"
              >
                {Array.from({ length: 10 }).map((_, i) => {
                  const year = new Date().getFullYear() - 5 + i;
                  return <option key={year} value={year}>{year}</option>;
                })}
              </select>
            </div>
            <button onClick={() => { 
              const d = new Date(currentDate); 
              d.setMonth(d.getMonth() + 1); 
              setCurrentDate(d); 
            }} className="p-2 hover:bg-slate-50 rounded-full transition-colors"><ChevronRight size={20} /></button>
          </div>
          <button onClick={() => { setEditingAppt(null); setIsModalOpen(true); }} className="flex items-center gap-3 px-6 py-3 bg-indigo-600 text-white rounded-2xl font-black text-sm uppercase tracking-widest shadow-xl shadow-indigo-100 hover:scale-105 active:scale-95 transition-all">
            <Plus size={20} /> Nouveau RDV
          </button>
        </div>
      </div>

      <div className="flex-1 min-h-0 overflow-y-auto">
        {view === 'month' ? (
          <div className="bg-white rounded-[2.5rem] border border-slate-100 shadow-sm overflow-hidden flex flex-col">
            <div className="calendar-grid border-b border-slate-50 bg-slate-50/50">
              {['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim'].map(day => (
                <div key={day} className="py-2 text-center text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">{day}</div>
              ))}
            </div>
            <div className="calendar-grid flex-1 overflow-y-auto">
              {calendarDays.map((day, i) => {
                const dayStr = day ? formatDate(new Date(currentDate.getFullYear(), currentDate.getMonth(), day)) : '';
                const dayAppts = appointments.filter(a => a.date === dayStr);
                const isToday = dayStr === formatDate(new Date());

                return (
                  <div key={i} className={`min-w-0 min-h-[85px] p-1.5 border-r border-b border-slate-50 relative group transition-colors ${day ? 'hover:bg-slate-50/50' : 'bg-slate-50/20'}`}>
                    {day && (
                      <>
                        <span className={`text-xs font-black ${isToday ? 'bg-indigo-600 text-white px-2 py-1 rounded-lg' : 'text-slate-300'} mb-2 inline-block`}>{day}</span>
                        <div className="space-y-1">
                          {dayAppts.map(appt => (
                            <button key={appt.id} onClick={() => { setSelectedAppt(appt); setView('day'); setCurrentDate(new Date(appt.date)); }} className={`w-full text-left px-2 py-1.5 rounded-lg text-[10px] font-bold whitespace-normal break-words transition-all ${appt.status === 'invoiced' ? 'bg-emerald-50 text-emerald-700 border border-emerald-100' : 'bg-indigo-50 text-indigo-700 border border-indigo-100'}`}>
                              {appt.time} • {appt.petName} • {(appt.services && Array.isArray(appt.services)) ? appt.services.join(', ') : ((appt as any).service || 'Non défini')}
                            </button>
                          ))}
                        </div>
                      </>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        ) : view === 'year' ? (
          <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-4 gap-4 pb-10">
            {Array.from({ length: 12 }).map((_, monthIndex) => {
              const monthDate = new Date(currentDate.getFullYear(), monthIndex, 1);
              const monthName = monthDate.toLocaleDateString('fr-FR', { month: 'long' });
              const monthAppts = appointments.filter(a => {
                const d = new Date(a.date);
                return d.getFullYear() === currentDate.getFullYear() && d.getMonth() === monthIndex;
              });
              return (
                <div key={monthIndex} className="bg-white p-4 rounded-3xl border border-slate-100 shadow-sm cursor-pointer hover:border-indigo-300 transition-all" onClick={() => { setCurrentDate(monthDate); setView('month'); }}>
                  <h3 className="text-sm font-black text-slate-800 uppercase tracking-widest mb-2">{monthName}</h3>
                  <p className="text-2xl font-black text-indigo-600">{monthAppts.length}</p>
                  <p className="text-[10px] font-bold text-slate-400 uppercase">Rendez-vous</p>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="max-w-4xl mx-auto space-y-4 pb-10">
            {appointments
              .filter(a => {
                if (view === 'upcoming') return a.date >= formatDate(new Date());
                if (view === 'past') return a.date < formatDate(new Date());
                return a.date === dateStr; // 'day' view
              })
              .sort((a, b) => view === 'past' ? b.date.localeCompare(a.date) || b.time.localeCompare(a.time) : a.date.localeCompare(b.date) || a.time.localeCompare(b.time))
              .map(appt => (
                <div key={appt.id} className="flex flex-col md:flex-row md:items-center gap-6 p-6 rounded-3xl border border-slate-100 bg-white hover:border-indigo-100 transition-all shadow-sm group">
                  <div className="w-24 text-center border-r border-slate-50 pr-6 shrink-0">
                    <p className="text-[10px] font-black text-indigo-400 uppercase tracking-widest">{new Date(appt.date).toLocaleDateString('fr-FR', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' })}</p>
                    <p className="text-xl font-black text-slate-800 tracking-tighter">{appt.time}</p>
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-1">
                      <button 
                        onClick={() => {
                          setEditingAppt(appt);
                          setIsModalOpen(true);
                        }}
                        className="text-lg font-black text-slate-900 uppercase italic tracking-tighter hover:text-indigo-600 transition-colors text-left"
                      >
                        {appt.petName}
                      </button>
                      <span className="px-3 py-1 bg-slate-900 text-white text-[9px] font-black uppercase rounded-full tracking-widest">{(appt.services && Array.isArray(appt.services)) ? appt.services.join(', ') : ((appt as any).service || 'Non défini')}</span>
                    </div>
                    <p className="text-xs text-slate-400 font-bold flex items-center gap-2 uppercase tracking-widest flex-wrap">
                      <Clock size={12}/> {appt.duration} MIN • {appt.clientName}
                      {(() => {
                        const client = clients.find(c => c.id === appt.clientId);
                        return client ? (
                          <>
                            {` • ${client.species} (${client.breed})`}
                            {client.phone && ` • 📞 ${client.phone}`}
                          </>
                        ) : '';
                      })()}
                    </p>
                    {appt.notes && <p className="text-sm text-slate-500 mt-2 italic">"{appt.notes}"</p>}
                    
                    <div className="flex gap-4 mt-4">
                      <div className="flex flex-col items-center gap-1">
                        <div className="flex items-center gap-2">
                          <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest cursor-pointer hover:text-indigo-600 transition-colors">
                            {appt.photoBefore ? 'Changer Avant' : '+ Photo Avant'}
                            <input type="file" className="hidden" accept="image/*" onChange={async (e) => {
                              const file = e.target.files?.[0];
                              if (!file) return;
                              try {
                                const compressedBase64 = await compressImage(file);
                                const updatedAppt = { ...appt, photoBefore: compressedBase64 };
                                if (await db.saveAppointment(updatedAppt)) {
                                  refreshData();
                                } else {
                                  setWarningState({
                                    isOpen: true,
                                    title: "Mémoire Saturée",
                                    message: "Impossible de sauvegarder la photo. L'espace de stockage est plein."
                                  });
                                }
                              } catch (error) {
                                console.error("Erreur compression:", error);
                                setWarningState({
                                  isOpen: true,
                                  title: "Erreur Photo",
                                  message: "Impossible de traiter cette photo."
                                });
                              } finally {
                                e.target.value = '';
                              }
                            }} />
                          </label>
                          {appt.photoBefore && (
                            <button onClick={async () => {
                              const updatedAppt = { ...appt, photoBefore: undefined };
                              await db.saveAppointment(updatedAppt);
                              refreshData();
                            }} className="text-red-400 hover:text-red-600 p-1"><X size={12}/></button>
                          )}
                        </div>
                        <PhotoThumbnail imageRef={appt.photoBefore} alt="Avant" />
                      </div>
                      <div className="flex flex-col items-center gap-1">
                        <div className="flex items-center gap-2">
                          <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest cursor-pointer hover:text-indigo-600 transition-colors">
                            {appt.photoAfter ? 'Changer Après' : '+ Photo Après'}
                            <input type="file" className="hidden" accept="image/*" onChange={async (e) => {
                              const file = e.target.files?.[0];
                              if (!file) return;
                              try {
                                const compressedBase64 = await compressImage(file);
                                const updatedAppt = { ...appt, photoAfter: compressedBase64 };
                                if (await db.saveAppointment(updatedAppt)) {
                                  refreshData();
                                } else {
                                  setWarningState({
                                    isOpen: true,
                                    title: "Mémoire Saturée",
                                    message: "Impossible de sauvegarder la photo. L'espace de stockage est plein."
                                  });
                                }
                              } catch (error) {
                                console.error("Erreur compression:", error);
                                setWarningState({
                                  isOpen: true,
                                  title: "Erreur Photo",
                                  message: "Impossible de traiter cette photo."
                                });
                              } finally {
                                e.target.value = '';
                              }
                            }} />
                          </label>
                          {appt.photoAfter && (
                            <button onClick={async () => {
                              const updatedAppt = { ...appt, photoAfter: undefined };
                              await db.saveAppointment(updatedAppt);
                              refreshData();
                            }} className="text-red-400 hover:text-red-600 p-1"><X size={12}/></button>
                          )}
                        </div>
                        <PhotoThumbnail imageRef={appt.photoAfter} alt="Après" />
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    {appt.status !== 'invoiced' ? (
                      <button onClick={() => { 
                        setSelectedAppt(appt); 
                        setInvoiceAmount('50'); 
                        setInvoiceDate(new Date().toISOString().split('T')[0]);
                        setInvoiceService((appt.services && Array.isArray(appt.services)) ? appt.services.join(', ') : ((appt as any).service || ''));
                        setIsCustomService(false);
                        setIsInvoiceModalOpen(true); 
                      }} className="flex items-center gap-2 px-6 py-3 bg-emerald-600 text-white rounded-2xl text-xs font-black uppercase tracking-widest hover:bg-emerald-700 shadow-lg shadow-emerald-50 transition-all">
                        <Euro size={16} /> Facturer
                      </button>
                    ) : (
                      <div className="flex items-center gap-2">
                         <span className="text-[10px] font-black text-emerald-500 bg-emerald-50 px-3 py-2 rounded-xl uppercase border border-emerald-100">Payé</span>
                         <button onClick={() => { const inv = db.getInvoices().find(i => i.appointmentId === appt.id); if(inv) onPrintInvoice?.(inv); }} className="p-3 bg-slate-100 text-slate-600 rounded-2xl hover:bg-slate-200 transition-colors"><Printer size={18} /></button>
                      </div>
                    )}
                    <button onClick={() => {
                      setEditingAppt(appt);
                      setIsModalOpen(true);
                    }} className="p-3 text-slate-300 hover:text-indigo-500 hover:bg-indigo-50 rounded-2xl transition-all"><Edit size={20}/></button>
                    <button onClick={() => { 
                      setConfirmState({
                        isOpen: true,
                        title: "Supprimer ce RDV",
                        message: "Voulez-vous vraiment supprimer ce rendez-vous ?",
                        onConfirm: () => {
                          db.deleteAppointment(appt.id);
                          refreshData();
                        }
                      });
                    }} className="p-3 text-slate-300 hover:text-red-500 hover:bg-red-50 rounded-2xl transition-all"><Trash2 size={20}/></button>
                  </div>
                </div>
              ))
            }
          </div>
        )}
      </div>

      {/* Modal Nouveau/Modifier RDV */}
      {isModalOpen && (
        <div className="fixed inset-0 z-[100] bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-xl rounded-[3rem] shadow-2xl overflow-hidden border border-white/20">
            <form key={editingAppt?.id || 'new'} onSubmit={handleSaveAppt} className="p-10 space-y-8">
              <div className="flex justify-between items-center mb-2">
                <h2 className="text-3xl font-black text-slate-900 uppercase tracking-tighter italic">{editingAppt ? 'Modifier Rendez-vous' : 'Nouveau Rendez-vous'}</h2>
                <button type="button" onClick={() => { setIsModalOpen(false); setEditingAppt(null); }} className="p-3 hover:bg-slate-100 rounded-2xl transition-colors"><X size={24}/></button>
              </div>

              <div className="space-y-6">
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1">Choisir un Client</label>
                  <select name="client" required defaultValue={editingAppt?.clientId || ''} className="w-full px-6 py-4 bg-slate-50 border border-slate-100 rounded-2xl font-black text-slate-800 outline-none focus:ring-4 ring-indigo-50 transition-all">
                    <option value="">Sélectionner...</option>
                    {clients.map(c => <option key={c.id} value={c.id}>{c.name} ({c.ownerName})</option>)}
                  </select>
                </div>

                <div className="grid grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1">Date</label>
                    <input type="date" name="date" defaultValue={editingAppt?.date || dateStr} required className="w-full px-6 py-4 bg-slate-50 border border-slate-100 rounded-2xl font-black text-slate-800 outline-none" />
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1">Heure</label>
                    <input type="time" name="time" defaultValue={editingAppt?.time || "09:00"} required className="w-full px-6 py-4 bg-slate-50 border border-slate-100 rounded-2xl font-black text-slate-800 outline-none" />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-6">
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1">Soins</label>
                  <div className="grid grid-cols-2 gap-2">
                    {config.services.map(s => (
                      <label key={s} className="flex items-center gap-2 px-4 py-3 bg-slate-50 border border-slate-100 rounded-xl cursor-pointer hover:bg-indigo-50">
                        <input type="checkbox" name="services" value={s} defaultChecked={editingAppt?.services?.includes(s)} className="w-4 h-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500" />
                        <span className="text-xs font-bold text-slate-700">{s}</span>
                      </label>
                    ))}
                  </div>
                </div>
                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1">Durée (minutes)</label>
                    <input type="number" name="duration" defaultValue={editingAppt?.duration || "60"} step="15" className="w-full px-6 py-4 bg-slate-50 border border-slate-100 rounded-2xl font-black text-slate-800 outline-none" />
                  </div>
                </div>

                <textarea name="notes" defaultValue={editingAppt?.notes || ''} placeholder="Notes particulières..." className="w-full px-6 py-4 bg-slate-50 border border-slate-100 rounded-2xl text-sm font-medium h-24 outline-none"></textarea>
              </div>

              <button type="submit" className="w-full py-6 bg-indigo-600 text-white rounded-[2rem] font-black text-xl uppercase tracking-widest shadow-2xl shadow-indigo-200 hover:bg-indigo-700 transition-all active:scale-[0.98]">
                {editingAppt ? 'Enregistrer les modifications' : 'Confirmer le Rendez-vous'}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Modal Facturation Rapide */}
      {isInvoiceModalOpen && selectedAppt && (
        <div className="fixed inset-0 z-[100] bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
           <div className="bg-white w-full max-w-lg rounded-[3rem] shadow-2xl overflow-hidden">
             <div className="p-10 space-y-8">
                <div className="flex justify-between items-center">
                   <h2 className="text-3xl font-black text-slate-900 uppercase tracking-tighter italic">Émettre Facture</h2>
                   <button onClick={() => setIsInvoiceModalOpen(false)} className="p-3 hover:bg-slate-100 rounded-2xl"><X size={24}/></button>
                </div>
                
                <div className="p-6 bg-slate-50 rounded-3xl border border-slate-100">
                   <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Prestation pour</p>
                   <p className="text-xl font-black text-slate-900">{selectedAppt.petName} ({selectedAppt.clientName})</p>
                </div>

                <div className="space-y-6">
                   <div className="space-y-2">
                      <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1">Date de Facturation</label>
                      <input type="date" value={invoiceDate} onChange={e => setInvoiceDate(e.target.value)} className="w-full px-6 py-4 bg-slate-50 border border-slate-100 rounded-2xl font-black text-slate-800 outline-none" />
                   </div>

                   <div className="space-y-2">
                      <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1">Type de Prestation</label>
                      {isCustomService ? (
                        <div className="flex gap-2">
                          <input type="text" value={invoiceService} onChange={e => setInvoiceService(e.target.value)} placeholder="Saisir la prestation..." className="w-full px-6 py-4 bg-slate-50 border border-slate-100 rounded-2xl font-black text-slate-800 outline-none" autoFocus />
                          <button onClick={() => { setIsCustomService(false); setInvoiceService((selectedAppt.services && Array.isArray(selectedAppt.services)) ? selectedAppt.services.join(', ') : ((selectedAppt as any).service || '')); }} className="px-4 py-4 bg-slate-100 text-slate-600 rounded-2xl font-black text-xs uppercase hover:bg-slate-200 transition-all">Liste</button>
                        </div>
                      ) : (
                        <div className="flex gap-2">
                          <select value={invoiceService} onChange={e => setInvoiceService(e.target.value)} className="w-full px-6 py-4 bg-slate-50 border border-slate-100 rounded-2xl font-black text-slate-800 outline-none">
                            {config.services.map(s => <option key={s} value={s}>{s}</option>)}
                          </select>
                          <button onClick={() => { setIsCustomService(true); setInvoiceService(''); }} className="px-4 py-4 bg-slate-100 text-slate-600 rounded-2xl font-black text-xs uppercase hover:bg-slate-200 transition-all">Autre</button>
                        </div>
                      )}
                   </div>

                   <div className="space-y-2">
                      <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1">Montant TTC (€)</label>
                      <input type="number" value={invoiceAmount} onChange={e => setInvoiceAmount(e.target.value)} className="w-full px-8 py-5 bg-indigo-50 border-2 border-indigo-100 rounded-[2rem] font-black text-3xl text-indigo-600 text-center outline-none" />
                   </div>

                   <div className="space-y-2">
                      <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1">Mode de Règlement</label>
                      <div className="grid grid-cols-2 gap-3">
                         {['Carte', 'Espèces', 'Chèque', 'Virement'].map(m => (
                           <button key={m} onClick={() => setPaymentMethod(m as any)} className={`py-4 rounded-2xl text-xs font-black uppercase tracking-widest border-2 transition-all ${paymentMethod === m ? 'bg-slate-900 text-white border-slate-900 shadow-xl' : 'bg-white text-slate-400 border-slate-100 hover:bg-slate-50'}`}>
                             {m}
                           </button>
                         ))}
                      </div>
                   </div>
                </div>

                <button onClick={handleConfirmInvoice} className="w-full py-6 bg-emerald-600 text-white rounded-[2rem] font-black text-xl uppercase tracking-widest shadow-2xl shadow-emerald-100 hover:bg-emerald-700 transition-all">
                   Valider & Générer PDF
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
