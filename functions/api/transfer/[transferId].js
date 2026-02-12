/**
 * GET /api/transfer/:transferId
 * Récupère les metadata d'un transfert
 */
export async function onRequestGet(context) {
  const { params, env } = context
  const { transferId } = params

  try {
    // Récupère le transfert
    const transfer = await env.DB.prepare(`
      SELECT id, created_at, expires_at, total_size, file_count, download_count
      FROM transfers
      WHERE id = ?
    `).bind(transferId).first()

    if (!transfer) {
      return Response.json(
        { error: 'Transfert non trouvé' },
        { status: 404 }
      )
    }

    // Vérifie l'expiration
    if (new Date(transfer.expires_at) < new Date()) {
      return Response.json(
        { error: 'Ce transfert a expiré' },
        { status: 404 }
      )
    }

    // Récupère les fichiers
    const { results: files } = await env.DB.prepare(`
      SELECT name, size FROM files WHERE transfer_id = ?
    `).bind(transferId).all()

    return Response.json({
      id: transfer.id,
      createdAt: transfer.created_at,
      expiresAt: transfer.expires_at,
      totalSize: transfer.total_size,
      fileCount: transfer.file_count,
      downloadCount: transfer.download_count,
      files
    })
  } catch (error) {
    console.error('Transfer fetch error:', error)
    return Response.json(
      { error: 'Erreur lors de la récupération du transfert' },
      { status: 500 }
    )
  }
}
