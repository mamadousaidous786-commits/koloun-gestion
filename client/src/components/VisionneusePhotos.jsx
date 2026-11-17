import React, { useEffect, useState } from 'react';
import { FiX, FiChevronLeft, FiChevronRight } from 'react-icons/fi';
import { urlFichier } from '../utils/fichiers';

// Affiche les photos en grand (clic sur une image) : photos = [{ image, legende }]
export default function VisionneusePhotos({ photos, depart = 0, onClose }) {
  const [i, setI] = useState(depart);
  const total = photos.length;
  const precedent = () => setI((v) => (v - 1 + total) % total);
  const suivant = () => setI((v) => (v + 1) % total);

  useEffect(() => {
    const touche = (e) => {
      if (e.key === 'Escape') onClose();
      if (e.key === 'ArrowLeft') precedent();
      if (e.key === 'ArrowRight') suivant();
    };
    window.addEventListener('keydown', touche);
    return () => window.removeEventListener('keydown', touche);
  });

  const p = photos[i];
  return (
    <div className="fixed inset-0 z-[100] bg-black/90 flex flex-col" onClick={onClose}>
      <div className="flex items-center justify-between px-4 py-3 text-white" onClick={(e) => e.stopPropagation()}>
        <p className="text-sm">{p.legende}{total > 1 ? `  ·  ${i + 1}/${total}` : ''}</p>
        <button onClick={onClose} className="p-2 rounded-full bg-white/10 hover:bg-white/20"><FiX size={20} /></button>
      </div>
      <div className="flex-1 flex items-center justify-center min-h-0 px-2 relative">
        {total > 1 && <button onClick={(e) => { e.stopPropagation(); precedent(); }} className="absolute left-2 p-3 rounded-full bg-white/10 hover:bg-white/20 text-white"><FiChevronLeft size={22} /></button>}
        <img src={urlFichier(p.image, 1400)} alt={p.legende} className="max-w-full max-h-full object-contain" onClick={(e) => e.stopPropagation()} />
        {total > 1 && <button onClick={(e) => { e.stopPropagation(); suivant(); }} className="absolute right-2 p-3 rounded-full bg-white/10 hover:bg-white/20 text-white"><FiChevronRight size={22} /></button>}
      </div>
      {total > 1 && (
        <div className="flex gap-2 justify-center p-3 overflow-x-auto" onClick={(e) => e.stopPropagation()}>
          {photos.map((x, k) => (
            <button key={k} onClick={() => setI(k)} className={`w-14 h-14 rounded-lg overflow-hidden shrink-0 ring-2 ${k === i ? 'ring-white' : 'ring-transparent opacity-60'}`}>
              <img src={urlFichier(x.image, 150)} alt="" className="w-full h-full object-cover" />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
