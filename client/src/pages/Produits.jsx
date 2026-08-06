import React, { useEffect, useRef, useState } from 'react';
import { toast } from 'react-toastify';
import { FiPlus, FiEdit2, FiTrash2, FiSearch, FiX, FiImage, FiCopy } from 'react-icons/fi';
import { listerProduits, creerProduit, modifierProduit, supprimerProduit, dupliquerProduit } from '../services/produitService';
import { useAuth } from '../context/AuthContext';
import { urlFichier } from '../utils/fichiers';

function formulaireVide() {
  return {
    nom: '',
    prix_normal: '',
    description: '',
    variantesExistantes: [],  // [{ id, image, tailles: [{id, taille, quantite}] }] déjà en base
    variantesASupprimer: [],  // ids de variantes existantes retirées
    nouvellesVariantes: [],   // [{ fichier, apercu, tailles: [{taille, quantite}] }]
  };
}

export default function Produits() {
  const [produits, setProduits] = useState([]);
  const [recherche, setRecherche] = useState('');
  const [modalOuvert, setModalOuvert] = useState(false);
  const [enEdition, setEnEdition] = useState(null);
  const [formulaire, setFormulaire] = useState(formulaireVide());
  const [chargement, setChargement] = useState(false);
  const [produitDetail, setProduitDetail] = useState(null); // pour la fenêtre "voir le contenu"
  const inputFichier = useRef(null);
  const { estAdmin } = useAuth();

  const chargerProduits = async () => {
    try {
      const data = await listerProduits({ recherche });
      setProduits(data);
    } catch {
      toast.error('Impossible de charger les produits.');
    }
  };

  useEffect(() => { chargerProduits(); }, [recherche]);

  const ouvrirCreation = () => {
    setFormulaire(formulaireVide());
    setEnEdition(null);
    setModalOuvert(true);
  };

  const ouvrirEdition = (produit) => {
    setFormulaire({
      nom: produit.nom,
      prix_normal: produit.prix_normal,
      description: produit.description || '',
      variantesExistantes: (produit.ProduitVariantes || []).map((v) => ({
        id: v.id,
        image: v.image,
        tailles: (v.ProduitTailles || []).map((t) => ({ id: t.id, taille: t.taille, quantite: t.quantite })),
      })),
      variantesASupprimer: [],
      nouvellesVariantes: [],
    });
    setEnEdition(produit.id);
    setModalOuvert(true);
  };

  // --- Gestion des nouvelles photos (chacune devient une variante avec ses propres tailles) ---
  const gererAjoutPhotos = (e) => {
    const fichiers = Array.from(e.target.files || []);
    const nouvelles = fichiers.map((fichier) => ({
      fichier,
      apercu: URL.createObjectURL(fichier),
      tailles: [{ taille: '', quantite: '' }],
    }));
    setFormulaire((f) => ({ ...f, nouvellesVariantes: [...f.nouvellesVariantes, ...nouvelles] }));
    e.target.value = '';
  };

  const retirerNouvelleVariante = (index) => {
    setFormulaire((f) => ({ ...f, nouvellesVariantes: f.nouvellesVariantes.filter((_, i) => i !== index) }));
  };

  const retirerVarianteExistante = (id) => {
    setFormulaire((f) => ({
      ...f,
      variantesExistantes: f.variantesExistantes.filter((v) => v.id !== id),
      variantesASupprimer: [...f.variantesASupprimer, id],
    }));
  };

  // --- Tailles pour une variante existante ---
  const modifierTailleExistante = (varianteId, index, champ, valeur) => {
    setFormulaire((f) => ({
      ...f,
      variantesExistantes: f.variantesExistantes.map((v) =>
        v.id !== varianteId ? v : { ...v, tailles: v.tailles.map((t, i) => (i === index ? { ...t, [champ]: valeur } : t)) }
      ),
    }));
  };
  const ajouterTailleExistante = (varianteId) => {
    setFormulaire((f) => ({
      ...f,
      variantesExistantes: f.variantesExistantes.map((v) =>
        v.id !== varianteId ? v : { ...v, tailles: [...v.tailles, { taille: '', quantite: '' }] }
      ),
    }));
  };
  const retirerTailleExistante = (varianteId, index) => {
    setFormulaire((f) => ({
      ...f,
      variantesExistantes: f.variantesExistantes.map((v) =>
        v.id !== varianteId ? v : { ...v, tailles: v.tailles.filter((_, i) => i !== index) }
      ),
    }));
  };

  // --- Tailles pour une nouvelle variante ---
  const modifierTailleNouvelle = (index, indexTaille, champ, valeur) => {
    setFormulaire((f) => ({
      ...f,
      nouvellesVariantes: f.nouvellesVariantes.map((v, i) =>
        i !== index ? v : { ...v, tailles: v.tailles.map((t, ti) => (ti === indexTaille ? { ...t, [champ]: valeur } : t)) }
      ),
    }));
  };
  const ajouterTailleNouvelle = (index) => {
    setFormulaire((f) => ({
      ...f,
      nouvellesVariantes: f.nouvellesVariantes.map((v, i) =>
        i !== index ? v : { ...v, tailles: [...v.tailles, { taille: '', quantite: '' }] }
      ),
    }));
  };
  const retirerTailleNouvelle = (index, indexTaille) => {
    setFormulaire((f) => ({
      ...f,
      nouvellesVariantes: f.nouvellesVariantes.map((v, i) =>
        i !== index ? v : { ...v, tailles: v.tailles.filter((_, ti) => ti !== indexTaille) }
      ),
    }));
  };

  const soumettre = async (e) => {
    e.preventDefault();
    setChargement(true);
    try {
      const nettoyerTailles = (tailles) => tailles.filter((t) => t.taille.trim() !== '');

      if (enEdition) {
        await modifierProduit(enEdition, {
          nom: formulaire.nom,
          prix_normal: formulaire.prix_normal,
          description: formulaire.description,
          variantesExistantes: formulaire.variantesExistantes.map((v) => ({ id: v.id, tailles: nettoyerTailles(v.tailles) })),
          variantesASupprimer: formulaire.variantesASupprimer,
          nouvellesVariantes: formulaire.nouvellesVariantes.map((v) => ({ fichier: v.fichier, tailles: nettoyerTailles(v.tailles) })),
        });
        toast.success('Produit modifié.');
      } else {
        if (formulaire.nouvellesVariantes.length === 0) {
          toast.warn('Ajoutez au moins une photo.');
          setChargement(false);
          return;
        }
        await creerProduit({
          nom: formulaire.nom,
          prix_normal: formulaire.prix_normal,
          description: formulaire.description,
          variantes: formulaire.nouvellesVariantes.map((v) => ({ fichier: v.fichier, tailles: nettoyerTailles(v.tailles) })),
        });
        toast.success('Produit ajouté.');
      }
      setModalOuvert(false);
      chargerProduits();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Erreur.');
    } finally {
      setChargement(false);
    }
  };

  const supprimer = async (id) => {
    if (!confirm('Supprimer ce produit ?')) return;
    await supprimerProduit(id);
    toast.success('Produit supprimé.');
    chargerProduits();
  };

  const dupliquer = async (id) => {
    try {
      await dupliquerProduit(id);
      toast.success('Produit dupliqué.');
      chargerProduits();
    } catch {
      toast.error('Impossible de dupliquer ce produit.');
    }
  };

  const imagePrincipale = (produit) => produit.ProduitVariantes?.[0]?.image || null;
  const quantiteTotale = (produit) =>
    (produit.ProduitVariantes || []).reduce((acc, v) => acc + (v.ProduitTailles || []).reduce((a, t) => a + t.quantite, 0), 0);

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <h1 className="titre-or text-2xl">Produits</h1>
        {estAdmin && (
          <button onClick={ouvrirCreation} className="btn-primary flex items-center gap-2">
            <FiPlus /> Nouveau produit
          </button>
        )}
      </div>

      <div className="relative mb-4 max-w-sm">
        <FiSearch className="absolute left-3 top-3 text-charbon-100/40" />
        <input
          value={recherche} onChange={(e) => setRecherche(e.target.value)}
          placeholder="Rechercher un produit..." className="input-champ pl-9"
        />
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
        {produits.map((p) => (
          <div key={p.id} className="card p-0 overflow-hidden">
            <div
              className="w-full h-36 bg-charbon-800 flex items-center justify-center overflow-hidden relative cursor-pointer"
              onClick={() => setProduitDetail(p)}
              title="Voir toutes les photos et informations"
            >
              {imagePrincipale(p) ? (
                <img src={urlFichier(imagePrincipale(p))} alt={p.nom} className="w-full h-full object-cover" />
              ) : (
                <FiImage className="text-charbon-100/30" size={32} />
              )}
              {p.ProduitVariantes?.length > 1 && (
                <span className="absolute bottom-1 right-1 bg-charbon-950/80 text-charbon-50 text-[10px] px-1.5 py-0.5 rounded-full">
                  +{p.ProduitVariantes.length - 1} photo(s)
                </span>
              )}
            </div>
            <div className="p-3">
              <p className="font-medium text-charbon-50 truncate">{p.nom}</p>
              <p className="text-or-300 text-sm">{Number(p.prix_normal).toLocaleString('fr-FR')} GNF</p>
              <p className="text-xs text-charbon-100/50 mt-1">Stock total : {quantiteTotale(p)}</p>
              {estAdmin && (
                <div className="flex gap-3 mt-2">
                  <button onClick={() => ouvrirEdition(p)} className="text-or-300 hover:text-or-600 text-sm"><FiEdit2 size={14} /></button>
                  <button onClick={() => dupliquer(p.id)} className="text-or-300 hover:text-or-600 text-sm" title="Dupliquer"><FiCopy size={14} /></button>
                  <button onClick={() => supprimer(p.id)} className="text-red-500 hover:text-red-600 text-sm"><FiTrash2 size={14} /></button>
                </div>
              )}
            </div>
          </div>
        ))}
        {produits.length === 0 && (
          <p className="col-span-full text-center py-10 text-charbon-100/40">Aucun produit trouvé.</p>
        )}
      </div>

      {/* Modal détail (voir le contenu de chaque photo) */}
      {produitDetail && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4" onClick={() => setProduitDetail(null)}>
          <div className="card w-full max-w-2xl max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <div className="flex justify-between items-start mb-4">
              <div>
                <h2 className="titre-or text-lg">{produitDetail.nom}</h2>
                <p className="text-or-300">{Number(produitDetail.prix_normal).toLocaleString('fr-FR')} GNF</p>
                {produitDetail.description && <p className="text-charbon-100/60 text-sm mt-1">{produitDetail.description}</p>}
              </div>
              <button onClick={() => setProduitDetail(null)} className="text-charbon-100/60"><FiX size={20} /></button>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {(produitDetail.ProduitVariantes || []).map((v) => (
                <div key={v.id} className="bg-charbon-800 rounded-lg overflow-hidden">
                  <img src={urlFichier(v.image)} alt="" className="w-full h-40 object-cover" />
                  <div className="p-2 flex flex-wrap gap-1">
                    {(v.ProduitTailles || []).map((t) => (
                      <span key={t.id} className={`text-xs px-1.5 py-0.5 rounded ${t.quantite === 0 ? 'bg-red-500/15 text-red-500' : t.quantite <= t.seuil_alerte ? 'bg-yellow-500/15 text-yellow-600' : 'bg-charbon-900 text-charbon-100/70'}`}>
                        {t.taille}: {t.quantite}
                      </span>
                    ))}
                    {(!v.ProduitTailles || v.ProduitTailles.length === 0) && (
                      <span className="text-xs text-charbon-100/40">Aucune taille configurée</span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Modal création/édition */}
      {modalOuvert && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="card w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <h2 className="titre-or text-lg mb-4">{enEdition ? 'Modifier le produit' : 'Nouveau produit'}</h2>
            <form onSubmit={soumettre} className="space-y-4">
              <input required placeholder="Nom du produit" className="input-champ" value={formulaire.nom} onChange={(e) => setFormulaire({ ...formulaire, nom: e.target.value })} />
              <input required type="number" placeholder="Prix (GNF)" className="input-champ" value={formulaire.prix_normal} onChange={(e) => setFormulaire({ ...formulaire, prix_normal: e.target.value })} />
              <textarea placeholder="Description" className="input-champ" rows={2} value={formulaire.description} onChange={(e) => setFormulaire({ ...formulaire, description: e.target.value })} />

              <div>
                <p className="text-sm text-charbon-100/70 mb-2">Photos — chaque photo a ses propres tailles et quantités</p>

                {/* Variantes déjà en base */}
                <div className="space-y-3">
                  {formulaire.variantesExistantes.map((v) => (
                    <div key={v.id} className="flex gap-3 bg-charbon-800 rounded-lg p-2">
                      <div className="relative w-20 h-20 flex-shrink-0 rounded overflow-hidden">
                        <img src={urlFichier(v.image)} alt="" className="w-full h-full object-cover" />
                        <button type="button" onClick={() => retirerVarianteExistante(v.id)} className="absolute top-0.5 right-0.5 bg-charbon-950/80 text-charbon-50 rounded-full p-0.5">
                          <FiX size={12} />
                        </button>
                      </div>
                      <div className="flex-1 space-y-1">
                        {v.tailles.map((t, index) => (
                          <div key={index} className="flex gap-2">
                            <input placeholder="Taille" className="input-champ py-1 text-sm flex-1" value={t.taille} onChange={(e) => modifierTailleExistante(v.id, index, 'taille', e.target.value)} />
                            <input type="number" placeholder="Qté" className="input-champ py-1 text-sm w-20" value={t.quantite} onChange={(e) => modifierTailleExistante(v.id, index, 'quantite', e.target.value)} />
                            <button type="button" onClick={() => retirerTailleExistante(v.id, index)} className="text-red-500 px-1"><FiX size={14} /></button>
                          </div>
                        ))}
                        <button type="button" onClick={() => ajouterTailleExistante(v.id)} className="text-or-300 text-xs flex items-center gap-1"><FiPlus size={12} /> Ajouter une taille</button>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Nouvelles variantes */}
                <div className="space-y-3 mt-3">
                  {formulaire.nouvellesVariantes.map((v, index) => (
                    <div key={index} className="flex gap-3 bg-charbon-800 rounded-lg p-2">
                      <div className="relative w-20 h-20 flex-shrink-0 rounded overflow-hidden">
                        <img src={v.apercu} alt="" className="w-full h-full object-cover" />
                        <button type="button" onClick={() => retirerNouvelleVariante(index)} className="absolute top-0.5 right-0.5 bg-charbon-950/80 text-charbon-50 rounded-full p-0.5">
                          <FiX size={12} />
                        </button>
                      </div>
                      <div className="flex-1 space-y-1">
                        {v.tailles.map((t, indexTaille) => (
                          <div key={indexTaille} className="flex gap-2">
                            <input placeholder="Taille" className="input-champ py-1 text-sm flex-1" value={t.taille} onChange={(e) => modifierTailleNouvelle(index, indexTaille, 'taille', e.target.value)} />
                            <input type="number" placeholder="Qté" className="input-champ py-1 text-sm w-20" value={t.quantite} onChange={(e) => modifierTailleNouvelle(index, indexTaille, 'quantite', e.target.value)} />
                            <button type="button" onClick={() => retirerTailleNouvelle(index, indexTaille)} className="text-red-500 px-1"><FiX size={14} /></button>
                          </div>
                        ))}
                        <button type="button" onClick={() => ajouterTailleNouvelle(index)} className="text-or-300 text-xs flex items-center gap-1"><FiPlus size={12} /> Ajouter une taille</button>
                      </div>
                    </div>
                  ))}
                </div>

                <button
                  type="button" onClick={() => inputFichier.current.click()}
                  className="mt-3 w-full py-2 rounded-lg bg-charbon-800 border border-dashed border-or-900/40 flex items-center justify-center gap-2 text-charbon-100/60 hover:text-or-300 hover:border-or-500"
                >
                  <FiPlus /> Ajouter une photo (avec ses tailles)
                </button>
                <input ref={inputFichier} type="file" accept="image/*" multiple className="hidden" onChange={gererAjoutPhotos} />
              </div>

              <div className="flex justify-end gap-2 mt-2">
                <button type="button" onClick={() => setModalOuvert(false)} className="btn-secondary">Annuler</button>
                <button type="submit" disabled={chargement} className="btn-primary">{chargement ? 'Enregistrement...' : enEdition ? 'Enregistrer' : 'Ajouter'}</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
