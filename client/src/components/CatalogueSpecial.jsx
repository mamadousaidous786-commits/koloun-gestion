import React, { useEffect, useMemo, useState } from 'react';
import { toast } from 'react-toastify';
import { FiPlus, FiEdit2, FiEyeOff, FiEye, FiImage, FiX, FiSearch, FiExternalLink } from 'react-icons/fi';
import Modal from './Modal';
import { listerModelesSpeciaux, publierModeleSpecial, modifierModeleSpecial, retirerModeleSpecial } from '../services/catalogueSpecialService';
import { compresserImages } from '../utils/images';
import { urlFichier } from '../utils/fichiers';
import { formaterGNF } from '../utils/format';

const URL_BOUTIQUE = import.meta.env.VITE_BOUTIQUE_URL || '';

const vide = () => ({ nom: '', prix: '', tailles: '39, 40, 41, 42, 43, 44', delai: '2 à 3 semaines', description: '' });

// Formulaire d'ajout / de modification d'un modèle (photos multiples)
function FormulaireModele({ modele, onFerme, onEnregistre }) {
  const enEdition = !!modele;
  const [champs, setChamps] = useState(() => (enEdition
    ? { nom: modele.nom, prix: String(modele.prix), tailles: modele.tailles.join(', '), delai: modele.delai, description: modele.description }
    : vide()));
  const [photosGardees, setPhotosGardees] = useState(enEdition ? modele.images : []);
  const [nouvelles, setNouvelles] = useState([]); // { fichier, apercu }
  const [enchainer, setEnchainer] = useState(!enEdition);
  const [envoi, setEnvoi] = useState(false);

  useEffect(() => () => nouvelles.forEach((n) => URL.revokeObjectURL(n.apercu)), []); // eslint-disable-line react-hooks/exhaustive-deps

  const ajouterPhotos = (liste) => {
    const fichiers = [...liste].filter((f) => f.type.startsWith('image/') || /\.(heic|heif)$/i.test(f.name));
    setNouvelles((n) => [...n, ...fichiers.map((fichier) => ({ fichier, apercu: URL.createObjectURL(fichier) }))]);
  };
  const retirerNouvelle = (i) => setNouvelles((n) => { URL.revokeObjectURL(n[i].apercu); return n.filter((_, k) => k !== i); });

  const soumettre = async (e) => {
    e.preventDefault();
    if (!champs.nom.trim()) return toast.error('Indiquez le nom du modèle.');
    if (!(Number(champs.prix) > 0)) return toast.error('Indiquez un prix valide.');
    if (photosGardees.length + nouvelles.length === 0) return toast.error('Ajoutez au moins une photo.');
    setEnvoi(true);
    try {
      const fd = new FormData();
      Object.entries(champs).forEach(([k, v]) => fd.append(k, typeof v === 'string' ? v.trim() : v));
      if (enEdition) fd.append('images_conservees', JSON.stringify(photosGardees));
      const fichiers = await compresserImages(nouvelles.map((n) => n.fichier));
      fichiers.forEach((f) => fd.append('images', f));
      if (enEdition) await modifierModeleSpecial(modele.id, fd);
      else await publierModeleSpecial(fd);
      toast.success(enEdition ? 'Modèle mis à jour' : 'Modèle publié dans la boutique');
      onEnregistre();
      if (!enEdition && enchainer) {
        // On garde les pointures, le délai et le prix : pratique pour enregistrer plusieurs modèles à la suite
        nouvelles.forEach((n) => URL.revokeObjectURL(n.apercu));
        setNouvelles([]);
        setChamps((c) => ({ ...c, nom: '', description: '' }));
      } else {
        onFerme();
      }
    } catch (err) {
      toast.error(err.response?.data?.message || "L'enregistrement n'a pas abouti. Réessayez.");
    } finally {
      setEnvoi(false);
    }
  };

  const maj = (k) => (e) => setChamps((c) => ({ ...c, [k]: e.target.value }));
  const total = photosGardees.length + nouvelles.length;

  return (
    <Modal titre={enEdition ? 'Modifier le modèle' : 'Nouveau modèle en commande spéciale'} onClose={onFerme} large>
      <form onSubmit={soumettre} className="space-y-4">
        <div>
          <label className="etiquette">Nom du modèle</label>
          <input className="input-champ" value={champs.nom} onChange={maj('nom')} placeholder="Ex. : Jordan 4 Retro noire" autoFocus />
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className="etiquette">Prix (GNF)</label>
            <input className="input-champ" type="number" inputMode="numeric" min="1" value={champs.prix} onChange={maj('prix')} />
          </div>
          <div>
            <label className="etiquette">Délai de livraison</label>
            <input className="input-champ" value={champs.delai} onChange={maj('delai')} />
          </div>
        </div>
        <div>
          <label className="etiquette">Pointures / tailles proposées (séparées par des virgules)</label>
          <input className="input-champ" value={champs.tailles} onChange={maj('tailles')} placeholder="Laisser vide si taille unique" />
        </div>
        <div>
          <label className="etiquette">Description (facultatif)</label>
          <input className="input-champ" value={champs.description} onChange={maj('description')} placeholder="Matière, couleur, détails…" />
        </div>

        <div>
          <label className="etiquette">Photos ({total})</label>
          <div className="grid grid-cols-4 sm:grid-cols-6 gap-2">
            {photosGardees.map((url) => (
              <div key={url} className="relative aspect-square rounded-lg overflow-hidden bg-slate-100">
                <img src={urlFichier(url, 200)} alt="" className="w-full h-full object-cover" />
                <button type="button" onClick={() => setPhotosGardees((p) => p.filter((x) => x !== url))} className="absolute top-1 right-1 w-6 h-6 rounded-full bg-black/60 text-white flex items-center justify-center" title="Retirer la photo"><FiX size={13} /></button>
              </div>
            ))}
            {nouvelles.map((n, i) => (
              <div key={n.apercu} className="relative aspect-square rounded-lg overflow-hidden bg-slate-100">
                <img src={n.apercu} alt="" className="w-full h-full object-cover" />
                <button type="button" onClick={() => retirerNouvelle(i)} className="absolute top-1 right-1 w-6 h-6 rounded-full bg-black/60 text-white flex items-center justify-center" title="Retirer la photo"><FiX size={13} /></button>
              </div>
            ))}
            <label className="aspect-square rounded-lg border-2 border-dashed border-slate-300 text-slate-500 flex flex-col items-center justify-center text-xs cursor-pointer hover:border-blue-400 hover:text-blue-600">
              <FiPlus size={20} />
              Ajouter
              <input type="file" accept="image/*" multiple className="hidden" onChange={(e) => { ajouterPhotos(e.target.files); e.target.value = ''; }} />
            </label>
          </div>
        </div>

        {!enEdition && (
          <label className="flex items-center gap-2 text-sm text-slate-700 cursor-pointer">
            <input type="checkbox" checked={enchainer} onChange={(e) => setEnchainer(e.target.checked)} className="w-4 h-4 accent-blue-600" />
            Après l'enregistrement, garder la fenêtre ouverte pour ajouter un autre modèle
          </label>
        )}

        <div className="flex justify-end gap-2 pt-2">
          <button type="button" onClick={onFerme} className="btn-secondary">Fermer</button>
          <button type="submit" disabled={envoi} className="btn-primary min-w-[10rem]">{envoi ? 'Enregistrement…' : enEdition ? 'Enregistrer' : 'Publier le modèle'}</button>
        </div>
      </form>
    </Modal>
  );
}

// Liste des modèles proposés en commande spéciale dans Koloun Boutique
export default function CatalogueSpecial() {
  const [modeles, setModeles] = useState([]);
  const [chargement, setChargement] = useState(true);
  const [formulaire, setFormulaire] = useState(null); // null | 'nouveau' | modèle
  const [recherche, setRecherche] = useState('');
  const [voirRetires, setVoirRetires] = useState(false);

  const charger = () => listerModelesSpeciaux()
    .then(setModeles)
    .catch((e) => toast.error(e.response?.data?.message || 'Impossible de charger les modèles.'))
    .finally(() => setChargement(false));
  useEffect(() => { charger(); }, []);

  const actifs = modeles.filter((m) => m.actif).length;
  const liste = useMemo(() => {
    const r = recherche.trim().toLowerCase();
    return modeles.filter((m) => (voirRetires ? !m.actif : m.actif) && (!r || m.nom.toLowerCase().includes(r)));
  }, [modeles, recherche, voirRetires]);

  const basculer = async (m) => {
    try {
      if (m.actif) {
        if (!window.confirm(`Retirer « ${m.nom} » de la boutique en ligne ?`)) return;
        await retirerModeleSpecial(m.id);
        toast.success('Modèle retiré de la boutique');
      } else {
        const fd = new FormData();
        fd.append('actif', '1');
        await modifierModeleSpecial(m.id, fd);
        toast.success('Modèle remis en ligne');
      }
      charger();
    } catch (e) {
      toast.error(e.response?.data?.message || "L'opération n'a pas abouti.");
    }
  };

  return (
    <div>
      <div className="flex flex-wrap items-center gap-2 mb-5">
        <div className="relative flex-1 min-w-[200px] max-w-sm">
          <FiSearch className="absolute left-3.5 top-3.5 text-slate-400" />
          <input className="input-champ pl-10" placeholder="Rechercher un modèle…" value={recherche} onChange={(e) => setRecherche(e.target.value)} />
        </div>
        <button onClick={() => setVoirRetires((v) => !v)} className="btn-secondary">
          {voirRetires ? <><FiEye /> Voir les modèles en ligne</> : <><FiEyeOff /> Voir les modèles retirés</>}
        </button>
        {URL_BOUTIQUE && <a href={`${URL_BOUTIQUE}/commande-speciale`} target="_blank" rel="noreferrer" className="btn-secondary"><FiExternalLink /> Voir dans la boutique</a>}
        <button onClick={() => setFormulaire('nouveau')} className="btn-primary"><FiPlus /> Ajouter un modèle</button>
      </div>

      <p className="text-sm text-slate-500 mb-4">
        {actifs} modèle{actifs > 1 ? 's' : ''} visible{actifs > 1 ? 's' : ''} par les clients dans la partie « Commande spéciale » de Koloun Boutique. Aucune limite : ajoutez-en autant que vous voulez.
      </p>

      {chargement ? (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
          {Array.from({ length: 10 }, (_, i) => <div key={i} className="card !p-0 overflow-hidden"><div className="aspect-square bg-slate-100" /><div className="h-[5.5rem]" /></div>)}
        </div>
      ) : liste.length === 0 ? (
        <div className="card text-center text-slate-400 py-10">
          {voirRetires ? 'Aucun modèle retiré.' : 'Aucun modèle pour le moment. Cliquez sur « Ajouter un modèle ».'}
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
          {liste.map((m) => (
            <div key={m.id} className="card !p-0 overflow-hidden flex flex-col">
              <div className="relative aspect-square bg-slate-50 flex items-center justify-center overflow-hidden">
                {m.images[0] ? <img loading="lazy" decoding="async" src={urlFichier(m.images[0], 400)} alt={m.nom} className="w-full h-full object-contain" /> : <FiImage className="text-slate-300" size={28} />}
                {m.images.length > 1 && <span className="absolute bottom-1.5 right-1.5 bg-black/60 text-white text-[10px] px-1.5 py-0.5 rounded-full">{m.images.length} photos</span>}
              </div>
              <div className="p-3 flex flex-col flex-1">
                <p className="font-medium text-slate-900 truncate" title={m.nom}>{m.nom}</p>
                <p className="text-sm font-semibold text-blue-600 tabular-nums">{formaterGNF(m.prix)}</p>
                <p className="text-xs text-slate-500 truncate h-4">{m.tailles.length ? `Tailles : ${m.tailles.join(', ')}` : 'Taille unique'}</p>
                <div className="flex gap-2 mt-2 pt-2 border-t border-slate-100">
                  <button onClick={() => setFormulaire(m)} className="flex-1 inline-flex items-center justify-center gap-1 text-xs font-medium text-blue-600 hover:bg-blue-50 rounded-lg py-1.5"><FiEdit2 size={13} /> Modifier</button>
                  <button onClick={() => basculer(m)} className={`flex-1 inline-flex items-center justify-center gap-1 text-xs font-medium rounded-lg py-1.5 ${m.actif ? 'text-red-600 hover:bg-red-50' : 'text-emerald-600 hover:bg-emerald-50'}`}>
                    {m.actif ? <><FiEyeOff size={13} /> Retirer</> : <><FiEye size={13} /> Remettre</>}
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {formulaire && (
        <FormulaireModele
          modele={formulaire === 'nouveau' ? null : formulaire}
          onFerme={() => setFormulaire(null)}
          onEnregistre={charger}
        />
      )}
    </div>
  );
}
