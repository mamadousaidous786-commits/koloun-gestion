const { Notification } = require('../models');

// GET /api/notifications
exports.listerNotifications = async (req, res) => {
  try {
    const notifications = await Notification.findAll({
      where: { boutique_id: req.utilisateur.boutique_id },
      order: [['created_at', 'DESC']],
      limit: 50,
    });
    res.json(notifications);
  } catch (error) {
    res.status(500).json({ message: 'Erreur serveur.', erreur: error.message });
  }
};

// PUT /api/notifications/:id/lue
exports.marquerLue = async (req, res) => {
  try {
    const notification = await Notification.findOne({
      where: { id: req.params.id, boutique_id: req.utilisateur.boutique_id },
    });
    if (!notification) return res.status(404).json({ message: 'Notification introuvable.' });
    notification.lue = true;
    await notification.save();
    res.json(notification);
  } catch (error) {
    res.status(500).json({ message: 'Erreur serveur.', erreur: error.message });
  }
};

// DELETE /api/notifications/:id
exports.supprimerNotification = async (req, res) => {
  try {
    const notification = await Notification.findOne({
      where: { id: req.params.id, boutique_id: req.utilisateur.boutique_id },
    });
    if (!notification) return res.status(404).json({ message: 'Notification introuvable.' });
    await notification.destroy();
    res.json({ message: 'Notification supprimée.' });
  } catch (error) {
    res.status(500).json({ message: 'Erreur serveur.', erreur: error.message });
  }
};

// DELETE /api/notifications -- Supprime toutes les notifications de la boutique
exports.supprimerToutesNotifications = async (req, res) => {
  try {
    await Notification.destroy({ where: { boutique_id: req.utilisateur.boutique_id } });
    res.json({ message: 'Toutes les notifications ont été supprimées.' });
  } catch (error) {
    res.status(500).json({ message: 'Erreur serveur.', erreur: error.message });
  }
};
