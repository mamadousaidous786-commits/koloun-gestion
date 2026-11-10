import React, { useState } from 'react';
import { toast } from 'react-toastify';
import { FiDatabase, FiDownload, FiShield } from 'react-icons/fi';
import EnTete from '../components/EnTete';
import { telechargerSauvegarde } from '../services/sauvegardeService';

export default function Sauvegarde() {
  const [chargement, setChargement] = useState(false);

  const telecharger = async () => {
    setChargement(true);
    try {
      await telechargerSauvegarde();
      toast.success('Sauvegarde téléchargée. Gardez le fichier en lieu sûr.');
    } catch {
      toast.error('Impossible de créer la sauvegarde.');
    } finally {
      setChargement(false);
    }
  };

  return (
    <div className="max-w-3xl">
      <EnTete titre="Sauvegarde" sousTitre="Protégez les données de votre boutique" icone={<FiDatabase />} />

      <div className="card mb-4">
        <h2 className="font-semibold text-slate-900 mb-1">Télécharger une copie de vos données</h2>
        <p className="text-sm text-slate-600 mb-4">
          Produits, ventes, clients, commandes spéciales, dettes, dépenses… tout est regroupé dans un seul fichier.
          Faites-le régulièrement (par exemple chaque fin de semaine) et gardez le fichier sur votre téléphone, votre ordinateur ou votre e-mail.
        </p>
        <button onClick={telecharger} disabled={chargement} className="btn-primary"><FiDownload /> {chargement ? 'Préparation…' : 'Télécharger la sauvegarde'}</button>
      </div>

      <div className="card bg-blue-50/60 !border-blue-100">
        <h2 className="font-semibold text-slate-900 mb-2 flex items-center gap-2"><FiShield className="text-blue-600" /> Sauvegarde automatique sur Railway</h2>
        <p className="text-sm text-slate-600 mb-3">Votre base de données est hébergée sur Railway, qui peut en faire des copies automatiques :</p>
        <ol className="text-sm text-slate-700 list-decimal pl-5 space-y-1.5">
          <li>Ouvrez votre projet sur <strong>railway.app</strong> et cliquez sur la case <strong>MySQL</strong>.</li>
          <li>Allez dans l'onglet <strong>Backups</strong>.</li>
          <li>Activez une sauvegarde planifiée (idéalement <strong>chaque jour</strong>).</li>
        </ol>
        <p className="text-xs text-slate-500 mt-3">Les photos des produits sont, elles, conservées séparément sur Cloudinary.</p>
      </div>
    </div>
  );
}
