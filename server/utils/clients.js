const { Client } = require('../models');

/**
 * Retrouve le client concerné ou le crée automatiquement.
 * - client_id fourni et valide → ce client
 * - sinon, un nom est fourni : on réutilise le client ayant le même téléphone (si renseigné), sinon on en crée un
 */
async function trouverOuCreerClient(boutique_id, { client_id, nom, telephone }) {
  if (client_id) {
    const existant = await Client.findOne({ where: { id: client_id, boutique_id } });
    if (existant) return existant;
  }
  if (!nom || !String(nom).trim()) return null;

  if (telephone && String(telephone).trim()) {
    const parTelephone = await Client.findOne({ where: { boutique_id, telephone: String(telephone).trim() } });
    if (parTelephone) return parTelephone;
  }
  return Client.create({
    boutique_id,
    nom: String(nom).trim(),
    telephone: telephone ? String(telephone).trim() : null,
  });
}

module.exports = { trouverOuCreerClient };
