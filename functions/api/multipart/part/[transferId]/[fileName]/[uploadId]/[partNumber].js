/**
 * POST /api/multipart/part/:transferId/:fileName/:uploadId/:partNumber
 * Upload une partie du fichier
 */
export async function onRequestPost(context) {
  const { params, request, env } = context
  const { transferId, fileName, uploadId, partNumber } = params

  try {
    const decodedFileName = decodeURIComponent(fileName)
    const r2Key = `${transferId}/${decodedFileName}`
    const partNum = parseInt(partNumber, 10)

    // Récupère le multipart upload existant
    const multipartUpload = env.BUCKET.resumeMultipartUpload(r2Key, uploadId)

    // Upload la partie
    const body = await request.arrayBuffer()
    const part = await multipartUpload.uploadPart(partNum, body)

    return Response.json({
      partNumber: part.partNumber,
      etag: part.etag
    })
  } catch (error) {
    console.error('Multipart part error:', error)
    return Response.json(
      { error: 'Erreur lors de l\'upload de la partie' },
      { status: 500 }
    )
  }
}
