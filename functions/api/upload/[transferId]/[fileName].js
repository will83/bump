/**
 * POST /api/upload/:transferId/:fileName
 * Upload un fichier vers R2
 */
export async function onRequestPost(context) {
  const { params, request, env } = context
  const { transferId, fileName } = params

  try {
    const decodedFileName = decodeURIComponent(fileName)
    const r2Key = `${transferId}/${decodedFileName}`

    // Récupère le body comme stream/buffer
    const body = await request.arrayBuffer()

    // Upload vers R2
    await env.BUCKET.put(r2Key, body, {
      httpMetadata: {
        contentType: request.headers.get('Content-Type') || 'application/octet-stream'
      }
    })

    return Response.json({ success: true })
  } catch (error) {
    console.error('Upload error:', error)
    return Response.json(
      { error: 'Erreur lors de l\'upload' },
      { status: 500 }
    )
  }
}
