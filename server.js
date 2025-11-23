// Simple Express server for MMCARTBOX suggestions
// - POST /api/suggest { prompt, rows, datasetName }
// If OPENAI_API_KEY is present it will call OpenAI; otherwise it uses a safe local fallback parser.
// IMPORTANT: Do NOT commit your real .env or API keys to the repo.

const express = require('express');
const fetch = require('node-fetch');
const cors = require('cors');
require('dotenv').config();

const app = express();
app.use(cors());
app.use(express.json({limit: '2mb'}));
app.use(express.static('public')); // If you serve static files from /public

const OPENAI_KEY = process.env.OPENAI_API_KEY || '';

// Local fallback parser (same heuristics as frontend)
function localParser(prompt, rows){
  if(!rows || rows.length === 0) return { text: 'No data loaded', type: null, x: null, y: [] };
  const p = prompt.toLowerCase();
  const origCols = Object.keys(rows[0]);
  const cols = origCols.map(c => c.toLowerCase());

  const suggestion = { type: null, x: null, y: [], text: '' };

  if(p.match(/\b(line|trend|over time)\b/)) suggestion.type = 'line';
  else if(p.match(/\b(bar|bars|histogram|compare)\b/)) suggestion.type = 'bar';
  else if(p.match(/\b(pie|doughnut|proportion|share)\b/)) suggestion.type = 'pie';
  else if(p.match(/\b(scatter|correlat|relationship)\b/)) suggestion.type = 'scatter';
  else suggestion.type = 'bar';

  for(const col of cols){
    if(p.includes(col)){
      const idx = cols.indexOf(col);
      if(!suggestion.x) suggestion.x = origCols[idx];
      else if(suggestion.y.length < 3 && !suggestion.y.includes(origCols[idx])) suggestion.y.push(origCols[idx]);
    }
  }

  if(!suggestion.x) suggestion.x = origCols[0];
  if(suggestion.y.length === 0){
    const sample = rows[0];
    const candidates = origCols.filter(k => typeof sample[k] === 'number' || !isNaN(Number(sample[k])));
    suggestion.y = candidates.slice(0, Math.min(2, candidates.length));
    if(suggestion.y.length === 0 && origCols.length > 1) suggestion.y = [origCols[1]];
  }

  suggestion.text = `Local suggestion: ${suggestion.type} of ${suggestion.y.join(', ')} vs ${suggestion.x}`;
  return suggestion;
}

app.post('/api/suggest', async (req, res) => {
  const { prompt, rows } = req.body;
  if(!prompt) return res.status(400).send('Missing prompt');
  if(!rows) return res.status(400).send('Missing rows (dataset)');

  if(!OPENAI_KEY){
    const s = localParser(prompt, rows);
    return res.json(s);
  }

  try {
    const system = `You are a helper that suggests chart specifications. Return ONLY a JSON object with keys: type, x, y (array), text. 'type' is one of: line, bar, pie, doughnut, scatter. 'x' is the column name to use as X. 'y' is an array of column names to use as Y-series. 'text' is a short human message. Do not include any extra text.`;

    const userContent = `Dataset columns: ${Object.keys(rows[0] || {}).join(', ')}\nPrompt: ${prompt}\nRespond in JSON exactly as requested.`;

    const openaiRes = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${OPENAI_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [
          {role: 'system', content: system},
          {role: 'user', content: userContent}
        ],
        max_tokens: 200,
        temperature: 0.0
      })
    });

    if(!openaiRes.ok){
      const txt = await openaiRes.text();
      console.error('OpenAI error:', txt);
      return res.status(500).send('OpenAI API error: ' + txt);
    }

    const data = await openaiRes.json();
    const content = data.choices?.[0]?.message?.content || '';
    let parsed = null;
    try {
      parsed = JSON.parse(content);
      return res.json(parsed);
    } catch (err){
      console.warn('Failed to parse model output as JSON, returning local suggestion. Output:', content);
      const s = localParser(prompt, rows);
      s.text = `Fallback used; model output couldn't be parsed as JSON. Model output: ${content}`;
      return res.json(s);
    }
  } catch (err) {
    console.error('Server error', err);
    const s = localParser(prompt, rows);
    s.text = 'Server fallback due to error: ' + err.message;
    return res.json(s);
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`MMCARTBOX server listening on port ${PORT}`);
});
