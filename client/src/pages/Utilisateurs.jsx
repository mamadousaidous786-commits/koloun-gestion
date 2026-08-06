import React, { useEffect, useState } from 'react';
import { toast } from 'react-toastify';
import { FiPlus, FiTrash2, FiToggleLeft, FiToggleRight } from 'react-icons/fi';
import { listerUtilisateurs, creerUtilisateur, changerStatutUtilisateur, supprimerUtilisateur } from '../services/utilisateurService';

const videFormulaire = { nom: '', prenom: '', email: '', telephone: '', mot_de_passe: '', role_id: 2 };

export default function Utilisateurs() {
  const [utilisateurs, setUtilisateurs] = useState([]);
  const [modalOuvert, setModalOuvert] = useState(false);
  const [formulaire, setFormulaire] = useState(videFormulaire);

 const charger = async () => {
  try {
    const data = await listerUtilisateurs();
    setUtilisateurs(data);
  } catch (error) {
    console.error(error);
  }
};

useEffect(() => {
  charger();
}, []);

  const soumettre = async (e) => {
    e.preventDefault();
    try {
      await creerUtilisateur(formulaire);
      toast.success('Utilisateur créé.');
      setModalOuvert(false);
      setFormulaire(videFormulaire);
      charger();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Erreur.');
    }
  };

  const basculerStatut = async (id) => { await changerStatutUtilisateur(id); charger(); };
  const supprimer = async (id) => { if (confirm('Supprimer cet utilisateur ?')) { await supprimerUtilisateur(id); charger(); } };

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <h1 className="titre-or text-2xl">Utilisateurs</h1>
        <button onClick={() => setModalOuvert(true)} className="btn-primary flex items-center gap-2"><FiPlus /> Nouvel utilisateur</button>
      </div>

      <div className="card overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-charbon-100/60 border-b border-charbon-800">
              <th className="pb-2">Nom</th><th className="pb-2">Email</th><th className="pb-2">Rôle</th><th className="pb-2">Statut</th><th className="pb-2">Actions</th>
            </tr>
          </thead>
          <tbody>
            {utilisateurs.map((u) => (
              <tr key={u.id} className="border-b border-charbon-800/50">
                <td className="py-2">{u.nom} {u.prenom}</td>
                <td className="py-2">{u.email}</td>
                <td className="py-2 capitalize">{u.Role?.nom}</td>
                <td className="py-2">
                  <button onClick={() => basculerStatut(u.id)} className={u.actif ? 'text-green-400' : 'text-charbon-100/40'}>
                    {u.actif ? <FiToggleRight size={20} /> : <FiToggleLeft size={20} />}
                  </button>
                </td>
                <td className="py-2"><button onClick={() => supprimer(u.id)} className="text-red-400"><FiTrash2 /></button></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {modalOuvert && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
          <div className="card w-full max-w-md">
            <h2 className="titre-or text-lg mb-4">Nouvel utilisateur</h2>
            <form onSubmit={soumettre} className="grid grid-cols-2 gap-3">
              <input required placeholder="Nom" className="input-champ" value={formulaire.nom} onChange={(e) => setFormulaire({ ...formulaire, nom: e.target.value })} />
              <input placeholder="Prénom" className="input-champ" value={formulaire.prenom} onChange={(e) => setFormulaire({ ...formulaire, prenom: e.target.value })} />
              <input required type="email" placeholder="Email" className="input-champ col-span-2" value={formulaire.email} onChange={(e) => setFormulaire({ ...formulaire, email: e.target.value })} />
              <input placeholder="Téléphone" className="input-champ" value={formulaire.telephone} onChange={(e) => setFormulaire({ ...formulaire, telephone: e.target.value })} />
              <select className="input-champ" value={formulaire.role_id} onChange={(e) => setFormulaire({ ...formulaire, role_id: Number(e.target.value) })}>
                <option value={2}>Utilisateur</option>
                <option value={1}>Administrateur</option>
              </select>
              <input required type="password" placeholder="Mot de passe" className="input-champ col-span-2" value={formulaire.mot_de_passe} onChange={(e) => setFormulaire({ ...formulaire, mot_de_passe: e.target.value })} />
              <div className="col-span-2 flex justify-end gap-2 mt-2">
                <button type="button" onClick={() => setModalOuvert(false)} className="btn-secondary">Annuler</button>
                <button type="submit" className="btn-primary">Créer</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
