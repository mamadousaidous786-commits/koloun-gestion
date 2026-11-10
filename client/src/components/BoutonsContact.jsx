import React from 'react';
import { FiPhone } from 'react-icons/fi';
import { FaWhatsapp } from 'react-icons/fa';
import { lienAppel, lienWhatsApp } from '../utils/format';

// Boutons "Appeler" et "WhatsApp" pour un numéro de téléphone
export default function BoutonsContact({ telephone, message = '' }) {
  if (!telephone) return null;
  return (
    <div className="flex gap-2">
      <a href={lienAppel(telephone)} className="inline-flex items-center gap-1.5 text-xs font-medium text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-lg px-2.5 py-1.5">
        <FiPhone size={13} /> Appeler
      </a>
      <a href={lienWhatsApp(telephone, message)} target="_blank" rel="noreferrer"
        className="inline-flex items-center gap-1.5 text-xs font-medium text-emerald-700 bg-emerald-50 hover:bg-emerald-100 rounded-lg px-2.5 py-1.5">
        <FaWhatsapp size={14} /> WhatsApp
      </a>
    </div>
  );
}
