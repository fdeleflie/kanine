
export interface Client {
  id: string;
  name: string;
  species: string;
  breed: string;
  coatType: string;
  birthDate: string;
  sex: 'M' | 'F';
  weight: number;
  ownerName: string;
  phone: string;
  email: string;
  address: string;
  particularities: string[];
  notes: string;
  photoProfile?: string;
  createdAt: string;
  isProfessional?: boolean;
}

export interface Appointment {
  id: string;
  date: string;
  time: string;
  clientId: string;
  clientName: string;
  petName: string;
  services: string[];
  notes: string;
  duration: number; // in minutes
  status: 'pending' | 'completed' | 'cancelled' | 'invoiced';
  photoBefore?: string; // Base64
  photoAfter?: string; // Base64
}

export interface InvoiceItem {
  description: string;
  amount: number;
}

export interface Invoice {
  id: string;
  number: string;
  date: string;
  clientId: string;
  petName: string;
  ownerName: string;
  amount: number;
  paymentMethod: 'Espèces' | 'Carte' | 'Chèque' | 'Virement';
  appointmentId: string;
  notes?: string;
  items?: InvoiceItem[];
  dueDate?: string;
  isProfessional?: boolean;
}

export interface Product {
  id: string;
  name: string;
  price: number;
}

export interface ProductInvoiceItem {
  productId: string;
  name: string;
  quantity: number;
  price: number;
}

export interface ProductInvoice {
  id: string;
  number: string;
  date: string;
  clientId: string;
  clientName: string;
  ownerName: string;
  amount: number;
  paymentMethod: 'Espèces' | 'Carte' | 'Chèque' | 'Virement';
  notes?: string;
  items: ProductInvoiceItem[];
}

export type BackupType = 'full' | 'partial' | 'photos';

export interface BackupSchedule {
  enabled: boolean;
  frequency: number; // in hours
  lastBackup?: string;
}

export interface AutoBackupConfig {
  enabled: boolean;
  schedules: {
    full: BackupSchedule;
    partial: BackupSchedule;
    photos: BackupSchedule;
  };
}

export interface Configuration {
  species: string[];
  breeds: Record<string, string[]>;
  particularities: string[];
  services: string[];
  coatTypes: string[];
  products: Product[];
  siret?: string;
  companyName?: string;
  ownerName?: string;
  address?: string;
  phone?: string;
  email?: string;
  logo?: string;
  autoBackup?: AutoBackupConfig;
}
