import React, { useEffect, useMemo, useState } from 'react';
import { Line, Bar, Doughnut } from 'react-chartjs-2';
import {
  Chart as ChartJS, CategoryScale, LinearScale, PointElement, LineElement, BarElement, ArcElement, Tooltip, Legend, Filler,
} from 'chart.js';
import { FiSearch, FiBarChart2, FiTrendingUp, FiShoppingBag, FiCreditCard, FiCalendar } from 'react-icons/fi';
import EnTete from '../components/EnTete';
import Stat from '../components/Stat';
import { rechercheIntelligente, graphiques } from '../services/statistiqueService';
import { formaterGNF } from '../utils/format';

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, BarElement, ArcElement, Tooltip, Legend, Filler);
ChartJS.defaults.font.family = 'Inter, system-ui, sans-serif';
ChartJS.defaults.color = '#64748b';

const BLEU = '#2563eb';
const BLEU_CLAIR = '#93c5fd';
const MARINE = '#1e3a8a';
const VERT = '#10b981';
const ORANGE = '#f59e0b';
const PALETTE = [BLEU, '#60a5fa', MARINE, '#06b6d4', '#8b5cf6', '#94a3b8'];

const abrege = (v) => {
  const n = Number(v);
  if (Math.abs(n) >= 1e6) return `${(n / 1e6).toLocaleString('fr-FR', { maximumFractionDigits: 1 })} M`;
  if (Math.abs(n) >= 1e3) return `${Math.round(n / 1e3)} k`;
  return String(n);
};
const optionsAxes = {
  responsive: true, maintainAspectRatio: false,
  plugins: { legend: { display: false }, tooltip: { callbacks: { label: (c) => ` ${formaterGNF(c.parsed.y ?? c.parsed.x ?? c.parsed)}` } } },
  scales: { y: { beginAtZero: true, ticks: { callback: abrege }, grid: { color: '#f1f5f9' } }, x: { grid: { display: false } } },
};
const NOMS_MOIS = ['janv.', 'févr.', 'mars', 'avr.', 'mai', 'juin', 'juil.', 'août', 'sept.', 'oct.', 'nov.', 'déc.'];
const NOMS_JOURS = ['Dim', 'Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam']; // DAYOFWEEK : 1 = dimanche

// Cadre d'un graphique : titre + phrase qui explique comment le lire
function Cadre({ titre, explication, children, hauteur = 'h-64', className = '' }) {
  return (
    <div className={`card ${className}`}>
      <h2 className="font-semibold text-slate-900">{titre}</h2>
      <p className="text-xs text-slate-500 mt-0.5 mb-4">{explication}</p>
      <div className={hauteur}>{children}</div>
    </div>
  );
}
const Vide = () => <div className="h-full flex items-center justify-center text-sm text-slate-400">Pas encore de données.</div>;

export default function Statistiques() {
  const [g, setG] = useState(null);
  const [terme, setTerme] = useState('');
  const [resultat, setResultat] = useState(null);

  useEffect(() => { graphiques().then(setG).catch(() => setG({})); }, []);

  const rechercher = async (e) => {
    e.preventDefault();
    if (!terme.trim()) return;
    setResultat(await rechercheIntelligente(terme));
  };

  const d = useMemo(() => {
    if (!g) return null;
    // 30 derniers jours complets (les jours sans vente valent 0)
    const jours = [];
    for (let i = 29; i >= 0; i -= 1) {
      const x = new Date(); x.setDate(x.getDate() - i);
      jours.push(x.toISOString().slice(0, 10));
    }
    const parJour = Object.fromEntries((g.ventes30 || []).map((v) => [v.jour, Number(v.total)]));
    const serie30 = jours.map((j) => parJour[j] || 0);

    // 6 derniers mois
    const mois = [];
    const now = new Date();
    for (let i = 5; i >= 0; i -= 1) {
      const x = new Date(now.getFullYear(), now.getMonth() - i, 1);
      mois.push(`${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, '0')}`);
    }
    const indexe = (liste) => Object.fromEntries((liste || []).map((v) => [v.mois, Number(v.total)]));
    const mv = indexe(g.mois); const md = indexe(g.depensesMois); const ma = indexe(g.achatsMois);

    const jourSemaine = Array(7).fill(0);
    (g.jours || []).forEach((v) => { jourSemaine[Number(v.jour) - 1] = Number(v.total); });
    const heures = Array(24).fill(0);
    (g.heures || []).forEach((v) => { heures[Number(v.heure)] = Number(v.nb); });

    const total30 = serie30.reduce((a, b) => a + b, 0);
    const nb30 = (g.ventes30 || []).reduce((a, v) => a + Number(v.nb), 0);
    const meilleurJourIdx = jourSemaine.indexOf(Math.max(...jourSemaine));
    const meilleureHeure = Math.max(...heures) > 0 ? heures.indexOf(Math.max(...heures)) : null;

    return {
      jours, serie30, total30, nb30,
      panier: nb30 ? total30 / nb30 : 0,
      mois, ventesMois: mois.map((m) => mv[m] || 0), depensesMois: mois.map((m) => md[m] || 0), achatsMois: mois.map((m) => ma[m] || 0),
      jourSemaine, heures,
      meilleurJour: Math.max(...jourSemaine) > 0 ? NOMS_JOURS[meilleurJourIdx] : '—',
      meilleureHeure,
    };
  }, [g]);

  if (!d) {
    return (
      <div>
        <EnTete titre="Statistiques" sousTitre="Comprenez votre activité en un coup d'œil" icone={<FiBarChart2 />} />
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {[0, 1, 2, 3].map((i) => <div key={i} className="card h-72 animate-pulse bg-slate-50" />)}
        </div>
      </div>
    );
  }

  const libelleMois = (m) => NOMS_MOIS[Number(m.slice(5)) - 1];
  const paiements = g.paiements || [];
  const produits = g.produits || [];
  const vendeurs = g.vendeurs || [];
  const clients = g.clients || [];
  const beneficeMois = d.ventesMois.map((v, i) => v - d.depensesMois[i] - d.achatsMois[i]);

  return (
    <div>
      <EnTete titre="Statistiques" sousTitre="Comprenez votre activité en un coup d'œil" icone={<FiBarChart2 />} />

      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4 mb-6">
        <Stat icone={<FiTrendingUp />} titre="Ventes sur 30 jours" valeur={formaterGNF(d.total30)} teinte="bleu" />
        <Stat icone={<FiShoppingBag />} titre="Nombre de ventes (30 j)" valeur={d.nb30} teinte="vert" />
        <Stat icone={<FiCreditCard />} titre="Panier moyen" valeur={formaterGNF(Math.round(d.panier))} detail="Montant moyen par vente" teinte="violet" />
        <Stat icone={<FiCalendar />} titre="Meilleur jour / heure" valeur={`${d.meilleurJour}${d.meilleureHeure !== null ? ` · ${d.meilleureHeure}h` : ''}`} detail="Quand vous vendez le plus (3 mois)" teinte="orange" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Cadre className="lg:col-span-2" titre="Chiffre d'affaires des 30 derniers jours"
          explication="Chaque point est le total vendu ce jour-là. Une montée = bonne journée ; un creux = jour calme (ou boutique fermée).">
          <Line options={optionsAxes} data={{
            labels: d.jours.map((j) => `${j.slice(8)}/${j.slice(5, 7)}`),
            datasets: [{ data: d.serie30, borderColor: BLEU, backgroundColor: 'rgba(37,99,235,0.12)', fill: true, tension: 0.35, pointRadius: 2, borderWidth: 2.5 }],
          }} />
        </Cadre>

        <Cadre titre="Ventes, dépenses et achats par mois"
          explication="Barres bleues = ce que vous encaissez. Orange = dépenses. Gris = achats fournisseurs. Vos ventes doivent dépasser les deux autres.">
          <Bar options={{ ...optionsAxes, plugins: { ...optionsAxes.plugins, legend: { display: true, position: 'bottom', labels: { boxWidth: 10, usePointStyle: true } }, tooltip: { callbacks: { label: (c) => ` ${c.dataset.label} : ${formaterGNF(c.parsed.y)}` } } } }}
            data={{
              labels: d.mois.map(libelleMois),
              datasets: [
                { label: 'Ventes', data: d.ventesMois, backgroundColor: BLEU, borderRadius: 6 },
                { label: 'Dépenses', data: d.depensesMois, backgroundColor: ORANGE, borderRadius: 6 },
                { label: 'Achats fournisseurs', data: d.achatsMois, backgroundColor: '#94a3b8', borderRadius: 6 },
              ],
            }} />
        </Cadre>

        <Cadre titre="Résultat estimé par mois"
          explication="Ventes − dépenses − achats. Vert = le mois dégage un gain ; rouge = vous avez dépensé plus que vous n'avez vendu (souvent un gros achat de stock).">
          <Bar options={optionsAxes} data={{
            labels: d.mois.map(libelleMois),
            datasets: [{ data: beneficeMois, backgroundColor: beneficeMois.map((v) => (v >= 0 ? VERT : '#ef4444')), borderRadius: 6 }],
          }} />
        </Cadre>

        <Cadre titre="Produits les plus vendus (3 mois)"
          explication="Nombre de pièces vendues par produit. Réapprovisionnez en priorité les produits en haut de la liste.">
          {produits.length ? (
            <Bar options={{ ...optionsAxes, indexAxis: 'y', plugins: { ...optionsAxes.plugins, tooltip: { callbacks: { label: (c) => ` ${c.parsed.x} pièce(s) · ${formaterGNF(produits[c.dataIndex].chiffre_affaires)}` } } },
              scales: { x: { beginAtZero: true, grid: { color: '#f1f5f9' }, ticks: { precision: 0 } }, y: { grid: { display: false } } } }}
              data={{ labels: produits.map((p) => p.nom), datasets: [{ data: produits.map((p) => Number(p.quantite)), backgroundColor: BLEU, borderRadius: 6 }] }} />
          ) : <Vide />}
        </Cadre>

        <Cadre titre="Moyens de paiement (30 jours)"
          explication="Part de chaque moyen de paiement dans vos encaissements. Utile pour savoir où se trouve votre argent (cash, Orange Money, marchand).">
          {paiements.length ? (
            <Doughnut options={{ responsive: true, maintainAspectRatio: false, cutout: '62%',
              plugins: { legend: { position: 'bottom', labels: { boxWidth: 10, usePointStyle: true } }, tooltip: { callbacks: { label: (c) => ` ${c.label} : ${formaterGNF(c.parsed)}` } } } }}
              data={{ labels: paiements.map((p) => p.nom), datasets: [{ data: paiements.map((p) => Number(p.total)), backgroundColor: PALETTE, borderColor: '#fff', borderWidth: 3 }] }} />
          ) : <Vide />}
        </Cadre>

        <Cadre titre="Ventes selon le jour de la semaine (3 mois)"
          explication="Total vendu par jour de la semaine. Les barres les plus hautes sont vos jours forts : prévoyez du stock et de la présence ces jours-là.">
          <Bar options={optionsAxes} data={{
            labels: NOMS_JOURS,
            datasets: [{ data: d.jourSemaine, backgroundColor: d.jourSemaine.map((v) => (v === Math.max(...d.jourSemaine) && v > 0 ? MARINE : BLEU_CLAIR)), borderRadius: 6 }],
          }} />
        </Cadre>

        <Cadre titre="Ventes selon l'heure (3 mois)"
          explication="Nombre de ventes par heure de la journée. Le pic montre l'heure où vos clients achètent le plus.">
          <Bar options={{ ...optionsAxes, plugins: { ...optionsAxes.plugins, tooltip: { callbacks: { label: (c) => ` ${c.parsed.y} vente(s)` } } }, scales: { y: { beginAtZero: true, ticks: { precision: 0 }, grid: { color: '#f1f5f9' } }, x: { grid: { display: false } } } }}
            data={{
              labels: d.heures.map((_, h) => `${h}h`),
              datasets: [{ data: d.heures, backgroundColor: d.heures.map((v) => (v === Math.max(...d.heures) && v > 0 ? MARINE : BLEU_CLAIR)), borderRadius: 4 }],
            }} />
        </Cadre>

        {vendeurs.length > 1 && (
          <Cadre titre="Ventes par vendeur (30 jours)" explication="Chiffre d'affaires réalisé par chaque membre de l'équipe.">
            <Bar options={optionsAxes} data={{ labels: vendeurs.map((v) => v.nom.trim()), datasets: [{ data: vendeurs.map((v) => Number(v.total)), backgroundColor: PALETTE, borderRadius: 6 }] }} />
          </Cadre>
        )}

        {clients.length > 0 && (
          <Cadre titre="Meilleurs clients (3 mois)" explication="Les clients enregistrés qui ont le plus acheté. Pensez à les remercier ou à leur proposer vos nouveautés.">
            <Bar options={{ ...optionsAxes, indexAxis: 'y', scales: { x: { beginAtZero: true, ticks: { callback: abrege }, grid: { color: '#f1f5f9' } }, y: { grid: { display: false } } },
              plugins: { ...optionsAxes.plugins, tooltip: { callbacks: { label: (c) => ` ${formaterGNF(c.parsed.x)} · ${clients[c.dataIndex].nb} achat(s)` } } } }}
              data={{ labels: clients.map((c) => c.nom), datasets: [{ data: clients.map((c) => Number(c.total)), backgroundColor: MARINE, borderRadius: 6 }] }} />
          </Cadre>
        )}
      </div>

      <div className="card mt-6">
        <h2 className="font-semibold text-slate-900">Recherche intelligente</h2>
        <p className="text-xs text-slate-500 mt-0.5 mb-4">Tapez un produit, un vendeur ou une catégorie pour connaître les quantités vendues et le chiffre d'affaires.</p>
        <form onSubmit={rechercher} className="flex gap-2 mb-4 max-w-md">
          <input value={terme} onChange={(e) => setTerme(e.target.value)} placeholder="Ex : Lacoste, un vendeur, une catégorie…" className="input-champ flex-1" />
          <button className="btn-primary" aria-label="Rechercher"><FiSearch /></button>
        </form>
        {resultat && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
            <div><p className="text-slate-500">Quantité vendue</p><p className="text-blue-700 font-semibold text-lg">{resultat.nombre_vendu}</p></div>
            <div><p className="text-slate-500">Chiffre d'affaires</p><p className="text-blue-700 font-semibold text-lg">{formaterGNF(resultat.chiffre_affaires)}</p></div>
            {Object.entries(resultat.repartition_paiement).map(([moyen, montant]) => (
              <div key={moyen}><p className="text-slate-500">{moyen}</p><p className="text-blue-700 font-semibold text-lg">{formaterGNF(montant)}</p></div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
