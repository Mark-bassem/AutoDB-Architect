// main.js - AutoDB Architect frontend

const API_BASE = 'http://localhost:5000/api'; // backend proxy root

let currentSchema = null;
let activeTab = 'erd';

const promptInput = document.getElementById('prompt-input');
const generateButton = document.getElementById('generate-button');
const errorMessage = document.getElementById('error-message');
const resultsContainer = document.getElementById('results-container');
const contentArea = document.getElementById('content-area');
const tabsContainer = document.getElementById('tabs-container');
const emptyState = document.getElementById('empty-state');
const examplesContainer = document.getElementById('examples-container');
const downloadSQLBtn = document.getElementById('download-sql');
const downloadJSONBtn = document.getElementById('download-json');
const exampleHospitalBtn = document.getElementById('example-hospital');

const examples = [
  "Uber-like app with Riders, Drivers, Trips, and Payments",
  "Online School with Students, Courses, Instructors, and Enrollments"
];

const tabs = [
  { id: 'erd', label: 'ERD Diagram', icon: 'layout', content: renderERD },
  { id: 'sql', label: 'SQL Script', icon: 'terminal', content: renderSQL },
  { id: 'code', label: 'Python Models', icon: 'code', content: renderPython },
  { id: 'json', label: 'JSON', icon: 'file-json', content: renderJSON },
];

function showError(msg) {
  errorMessage.textContent = msg;
  errorMessage.classList.remove('hidden');
}

function hideError() {
  errorMessage.textContent = '';
  errorMessage.classList.add('hidden');
}

function setLoading(on) {
  const icon = generateButton.querySelector('i');
  const span = generateButton.querySelector('span');
  generateButton.disabled = on;

  if (on) {
    generateButton.classList.add('opacity-70', 'cursor-not-allowed');
    icon.setAttribute('data-lucide', 'loader-2');
    icon.classList.add('animate-spin');
    if (span) span.textContent = 'Analysis ...';
  } else {
    generateButton.classList.remove('opacity-70', 'cursor-not-allowed');
    icon.setAttribute('data-lucide', 'play');
    icon.classList.remove('animate-spin');
    if (span) span.textContent = 'Generate System';
  }
  if (window.lucide && typeof lucide.createIcons === 'function') lucide.createIcons();
}

function escapeHtml(str) {
  return (str || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function createCodeBlock(code, language) {
  const id = 'copy-' + Math.random().toString(36).slice(2, 9);
  return `
    <div class="relative group rounded-lg overflow-hidden border border-slate-700 bg-slate-900 my-4 shadow-lg">
      <div class="flex items-center justify-between px-4 py-2 bg-slate-800 border-b border-slate-700">
        <span class="text-xs font-mono text-slate-400 uppercase tracking-wider">${language}</span>
        <button data-copy-id="${id}" class="p-1 hover:bg-slate-700 rounded transition-colors copy-button" title="Copy to clipboard">
          <i data-lucide="copy" style="width:14px;height:14px" class="text-slate-400"></i>
        </button>
      </div>
      <pre class="p-4 overflow-x-auto text-sm font-mono text-slate-300 whitespace-pre code-container">
${escapeHtml(code)}
      </pre>
    </div>
  `;
}

// --- Schema generators ---

function generateSQL(schema) {
  if (!schema || !schema.entities) return '';
  let sql = `-- Generated SQL Schema\n-- System: AutoDB Architect\n\n`;

  schema.entities.forEach(entity => {
    sql += `CREATE TABLE ${entity.name} (\n`;
    const fields = (entity.fields || []).map(f => {
      let line = `  ${f.name} ${f.type}`;
      if (f.isPK) line += ' PRIMARY KEY';
      return line;
    });
    sql += fields.join(',\n');
    sql += `\n);\n\n`;
  });

  (schema.relationships || []).forEach(rel => {
    if (rel.type === 'One-to-Many' || rel.type === 'Many-to-One') {
      const fkTable = rel.to;
      const pkTable = rel.from;
      const pkEntity = (schema.entities || []).find(e => e.name === pkTable);
      const pkField = pkEntity?.fields?.find(f => f.isPK);
      const pkType = pkField?.type || 'INT';
      sql += `-- Relationship: ${pkTable} ${rel.label || 'related to'} ${fkTable} (${rel.type})\n`;
      sql += `ALTER TABLE ${fkTable} ADD COLUMN ${pkTable.toLowerCase()}_id ${pkType};\n`;
      sql += `ALTER TABLE ${fkTable} ADD CONSTRAINT fk_${fkTable}_${pkTable} FOREIGN KEY (${pkTable.toLowerCase()}_id) REFERENCES ${pkTable}(${pkField?.name || 'id'});\n\n`;
    }
  });

  return sql;
}

function generatePythonClasses(schema) {
  if (!schema || !schema.entities) return '';
  let code = `from dataclasses import dataclass\nfrom typing import Optional, List\nfrom datetime import date, datetime\n\n`;

  schema.entities.forEach(entity => {
    code += `@dataclass\nclass ${entity.name}:\n    \"\"\"${entity.description || ('Model for ' + entity.name)}\"\"\"\n`;
    (entity.fields || []).forEach(f => {
      let pyType = 'str';
      const t = (f.type || '').toUpperCase();
      if (t.includes('INT')) pyType = 'int';
      if (t.includes('BOOL')) pyType = 'bool';
      if (t.includes('DATE')) pyType = 'date';
      if (t.includes('TIMESTAMP')) pyType = 'datetime';
      if (t.includes('FLOAT') || t.includes('DECIMAL')) pyType = 'float';
      code += `    ${f.name}: ${pyType}\n`;
    });
    code += '\n';
  });

  return code;
}

// --- Renderers ---

function renderEntityCard(entity) {
  const fieldsHtml = (entity.fields || []).map(f => `
    <div class="flex justify-between items-center text-sm py-1.5 border-b border-slate-700/50 last:border-0 hover:bg-slate-700/30 px-1 rounded">
      <div class="flex items-center gap-2">
        ${f.isPK ? '<span title="Key ELement" class="text-yellow-500 text-xs">PK</span>' : ''}
        ${f.isFK ? '<span title="Foreign Key" class="text-purple-500 text-xs">FK</span>' : ''}
        <span class="font-mono ${f.isPK ? 'text-yellow-100 font-medium' : 'text-slate-300'}">${f.name}</span>
      </div>
      <span class="text-xs text-slate-500 uppercase font-mono">${f.type}</span>
    </div>
  `).join('');

  return `
    <div class="bg-slate-800 border-t-4 border-blue-500 rounded-lg shadow-xl min-w-[240px] max-w-sm m-2 flex flex-col">
      <div class="bg-slate-900/50 p-3 flex justify-between items-center border-b border-slate-700">
        <div class="flex items-center gap-2">
          <i data-lucide="table" style="width:16px;height:16px" class="text-blue-400"></i>
          <span class="font-bold text-slate-200">${entity.name}</span>
        </div>
        <span class="text-[10px] text-slate-500 bg-slate-900 px-2 py-1 rounded-full border border-slate-800">TABLE</span>
      </div>
      <div class="p-3 flex-grow">${fieldsHtml}</div>
      <div class="bg-slate-900/30 p-2 text-xs text-slate-500 italic border-t border-slate-800 text-center">${entity.description || ''}</div>
    </div>
  `;
}

function renderRelationshipMatrix(relationships) {
  if (!relationships || relationships.length === 0) return '';
  const matrixHtml = (relationships || []).map(rel => `
    <div class="group flex items-center justify-between text-sm bg-slate-950 p-4 rounded-lg border border-slate-800 hover:border-blue-500/30 transition-colors">
      <span class="font-semibold text-blue-300">${rel.from}</span>
      <div class="flex flex-col items-center px-3">
        <span class="text-[10px] text-slate-500 mb-1">${rel.type}</span>
        <div class="w-16 h-[1px] bg-slate-700 group-hover:bg-blue-500/50 transition-colors relative"></div>
        <span class="text-[10px] text-slate-600 mt-1 italic">${rel.label || 'related to'}</span>
      </div>
      <span class="font-semibold text-indigo-300">${rel.to}</span>
    </div>
  `).join('');

  return `
    <div class="mt-12 pt-8 border-t border-dashed border-slate-800">
      <h3 class="text-sm font-bold text-slate-500 uppercase tracking-wider mb-6 flex items-center gap-2 justify-end">
        <i data-lucide="arrow-right" style="width:14px;height:14px"></i>
        Relationships Matrix
      </h3>
      <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">${matrixHtml}</div>
    </div>
  `;
}

function renderERD(schema) {
  if (!schema) return '';
  const cardsHtml = (schema.entities || []).map(renderEntityCard).join('');
  const matrixHtml = renderRelationshipMatrix(schema.relationships);
  return `<div class="h-full"><div class="flex flex-wrap gap-8 justify-center items-start">${cardsHtml}</div>${matrixHtml}</div>`;
}

function renderSQL(schema) {
  if (!schema) return '';
  const sqlCode = generateSQL(schema);
  return `<div><div class="flex items-center justify-between mb-2"><h3 class="text-lg font-semibold text-slate-200">مخطط قاعدة البيانات (DDL)</h3><span class="text-xs text-slate-500 bg-slate-800 px-2 py-1 rounded">compatible with PostgreSQL / MySQL</span></div>${createCodeBlock(sqlCode, 'sql')}</div>`;
}

function renderPython(schema) {
  if (!schema) return '';
  const pythonCode = generatePythonClasses(schema);
  return `<div><h3 class="text-lg font-semibold text-slate-200 mb-2">Class Models Python</h3>${createCodeBlock(pythonCode, 'python')}</div>`;
}

function renderJSON(schema) {
  if (!schema) return '';
  const jsonCode = JSON.stringify(schema, null, 2);
  return `<div><h3 class="text-lg font-semibold text-slate-200 mb-2">JSON</h3>${createCodeBlock(jsonCode, 'json')}</div>`;
}

function renderTabs() {
  tabsContainer.innerHTML = tabs.map(tab => {
    const isActive = tab.id === activeTab;
    return `<button data-tab-id="${tab.id}" class="flex items-center gap-2 px-6 py-3 rounded-t-lg transition-all font-medium text-sm border-t border-x ${isActive ? 'border-slate-700 bg-slate-900 text-blue-400 border-b-slate-900 mb-[-1px] z-10' : 'border-transparent text-slate-500 hover:text-slate-300 hover:bg-slate-800/50'}"><i data-lucide="${tab.icon}" style="width:16px;height:16px"></i>${tab.label}</button>`;
  }).join('');
  tabsContainer.querySelectorAll('button').forEach(btn => {
    btn.addEventListener('click', () => {
      activeTab = btn.getAttribute('data-tab-id');
      renderTabs();
      updateContent();
    });
  });
  if (window.lucide) lucide.createIcons();
}

function updateContent() {
  const active = tabs.find(t => t.id === activeTab);
  contentArea.innerHTML = active ? active.content(currentSchema) : '';
  if (window.lucide) lucide.createIcons();
}

// copy button handler (delegation)
document.addEventListener('click', (e) => {
  const btn = e.target.closest('.copy-button');
  if (!btn) return;
  const pre = btn.closest('.relative')?.querySelector('pre');
  if (!pre) return;
  navigator.clipboard.writeText(pre.innerText).then(() => {
    const ic = btn.querySelector('i');
    const orig = ic?.getAttribute('data-lucide');
    if (ic) {
      ic.setAttribute('data-lucide', 'check');
      ic.classList.add('text-green-400');
      if (window.lucide) lucide.createIcons();
      setTimeout(() => {
        if (orig) ic.setAttribute('data-lucide', orig);
        ic.classList.remove('text-green-400');
        if (window.lucide) lucide.createIcons();
      }, 1500);
    }
  }).catch(() => showError('Copy failed - make sure your browser permissions are enabled.'));
});

// Backend interaction
async function generateSchemaFromText(description) {
  const res = await fetch(API_BASE + '/generate', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ prompt: description })
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: 'Server error' }));
    throw new Error(err.error || 'API failure');
  }
  return res.json();
}

async function handleGenerate() {
  const prompt = promptInput.value.trim();
  if (!prompt) {
    showError('Please write the system description first.');
    return;
  }
  hideError();
  setLoading(true);
  resultsContainer.classList.add('hidden');
  emptyState.classList.add('hidden');
  currentSchema = null;

  try {
    const schema = await generateSchemaFromText(prompt);
    currentSchema = schema;
    resultsContainer.classList.remove('hidden');
    activeTab = 'erd';
    renderTabs();
    updateContent();
  } catch (err) {
    console.error('Generation failed:', err);
    showError('Failed to generate the diagrem.');
    emptyState.classList.remove('hidden');
  } finally {
    setLoading(false);
  }
}

// download helpers
function downloadText(filename, text) {
  const blob = new Blob([text], { type: 'text/plain;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  URL.revokeObjectURL(url);
  a.remove();
}

// initialize UI
function init() {
  // examples buttons
  examplesContainer.innerHTML = examples.map(ex => `<button class="text-xs whitespace-nowrap px-3 py-1.5 rounded-full bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-slate-200 border border-slate-700">${ex}</button>`).join('');
  document.querySelectorAll('#examples-container button').forEach(b => b.addEventListener('click', () => promptInput.value = b.textContent));

  // example hospital quick fill
  if (exampleHospitalBtn) {
    exampleHospitalBtn.addEventListener('click', () => {
      promptInput.value = "A hospital contains Doctors, Patients, Appointments, Departments, Nurses, Prescriptions. Each patient may have multiple Appointments. Doctors work in Departments";
    });
    exampleHospitalBtn.classList.remove('hidden');
  }

  generateButton.addEventListener('click', handleGenerate);

  promptInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleGenerate();
    }
  });

  downloadSQLBtn.addEventListener('click', () => {
    if (!currentSchema) { showError('There is no diagram to download'); setTimeout(hideError, 2000); return; }
    const sql = generateSQL(currentSchema);
    downloadText('schema.sql', sql);
  });

  downloadJSONBtn.addEventListener('click', () => {
    if (!currentSchema) { showError('There is no diagram to download'); setTimeout(hideError, 2000); return; }
    const json = JSON.stringify(currentSchema, null, 2);
    downloadText('schema.json', json);
  });

  renderTabs();
  if (window.lucide) lucide.createIcons();
}

window.addEventListener('load', init);
