const crypto = require(‘crypto’);

module.exports = async function handler(req, res) {
if (req.method !== ‘POST’) return res.status(405).end();

const { question } = req.body;
if (!question) return res.status(400).json({ error: ‘Falta la pregunta’ });

try {
const kvData = await fetchKnowledgeFromR2();
const answer = findBestMatch(question, kvData);
res.status(200).json({ answer });
} catch (error) {
console.error(‘ERROR NOVA:’, error.message);
res.status(500).json({ answer: ‘Error al conectar con la base de conocimiento.’ });
}
};

async function fetchKnowledgeFromR2() {
const endpoint  = process.env.R2_ENDPOINT;
const bucket    = process.env.R2_BUCKET_NAME;
const accessKey = process.env.R2_ACCESS_KEY_ID;
const secretKey = process.env.R2_SECRET_ACCESS_KEY;
const region    = ‘auto’;
const service   = ‘s3’;
const file      = ‘knowledge.json’;

if (!endpoint || !bucket || !accessKey || !secretKey) {
throw new Error(‘Faltan variables de entorno de R2’);
}

const host      = new URL(endpoint).host;
const now       = new Date();
const amzDate   = now.toISOString().replace(/[:-]|.\d{3}/g, ‘’).slice(0, 15) + ‘Z’;
const dateStamp = amzDate.slice(0, 8);

const canonicalUri     = `/${bucket}/${file}`;
const canonicalQuery   = ‘’;
const canonicalHeaders = `host:${host}\nx-amz-date:${amzDate}\n`;
const signedHeaders    = ‘host;x-amz-date’;
const payloadHash      = ‘e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855’;

const canonicalRequest = [
‘GET’, canonicalUri, canonicalQuery,
canonicalHeaders, signedHeaders, payloadHash
].join(’\n’);

const credentialScope = `${dateStamp}/${region}/${service}/aws4_request`;
const stringToSign = [
‘AWS4-HMAC-SHA256’, amzDate, credentialScope,
crypto.createHash(‘sha256’).update(canonicalRequest).digest(‘hex’)
].join(’\n’);

const hmac = (key, data) => crypto.createHmac(‘sha256’, key).update(data).digest();
const signingKey = hmac(hmac(hmac(hmac(`AWS4${secretKey}`, dateStamp), region), service), ‘aws4_request’);
const signature  = crypto.createHmac(‘sha256’, signingKey).update(stringToSign).digest(‘hex’);

const authHeader = `AWS4-HMAC-SHA256 Credential=${accessKey}/${credentialScope}, SignedHeaders=${signedHeaders}, Signature=${signature}`;

const url = `${endpoint}/${bucket}/${file}`;
const response = await fetch(url, {
headers: {
‘x-amz-date’: amzDate,
‘Authorization’: authHeader
}
});

if (!response.ok) {
const errText = await response.text();
throw new Error(`R2 ${response.status}: ${errText}`);
}

return await response.json();
}

function findBestMatch(question, kvData) {
const questionWords = normalize(question).split(’ ’).filter(w => w.length > 2);

let bestMatch = null;
let bestScore = 0;

for (const [key, value] of Object.entries(kvData)) {
const keyWords = normalize(key).split(’ ’).filter(w => w.length > 2);

```
const matches = questionWords.filter(word =>
  keyWords.some(kw => kw.includes(word) || word.includes(kw))
).length;

const score = matches / Math.max(questionWords.length, 1);

if (score > bestScore) {
  bestScore = score;
  bestMatch = value;
}
```

}

if (bestScore < 0.3 || !bestMatch) {
return ‘Lo siento, no tengo información sobre ese tema en mi base de conocimiento.’;
}

return bestMatch;
}

function normalize(text) {
return text
.toLowerCase()
.normalize(‘NFD’)
.replace(/[\u0300-\u036f]/g, ‘’)
.replace(/[^a-z0-9\s]/g, ‘’)
.trim();
}
