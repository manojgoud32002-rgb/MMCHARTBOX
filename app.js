// MMCARTBOX frontend logic (multi-dataset + server suggestion endpoint)
let datasets = {}; // { name: rows[] }
let activeDataset = null;
let chart = null;

// DOM
const chat = document.getElementById('chat');
const promptForm = document.getElementById('promptForm');
const promptInput = document.getElementById('promptInput');

const fileInput = document.getElementById('fileInput');
const pasteCsvBtn = document.getElementById('pasteCsvBtn');
const useSampleBtn = document.getElementById('useSampleBtn');

const preview = document.getElementById('preview');
const datasetSelect = document.getElementById('datasetSelect');
const chartType = document.getElementById('chartType');
const xSelect = document.getElementById('xSelect');
const ySelect = document.getElementById('ySelect');
const renderBtn = document.getElementById('renderBtn');
const downloadBtn = document.getElementById('downloadBtn');
const serverSuggestBtn = document.getElementById('serverSuggestBtn');
const canvas = document.getElementById('chartCanvas');

// Utilities
function addMessage(text, who='bot'){
  const div = document.createElement('div');
  div.className = 'msg ' + (who === 'user' ? 'user' : 'bot');
  div.textContent = text;
  chat.appendChild(div);
  chat.scrollTop = chat.scrollHeight;
}

function showPreview(rows){
  if(!rows || rows.length===0){ preview.innerHTML = 'No data loaded.'; return; }
  const cols = Object.keys(rows[0]);
  let html = '<table><thead><tr>';
  for(const c of cols) html += `<th>${c}</th>`;
  html += '</tr></thead><tbody>';
  const max = Math.min(rows.length, 8);
  for(let i=0;i<max;i++){
    html += '<tr>';
    for(const c of cols) html += `<td>${rows[i][c]}</td>`;
    html += '</tr>';
  }
  if(rows.length>8) html += `<tr><td colspan="${cols.length}">... ${rows.length - 8} more rows</td></tr>`;
  html += '</tbody></table>';
  preview.innerHTML = html;
}

function addDataset(name, rows){
  datasets[name] = rows;
  const opt = document.createElement('option');
  opt.value = name; opt.textContent = name;
  datasetSelect.appendChild(opt);
  if(!activeDataset) { datasetSelect.value = name; setActiveDataset(name); }
}

function setActiveDataset(name){
  activeDataset = name;
  const rows = datasets[name];
  showPreview(rows);
  populateSelects(rows);
}

// CSV handling
function loadCSVTextIntoDataset(text, filename = `data_${Object.keys(datasets).length + 1}`){
  const res = Papa.parse(text, {header:true, dynamicTyping:true, skipEmptyLines:true});
  const name = filename.replace(/\.[^/.]+$/, "");
  addDataset(name, res.data);
  addMessage(`Loaded dataset "${name}" (${res.data.length} rows, ${Object.keys(res.data[0]||{}).length} cols).`, 'bot');
}

fileInput.addEventListener('change', (e)=>{
  const files = Array.from(e.target.files || []);
  if(files.length === 0) return;
  files.forEach(f => {
    const reader = new FileReader();
    reader.onload = evt => loadCSVTextIntoDataset(evt.target.result, f.name);
    reader.readAsText(f);
  });
});

pasteCsvBtn.addEventListener('click', ()=>{
  const text = prompt('Paste CSV data (first line = header):');
  if(text) loadCSVTextIntoDataset(text, `pasted_${Date.now()}.csv`);
});

useSampleBtn.addEventListener('click', ()=>{
  const sample = `Date,Sales,Region,Category,Price\n2024-01-01,120,North,A,9.99\n2024-01-02,150,North,B,12.50\n2024-01-03,170,South,A,8.75\n2024-01-04,80,East,B,7.00\n2024-01-05,200,West,A,11.30\n2024-01-06,90,South,B,6.50\n2024-01-07,220,East,A,13.00\n2024-01-08,180,West,B,10.25`;
  loadCSVTextIntoDataset(sample, 'sample.csv');
});

// After dataset loaded
datasetSelect.addEventListener('change', (e) => setActiveDataset(e.target.value));

function populateSelects(rows){
  xSelect.innerHTML = '';
  ySelect.innerHTML = '';
  if(!rows || rows.length===0) return;
  const cols = Object.keys(rows[0]);
  for(const c of cols){
    const opt1 = document.createElement('option'); opt1.value=c; opt1.textContent=c; xSelect.appendChild(opt1);
    const opt2 = document.createElement('option'); opt2.value=c; opt2.textContent=c; ySelect.appendChild(opt2);
  }
}

// Chart rendering
function renderChartFromSelection(){
  if(!activeDataset){ alert('Choose or load a dataset first.'); return; }
  const rows = datasets[activeDataset];
  if(!rows || rows.length===0){ alert('Dataset empty.'); return; }

  const xKey = xSelect.value;
  const yKeys = Array.from(ySelect.selectedOptions).map(o=>o.value);
  const type = chartType.value;
  if(!xKey || yKeys.length === 0){ alert('Choose X and at least one Y column (hold Ctrl/Cmd to multi-select).'); return; }

  // Prepare dataset arrays
  const labels = rows.map(r => r[xKey]);
  const colors = ['#2563eb','#f59e0b','#10b981','#ef4444','#8b5cf6','#ec4899','#06b6d4'];

  const datasetsForChart = yKeys.map((yk, i) => {
    const data = rows.map(r => {
      const v = r[yk];
      return (typeof v === 'number') ? v : (Number(v) || 0);
    });
    return {
      label: yk,
      data,
      borderColor: colors[i % colors.length],
      backgroundColor: colors[i % colors.length],
      fill: false,
    };
  });

  const ctx = canvas.getContext('2d');
  if(chart) chart.destroy();

  const cfg = {
    type: (type === 'scatter' && yKeys.length === 1) ? 'scatter' : type,
    data: {
      labels: (type === 'scatter') ? labels : labels,
      datasets: datasetsForChart
    },
    options: {
      responsive: true,
      plugins:{
        legend:{ position: 'top' }
      },
      scales: (type === 'pie' || type === 'doughnut') ? {} : {
        x: { display: true, title: {display:true, text:xKey} },
        y: { display: true, title: {display:true, text: yKeys.join(', ') } }
      }
    }
  };

  // For scatter: convert to [{x, y}] if necessary (single y)
  if(cfg.type === 'scatter' && yKeys.length===1){
    cfg.data.datasets = [{
      label: `${yKeys[0]} vs ${xKey}`,
      data: rows.map(r => ({ x: r[xKey], y: r[yKeys[0]] })),
      backgroundColor: colors[0]
    }];
  }

  chart = new Chart(ctx, cfg);
  addMessage(`Rendered ${type} chart: ${yKeys.join(', ')} vs ${xKey}`, 'bot');
}

// Simple local natural-language prompt parsing to suggest chart + columns
function localParsePrompt(prompt, rows){
  const p = prompt.toLowerCase();
  const suggestion = {type:null, x:null, y:[], text:'Could not infer a chart.'};
  if(!rows || rows.length===0){
    suggestion.text = 'Load a dataset first to get suggestions.';
    return suggestion;
  }
  const origCols = Object.keys(rows[0]);
  const cols = origCols.map(c=>c.toLowerCase());

  if(p.match(/\b(line|trend|over time)\b/)) suggestion.type = 'line';
  else if(p.match(/\b(bar|bars|histogram|compare)\b/)) suggestion.type = 'bar';
  else if(p.match(/\b(pie|doughnut|proportion|share)\b/)) suggestion.type = 'pie';
  else if(p.match(/\b(scatter|correlat|relationship)\b/)) suggestion.type = 'scatter';
  else suggestion.type = 'bar';

  // find columns mentioned
  for(const col of cols){
    if(p.includes(col)) {
      const idx = cols.indexOf(col);
      if(!suggestion.x) suggestion.x = origCols[idx];
      else if(suggestion.y.length < 3 && !suggestion.y.includes(origCols[idx])) suggestion.y.push(origCols[idx]);
    }
  }

  // heuristics for x and y
  if(!suggestion.x) suggestion.x = origCols[0];
  if(suggestion.y.length === 0) {
    // pick numeric columns as y
    const sample = rows[0];
    const candidates = origCols.filter(k => typeof sample[k] === 'number' || !isNaN(Number(sample[k])));
    suggestion.y = candidates.slice(0, Math.min(2, candidates.length));
    if(suggestion.y.length === 0 && origCols.length > 1) suggestion.y = [origCols[1]];
  }

  suggestion.text = `Suggested ${suggestion.type} chart of "${suggestion.y.join(', ')}" vs "${suggestion.x}".`;
  return suggestion;
}

// Server suggestion: POST /api/suggest { prompt, datasetName or rows }
// Server returns { type, x, y:[], text }
async function askServerForSuggestion(prompt){
  if(!activeDataset){ addMessage('Load a dataset first before asking the server.', 'bot'); return null;}
  addMessage('Asking server for a suggestion...', 'bot');
  try {
    const rows = datasets[activeDataset];
    const res = await fetch('/api/suggest', {
      method: 'POST',
      headers: {'Content-Type': 'application/json'},
      body: JSON.stringify({ prompt, rows, datasetName: activeDataset })
    });
    if(!res.ok){
      const txt = await res.text();
      addMessage(`Server error: ${txt}`, 'bot');
      return null;
    }
    const json = await res.json();
    return json;
  } catch (err){
    addMessage(`Server request failed: ${err.message}`, 'bot');
    return null;
  }
}

// Events
promptForm.addEventListener('submit', async (e)=>{
  const text = promptInput.value.trim();
  if(!text) return;
  addMessage(text, 'user');
  promptInput.value = '';

  // Try server first; fallback to local
  let sug = null;
  const serverEnabled = true; // user's server may not be running; function handles failure
  if(serverEnabled){
    const serverResp = await askServerForSuggestion(text);
    if(serverResp && serverResp.type){
      sug = serverResp;
      addMessage(sug.text || 'Server made a suggestion.', 'bot');
    } else {
      // fallback
      sug = localParsePrompt(text, datasets[activeDataset]);
      addMessage('(Using local fallback) ' + sug.text, 'bot');
    }
  } else {
    sug = localParsePrompt(text, datasets[activeDataset]);
    addMessage(sug.text, 'bot');
  }

  // apply suggestion
  if(sug){
    if(sug.type) chartType.value = sug.type;
    if(sug.x) xSelect.value = sug.x;
    if(Array.isArray(sug.y) && sug.y.length){
      // set selections
      Array.from(ySelect.options).forEach(opt => opt.selected = sug.y.includes(opt.value));
    } else {
      // select first option
      ySelect.selectedIndex = 0;
    }
  }
});

serverSuggestBtn.addEventListener('click', async ()=>{
  const text = promptInput.value.trim();
  if(!text){ alert('Type a prompt first (or paste it) and then click Ask server for suggestion.'); return; }
  addMessage(text, 'user');
  const sug = await askServerForSuggestion(text);
  if(sug){
    addMessage(sug.text || 'Server suggestion received.', 'bot');
    if(sug.type) chartType.value = sug.type;
    if(sug.x) xSelect.value = sug.x;
    if(Array.isArray(sug.y) && sug.y.length){
      Array.from(ySelect.options).forEach(opt => opt.selected = sug.y.includes(opt.value));
    }
  } else {
    addMessage('No suggestion from server (see earlier messages).', 'bot');
  }
});

renderBtn.addEventListener('click', renderChartFromSelection);

downloadBtn.addEventListener('click', ()=>{
  if(!chart) return alert('Render a chart first.');
  const link = document.createElement('a');
  link.href = canvas.toDataURL('image/png');
  link.download = 'mmcartbox_chart.png';
  link.click();
});

// Initialize
addMessage('Welcome to MMCARTBOX — load CSV(s) (you can add multiple), select dataset and columns, or type a prompt and ask the server for a suggestion. Server is optional.', 'bot');