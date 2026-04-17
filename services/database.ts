
import { Client, Appointment, Invoice, Configuration } from '../types';
import { INITIAL_CONFIG } from '../constants';
import { set, del, get } from 'idb-keyval';
import { 
  db as fdb, 
  auth, 
  collection, 
  doc, 
  setDoc, 
  getDoc, 
  getDocs, 
  query, 
  where, 
  deleteDoc, 
  writeBatch 
} from '../firebase';

const KEYS = {
  CLIENTS: 'groom_clients',
  APPOINTMENTS: 'groom_appointments',
  INVOICES: 'groom_invoices',
  PRODUCT_INVOICES: 'groom_product_invoices',
  CONFIG: 'groom_config',
  AUDIT: 'groom_audit_log'
};

export interface ImportResult {
  success: boolean;
  message: string;
  logs: string[];
}

export const db = {
  getUid: () => auth.currentUser?.uid,

  logAction: (action: string, details: string, undoData?: any) => {
    try {
      const auditStr = localStorage.getItem(KEYS.AUDIT);
      const audit = auditStr ? JSON.parse(auditStr) : [];
      audit.unshift({
        id: Math.random().toString(36).substr(2, 9),
        timestamp: new Date().toISOString(),
        action,
        details,
        undoData
      });
      localStorage.setItem(KEYS.AUDIT, JSON.stringify(audit.slice(0, 100)));
    } catch (e) {}
  },

  undoAction: (auditId: string): boolean => {
    const auditStr = localStorage.getItem(KEYS.AUDIT);
    if (!auditStr) return false;
    const audit = JSON.parse(auditStr);
    const entryIndex = audit.findIndex((a: any) => a.id === auditId);
    if (entryIndex === -1) return false;
    const entry = audit[entryIndex];
    if (!entry.undoData) return false;

    if (entry.action === "Suppression Client" || entry.action === "Suppression Client Totale") {
      db.saveClient(entry.undoData.client);
      if (entry.undoData.appointments) {
        entry.undoData.appointments.forEach((a: any) => db.saveAppointment(a));
      }
      if (entry.undoData.invoices) {
        entry.undoData.invoices.forEach((i: any) => db.saveInvoice(i));
      }
    } else if (entry.action === "Suppression Facture") {
      db.saveInvoice(entry.undoData.invoice);
      if (entry.undoData.appointment) {
        db.saveAppointment(entry.undoData.appointment);
      }
    } else if (entry.action === "Suppression Rendez-vous") {
      db.saveAppointment(entry.undoData.appointment);
    }

    // Remove the audit entry or mark it as undone
    audit.splice(entryIndex, 1);
    localStorage.setItem(KEYS.AUDIT, JSON.stringify(audit));
    return true;
  },

  getAuditLog: (): any[] => {
    try {
      const auditStr = localStorage.getItem(KEYS.AUDIT);
      return auditStr ? JSON.parse(auditStr) : [];
    } catch { return []; }
  },

  getConfig: (): Configuration & { logo?: string } => {
    try {
      const data = localStorage.getItem(KEYS.CONFIG);
      return data ? JSON.parse(data) : INITIAL_CONFIG;
    } catch { return INITIAL_CONFIG; }
  },
  
  saveConfig: async (config: any) => {
    localStorage.setItem(KEYS.CONFIG, JSON.stringify(config));
    const uid = db.getUid();
    if (uid) {
      try {
        await setDoc(doc(fdb, 'users', uid), { 
          uid, 
          email: auth.currentUser?.email,
          config,
          lastSync: new Date().toISOString()
        }, { merge: true });
      } catch (e) { console.error("Cloud sync failed (config):", e); }
    }
  },

  updateConfigItems: (key: keyof Configuration, items: string[]) => {
    const config = db.getConfig();
    (config as any)[key] = items;
    db.saveConfig(config);
  },

  getClients: (): Client[] => {
    try {
      const data = localStorage.getItem(KEYS.CLIENTS);
      const parsed = data ? JSON.parse(data) : [];
      const clients = Array.isArray(parsed) ? parsed : [];
      // Deduplicate by ID
      return Array.from(new Map(clients.map(item => [item.id, item])).values());
    } catch { return []; }
  },

  saveClient: async (client: Client): Promise<boolean> => {
    try {
      const clients = db.getClients();
      const index = clients.findIndex(c => c.id === client.id);
      
      // Handle photoProfile separately
      let clientToSave = { ...client };
      if (client.photoProfile && client.photoProfile.startsWith('data:image/')) {
        const photoKey = `photo_client_${client.id}`;
        await set(photoKey, client.photoProfile);
        clientToSave.photoProfile = photoKey;
      }

      if (index >= 0) clients[index] = clientToSave;
      else clients.push(clientToSave);
      
      localStorage.setItem(KEYS.CLIENTS, JSON.stringify(clients));

      // Firebase Sync
      const uid = db.getUid();
      if (uid) {
        try {
          // Flatten photo for cloud if needed, or store key
          await setDoc(doc(fdb, `users/${uid}/clients`, client.id), {
            ...clientToSave,
            uid,
            updatedAt: new Date().toISOString()
          });
        } catch (e) { console.error("Cloud sync failed (client):", e); }
      }

      return true;
    } catch (e) {
      console.error("Failed to save client:", e);
      return false;
    }
  },

  deleteClient: async (id: string, deleteEverything: boolean = true) => {
    const clients = db.getClients();
    const clientToDelete = clients.find(c => c.id === id);
    if (!clientToDelete) return false;

    const newClients = clients.filter(c => c.id !== id);
    localStorage.setItem(KEYS.CLIENTS, JSON.stringify(newClients));

    const uid = db.getUid();
    if (uid) {
      try {
        await deleteDoc(doc(fdb, `users/${uid}/clients`, id));
      } catch (e) { console.error("Cloud sync failed (delete client):", e); }
    }

    if (deleteEverything) {
        const appts = db.getAppointments();
        const apptsToDelete = appts.filter(a => a.clientId === id);
        
        const invoices = db.getInvoices();
        const invoicesToDelete = invoices.filter(i => i.clientId === id);

        const newAppts = appts.filter(a => a.clientId !== id);
        const newInvoices = invoices.filter(i => i.clientId !== id);

        localStorage.setItem(KEYS.APPOINTMENTS, JSON.stringify(newAppts));
        localStorage.setItem(KEYS.INVOICES, JSON.stringify(newInvoices));

        if (uid) {
          try {
            const batch = writeBatch(fdb);
            apptsToDelete.forEach(a => batch.delete(doc(fdb, `users/${uid}/appointments`, a.id)));
            invoicesToDelete.forEach(i => batch.delete(doc(fdb, `users/${uid}/invoices`, i.id)));
            await batch.commit();
          } catch (e) { console.error("Cloud sync failed (batch delete):", e); }
        }
        
        db.logAction("Suppression Client Totale", `ID: ${id} (${clientToDelete.name})`, {
            client: clientToDelete,
            appointments: apptsToDelete,
            invoices: invoicesToDelete
        });
    } else {
        db.logAction("Suppression Client", `ID: ${id} (${clientToDelete.name})`, {
            client: clientToDelete
        });
    }
    return true;
  },

  getAppointments: (): Appointment[] => {
    try {
      const data = localStorage.getItem(KEYS.APPOINTMENTS);
      const parsed = data ? JSON.parse(data) : [];
      const appts = Array.isArray(parsed) ? parsed : [];
      // Deduplicate by ID
      return Array.from(new Map(appts.map(item => [item.id, item])).values());
    } catch { return []; }
  },

  saveAppointment: async (appt: Appointment): Promise<boolean> => {
    try {
      const appts = db.getAppointments();
      const index = appts.findIndex(a => a.id === appt.id);
      
      let apptToSave = { ...appt };

      if (appt.photoBefore && appt.photoBefore.startsWith('data:image/')) {
        const photoKey = `photo_before_${appt.id}`;
        await set(photoKey, appt.photoBefore);
        apptToSave.photoBefore = photoKey;
      }

      if (appt.photoAfter && appt.photoAfter.startsWith('data:image/')) {
        const photoKey = `photo_after_${appt.id}`;
        await set(photoKey, appt.photoAfter);
        apptToSave.photoAfter = photoKey;
      }

      if (index >= 0) appts[index] = apptToSave;
      else appts.push(apptToSave);
      
      localStorage.setItem(KEYS.APPOINTMENTS, JSON.stringify(appts));

      const uid = db.getUid();
      if (uid) {
        try {
          await setDoc(doc(fdb, `users/${uid}/appointments`, appt.id), {
            ...apptToSave,
            uid,
            updatedAt: new Date().toISOString()
          });
        } catch (e) { console.error("Cloud sync failed (appointment):", e); }
      }

      return true;
    } catch (e) {
      console.error("Failed to save appointment:", e);
      return false;
    }
  },

  deleteAppointment: async (id: string) => {
    const appts = db.getAppointments();
    const apptToDelete = appts.find(a => a.id === id);
    if (!apptToDelete) return;

    const newAppts = appts.filter(a => a.id !== id);
    localStorage.setItem(KEYS.APPOINTMENTS, JSON.stringify(newAppts));

    const uid = db.getUid();
    if (uid) {
      try {
        await deleteDoc(doc(fdb, `users/${uid}/appointments`, id));
      } catch (e) { console.error("Cloud sync failed (delete appt):", e); }
    }

    db.logAction("Suppression Rendez-vous", `ID: ${id} (${apptToDelete.petName})`, {
      appointment: apptToDelete
    });
  },

  getInvoices: (): Invoice[] => {
    try {
      const data = localStorage.getItem(KEYS.INVOICES);
      const parsed = data ? JSON.parse(data) : [];
      const invoices = Array.isArray(parsed) ? parsed : [];
      // Deduplicate by ID
      return Array.from(new Map(invoices.map(item => [item.id, item])).values());
    } catch { return []; }
  },

  saveInvoice: async (invoice: Invoice) => {
    const invoices = db.getInvoices();
    const index = invoices.findIndex(i => i.id === invoice.id);
    if (index >= 0) {
      invoices[index] = invoice;
    } else {
      invoices.push(invoice);
    }
    localStorage.setItem(KEYS.INVOICES, JSON.stringify(invoices));

    const uid = db.getUid();
    if (uid) {
      try {
        await setDoc(doc(fdb, `users/${uid}/invoices`, invoice.id), {
          ...invoice,
          uid,
          updatedAt: new Date().toISOString()
        });
      } catch (e) { console.error("Cloud sync failed (invoice):", e); }
    }
  },

  deleteInvoice: async (id: string) => {
    const invoices = db.getInvoices();
    const invoiceToDelete = invoices.find(i => i.id === id);
    if (!invoiceToDelete) return;

    const newInvoices = invoices.filter(i => i.id !== id);
    localStorage.setItem(KEYS.INVOICES, JSON.stringify(newInvoices));

    const uid = db.getUid();
    if (uid) {
      try {
        await deleteDoc(doc(fdb, `users/${uid}/invoices`, id));
      } catch (e) { console.error("Cloud sync failed (delete invoice):", e); }
    }

    // Restore appointment status to pending
    let apptToRestore = null;
    if (invoiceToDelete.appointmentId) {
      const appts = db.getAppointments();
      const apptIndex = appts.findIndex(a => a.id === invoiceToDelete.appointmentId);
      if (apptIndex >= 0) {
        appts[apptIndex].status = 'pending';
        apptToRestore = { ...appts[apptIndex], status: 'invoiced' }; // previous state
        localStorage.setItem(KEYS.APPOINTMENTS, JSON.stringify(appts));
        
        if (uid) {
          try {
            await setDoc(doc(fdb, `users/${uid}/appointments`, appts[apptIndex].id), {
              ...appts[apptIndex],
              uid,
              updatedAt: new Date().toISOString()
            });
          } catch (e) {}
        }
      }
    }

    db.logAction("Suppression Facture", `ID: ${id} (${invoiceToDelete.number})`, {
      invoice: invoiceToDelete,
      appointment: apptToRestore
    });
  },

  updateInvoice: async (invoice: Invoice) => {
    const invoices = db.getInvoices();
    const index = invoices.findIndex(i => i.id === invoice.id);
    if (index >= 0) {
      invoices[index] = invoice;
      localStorage.setItem(KEYS.INVOICES, JSON.stringify(invoices));

      const uid = db.getUid();
      if (uid) {
        try {
          await setDoc(doc(fdb, `users/${uid}/invoices`, invoice.id), {
            ...invoice,
            uid,
            updatedAt: new Date().toISOString()
          });
        } catch (e) {}
      }
    }
  },

  getNextInvoiceNumber: (dateStr?: string): string => {
    const invoices = db.getInvoices();
    const date = dateStr ? new Date(dateStr) : new Date();
    const year = date.getFullYear();
    const yearInvoices = invoices.filter(i => i.number.startsWith(`F${year}`));
    const nextNum = yearInvoices.length + 1;
    return `F${year}-${nextNum.toString().padStart(4, '0')}`;
  },

  getProductInvoices: (): any[] => {
    try {
      const data = localStorage.getItem(KEYS.PRODUCT_INVOICES);
      const parsed = data ? JSON.parse(data) : [];
      const invoices = Array.isArray(parsed) ? parsed : [];
      // Deduplicate by ID
      return Array.from(new Map(invoices.map(item => [item.id, item])).values());
    } catch { return []; }
  },

  saveProductInvoice: async (invoice: any) => {
    const invoices = db.getProductInvoices();
    const index = invoices.findIndex(i => i.id === invoice.id);
    if (index >= 0) {
      invoices[index] = invoice;
    } else {
      invoices.push(invoice);
    }
    localStorage.setItem(KEYS.PRODUCT_INVOICES, JSON.stringify(invoices));

    const uid = db.getUid();
    if (uid) {
      try {
        await setDoc(doc(fdb, `users/${uid}/productInvoices`, invoice.id), {
          ...invoice,
          uid,
          updatedAt: new Date().toISOString()
        });
      } catch (e) {}
    }
  },

  deleteProductInvoice: async (id: string) => {
    const invoices = db.getProductInvoices();
    const invoiceToDelete = invoices.find(i => i.id === id);
    if (!invoiceToDelete) return;

    const newInvoices = invoices.filter(i => i.id !== id);
    localStorage.setItem(KEYS.PRODUCT_INVOICES, JSON.stringify(newInvoices));

    const uid = db.getUid();
    if (uid) {
      try {
        await deleteDoc(doc(fdb, `users/${uid}/productInvoices`, id));
      } catch (e) {}
    }

    db.logAction("Suppression Facture Boutique", `ID: ${id} (${invoiceToDelete.number})`, {
      invoice: invoiceToDelete
    });
  },

  getNextProductInvoiceNumber: (dateStr?: string): string => {
    const invoices = db.getProductInvoices();
    const date = dateStr ? new Date(dateStr) : new Date();
    const year = date.getFullYear();
    const yearInvoices = invoices.filter(i => i.number.startsWith(`P${year}`));
    const nextNum = yearInvoices.length + 1;
    return `P${year}-${nextNum.toString().padStart(4, '0')}`;
  },

  migrateToFirebase: async (progressCallback: (msg: string) => void): Promise<boolean> => {
    const uid = db.getUid();
    if (!uid) {
      progressCallback("Erreur: Utilisateur non connecté");
      return false;
    }

    try {
      progressCallback("Début de la migration...");
      
      // Config
      progressCallback("Migration de la configuration...");
      await db.saveConfig(db.getConfig());

      // Clients
      const clients = db.getClients();
      progressCallback(`Migration de ${clients.length} clients...`);
      for (const client of clients) {
        // Resolve photo from IndexedDB if needed
        const clientToMigrate = { ...client };
        if (client.photoProfile && client.photoProfile.startsWith('photo_client_')) {
          clientToMigrate.photoProfile = await get(client.photoProfile);
        }
        await db.saveClient(clientToMigrate);
      }

      // Appointments
      const appts = db.getAppointments();
      progressCallback(`Migration de ${appts.length} rendez-vous...`);
      for (const appt of appts) {
        const apptToMigrate = { ...appt };
        if (appt.photoBefore && appt.photoBefore.startsWith('photo_before_')) apptToMigrate.photoBefore = await get(appt.photoBefore);
        if (appt.photoAfter && appt.photoAfter.startsWith('photo_after_')) apptToMigrate.photoAfter = await get(appt.photoAfter);
        await db.saveAppointment(apptToMigrate);
      }

      // Invoices
      const invoices = db.getInvoices();
      progressCallback(`Migration de ${invoices.length} factures...`);
      for (const inv of invoices) await db.saveInvoice(inv);

      // Product Invoices
      const pInvoices = db.getProductInvoices();
      progressCallback(`Migration de ${pInvoices.length} factures produits...`);
      for (const pinv of pInvoices) await db.saveProductInvoice(pinv);

      progressCallback("Migration terminée avec succès !");
      return true;
    } catch (e: any) {
      progressCallback(`Erreur pendant la migration: ${e.message}`);
      return false;
    }
  },

  exportAsJSON: async (options?: { excludePhotos?: boolean, photosOnly?: boolean }) => {
    const clients = db.getClients();
    const appointments = db.getAppointments();
    
    let exportedClients: any[] = [];
    let exportedAppts: any[] = [];

    if (options?.photosOnly) {
      // Export ONLY photos (as base64)
      exportedClients = await Promise.all(clients.map(async c => {
        if (c.photoProfile && c.photoProfile.startsWith('photo_client_')) {
          try {
            const base64 = await get(c.photoProfile);
            return { id: c.id, photoProfile: base64 };
          } catch (e) { return { id: c.id }; }
        }
        return { id: c.id };
      }));

      exportedAppts = await Promise.all(appointments.map(async a => {
        let photos: any = { id: a.id };
        if (a.photoBefore && a.photoBefore.startsWith('photo_before_')) {
          try {
            const base64 = await get(a.photoBefore);
            if (base64) photos.photoBefore = base64;
          } catch (e) {}
        }
        if (a.photoAfter && a.photoAfter.startsWith('photo_after_')) {
          try {
            const base64 = await get(a.photoAfter);
            if (base64) photos.photoAfter = base64;
          } catch (e) {}
        }
        return photos;
      }));
    } else if (options?.excludePhotos) {
      exportedClients = clients.map(c => {
        const { photoProfile, ...rest } = c;
        return rest;
      });
      exportedAppts = appointments.map(a => {
        const { photoBefore, photoAfter, ...rest } = a;
        return rest;
      });
    } else {
      exportedClients = await Promise.all(clients.map(async c => {
        if (c.photoProfile && c.photoProfile.startsWith('photo_client_')) {
          try {
            const base64 = await get(c.photoProfile);
            return { ...c, photoProfile: base64 || c.photoProfile };
          } catch (e) { return c; }
        }
        return c;
      }));

      exportedAppts = await Promise.all(appointments.map(async a => {
        let newA = { ...a };
        if (newA.photoBefore && newA.photoBefore.startsWith('photo_before_')) {
          try {
            const base64 = await get(newA.photoBefore);
            if (base64) newA.photoBefore = base64;
          } catch (e) {}
        }
        if (newA.photoAfter && newA.photoAfter.startsWith('photo_after_')) {
          try {
            const base64 = await get(newA.photoAfter);
            if (base64) newA.photoAfter = base64;
          } catch (e) {}
        }
        return newA;
      }));
    }

    const data = {
      type: options?.photosOnly ? 'photos' : (options?.excludePhotos ? 'partial' : 'full'),
      timestamp: new Date().toISOString(),
      clients: exportedClients,
      appointments: exportedAppts,
      invoices: options?.photosOnly ? [] : db.getInvoices(),
      productInvoices: options?.photosOnly ? [] : db.getProductInvoices(),
      config: options?.photosOnly ? null : db.getConfig()
    };

    return JSON.stringify(data, null, 2);
  },

  deleteAuditLogEntry: (id: string) => {
    const auditStr = localStorage.getItem(KEYS.AUDIT);
    if (!auditStr) return;
    const audit = JSON.parse(auditStr);
    const newAudit = audit.filter((a: any) => a.id !== id);
    localStorage.setItem(KEYS.AUDIT, JSON.stringify(newAudit));
  },

  importFullData: async (jsonString: string): Promise<ImportResult> => {
    const logs: string[] = [];
    const log = (msg: string) => logs.push(`[${new Date().toLocaleTimeString()}] ${msg}`);

    try {
      const rawSize = (jsonString.length / 1024 / 1024).toFixed(2);
      log(`Fichier chargé : ${rawSize} Mo`);

      if (!jsonString || jsonString.trim() === "") throw new Error("Le contenu est vide.");

      log("Analyse du JSON...");
      const data = JSON.parse(jsonString.trim());
      const backupType = data.type || 'full';
      log(`Type de sauvegarde détecté : ${backupType}`);
      
      log("Validation des données...");
      if (!data.clients || !Array.isArray(data.clients)) throw new Error("Format invalide (Données clients manquantes).");

      if (backupType === 'photos') {
        log("Mode Fusion : Importation des photos uniquement...");
        const currentClients = db.getClients();
        const currentAppts = db.getAppointments();

        let updatedCount = 0;

        // Merge photos into clients
        for (const exportedClient of data.clients) {
          if (exportedClient.photoProfile && exportedClient.photoProfile.startsWith('data:image/')) {
            const photoKey = `photo_client_${exportedClient.id}`;
            await set(photoKey, exportedClient.photoProfile);
            
            const clientIndex = currentClients.findIndex(c => c.id === exportedClient.id);
            if (clientIndex !== -1) {
              currentClients[clientIndex].photoProfile = photoKey;
              updatedCount++;
            }
          }
        }

        // Merge photos into appointments
        for (const exportedAppt of (data.appointments || [])) {
          const apptIndex = currentAppts.findIndex(a => a.id === exportedAppt.id);
          if (apptIndex !== -1) {
            if (exportedAppt.photoBefore && exportedAppt.photoBefore.startsWith('data:image/')) {
              const photoKey = `photo_appt_before_${exportedAppt.id}`;
              await set(photoKey, exportedAppt.photoBefore);
              currentAppts[apptIndex].photoBefore = photoKey;
              updatedCount++;
            }
            if (exportedAppt.photoAfter && exportedAppt.photoAfter.startsWith('data:image/')) {
              const photoKey = `photo_appt_after_${exportedAppt.id}`;
              await set(photoKey, exportedAppt.photoAfter);
              currentAppts[apptIndex].photoAfter = photoKey;
              updatedCount++;
            }
          }
        }

        log(`Fusion terminée : ${updatedCount} photos restaurées.`);
        localStorage.setItem(KEYS.CLIENTS, JSON.stringify(currentClients));
        localStorage.setItem(KEYS.APPOINTMENTS, JSON.stringify(currentAppts));
        
        return { success: true, message: `Fusion des photos réussie (${updatedCount} photos)`, logs };
      }

      log("Extraction et sauvegarde des photos...");
      const clientsToSave = await Promise.all(data.clients.map(async (c: any) => {
        if (c.photoProfile && c.photoProfile.startsWith('data:image/')) {
          const photoKey = `photo_client_${c.id}`;
          try {
            await set(photoKey, c.photoProfile);
            return { ...c, photoProfile: photoKey };
          } catch (e) {
            log(`Erreur sauvegarde photo client ${c.id}`);
            return c;
          }
        }
        return c;
      }));

      const apptsToSave = await Promise.all((data.appointments || []).map(async (a: any) => {
        let newA = { ...a };
        if (newA.photoBefore && newA.photoBefore.startsWith('data:image/')) {
          const photoKey = `photo_appt_before_${newA.id}`;
          try {
            await set(photoKey, newA.photoBefore);
            newA.photoBefore = photoKey;
          } catch (e) { log(`Erreur sauvegarde photo avant rdv ${newA.id}`); }
        }
        if (newA.photoAfter && newA.photoAfter.startsWith('data:image/')) {
          const photoKey = `photo_appt_after_${newA.id}`;
          try {
            await set(photoKey, newA.photoAfter);
            newA.photoAfter = photoKey;
          } catch (e) { log(`Erreur sauvegarde photo après rdv ${newA.id}`); }
        }
        return newA;
      }));

      log("Test de l'espace de stockage...");
      const clientsStr = JSON.stringify(clientsToSave);
      const apptsStr = JSON.stringify(apptsToSave);
      const invsStr = JSON.stringify(data.invoices || []);
      const productInvsStr = JSON.stringify(data.productInvoices || []);
      const configStr = JSON.stringify(data.config || INITIAL_CONFIG);

      // On teste d'abord l'écriture dans des clés de test
      try {
        localStorage.setItem('__test_quota__', clientsStr + apptsStr + invsStr + productInvsStr);
        localStorage.removeItem('__test_quota__');
        log("Espace de stockage suffisant.");
      } catch (e) {
        throw new Error("MÉMOIRE SATURÉE : Le fichier est trop volumineux pour votre navigateur (trop de photos ?).");
      }

      log("Écriture définitive...");
      localStorage.setItem(KEYS.CLIENTS, clientsStr);
      localStorage.setItem(KEYS.APPOINTMENTS, apptsStr);
      localStorage.setItem(KEYS.INVOICES, invsStr);
      localStorage.setItem(KEYS.PRODUCT_INVOICES, productInvsStr);
      
      if (backupType === 'full' && data.config) {
        localStorage.setItem(KEYS.CONFIG, configStr);
      }

      log("SYNK : Données synchronisées avec succès.");
      return { success: true, message: `Importation ${backupType} réussie`, logs };
    } catch (e: any) {
      log(`ERREUR : ${e.message}`);
      return { success: false, message: e.message, logs };
    }
  },

  resetAll: () => {
    if (window.confirm("🚨 ATTENTION : Voulez-vous vraiment TOUT effacer ?")) {
      localStorage.clear();
      window.location.reload();
    }
  },

  setAutoBackupDirectory: async (handle: any) => {
    try {
      await set('groom_auto_backup_handle', handle);
    } catch (e) {
      console.error("Erreur sauvegarde handle", e);
    }
  },

  getAutoBackupDirectory: async (): Promise<any> => {
    try {
      return await get('groom_auto_backup_handle');
    } catch (e) {
      return null;
    }
  },

  performAutoBackupIfDue: async () => {
    const config = db.getConfig();
    if (!config.autoBackup?.enabled || !config.autoBackup.schedules) return;

    const handle = await db.getAutoBackupDirectory();
    if (!handle) return;

    // Verify permission silently
    if (typeof handle.queryPermission !== 'function') return;
    try {
      const permission = await handle.queryPermission({ mode: 'readwrite' });
      if (permission !== 'granted') return;
    } catch (e) {
      return;
    }

    const now = new Date();
    const schedules = config.autoBackup.schedules;
    const types: ('full' | 'partial' | 'photos')[] = ['full', 'partial', 'photos'];

    for (const type of types) {
      const schedule = schedules[type];
      if (!schedule || !schedule.enabled || !schedule.frequency) continue;

      const lastBackup = schedule.lastBackup ? new Date(schedule.lastBackup) : new Date(0);
      const hoursSinceLastBackup = (now.getTime() - lastBackup.getTime()) / (1000 * 60 * 60);

      if (hoursSinceLastBackup >= schedule.frequency) {
        try {
          const json = await db.exportAsJSON({ 
            excludePhotos: type === 'partial',
            photosOnly: type === 'photos'
          });
          const blob = new Blob([json], { type: 'application/json' });
          const filename = `kanine_autobackup_${type}_${now.toISOString().split('T')[0]}_${now.getHours()}h${now.getMinutes()}.json`;

          const fileHandle = await handle.getFileHandle(filename, { create: true });
          const writable = await fileHandle.createWritable();
          await writable.write(blob);
          await writable.close();

          // Update last backup time for THIS schedule
          schedule.lastBackup = now.toISOString();
          db.saveConfig(config);
          console.log(`Auto-backup (${type}) successful: ${filename}`);
        } catch (e) {
          console.error(`Auto-backup (${type}) failed:`, e);
        }
      }
    }
  }
};

