/**
 * POST /api/cleanup
 * Supprime les transferts expirés
 * Protégé par un secret (à appeler via cron externe)
 */
export async function onRequestPost(context) {
  const { request, env } = context

  // Vérifie le secret (optionnel mais recommandé)
  const authHeader = request.headers.get('Authorization')
  if (env.CLEANUP_SECRET && authHeader !== `Bearer ${env.CLEANUP_SECRET}`) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    // Récupère les transferts expirés
    const { results: expiredTransfers } = await env.DB.prepare(`
      SELECT id FROM transfers WHERE expires_at < datetime('now')
    `).all()

    if (expiredTransfers.length === 0) {
      return Response.json({ message: 'Aucun transfert expiré', deleted: 0 })
    }

    let deletedFiles = 0

    for (const transfer of expiredTransfers) {
      // Récupère les fichiers du transfert
      const { results: files } = await env.DB.prepare(`
        SELECT r2_key FROM files WHERE transfer_id = ?
      `).bind(transfer.id).all()

      // Supprime les fichiers de R2
      for (const file of files) {
        try {
          await env.BUCKET.delete(file.r2_key)
          deletedFiles++
        } catch (err) {
          console.error(`Erreur suppression R2 ${file.r2_key}:`, err)
        }
      }

      // Supprime les entrées de D1
      await env.DB.prepare(`DELETE FROM files WHERE transfer_id = ?`).bind(transfer.id).run()
      await env.DB.prepare(`DELETE FROM transfers WHERE id = ?`).bind(transfer.id).run()
    }

    return Response.json({
      message: 'Nettoyage terminé',
      deletedTransfers: expiredTransfers.length,
      deletedFiles
    })
  } catch (error) {
    console.error('Cleanup error:', error)
    return Response.json({ error: 'Erreur lors du nettoyage' }, { status: 500 })
  }
}
