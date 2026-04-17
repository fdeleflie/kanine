
import React from 'react';
import { Invoice, Client } from '../types';
import { Phone, MapPin, PawPrint } from 'lucide-react';
import { db } from '../services/database';
import { useImage } from '../hooks/useImage';

interface InvoicePDFProps {
  invoice: Invoice;
  client?: Client;
}

const InvoicePDF: React.FC<InvoicePDFProps> = ({ invoice, client }) => {
  const [config, setConfig] = React.useState<any>(null);

  React.useEffect(() => {
    const loadConfig = async () => {
      const data = await db.getConfig();
      setConfig(data);
    };
    loadConfig();
  }, []);

  const logoImage = useImage(config?.logo);

  if (!config) return null;

  return (
    <div className="bg-white text-slate-800 w-full max-w-[21cm] mx-auto print:p-0 min-h-screen flex flex-col">
      {/* Header Premium inspiré du logo */}
      <div className="bg-[#0f172a] text-white p-10 flex justify-between items-center border-b-4 border-amber-400">
        <div className="flex items-center gap-8">
           {logoImage ? (
             <img src={logoImage} className="w-64 h-64 object-contain" alt="Logo" />
           ) : (
             <div className="w-40 h-40 bg-white/10 rounded-3xl flex items-center justify-center text-amber-400">
                <PawPrint size={80} />
             </div>
           )}
           <div className="space-y-1">
              <h1 className="text-3xl font-black uppercase tracking-tighter italic leading-none text-amber-400">{config.companyName || "Ka'nine & Patounes"}</h1>
              <p className="text-[12px] font-bold text-slate-300 uppercase tracking-[0.3em]">{config.ownerName || "Karine DELEFLIE"}</p>
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Toilettage & Soins Canins et Félins</p>
              <div className="text-[11px] text-slate-400 pt-3 space-y-1">
                <p className="flex items-center gap-2 font-bold text-white"><Phone size={12}/> {config.phone || "06 20 23 33 95"}</p>
                <p className="flex items-center gap-2"><MapPin size={12}/> {config.address || "181 Chemin Vert, 59480 La Bassée"}</p>
              </div>
           </div>
        </div>

        <div className="text-right">
          <h2 className="text-6xl font-black text-white/5 uppercase tracking-tighter leading-none mb-2">FACTURE</h2>
          <div className="bg-amber-400 text-slate-900 px-6 py-2 rounded-xl inline-block">
             <p className="text-sm font-black tracking-widest">{invoice.number}</p>
          </div>
          <p className="text-[11px] font-bold text-slate-400 uppercase mt-2">{new Date(invoice.date).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })}</p>
        </div>
      </div>

      <div className="p-12 flex-1">
        <div className="grid grid-cols-2 gap-12 mb-16">
          <div className="space-y-4">
            <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-widest border-b pb-1">Client</h3>
            <p className="text-xl font-black text-slate-900 uppercase italic">{invoice.ownerName}</p>
            {client?.address && <p className="text-sm text-slate-500 leading-relaxed">{client.address}</p>}
          </div>
          <div className="space-y-4">
            <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-widest border-b pb-1">Pensionnaire</h3>
            <p className="text-xl font-black text-slate-900 uppercase italic">{invoice.petName}</p>
            <p className="text-sm text-slate-500 font-bold">{client?.species} • {client?.breed}</p>
          </div>
        </div>

        <table className="w-full">
          <thead>
            <tr className="border-b-2 border-slate-900 text-left">
              <th className="py-4 text-[11px] font-black uppercase tracking-widest text-slate-400">Désignation de la prestation</th>
              <th className="py-4 text-right text-[11px] font-black uppercase tracking-widest text-slate-400">Montant</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {invoice.items && invoice.items.length > 0 ? (
              invoice.items.map((item, idx) => (
                <tr key={idx}>
                  <td className="py-6">
                    <p className="font-black text-slate-900 text-xl uppercase tracking-tighter">{item.description}</p>
                  </td>
                  <td className="py-6 text-right font-black text-2xl text-slate-900 italic">
                    {item.amount.toFixed(2)}€
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td className="py-12">
                  <p className="font-black text-slate-900 text-2xl uppercase tracking-tighter">Soin de toilettage complet</p>
                  {invoice.notes && (
                    <div className="mt-6 p-6 bg-slate-50 border-l-4 border-slate-900 rounded-r-3xl">
                      <p className="text-[10px] font-black text-slate-400 uppercase mb-2 tracking-widest">Détails</p>
                      <p className="text-sm text-slate-700 italic leading-relaxed">"{invoice.notes}"</p>
                    </div>
                  )}
                </td>
                <td className="py-12 text-right font-black text-4xl text-slate-900 italic">
                  {invoice.amount.toFixed(2)}€
                </td>
              </tr>
            )}
          </tbody>
          <tfoot>
            <tr className="border-t-2 border-slate-900">
              <td className="py-10 font-black text-slate-400 uppercase text-[12px] tracking-widest">Total Net à payer</td>
              <td className="py-10 text-right font-black text-6xl text-slate-900 italic tracking-tighter underline decoration-amber-400 decoration-4 underline-offset-8">{invoice.amount.toFixed(2)}€</td>
            </tr>
          </tfoot>
        </table>

        <div className="mt-10 flex justify-between items-end border-t border-slate-100 pt-6">
          <div className="space-y-4">
             <div className="bg-slate-900 text-white px-6 py-4 rounded-2xl flex items-center gap-4">
                <p className="text-[11px] font-black uppercase tracking-widest opacity-70">Règlement :</p>
                <p className="text-amber-400 font-black uppercase">{invoice.paymentMethod}</p>
             </div>
             <div className="text-[9px] font-bold text-slate-500 space-y-1">
               <p>Date limite de paiement : {invoice.dueDate ? new Date(invoice.dueDate).toLocaleDateString('fr-FR') : "30 jours à réception"}</p>
               <p>Pénalités de retard : 3 fois le taux d'intérêt légal en vigueur</p>
               {invoice.isProfessional && <p>Indemnité forfaitaire pour frais de recouvrement : 40 €</p>}
             </div>
          </div>
          
          <div className="text-right space-y-2">
            <p className="text-[11px] font-black text-slate-900 uppercase">{config.companyName || "Ka'nine & Patounes"}</p>
            <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest leading-loose max-w-[250px] ml-auto">
              Auto-entrepreneur<br/>
              TVA non applicable, art. 293 B du CGI<br/>
              INSCRIPTION AU REGISTRE NATIONAL<br/>
              DES ENTREPRISES (RNE) DE LILLE<br/>
              {config.siret ? `SIRET : ${config.siret}` : ""}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default InvoicePDF;
