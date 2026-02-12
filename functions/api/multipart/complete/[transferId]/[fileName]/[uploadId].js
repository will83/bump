/**
 * POST /api/multipart/complete/:transferId/:fileName/:uploadId
 * Finalise le multipart upload
 */
export async function onRequestPost(context) {
  const { params, request, env } = context
  const { transferId, fileName, uploadId } = params

  try {
    const decodedFileName = decodeURIComponent(fileName)
    const r2Key = `${transferId}/${decodedFileName}`

    // Récupère les parties uploadées
    const { parts } = await request.json()

    // Récupère le multipart upload existant
    const multipartUpload = env.BUCKET.resumeMultipartUpload(r2Key, uploadId)

    // Finalise l'upload
    const object = await multipartUpload.complete(parts)

    return Response.json({
      success: true,
      key: object.key,
      size: object.size
    })
  } catch (error) {
    console.error('Multipart complete error:', error)
    return Response.json(
      { error: 'Erreur lors de la finalisation' },
      { status: 500 }
    )
  }
}
