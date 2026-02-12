/**
 * GET /api/download/:transferId/:fileName
 * Télécharge un fichier depuis R2
 */
export async function onRequestGet(context) {
  const { params, env } = context
  const { transferId, fileName } = params

  try {
    const decodedFileName = decodeURIComponent(fileName)

    // Vérifie que le transfert existe et n'est pas expiré
    const transfer = await env.DB.prepare(`
      SELECT expires_at FROM transfers WHERE id = ?
    `).bind(transferId).first()

    if (!transfer) {
      return Response.json(
        { error: 'Transfert non trouvé' },
        { status: 404 }
      )
    }

    if (new Date(transfer.expires_at) < new Date()) {
      return Response.json(
        { error: 'Ce transfert a expiré' },
        { status: 404 }
      )
    }

    // Récupère le fichier depuis R2
    const r2Key = `${transferId}/${decodedFileName}`
    const object = await env.BUCKET.get(r2Key)

    if (!object) {
      return Response.json(
        { error: 'Fichier non trouvé' },
        { status: 404 }
      )
    }

    // Incrémente le compteur de téléchargements (async, non bloquant)
    context.waitUntil(
      env.DB.prepare(`
        UPDATE transfers SET download_count = download_count + 1 WHERE id = ?
      `).bind(transferId).run()
    )

    // Détermine le Content-Type
    const contentType = object.httpMetadata?.contentType || 'application/octet-stream'

    // Retourne le fichier
    return new Response(object.body, {
      headers: {
        'Content-Type': contentType,
        'Content-Length': object.size,
        'Content-Disposition': `attachment; filename="${decodedFileName}"`,
        'Cache-Control': 'private, max-age=3600'
      }
    })
  } catch (error) {
    console.error('Download error:', error)
    return Response.json(
      { error: 'Erreur lors du téléchargement' },
      { status: 500 }
    )
  }
}
