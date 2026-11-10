import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'react-toastify';
import { useAuth } from '../context/AuthContext';
import logo from '../assets/logo.jpeg';

export default function Connexion() {
  const [email, setEmail] = useState('');
  const [motDePasse, setMotDePasse] = useState('');
  const [chargement, setChargement] = useState(false);
  const { connexion } = useAuth();
  const navigate = useNavigate();

  const soumettre = async (e) => {
    e.preventDefault();
    setChargement(true);
    try {
      await connexion(email, motDePasse);
      navigate('/tableau-de-bord');
    } catch (error) {
      toast.error(error.response?.data?.message || "Connexion impossible. Si le serveur vient de se réveiller, patientez 30 secondes et réessayez.");
    } finally {
      setChargement(false);
    }
  };

  return (
    <div className="min-h-screen flex bg-white">
      {/* Panneau de marque (caché sur téléphone) */}
      <div className="hidden lg:flex w-1/2 bg-gradient-to-br from-marine-700 via-marine-800 to-marine-900 text-white flex-col justify-between p-12 relative overflow-hidden">
        <div className="absolute -top-24 -right-24 w-96 h-96 rounded-full bg-blue-500/20 blur-3xl" />
        <div className="absolute -bottom-32 -left-16 w-96 h-96 rounded-full bg-blue-400/10 blur-3xl" />
        <div className="relative flex items-center gap-3">
          <img src={logo} alt="" className="w-12 h-12 object-cover rounded-full ring-2 ring-white/20" />
          <span className="font-bold text-lg">Koloun Luxure</span>
        </div>
        <div className="relative">
          <h2 className="text-4xl font-extrabold leading-tight tracking-tight">Pilotez votre boutique,<br />simplement.</h2>
          <p className="mt-4 text-blue-100/70 max-w-md">Ventes, stock, commandes spéciales, dettes et comptabilité — tout au même endroit, sur ordinateur comme sur téléphone.</p>
        </div>
        <p className="relative text-sm text-blue-200/50">Qualité &amp; Élégance</p>
      </div>

      {/* Formulaire */}
      <div className="flex-1 flex items-center justify-center p-6 bg-charbon-950">
        <div className="w-full max-w-sm">
          <div className="flex flex-col items-center mb-8 lg:items-start">
            <img src={logo} alt="Koloun Luxure" className="w-16 h-16 object-cover rounded-full shadow-md lg:hidden mb-4" />
            <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Connexion</h1>
            <p className="text-sm text-slate-500 mt-1">Accédez à votre espace de gestion</p>
          </div>

          <form onSubmit={soumettre} className="space-y-4 bg-white border border-slate-200/70 shadow-soft rounded-2xl p-6">
            <div>
              <label className="etiquette">Email</label>
              <input type="email" required autoComplete="username" value={email} onChange={(e) => setEmail(e.target.value)}
                className="input-champ" placeholder="vous@exemple.com" />
            </div>
            <div>
              <label className="etiquette">Mot de passe</label>
              <input type="password" required autoComplete="current-password" value={motDePasse} onChange={(e) => setMotDePasse(e.target.value)}
                className="input-champ" placeholder="••••••••" />
            </div>
            <button type="submit" disabled={chargement} className="btn-primary w-full py-3">
              {chargement ? 'Connexion…' : 'Se connecter'}
            </button>
            {chargement && <p className="text-xs text-slate-400 text-center">Le serveur peut mettre jusqu'à 30 secondes à se réveiller.</p>}
          </form>
        </div>
      </div>
    </div>
  );
}
