import React from 'react';

// Empêche toute page blanche : en cas d'erreur, on affiche un message + bouton au lieu de tout faire disparaître
export default class ErreurLimite extends React.Component {
  state = { erreur: null };
  static getDerivedStateFromError(erreur) { return { erreur }; }
  componentDidUpdate(prev) {
    if (this.state.erreur && prev.cle !== this.props.cle) this.setState({ erreur: null }); // changement de page = on réessaie
  }
  render() {
    if (!this.state.erreur) return this.props.children;
    const chunk = /Loading chunk|dynamically imported module|Importing a module script failed/i.test(String(this.state.erreur?.message));
    return (
      <div className="card text-center py-12">
        <p className="font-semibold text-slate-800">{chunk ? 'Une nouvelle version est disponible.' : "Cette page n'a pas pu s'afficher."}</p>
        <div className="mt-4 flex justify-center gap-3">
          <button className="btn-primary" onClick={() => (chunk ? window.location.reload() : this.setState({ erreur: null }))}>
            {chunk ? 'Actualiser' : 'Réessayer'}
          </button>
        </div>
      </div>
    );
  }
}
