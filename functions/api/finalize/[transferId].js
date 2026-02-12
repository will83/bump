/**
 * POST /api/finalize/:transferId
 * Finalise un transfert en créant les entrées dans D1
 */
export async function onRequestPost(context) {
  const { params, request, env } = context
  const { transferId } = params

  try {
    const { files } = await request.json()

    if (!files || !Array.isArray(files) || files.length === 0) {
      return Response.json(
        { error: 'Liste de fichiers invalide' },
        { status: 400 }
      )
    }

    // Calcule la taille totale
    const totalSize = files.reduce((sum, f) => sum + f.size, 0)

    // Date d'expiration = maintenant + 7 jours
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString()

    // Crée le transfert dans D1
    await env.DB.prepare(`
      INSERT INTO transfers (id, expires_at, total_size, file_count)
      VALUES (?, ?, ?, ?)
    `).bind(transferId, expiresAt, totalSize, files.length).run()

    // Insère les fichiers
    const insertFile = env.DB.prepare(`
      INSERT INTO files (transfer_id, name, size, r2_key)
      VALUES (?, ?, ?, ?)
    `)

    const batch = files.map(file => {
      const r2Key = `${transferId}/${file.name}`
      return insertFile.bind(transferId, file.name, file.size, r2Key)
    })

    await env.DB.batch(batch)

    return Response.json({
      id: transferId,
      expiresAt
    })
  } catch (error) {
    console.error('Finalize error:', error)
    return Response.json(
      { error: 'Erreur lors de la finalisation' },
      { status: 500 }
    )
  }
}
