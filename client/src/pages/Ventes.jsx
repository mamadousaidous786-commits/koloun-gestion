import React, { useEffect, useState } from 'react';
import { toast } from 'react-toastify';
import { FiTrash2, FiPrinter, FiImage } from 'react-icons/fi';
import { listerProduits } from '../services/produitService';
import { creerVente, listerVentes, genererRecu, supprimerVente } from '../services/venteService';
import { urlFichier } from '../utils/fichiers';
import { useAuth } from '../context/AuthContext';

const MOYENS_PAIEMENT = [
  { id: 1, nom: 'Orange Money' },
  { id: 2, nom: 'Paiement Marchand' },
  { id: 3, nom: 'Cash' },
];

export default function Ventes() {
  const { estAdmin } = useAuth();
  const [produits, setProduits] = useState([]);
  const [varianteChoisie, setVarianteChoisie] = useState({}); // { produit_id: index de variante }
  const [tailleChoisie, setTailleChoisie] = useState({});     // { produit_id: produit_taille_id }
  const [panier, setPanier] = useState([]);
  const [moyenPaiementId, setMoyenPaiementId] = useState(3);
  const [observation, setObservation] = useState('');
  const [ventes, setVentes] = useState([]);

  const charger = () => {
    listerProduits().then(setProduits).catch(() => {});
    listerVentes().then(setVentes).catch(() => {});
  };
  useEffect(charger, []);

  const choisirVariante = (produitId, indexVariante) => {
    setVarianteChoisie({ ...varianteChoisie, [produitId]: indexVariante });
    setTailleChoisie({ ...tailleChoisie, [produitId]: null });
  };

  const choisirTaille = (produitId, tailleId) => {
    setTailleChoisie({ ...tailleChoisie, [produitId]: tailleId });
  };

  const ajouterAuPanier = (produit) => {
    const indexVariante = varianteChoisie[produit.id] || 0;
    const variante = produit.ProduitVariantes?.[indexVariante];
    if (!variante) return toast.warn('Choisissez une photo pour ce produit.');

    const tailleId = tailleChoisie[produit.id] || variante.ProduitTailles?.[0]?.id;
    const taille = variante.ProduitTailles?.find((t) => t.id === Number(tailleId));

    if (!taille) return toast.warn('Cette photo n\'a aucune taille configurée.');
    if (taille.quantite <= 0) return toast.warn('Taille en rupture de stock.');

    const existant = panier.find((a) => a.produit_taille_id === taille.id);
    if (existant) {
      setPanier(panier.map((a) => a.produit_taille_id === taille.id ? { ...a, quantite: a.quantite + 1 } : a));
    } else {
      setPanier([...panier, {
        produit_taille_id: taille.id,
        nom: produit.nom,
        taille: taille.taille,
        image: variante.image,
        prix_applique: Number(produit.prix_normal),
        prix_normal: Number(produit.prix_normal),
        quantite: 1,
      }]);
    }
  };

  const retirerDuPanier = (produit_taille_id) => setPanier(panier.filter((a) => a.produit_taille_id !== produit_taille_id));

  const modifierQuantite = (produit_taille_id, quantite) => {
    setPanier(panier.map((a) => a.produit_taille_id === produit_taille_id ? { ...a, quantite: Number(quantite) } : a));
  };

  const modifierPrix = (produit_taille_id, prix) => {
    setPanier(panier.map((a) => a.produit_taille_id === produit_taille_id ? { ...a, prix_applique: Number(prix) } : a));
  };

  const total = panier.reduce((acc, a) => acc + (a.prix_applique * a.quantite), 0);

  const validerVente = async () => {
    if (panier.length === 0) return toast.warn('Le panier est vide.');
    try {
      const articles = panier.map((a) => ({
        produit_taille_id: a.produit_taille_id,
        quantite: a.quantite,
        prix_applique: a.prix_applique,
      }));
      const vente = await creerVente({ articles, moyen_paiement_id: moyenPaiementId, observation });
      toast.success(`Vente enregistrée : ${vente.numero_recu}`);
      setPanier([]);
      setObservation('');
      charger();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Erreur lors de la vente.');
    }
  };

 const imprimerRecu = async (venteId) => {
  const nouvelOnglet = window.open('', '_blank'); // ouvert tout de suite, dans le geste du clic
  try {
    const res = await genererRecu(venteId);
    if (nouvelOnglet) {
      nouvelOnglet.location.href = urlFichier(res.chemin);
    } else {
      toast.error('Le navigateur a bloqué l\'ouverture du reçu. Autorise les pop-ups pour ce site.');
    }
  } catch {
    toast.error('Impossible de générer le reçu.');
    if (nouvelOnglet) nouvelOnglet.close();
  }
};

  const supprimerLaVente = async (venteId, numeroRecu) => {
    if (!confirm(`Supprimer la vente ${numeroRecu} ? Le stock sera restauré.`)) return;
    try {
      await supprimerVente(venteId);
      toast.success('Vente supprimée, stock restauré.');
      charger();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Erreur lors de la suppression.');
    }
  };

  return (
    <div>
      <h1 className="titre-or text-2xl mb-6">Ventes</h1>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Produits disponibles */}
        <div className="lg:col-span-2 card flex flex-col h-[34rem]">
          <h2 className="text-or-300 font-medium mb-4 flex-shrink-0">Produits disponibles</h2>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3 overflow-y-auto flex-1 min-h-0 pr-1 content-start">
            {produits.map((p) => {
              const indexVariante = varianteChoisie[p.id] || 0;
              const variante = p.ProduitVariantes?.[indexVariante];

              return (
                <div key={p.id} className="bg-charbon-800 rounded-lg overflow-visible border border-transparent hover:border-or-500 transition flex flex-col">
                  <div className="w-full h-24 bg-charbon-900 flex items-center justify-center overflow-hidden flex-shrink-0 rounded-t-lg">
                    {variante?.image ? (
                      <img src={urlFichier(variante.image)} alt={p.nom} className="w-full h-full object-cover" />
                    ) : (
                      <FiImage className="text-charbon-100/30" size={24} />
                    )}
                  </div>

                  {p.ProduitVariantes?.length > 1 && (
                    <div className="flex gap-1 p-1 overflow-x-auto flex-shrink-0">
                      {p.ProduitVariantes.map((v, i) => (
                        <button
                          key={v.id} type="button" onClick={() => choisirVariante(p.id, i)}
                          className={`w-8 h-8 rounded flex-shrink-0 overflow-hidden border-2 ${i === indexVariante ? 'border-or-500' : 'border-transparent'}`}
                        >
                          <img src={urlFichier(v.image)} alt="" className="w-full h-full object-cover" />
                        </button>
                      ))}
                    </div>
                  )}

                  <div className="p-2 flex flex-col flex-1">
                    <p className="text-sm font-medium text-charbon-50 truncate">{p.nom}</p>
                    <p className="text-xs text-or-300">{Number(p.prix_normal).toLocaleString('fr-FR')} GNF</p>

                    {variante?.ProduitTailles?.length > 0 && (
                      <select
                        value={tailleChoisie[p.id] || variante.ProduitTailles[0]?.id}
                        onChange={(e) => choisirTaille(p.id, e.target.value)}
                        className="w-full text-xs bg-charbon-900 border border-or-900/30 rounded mt-1 px-1 py-0.5"
                      >
                        {variante.ProduitTailles.map((t) => (
                          <option key={t.id} value={t.id} disabled={t.quantite === 0}>
                            {t.taille} ({t.quantite})
                          </option>
                        ))}
                      </select>
                    )}

                    <button type="button" onClick={() => ajouterAuPanier(p)} className="btn-primary w-full mt-2 text-xs py-1.5 mt-auto">
                      Ajouter
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Panier / vente en cours */}
        <div className="card flex flex-col">
          <h2 className="text-or-300 font-medium mb-4">Vente en cours</h2>
          <div className="flex-1 space-y-2 mb-4 max-h-72 overflow-y-auto">
            {panier.map((a) => (
              <div key={a.produit_taille_id} className="bg-charbon-800 rounded-lg p-2 text-sm">
                <div className="flex items-center gap-2">
                  <div className="w-10 h-10 rounded overflow-hidden bg-charbon-900 flex-shrink-0 flex items-center justify-center">
                    {a.image ? <img src={urlFichier(a.image)} className="w-full h-full object-cover" /> : <FiImage className="text-charbon-100/30" size={16} />}
                  </div>
                  <div className="flex-1">
                    <p className="text-charbon-50 text-xs font-medium">{a.nom} — {a.taille}</p>
                  </div>
                  <button onClick={() => retirerDuPanier(a.produit_taille_id)} className="text-red-500"><FiTrash2 size={14} /></button>
                </div>
                <div className="flex gap-2 mt-2">
                  <div className="flex-1">
                    <label className="text-[10px] text-charbon-100/50">Quantité</label>
                    <input type="number" min="1" value={a.quantite} onChange={(e) => modifierQuantite(a.produit_taille_id, e.target.value)} className="w-full bg-charbon-900 border border-or-900/30 rounded px-1 py-0.5 text-center" />
                  </div>
                  <div className="flex-1">
                    <label className="text-[10px] text-charbon-100/50">Prix appliqué (modifiable)</label>
                    <input type="number" value={a.prix_applique} onChange={(e) => modifierPrix(a.produit_taille_id, e.target.value)} className={`w-full bg-charbon-900 border rounded px-1 py-0.5 text-center ${a.prix_applique < a.prix_normal ? 'border-green-500 text-green-500' : 'border-or-900/30'}`} />
                  </div>
                </div>
                {a.prix_applique < a.prix_normal && (
                  <p className="text-[10px] text-green-500 mt-1">Prix réduit appliqué (normal: {a.prix_normal.toLocaleString('fr-FR')} GNF)</p>
                )}
              </div>
            ))}
            {panier.length === 0 && <p className="text-charbon-100/40 text-sm">Panier vide.</p>}
          </div>

          <select value={moyenPaiementId} onChange={(e) => setMoyenPaiementId(Number(e.target.value))} className="input-champ mb-2">
            {MOYENS_PAIEMENT.map((m) => <option key={m.id} value={m.id}>{m.nom}</option>)}
          </select>
          <input placeholder="Observation (facultatif)" value={observation} onChange={(e) => setObservation(e.target.value)} className="input-champ mb-3" />

          <div className="flex justify-between text-lg font-semibold text-or-300 mb-3">
            <span>Total</span>
            <span>{total.toLocaleString('fr-FR')} GNF</span>
          </div>
          <button onClick={validerVente} className="btn-primary w-full">Valider la vente</button>
        </div>
      </div>

      {/* Historique des ventes */}
      <div className="card mt-6 overflow-x-auto">
        <h2 className="text-or-300 font-medium mb-4">Historique des ventes</h2>
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-charbon-100/60 border-b border-charbon-800">
              <th className="pb-2">Reçu</th>
              <th className="pb-2">Date</th>
              <th className="pb-2">Montant</th>
              <th className="pb-2">Paiement</th>
              <th className="pb-2">Action</th>
              {estAdmin && <th className="pb-2">Supprimer</th>}
            </tr>
          </thead>
          <tbody>
            {ventes.map((v) => (
              <tr key={v.id} className="border-b border-charbon-800/50">
                <td className="py-2">{v.numero_recu}</td>
                <td className="py-2">{new Date(v.date_vente).toLocaleString('fr-FR')}</td>
                <td className="py-2 text-or-300">{Number(v.montant_total).toLocaleString('fr-FR')} GNF</td>
                <td className="py-2">{v.MoyenPaiement?.nom}</td>
                <td className="py-2">
                  <button onClick={() => imprimerRecu(v.id)} className="text-or-300 hover:text-or-600 flex items-center gap-1">
                    <FiPrinter /> Reçu
                  </button>
                </td>
                {estAdmin && (
                  <td className="py-2">
                    <button onClick={() => supprimerLaVente(v.id, v.numero_recu)} className="text-red-500 hover:text-red-600">
                      <FiTrash2 />
                    </button>
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}