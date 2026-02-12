/**
 * GET /api/presign/:transferId/:fileName
 * Génère une URL présignée pour upload direct vers R2
 */

// AWS Signature V4 implementation for R2
async function signRequest(method, url, headers, accessKeyId, secretAccessKey, region = 'auto') {
  const urlObj = new URL(url)
  const datetime = new Date().toISOString().replace(/[:-]|\.\d{3}/g, '')
  const date = datetime.slice(0, 8)

  const credential = `${accessKeyId}/${date}/${region}/s3/aws4_request`

  // Canonical headers
  const signedHeaders = 'host;x-amz-content-sha256;x-amz-date'
  const canonicalHeaders = [
    `host:${urlObj.host}`,
    `x-amz-content-sha256:UNSIGNED-PAYLOAD`,
    `x-amz-date:${datetime}`,
  ].join('\n') + '\n'

  // Canonical request
  const canonicalRequest = [
    method,
    urlObj.pathname,
    urlObj.searchParams.toString(),
    canonicalHeaders,
    signedHeaders,
    'UNSIGNED-PAYLOAD'
  ].join('\n')

  // String to sign
  const encoder = new TextEncoder()
  const canonicalRequestHash = await crypto.subtle.digest('SHA-256', encoder.encode(canonicalRequest))
  const canonicalRequestHashHex = Array.from(new Uint8Array(canonicalRequestHash))
    .map(b => b.toString(16).padStart(2, '0')).join('')

  const stringToSign = [
    'AWS4-HMAC-SHA256',
    datetime,
    `${date}/${region}/s3/aws4_request`,
    canonicalRequestHashHex
  ].join('\n')

  // Signing key
  async function hmacSha256(key, data) {
    const cryptoKey = await crypto.subtle.importKey(
      'raw',
      typeof key === 'string' ? encoder.encode(key) : key,
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['sign']
    )
    return await crypto.subtle.sign('HMAC', cryptoKey, encoder.encode(data))
  }

  const kDate = await hmacSha256(`AWS4${secretAccessKey}`, date)
  const kRegion = await hmacSha256(kDate, region)
  const kService = await hmacSha256(kRegion, 's3')
  const kSigning = await hmacSha256(kService, 'aws4_request')

  const signature = Array.from(new Uint8Array(await hmacSha256(kSigning, stringToSign)))
    .map(b => b.toString(16).padStart(2, '0')).join('')

  return {
    authorization: `AWS4-HMAC-SHA256 Credential=${credential}, SignedHeaders=${signedHeaders}, Signature=${signature}`,
    'x-amz-date': datetime,
    'x-amz-content-sha256': 'UNSIGNED-PAYLOAD'
  }
}

// Encode URI component but preserve certain characters for S3 compatibility
function s3UriEncode(str) {
  return encodeURIComponent(str)
    .replace(/!/g, '%21')
    .replace(/'/g, '%27')
    .replace(/\(/g, '%28')
    .replace(/\)/g, '%29')
    .replace(/\*/g, '%2A')
}

// Génère une URL présignée pour PUT
async function generatePresignedUrl(bucket, key, accessKeyId, secretAccessKey, accountId, expiresIn = 3600) {
  const endpoint = `https://${accountId}.r2.cloudflarestorage.com`
  const datetime = new Date().toISOString().replace(/[:-]|\.\d{3}/g, '')
  const date = datetime.slice(0, 8)
  const region = 'auto'

  const credential = `${accessKeyId}/${date}/${region}/s3/aws4_request`

  const params = new URLSearchParams({
    'X-Amz-Algorithm': 'AWS4-HMAC-SHA256',
    'X-Amz-Credential': credential,
    'X-Amz-Date': datetime,
    'X-Amz-Expires': expiresIn.toString(),
    'X-Amz-SignedHeaders': 'host',
  })

  // Encode the key properly for S3
  const encodedKey = key.split('/').map(s3UriEncode).join('/')
  const canonicalUri = `/${bucket}/${encodedKey}`

  const url = `${endpoint}${canonicalUri}`
  const urlObj = new URL(url)
  urlObj.search = params.toString()

  // Canonical request for presigned URL
  const canonicalRequest = [
    'PUT',
    canonicalUri,
    params.toString(),
    `host:${urlObj.host}\n`,
    'host',
    'UNSIGNED-PAYLOAD'
  ].join('\n')

  const encoder = new TextEncoder()
  const canonicalRequestHash = await crypto.subtle.digest('SHA-256', encoder.encode(canonicalRequest))
  const canonicalRequestHashHex = Array.from(new Uint8Array(canonicalRequestHash))
    .map(b => b.toString(16).padStart(2, '0')).join('')

  const stringToSign = [
    'AWS4-HMAC-SHA256',
    datetime,
    `${date}/${region}/s3/aws4_request`,
    canonicalRequestHashHex
  ].join('\n')

  async function hmacSha256(key, data) {
    const cryptoKey = await crypto.subtle.importKey(
      'raw',
      typeof key === 'string' ? encoder.encode(key) : key,
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['sign']
    )
    return await crypto.subtle.sign('HMAC', cryptoKey, encoder.encode(data))
  }

  const kDate = await hmacSha256(`AWS4${secretAccessKey}`, date)
  const kRegion = await hmacSha256(kDate, region)
  const kService = await hmacSha256(kRegion, 's3')
  const kSigning = await hmacSha256(kService, 'aws4_request')

  const signature = Array.from(new Uint8Array(await hmacSha256(kSigning, stringToSign)))
    .map(b => b.toString(16).padStart(2, '0')).join('')

  params.set('X-Amz-Signature', signature)
  urlObj.search = params.toString()

  return urlObj.toString()
}

export async function onRequestGet(context) {
  const { params, env } = context
  const { transferId, fileName } = params

  try {
    const decodedFileName = decodeURIComponent(fileName)
    const r2Key = `${transferId}/${decodedFileName}`

    // Account ID extrait de l'endpoint R2 ou configuré
    // Format: https://<account_id>.r2.cloudflarestorage.com
    const accountId = '63cd4bc3c2b4f5f480421105fe0f2a2b'

    const presignedUrl = await generatePresignedUrl(
      'bump-files',
      r2Key,
      env.R2_ACCESS_KEY_ID,
      env.R2_SECRET_ACCESS_KEY,
      accountId,
      3600 // 1 heure
    )

    return Response.json({
      url: presignedUrl,
      key: r2Key
    })
  } catch (error) {
    console.error('Presign error:', error)
    return Response.json(
      { error: 'Erreur lors de la génération de l\'URL' },
      { status: 500 }
    )
  }
}
