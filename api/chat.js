export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();

  const { question } = req.body;
  if (!question) return res.status(400).json({ error: 'Falta la pregunta' });

  try {
    // 1. Obtener documentos de R2
    const docs = await fetchDocumentsFromR2();
    
    // 2. Construir contexto
    const context = docs.join('\n\n---\n\n');
    
    // 3. Llamar a Gemini (API gratuita de Google)
    const geminiResponse = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-pro:generateContent?key=${process.env.GEMINI_API_KEY}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{
            parts: [{
              text: `Eres Nova, un asistente tecnico profesional. Responde EXCLUSIVAMENTE con la informacion del siguiente contexto. Si la respuesta no esta en el contexto, indica: "La informacion solicitada no se encuentra en los documentos del bucket R2."\n\nContexto:\n${context}\n\nPregunta: ${question}`
            }]
          }]
        })
      }
    );

    const data = await geminiResponse.json();
    const answer = data.candidates?.[0]?.content?.parts?.[0]?.text || 
                   'No se pudo generar una respuesta. Verifique los documentos.';

    res.status(200).json({ answer });
  } catch (error) {
    console.error(error);
    res.status(500).json({ answer: 'Error interno del servidor de conocimiento.' });
  }
}

async function fetchDocumentsFromR2() {
  const endpoint = process.env.R2_ENDPOINT;
  const bucket = process.env.R2_BUCKET_NAME;
  const accessKey = process.env.R2_ACCESS_KEY_ID;
  const secretKey = process.env.R2_SECRET_ACCESS_KEY;

  const listUrl = `${endpoint}/${bucket}?list-type=2`;
  
  const listResponse = await fetch(listUrl, {
    headers: {
      'Authorization': 'Basic ' + btoa(`${accessKey}:${secretKey}`)
    }
  });

  const listText = await listResponse.text();
  const parser = new DOMParser();
  const xmlDoc = parser.parseFromString(listText, "text/xml");
  const keys = [...xmlDoc.getElementsByTagName('Key')].map(el => el.textContent);

  const documents = [];
  for (const key of keys) {
    if (key.endsWith('.txt') || key.endsWith('.md')) {
      const fileUrl = `${endpoint}/${bucket}/${key}`;
      const fileResponse = await fetch(fileUrl, {
        headers: {
          'Authorization': 'Basic ' + btoa(`${accessKey}:${secretKey}`)
        }
      });
      const text = await fileResponse.text();
      documents.push(`[Archivo: ${key}]\n${text}`);
    }
  }
  
  return documents;
}
