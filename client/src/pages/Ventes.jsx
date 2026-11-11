import React, { useEffect, useState } from 'react';
import { toast } from 'react-toastify';
import { FiTrash2, FiPrinter, FiImage, FiShoppingCart, FiPlus } from 'react-icons/fi';
import { FaWhatsapp } from 'react-icons/fa';
import EnTete from '../components/EnTete';
import { listerProduits } from '../services/produitService';
import { listerClients } from '../services/clientService';
import { creerVente, listerVentes, genererRecu, supprimerVente } from '../services/venteService';
import { urlFichier } from '../utils/fichiers';
import { formaterGNF, lienWhatsApp, aujourdhui } from '../utils/format';
import { useAuth } from '../context/AuthContext';

const MOYENS_PAIEMENT = [
  { id: 1, nom: 'Orange Money' },
  { id: 2, nom: 'Paiement Marchand' },
  { id: 3, nom: 'Cash' },
];

export default function Ventes() {
  const { estAdmin } = useAuth();
  const [produits, setProduits] = useState([]);
  const [clients, setClients] = useState([]);
  const [varianteChoisie, setVarianteChoisie] = useState({}); // { produit_id: index de variante }
  const [tailleChoisie, setTailleChoisie] = useState({});     // { produit_id: produit_taille_id }
  const [panier, setPanier] = useState([]);
  const [moyenPaiementId, setMoyenPaiementId] = useState(3);
  const [clientId, setClientId] = useState('');
  const [observation, setObservation] = useState('');
  const [ventes, setVentes] = useState([]);
  const [jour, setJour] = useState(aujourdhui()); // administrateur : peut consulter un autre jour

  const charger = () => {
    listerProduits().then(setProduits).catch(() => {});
    listerVentes(estAdmin ? { jour } : undefined).then(setVentes).catch(() => {});
  };
  useEffect(() => {
    charger();
  }, [jour]);
  useEffect(() => {
    listerClients().then(setClients).catch(() => {});
  }, []);

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

    if (!taille) return toast.warn("Cette photo n'a aucune taille configurée.");
    if (taille.quantite <= 0) return toast.warn('Taille en rupture de stock.');

    const existant = panier.find((a) => a.produit_taille_id === taille.id);
    if (existant) {
      setPanier(panier.map((a) => (a.produit_taille_id === taille.id ? { ...a, quantite: a.quantite + 1 } : a)));
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

  const retirerDuPanier = (id) => setPanier(panier.filter((a) => a.produit_taille_id !== id));
  const modifierQuantite = (id, quantite) => setPanier(panier.map((a) => (a.produit_taille_id === id ? { ...a, quantite: Number(quantite) } : a)));
  const modifierPrix = (id, prix) => setPanier(panier.map((a) => (a.produit_taille_id === id ? { ...a, prix_applique: Number(prix) } : a)));

  const total = panier.reduce((acc, a) => acc + a.prix_applique * a.quantite, 0);

  const [enregistrement, setEnregistrement] = useState(false);

  const validerVente = async () => {
    if (panier.length === 0) return toast.warn('Le panier est vide.');
    if (enregistrement) return; // évite une double vente si on reclique pendant l'attente
    setEnregistrement(true);
    try {
      const articles = panier.map((a) => ({
        produit_taille_id: a.produit_taille_id,
        quantite: a.quantite,
        prix_applique: a.prix_applique,
      }));
      const vente = await creerVente({ articles, moyen_paiement_id: moyenPaiementId, observation, client_id: clientId || undefined });
      toast.success(`Vente enregistrée : ${vente.numero_recu}`);
      setPanier([]);
      setObservation('');
      setClientId('');
      charger();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Erreur lors de la vente.');
    } finally {
      setEnregistrement(false);
    }
  };

  // L'onglet est ouvert tout de suite (au clic) : sinon le téléphone bloque l'ouverture après l'attente du serveur
  const imprimerRecu = async (venteId) => {
    const onglet = window.open('', '_blank');
    try {
      const res = await genererRecu(venteId);
      if (onglet) onglet.location.href = urlFichier(res.chemin);
      else toast.error("Le navigateur a bloqué l'ouverture du reçu. Autorisez les pop-ups pour ce site.");
    } catch {
      toast.error('Impossible de générer le reçu.');
      if (onglet) onglet.close();
    }
  };

  // Envoie le lien du reçu par WhatsApp (au client si son numéro est connu, sinon vous choisissez le contact)
  const envoyerWhatsApp = async (venteId) => {
    const onglet = window.open('', '_blank');
    try {
      const res = await genererRecu(venteId);
      const message = `Bonjour, voici votre reçu ${res.numero_recu} de Koloun Luxure (${formaterGNF(res.montant_total)}) : ${res.lien_public}\nMerci de votre confiance !`;
      const lien = lienWhatsApp(res.client_telephone, message);
      if (onglet) onglet.location.href = lien;
      else window.location.href = lien;
    } catch {
      toast.error("Impossible de préparer l'envoi WhatsApp.");
      if (onglet) onglet.close();
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
      <EnTete titre="Ventes" sousTitre="Encaissez rapidement et envoyez le reçu en un clic" icone={<FiShoppingCart />} />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Produits disponibles */}
        <div className="lg:col-span-2 card flex flex-col h-[26rem] sm:h-[30rem] lg:h-[36rem]">
          <h2 className="font-semibold text-slate-900 mb-4 flex-shrink-0">Produits disponibles</h2>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3 overflow-y-auto flex-1 min-h-0 pr-1 content-start">
            {produits.map((p) => {
              const indexVariante = varianteChoisie[p.id] || 0;
              const variante = p.ProduitVariantes?.[indexVariante];

              return (
                <div key={p.id} className="bg-white border border-slate-200 rounded-xl overflow-visible hover:border-blue-400 hover:shadow-md transition flex flex-col">
                  <div className="w-full h-24 bg-slate-100 flex items-center justify-center overflow-hidden flex-shrink-0 rounded-t-xl">
                    {variante?.image ? (
                      <img loading="lazy" decoding="async" src={urlFichier(variante.image)} alt={p.nom} className="w-full h-full object-contain" />
                    ) : (
                      <FiImage className="text-slate-300" size={24} />
                    )}
                  </div>

                  {p.ProduitVariantes?.length > 1 && (
                    <div className="flex gap-1 p-1.5 overflow-x-auto flex-shrink-0">
                      {p.ProduitVariantes.map((v, i) => (
                        <button
                          key={v.id} type="button" onClick={() => choisirVariante(p.id, i)}
                          className={`w-8 h-8 rounded-md flex-shrink-0 overflow-hidden border-2 ${i === indexVariante ? 'border-blue-600' : 'border-transparent'}`}
                        >
                          <img loading="lazy" decoding="async" src={urlFichier(v.image)} alt="" className="w-full h-full object-contain" />
                        </button>
                      ))}
                    </div>
                  )}

                  <div className="p-2.5 flex flex-col flex-1">
                    <p className="text-sm font-semibold text-slate-900 truncate">{p.nom}</p>
                    <p className="text-xs font-medium text-blue-600">{formaterGNF(p.prix_normal)}</p>

                    {variante?.ProduitTailles?.length > 0 && (
                      <select
                        value={tailleChoisie[p.id] || variante.ProduitTailles[0]?.id}
                        onChange={(e) => choisirTaille(p.id, e.target.value)}
                        className="w-full text-xs bg-slate-50 border border-slate-200 rounded-lg mt-1.5 px-1.5 py-1"
                      >
                        {variante.ProduitTailles.map((t) => (
                          <option key={t.id} value={t.id} disabled={t.quantite === 0}>
                            {t.taille} ({t.quantite})
                          </option>
                        ))}
                      </select>
                    )}

                    <button type="button" onClick={() => ajouterAuPanier(p)} className="btn-primary w-full mt-2 !text-xs !py-1.5 !rounded-lg mt-auto">
                      <FiPlus size={13} /> Ajouter
                    </button>
                  </div>
                </div>
              );
            })}
            {produits.length === 0 && <p className="col-span-full text-center text-sm text-slate-400 py-10">Aucun produit.</p>}
          </div>
        </div>

        {/* Panier / vente en cours */}
        <div className="card flex flex-col">
          <h2 className="font-semibold text-slate-900 mb-4">Vente en cours</h2>
          <div className="flex-1 space-y-2 mb-4 max-h-72 overflow-y-auto">
            {panier.map((a) => (
              <div key={a.produit_taille_id} className="bg-slate-50 rounded-xl p-2.5 text-sm">
                <div className="flex items-center gap-2">
                  <div className="w-10 h-10 rounded-lg overflow-hidden bg-white flex-shrink-0 flex items-center justify-center">
                    {a.image ? <img loading="lazy" decoding="async" src={urlFichier(a.image)} alt="" className="w-full h-full object-contain" /> : <FiImage className="text-slate-300" size={16} />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-slate-900 text-xs font-semibold truncate">{a.nom} — {a.taille}</p>
                  </div>
                  <button onClick={() => retirerDuPanier(a.produit_taille_id)} className="text-slate-400 hover:text-red-600"><FiTrash2 size={14} /></button>
                </div>
                <div className="flex gap-2 mt-2">
                  <div className="flex-1">
                    <label className="text-[10px] text-slate-500">Quantité</label>
                    <input type="number" min="1" value={a.quantite} onChange={(e) => modifierQuantite(a.produit_taille_id, e.target.value)} className="w-full bg-white border border-slate-200 rounded-lg px-1 py-1 text-center" />
                  </div>
                  <div className="flex-1">
                    <label className="text-[10px] text-slate-500">Prix appliqué (modifiable)</label>
                    <input type="number" value={a.prix_applique} onChange={(e) => modifierPrix(a.produit_taille_id, e.target.value)}
                      className={`w-full bg-white border rounded-lg px-1 py-1 text-center ${a.prix_applique < a.prix_normal ? 'border-emerald-500 text-emerald-600' : 'border-slate-200'}`} />
                  </div>
                </div>
                {a.prix_applique < a.prix_normal && (
                  <p className="text-[10px] text-emerald-600 mt-1">Prix réduit appliqué (normal : {formaterGNF(a.prix_normal)})</p>
                )}
              </div>
            ))}
            {panier.length === 0 && <p className="text-slate-400 text-sm">Panier vide.</p>}
          </div>

          <select value={clientId} onChange={(e) => setClientId(e.target.value)} className="input-champ mb-2">
            <option value="">Client (facultatif)</option>
            {clients.map((c) => <option key={c.id} value={c.id}>{c.nom}{c.telephone ? ` — ${c.telephone}` : ''}</option>)}
          </select>
          <select value={moyenPaiementId} onChange={(e) => setMoyenPaiementId(Number(e.target.value))} className="input-champ mb-2">
            {MOYENS_PAIEMENT.map((m) => <option key={m.id} value={m.id}>{m.nom}</option>)}
          </select>
          <input placeholder="Observation (facultatif)" value={observation} onChange={(e) => setObservation(e.target.value)} className="input-champ mb-3" />

          <div className="flex justify-between items-baseline text-lg font-bold text-slate-900 mb-3">
            <span>Total</span>
            <span className="text-blue-700">{formaterGNF(total)}</span>
          </div>
          <button onClick={validerVente} disabled={enregistrement} className="btn-primary w-full py-3 disabled:opacity-60">{enregistrement ? 'Enregistrement…' : 'Valider la vente'}</button>
        </div>
      </div>

      {/* Ventes du jour : chaque utilisateur retrouve ses ventes d'aujourd'hui et peut réimprimer un reçu */}
      <div className="card mt-6 overflow-x-auto">
        <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
          <div>
            <h2 className="font-semibold text-slate-900">
              {estAdmin ? (jour === aujourdhui() ? "Ventes d'aujourd'hui" : `Ventes du ${new Date(jour).toLocaleDateString('fr-FR')}`) : 'Mes ventes du jour'}
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              {ventes.length} vente(s) · total <b className="text-blue-700">{formaterGNF(ventes.reduce((a, v) => a + Number(v.montant_total), 0))}</b> · imprimez ou renvoyez un reçu à tout moment
            </p>
          </div>
          {estAdmin && <input type="date" value={jour} max={aujourdhui()} onChange={(e) => setJour(e.target.value || aujourdhui())} className="input-champ !w-auto" />}
        </div>
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-slate-500 border-b border-slate-100">
              <th className="pb-2">Reçu</th>
              <th className="pb-2">Date</th>
              <th className="pb-2">Client</th>
              <th className="pb-2">Montant</th>
              <th className="pb-2">Paiement</th>
              <th className="pb-2">Reçu / envoi</th>
              {estAdmin && <th className="pb-2"></th>}
            </tr>
          </thead>
          <tbody>
            {ventes.map((v) => (
              <tr key={v.id} className="border-b border-slate-50">
                <td className="py-2.5 whitespace-nowrap">{v.numero_recu}</td>
                <td className="py-2.5 whitespace-nowrap">{new Date(v.date_vente).toLocaleString('fr-FR')}</td>
                <td className="py-2.5">{v.Client?.nom || <span className="text-slate-300">—</span>}</td>
                <td className="py-2.5 font-semibold whitespace-nowrap">{formaterGNF(v.montant_total)}</td>
                <td className="py-2.5">{v.MoyenPaiement?.nom}</td>
                <td className="py-2.5">
                  <div className="flex items-center gap-2">
                    <button onClick={() => imprimerRecu(v.id)} className="inline-flex items-center gap-1 text-xs font-medium text-blue-700 bg-blue-50 hover:bg-blue-100 rounded-lg px-2.5 py-1.5">
                      <FiPrinter size={13} /> Reçu
                    </button>
                    <button onClick={() => envoyerWhatsApp(v.id)} className="inline-flex items-center gap-1 text-xs font-medium text-emerald-700 bg-emerald-50 hover:bg-emerald-100 rounded-lg px-2.5 py-1.5">
                      <FaWhatsapp size={14} /> WhatsApp
                    </button>
                  </div>
                </td>
                {estAdmin && (
                  <td className="py-2.5 text-right">
                    <button onClick={() => supprimerLaVente(v.id, v.numero_recu)} className="text-slate-300 hover:text-red-600"><FiTrash2 /></button>
                  </td>
                )}
              </tr>
            ))}
            {ventes.length === 0 && <tr><td colSpan={7} className="text-center py-8 text-slate-400">Aucune vente {estAdmin && jour !== aujourdhui() ? 'ce jour-là' : "aujourd'hui"}.</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}
