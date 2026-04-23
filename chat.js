export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();

  const { question } = req.body;
  if (!question) return res.status(400).json({ error: 'Falta la pregunta' });

  try {
    // 1. Obtener todas las claves del KV de Cloudflare
    const kvData = await fetchAllFromKV();

    // 2. Buscar la mejor respuesta por palabras clave
    const answer = findBestMatch(question, kvData);

    res.status(200).json({ answer });
  } catch (error) {
    console.error(error);
    res.status(500).json({ answer: 'Error al conectar con la base de conocimiento.' });
  }
}

// Busca la entrada más parecida a la pregunta del usuario
function findBestMatch(question, kvData) {
  const questionWords = normalize(question).split(' ').filter(w => w.length > 2);

  let bestMatch = null;
  let bestScore = 0;

  for (const [key, value] of Object.entries(kvData)) {
    const keyWords = normalize(key).split(' ').filter(w => w.length > 2);

    // Contar cuántas palabras coinciden
    const matches = questionWords.filter(word => 
      keyWords.some(kw => kw.includes(word) || word.includes(kw))
    ).length;

    const score = matches / Math.max(questionWords.length, 1);

    if (score > bestScore) {
      bestScore = score;
      bestMatch = value;
    }
  }

  // Si no encontró nada relevante (menos del 30% de coincidencia)
  if (bestScore < 0.3 || !bestMatch) {
    return 'Lo siento, no tengo información sobre ese tema en mi base de conocimiento.';
  }

  return bestMatch;
}

// Normaliza texto: minúsculas, sin tildes, sin caracteres especiales
function normalize(text) {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // quita tildes
    .replace(/[^a-z0-9\s]/g, '')     // quita caracteres especiales
    .trim();
}

// Obtiene todo el contenido del KV de Cloudflare
async function fetchAllFromKV() {
  const accountId = process.env.CF_ACCOUNT_ID;
  const namespaceId = process.env.CF_KV_NAMESPACE_ID;
  const apiToken = process.env.CF_API_TOKEN;

  const baseUrl = `https://api.cloudflare.com/client/v4/accounts/${accountId}/storage/kv/namespaces/${namespaceId}`;

  // 1. Listar todas las claves
  const listRes = await fetch(`${baseUrl}/keys`, {
    headers: { 'Authorization': `Bearer ${apiToken}` }
  });

  const listData = await listRes.json();

  if (!listData.success) {
    throw new Error('No se pudieron obtener las claves del KV');
  }

  const keys = listData.result.map(k => k.name);

  // 2. Obtener el valor de cada clave
  const kvData = {};

  await Promise.all(keys.map(async (key) => {
    const valueRes = await fetch(`${baseUrl}/values/${encodeURIComponent(key)}`, {
      headers: { 'Authorization': `Bearer ${apiToken}` }
    });
    const value = await valueRes.text();
    kvData[key] = value;
  }));

  return kvData;
}
