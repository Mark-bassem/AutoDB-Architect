// server.js
require('dotenv').config();
const express = require('express');
const fetch = require('node-fetch');
const cors = require('cors');
const bodyParser = require('body-parser');

const app = express();
app.use(cors());
app.use(bodyParser.json());

const API_KEY = process.env.GENERATIVE_API_KEY;
if (!API_KEY) {
  console.error('Error: GENERATIVE_API_KEY is not set in .env');
  process.exit(1);
}

const PORT = process.env.PORT || 5000;
console.log('Loaded key:', API_KEY);

// Helper: replace YOUR_GENERATIVE_API_URL with actual API endpoint
const API_URL = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${API_KEY}`;

// POST /api/generate
app.post('/api/generate', async (req, res) => {
  const { prompt } = req.body || {};
  if (!prompt) return res.status(400).json({ error: 'Missing prompt' });

  const systemInstruction = `
You are an expert Database Architect. Output ONLY a valid JSON object with:
{
  "entities": [{ "name": "PascalCase", "description": "short", "fields": [{ "name":"camelCase", "type":"SQL_TYPE", "isPK": boolean, "isFK": boolean }] }],
  "relationships": [{ "from":"EntityName", "to":"EntityName", "type":"One-to-One|One-to-Many|Many-to-Many", "label":"verb" }]
}
No markdown, no extra text.
`;

  const payload = {
    contents: [{ parts: [{ text: prompt }] }],
    systemInstruction: { parts: [{ text: systemInstruction }] },
    generationConfig: { responseMimeType: 'application/json' }
  };

  try {
    const r = await fetch(API_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    const data = await r.json();
    const text = data?.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!text) return res.status(500).json({ error: 'Bad AI response', raw: data });

    try {
      const parsed = JSON.parse(text);
      return res.json(parsed);
    } catch (e) {
      return res.status(500).json({ error: 'Failed to parse AI JSON', rawText: text });
    }
  } catch (err) {
    console.error('Upstream request failed', err);
    res.status(500).json({ error: 'Upstream request failed' });
  }
});

app.listen(PORT, () => console.log(`Server running on http://localhost:${PORT}`));
