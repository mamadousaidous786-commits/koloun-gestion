import React, { useEffect, useState } from 'react';
import { toast } from 'react-toastify';
import { FiPlus, FiTruck, FiTrash2 } from 'react-icons/fi';
import { listerCommandes, creerCommande, mettreAJourTransport, mettreAJourRentabilite, supprimerCommande } from '../services/commandeService';
import { listerFournisseurs, creerFournisseur } from '../services/fournisseurService';

const videFormulaire = { fournisseur_id: '', nom_commande: '', montant_total: '', quantite_totale: '', transport: '', date_commande: new Date().toISOString().slice(0, 10) };

export default function Commandes() {
  const [commandes, setCommandes] = useState([]);
  const [fournisseurs, setFournisseurs] = useState([]);
  const [modalOuvert, setModalOuvert] = useState(false);
  const [formulaire, setFormulaire] = useState(videFormulaire);
  const [nouveauFournisseur, setNouveauFournisseur] = useState('');
  const [periode, setPeriode] = useState('mois');
  const [dateFiltre, setDateFiltre] = useState(new Date().toISOString().slice(0, 10));
  const [transportModif, setTransportModif] = useState({});

  const charger = () => {
    listerCommandes({ periode, date: dateFiltre }).then(setCommandes).catch(() => {});
    listerFournisseurs().then(setFournisseurs).catch(() => {});
  };

  useEffect(charger, [periode, dateFiltre]);

  const ajouterFournisseur = async () => {
    if (!nouveauFournisseur.trim()) return;
    const f = await creerFournisseur({ nom: nouveauFournisseur });
    setFournisseurs([...fournisseurs, f]);
    setFormulaire({ ...formulaire, fournisseur_id: f.id });
    setNouveauFournisseur('');
  };

  const soumettre = async (e) => {
    e.preventDefault();
    try {
      await creerCommande(formulaire);
      toast.success('Commande enregistrée.');
      setModalOuvert(false);
      setFormulaire(videFormulaire);
      charger();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Erreur.');
    }
  };

  const enregistrerTransport = async (id) => {
    const valeur = transportModif[id];
    if (valeur === undefined) return;
    await mettreAJourTransport(id, valeur);
    toast.success('Transport mis à jour.');
    charger();
  };

  const supprimer = async (id) => {
    if (!confirm('Supprimer cette commande ?')) return;
    await supprimerCommande(id);
    charger();
  };

  const formaterGNF = (val) => `${Number(val || 0).toLocaleString('fr-FR')} GNF`;

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <h1 className="titre-or text-2xl flex items-center gap-2"><FiTruck /> Commandes</h1>
        <button onClick={() => setModalOuvert(true)} className="btn-primary flex items-center gap-2">
          <FiPlus /> Nouvelle commande
        </button>
      </div>

      {/* Filtres période */}
      <div className="flex flex-wrap items-center gap-3 mb-4">
        <select value={periode} onChange={(e) => setPeriode(e.target.value)} className="input-champ w-auto">
          <option value="jour">Journalier</option>
          <option value="mois">Mensuel</option>
        </select>
        <input type="date" value={dateFiltre} onChange={(e) => setDateFiltre(e.target.value)} className="input-champ w-auto" />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {commandes.map((c) => (
          <div key={c.id} className="card">
            <div className="flex justify-between items-start mb-2">
              <div>
                <p className="font-semibold text-charbon-50">{c.nom_commande || `Commande #${c.id}`}</p>
                <p className="text-xs text-charbon-100/50">{c.Fournisseur?.nom} · {new Date(c.date_commande).toLocaleDateString('fr-FR')}</p>
              </div>
              <div className="flex items-center gap-2">
                <span className={`text-xs px-2 py-1 rounded-full ${c.statut === 'amortie' ? 'bg-green-500/15 text-green-600' : 'bg-yellow-500/15 text-yellow-600'}`}>
                  {c.statut === 'amortie' ? 'Objectif atteint' : 'En cours'}
                </span>
                <button onClick={() => supprimer(c.id)} className="text-red-500"><FiTrash2 size={14} /></button>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2 text-sm mb-3">
              <div><p className="text-charbon-100/50 text-xs">Montant total</p><p>{formaterGNF(c.montant_total)}</p></div>
              <div><p className="text-charbon-100/50 text-xs">Quantité totale</p><p>{c.quantite_totale}</p></div>
              <div><p className="text-charbon-100/50 text-xs">Prix unitaire produit</p><p>{formaterGNF(c.prix_unitaire)}</p></div>
              <div><p className="text-charbon-100/50 text-xs">Transport unitaire</p><p>{formaterGNF(c.transport_unitaire)}</p></div>
              <div><p className="text-charbon-100/50 text-xs">Coût réel (produit + transport)</p><p className="text-or-300 font-medium">{formaterGNF(c.cout_reel)}</p></div>
              <div><p className="text-charbon-100/50 text-xs">Objectif (coût réel × quantité)</p><p className="text-or-300 font-medium">{formaterGNF(c.objectif)}</p></div>
            </div>

            <div className="flex items-end gap-2">
              <div className="flex-1">
                <label className="text-xs text-charbon-100/50">Transport (à définir une fois le produit arrivé)</label>
                <input
                  type="number" placeholder="Montant transport"
                  defaultValue={c.transport}
                  onChange={(e) => setTransportModif({ ...transportModif, [c.id]: e.target.value })}
                  className="input-champ"
                />
              </div>
              <button onClick={() => enregistrerTransport(c.id)} className="btn-secondary">OK</button>
            </div>
          </div>
        ))}
        {commandes.length === 0 && (
          <p className="col-span-full text-center py-10 text-charbon-100/40">Aucune commande pour cette période.</p>
        )}
      </div>

      {modalOuvert && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="card w-full max-w-lg">
            <h2 className="titre-or text-lg mb-4">Nouvelle commande</h2>
            <form onSubmit={soumettre} className="grid grid-cols-2 gap-3">
              <div className="col-span-2">
                <select required className="input-champ w-full" value={formulaire.fournisseur_id} onChange={(e) => setFormulaire({ ...formulaire, fournisseur_id: e.target.value })}>
                  <option value="">-- Fournisseur --</option>
                  {fournisseurs.map((f) => <option key={f.id} value={f.id}>{f.nom}</option>)}
                </select>
              </div>
              <div className="col-span-2 flex gap-2">
                <input placeholder="Ajouter un nouveau fournisseur" className="input-champ flex-1" value={nouveauFournisseur} onChange={(e) => setNouveauFournisseur(e.target.value)} />
                <button type="button" onClick={ajouterFournisseur} className="btn-secondary">Ajouter</button>
              </div>
              <input placeholder="Nom de la commande" className="input-champ col-span-2" value={formulaire.nom_commande} onChange={(e) => setFormulaire({ ...formulaire, nom_commande: e.target.value })} />
              <input required type="number" placeholder="Montant total de la commande" className="input-champ" value={formulaire.montant_total} onChange={(e) => setFormulaire({ ...formulaire, montant_total: e.target.value })} />
              <input required type="number" placeholder="Quantité totale" className="input-champ" value={formulaire.quantite_totale} onChange={(e) => setFormulaire({ ...formulaire, quantite_totale: e.target.value })} />
              <input type="number" placeholder="Transport (facultatif pour l'instant)" className="input-champ" value={formulaire.transport} onChange={(e) => setFormulaire({ ...formulaire, transport: e.target.value })} />
              <input required type="date" className="input-champ" value={formulaire.date_commande} onChange={(e) => setFormulaire({ ...formulaire, date_commande: e.target.value })} />
              <div className="col-span-2 flex justify-end gap-2 mt-2">
                <button type="button" onClick={() => setModalOuvert(false)} className="btn-secondary">Annuler</button>
                <button type="submit" className="btn-primary">Enregistrer</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
