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

  const gererSoumission = async (e) => {
    e.preventDefault();
    setChargement(true);
    try {
      await connexion(email, motDePasse);
      navigate('/tableau-de-bord');
    } catch (error) {
      toast.error(error.response?.data?.message || 'Erreur de connexion.');
    } finally {
      setChargement(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-charbon-950 px-4">
      <div className="card w-full max-w-sm">
        <div className="flex flex-col items-center mb-6">
          <img src={logo} alt="Koloun Luxure" className="w-24 h-24 object-contain rounded-full mb-3" />
          <h1 className="titre-or text-xl">Koloun Luxure</h1>
          <p className="text-xs text-charbon-100/50">Gestion Commerciale</p>
        </div>

        <form onSubmit={gererSoumission} className="space-y-4">
          <div>
            <label className="text-sm text-charbon-100/70 mb-1 block">Email</label>
            <input
              type="email" required value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="input-champ" placeholder="vous@koloun.com"
            />
          </div>
          <div>
            <label className="text-sm text-charbon-100/70 mb-1 block">Mot de passe</label>
            <input
              type="password" required value={motDePasse}
              onChange={(e) => setMotDePasse(e.target.value)}
              className="input-champ" placeholder="••••••••"
            />
          </div>
          <button type="submit" disabled={chargement} className="btn-primary w-full">
            {chargement ? 'Connexion...' : 'Se connecter'}
          </button>
        </form>
      </div>
    </div>
  );
}
