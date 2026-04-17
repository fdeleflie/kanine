import React from 'react';
import { ProductInvoice, Client } from '../types';
import { Phone, MapPin, PawPrint } from 'lucide-react';
import { db } from '../services/database';
import { useImage } from '../hooks/useImage';

interface ProductInvoicePDFProps {
  invoice: ProductInvoice;
  client?: Client;
}

const ProductInvoicePDF: React.FC<ProductInvoicePDFProps> = ({ invoice, client }) => {
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
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Boutique & Accessoires</p>
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
        </div>

        <table className="w-full">
          <thead>
            <tr className="border-b-2 border-slate-900 text-left">
              <th className="py-4 text-[11px] font-black uppercase tracking-widest text-slate-400">Désignation</th>
              <th className="py-4 text-center text-[11px] font-black uppercase tracking-widest text-slate-400">Qté</th>
              <th className="py-4 text-right text-[11px] font-black uppercase tracking-widest text-slate-400">Prix Unitaire</th>
              <th className="py-4 text-right text-[11px] font-black uppercase tracking-widest text-slate-400">Total</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {invoice.items && invoice.items.length > 0 ? (
              invoice.items.map((item, idx) => (
                <tr key={idx}>
                  <td className="py-6">
                    <p className="font-black text-slate-900 text-xl uppercase tracking-tighter">{item.name}</p>
                  </td>
                  <td className="py-6 text-center font-black text-xl text-slate-900">
                    {item.quantity}
                  </td>
                  <td className="py-6 text-right font-black text-xl text-slate-900 italic">
                    {item.price.toFixed(2)}€
                  </td>
                  <td className="py-6 text-right font-black text-2xl text-slate-900 italic">
                    {(item.price * item.quantity).toFixed(2)}€
                  </td>
                </tr>
              ))
            ) : null}
          </tbody>
          <tfoot>
            <tr className="border-t-2 border-slate-900">
              <td colSpan={3} className="py-8 text-right text-[10px] font-black uppercase tracking-widest text-slate-400 pr-8">
                Total TTC
              </td>
              <td className="py-8 text-right text-5xl font-black text-slate-900 italic">
                {invoice.amount.toFixed(2)}€
              </td>
            </tr>
          </tfoot>
        </table>

        {invoice.notes && (
          <div className="mt-12 p-6 bg-slate-50 border-l-4 border-slate-900 rounded-r-3xl">
            <p className="text-[10px] font-black text-slate-400 uppercase mb-2 tracking-widest">Notes</p>
            <p className="text-sm text-slate-700 italic leading-relaxed">"{invoice.notes}"</p>
          </div>
        )}
      </div>

      <div className="bg-slate-50 p-10 border-t border-slate-200 mt-auto">
        <div className="flex justify-between items-center">
          <div className="space-y-1">
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Moyen de paiement</p>
            <p className="text-xl font-black text-slate-900 uppercase italic">{invoice.paymentMethod}</p>
          </div>
          <div className="text-right space-y-1">
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">SIRET</p>
            <p className="text-sm font-bold text-slate-600">{config.siret || "123 456 789 00012"}</p>
            <p className="text-[9px] text-slate-400 uppercase mt-2">TVA non applicable, art. 293 B du CGI</p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ProductInvoicePDF;
