/**
 * Worker de nettoyage avec Cron Trigger
 * Tourne toutes les heures pour supprimer les transferts expirés
 */

export default {
  async scheduled(event, env, ctx) {
    console.log('Cron: Nettoyage des fichiers expirés...')

    try {
      // Récupère les transferts expirés
      const { results: expiredTransfers } = await env.DB.prepare(`
        SELECT id FROM transfers WHERE expires_at < datetime('now')
      `).all()

      if (expiredTransfers.length === 0) {
        console.log('Aucun transfert expiré')
        return
      }

      console.log(`${expiredTransfers.length} transfert(s) expiré(s) à supprimer`)

      for (const transfer of expiredTransfers) {
        // Récupère les fichiers du transfert
        const { results: files } = await env.DB.prepare(`
          SELECT r2_key FROM files WHERE transfer_id = ?
        `).bind(transfer.id).all()

        // Supprime les fichiers de R2
        for (const file of files) {
          try {
            await env.BUCKET.delete(file.r2_key)
          } catch (err) {
            console.error(`Erreur suppression R2 ${file.r2_key}:`, err)
          }
        }

        // Supprime les entrées de D1
        await env.DB.prepare(`DELETE FROM files WHERE transfer_id = ?`).bind(transfer.id).run()
        await env.DB.prepare(`DELETE FROM transfers WHERE id = ?`).bind(transfer.id).run()

        console.log(`Transfert ${transfer.id} supprimé`)
      }

      console.log('Nettoyage terminé')
    } catch (error) {
      console.error('Erreur cron cleanup:', error)
    }
  }
}
