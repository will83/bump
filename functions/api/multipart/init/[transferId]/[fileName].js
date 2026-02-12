/**
 * POST /api/multipart/init/:transferId/:fileName
 * Initialise un multipart upload pour les gros fichiers
 */
export async function onRequestPost(context) {
  const { params, env } = context
  const { transferId, fileName } = params

  try {
    const decodedFileName = decodeURIComponent(fileName)
    const r2Key = `${transferId}/${decodedFileName}`

    // Crée un multipart upload
    const multipartUpload = await env.BUCKET.createMultipartUpload(r2Key)

    return Response.json({
      uploadId: multipartUpload.uploadId,
      key: multipartUpload.key
    })
  } catch (error) {
    console.error('Multipart init error:', error)
    return Response.json(
      { error: 'Erreur lors de l\'initialisation' },
      { status: 500 }
    )
  }
}
