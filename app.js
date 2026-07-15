import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { 
  getAuth, 
  signInWithEmailAndPassword, 
  signOut, 
  onAuthStateChanged,
  setPersistence,           
  browserSessionPersistence 
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";
import { getDatabase, ref, set, onValue, update, remove } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-database.js";

const firebaseConfig = {
  apiKey: "AIzaSyB5rYR7Mgyznfgd3yiAUpboeGdBbDf6X9Q",
  authDomain: "lpa-200.firebaseapp.com",
  databaseURL: "https://lpa-200-default-rtdb.firebaseio.com",
  projectId: "lpa-200",
  storageBucket: "lpa-200.firebasestorage.app",
  messagingSenderId: "1015616942063",
  appId: "1:1015616942063:web:8550613aae574ec672d01a",
  measurementId: "G-YKFTHME20T"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getDatabase(app);

const FEE = 3600;
let residents = [];
let openMenuId = null;
let currentStatusFilter = 'ALL'; // Tracks 'ALL', 'PAID', or 'UNPAID'

const periodsConfig = [
  { value: 'T1-2026', label: 'Trimestre 1' },
  { value: 'T2-2026', label: 'Trimestre 2' },
  { value: 'T3-2026', label: 'Trimestre 3' },
  { value: 'T4-2026', label: 'Trimestre 4' }
];

const authContainer = document.getElementById('authContainer');
const mainApp = document.getElementById('mainApp');
const authEmailInput = document.getElementById('authEmail');
const authPasswordInput = document.getElementById('authPassword');
const authSubmitBtn = document.getElementById('authSubmitBtn');
const authError = document.getElementById('authError');
const logoutBtn = document.getElementById('logoutBtn');
const periodSelect = document.getElementById('periodSelect');
const blockFilterSelect = document.getElementById('blockFilterSelect');

// New Search Element Selectors
const searchToggleBtn = document.getElementById('searchToggleBtn');
const searchBarContainer = document.getElementById('searchBarContainer');
const residentSearchInput = document.getElementById('residentSearchInput');
const searchClearBtn = document.getElementById('searchClearBtn');

onAuthStateChanged(auth, (user) => {
  if (user) {
    authContainer.style.display = 'none';
    mainApp.style.display = 'flex';
    listenToLiveDatabaseUpdates();
  } else {
    authContainer.style.display = 'flex';
    mainApp.style.display = 'none';
    residents = [];
  }
});

authSubmitBtn.addEventListener('click', () => {
  const email = authEmailInput.value.trim();
  const password = authPasswordInput.value;
  authError.style.display = 'none';

  setPersistence(auth, browserSessionPersistence)
    .then(() => {
      return signInWithEmailAndPassword(auth, email, password);
    })
    .catch(error => {
      authError.textContent = "Error: " + error.message;
      authError.style.display = 'block';
    });
});

logoutBtn.addEventListener('click', () => {
  signOut(auth);
});

function listenToLiveDatabaseUpdates() {
  const residentsRef = ref(db, 'residents');
  onValue(residentsRef, (snapshot) => {
    const data = snapshot.val();
    if (data) {
      residents = Object.keys(data).map(key => ({
        id: key,
        ...data[key],
        payments: data[key].payments || {}
      }));
    } else {
      residents = [];
    }
    render();
  });
}

function getCurrentPeriod() { return periodSelect.value; }
function getCurrentBlockFilter() { return blockFilterSelect.value; }
function isPaid(resident, period) { return !!resident.payments?.[period]; }

function sortResidents(list) {
  return list.sort((a, b) => {
    const blockA = a.block.toUpperCase();
    const blockB = b.block.toUpperCase();
    if (blockA !== blockB) return blockA.localeCompare(blockB);
    const numA = parseInt(a.house.replace(/\D/g, '')) || 0;
    const numB = parseInt(b.house.replace(/\D/g, '')) || 0;
    if (numA !== numB) return numA - numB;
    return a.house.localeCompare(b.house);
  });
}

function addResident() {
  const block = document.getElementById('blockInput').value.trim();
  const house = document.getElementById('houseInput').value.trim();
  const name = document.getElementById('nameInput').value.trim();

  if (!house || !name) {
    alert('Please enter both house number and resident name.');
    return;
  }

  const newId = 'res_' + Date.now() + '_' + Math.floor(Math.random()*1000);
  set(ref(db, 'residents/' + newId), {
    block: block,
    house: house,
    name: name,
    payments: {}
  });

  document.getElementById('houseInput').value = '';
  document.getElementById('nameInput').value = '';
  closeManualAddModal();
}

window.togglePaid = function(id) {
  const r = residents.find(x => x.id === id);
  if (!r) return;
  const period = getCurrentPeriod();
  const nextState = !isPaid(r, period);

  update(ref(db, `residents/${id}/payments`), {
    [period]: nextState
  });
}

window.deleteResident = function(id) {
  const r = residents.find(x => x.id === id);
  if (!r) return;
  if (confirm(`Are you absolutely sure you want to completely remove ${r.name}?`)) {
    remove(ref(db, 'residents/' + id));
  }
}

window.toggleMenu = function(id, event) {
  event.stopPropagation();
  const menu = document.getElementById('menu-' + id);
  if (openMenuId && openMenuId !== id) {
    const prev = document.getElementById('menu-' + openMenuId);
    if (prev) prev.classList.remove('show');
  }
  if (menu) {
    menu.classList.toggle('show');
    openMenuId = menu.classList.contains('show') ? id : null;
  }
}

// Modals Controller Actions
window.openManualAddModal = function() {
  document.getElementById('houseInput').value = '';
  document.getElementById('nameInput').value = '';
  document.getElementById('manualAddModal').classList.add('show');
}
window.closeManualAddModal = function() { document.getElementById('manualAddModal').classList.remove('show'); }
window.openPrintModal = function() { document.getElementById('printModal').classList.add('show'); }
window.closePrintModal = function() { document.getElementById('printModal').classList.remove('show'); }
window.openBulkModal = function() { 
  document.getElementById('bulkInputText').value = '';
  document.getElementById('bulkModal').classList.add('show'); 
}
window.closeBulkModal = function() { document.getElementById('bulkModal').classList.remove('show'); }

function processBulkImport() {
  const rawText = document.getElementById('bulkInputText').value;
  const lines = rawText.split('\n');
  let addedCount = 0;

  lines.forEach((line, index) => {
    if (!line.trim()) return; 
    const parts = line.split(',');
    
    if (parts.length >= 3) {
      const block = parts[0].trim();
      const house = parts[1].trim();
      const name = parts.slice(2).join(',').trim(); 

      if (block && house && name) {
        const uniqueId = 'res_bulk_' + Date.now() + '_' + index + '_' + Math.floor(Math.random()*100);
        set(ref(db, 'residents/' + uniqueId), {
          block: block,
          house: house,
          name: name,
          payments: {}
        });
        addedCount++;
      }
    }
  });

  if (addedCount > 0) {
    alert(`Success! Successfully processed and saved ${addedCount} residents directly into the cloud database.`);
    closeBulkModal();
  } else {
    alert('Error parsing lines. Verify your formatting rule matches: Block, House, Full Name');
  }
}

window.executePrintJob = function() {
  const targetBlock = document.getElementById('printBlockSelect').value;
  const targetTrimester = document.getElementById('printTrimesterSelect').value;

  let printData = [...residents];
  if (targetBlock !== 'ALL') {
    printData = printData.filter(r => r.block.toUpperCase() === targetBlock.toUpperCase());
  }
  printData = sortResidents(printData);

  let targetPeriods = [];
  if (targetTrimester === 'CURRENT') {
    targetPeriods.push(getCurrentPeriod());
  } else if (targetTrimester === 'ALL') {
    targetPeriods = periodsConfig.map(p => p.value);
  } else {
    targetPeriods.push(targetTrimester);
  }

  const printArea = document.getElementById('printArea');
  printArea.innerHTML = ''; 

  if (printData.length === 0) {
    printArea.innerHTML = `
      <div class="print-header">
        <h1>Neighborhood Association — Payment Register</h1>
        <p>No matching records found.</p>
      </div>`;
  } else {
    const blocksMap = {};
    printData.forEach(r => {
      const bKey = r.block.toUpperCase();
      if (!blocksMap[bKey]) blocksMap[bKey] = [];
      blocksMap[bKey].push(r);
    });

    const sortedBlockKeys = Object.keys(blocksMap).sort();

    sortedBlockKeys.forEach(blockKey => {
      const blockResidents = blocksMap[blockKey];
      const pageWrapper = document.createElement('div');
      pageWrapper.className = 'print-page-block';

      const trimesterText = targetTrimester === 'CURRENT' 
        ? periodSelect.options[periodSelect.selectedIndex].text 
        : (targetTrimester === 'ALL' ? 'Full Year Matrix Coverage' : targetTrimester);

      const currentTimestamp = new Date().toLocaleString('en-US', { 
        year: 'numeric', month: 'numeric', day: 'numeric', 
        hour: '2-digit', minute: '2-digit' 
      });

      const boldRightBorder = 'border-right: 3px solid #000 !important;';
      const thinRightBorder = 'border-right: 1px solid #ccc !important;';

      // ROW 1: Identity fields with rowspan="2" & Trimester labels with colspan="3"[cite: 9]
      let mainHeaderCells = `
        <th class="print-th" rowspan="2" style="width: 7%; ${thinRightBorder}">Bloc</th>
        <th class="print-th" rowspan="2" style="width: 9%; ${thinRightBorder}">N° Appt</th>
        <th class="print-th" rowspan="2" style="text-align: left; width: 24%; ${boldRightBorder}">Nom Complet</th>
      `;

      // ROW 2: Empty width mapping slots underneath the trimester groups[cite: 9]
      let subHeaderCells = '';

      targetPeriods.forEach((p, idx) => {
        const cfg = periodsConfig.find(c => c.value === p);
        const periodLabel = cfg ? cfg.label : p;
        const isLastTrimester = (idx === targetPeriods.length - 1);
        const rightGroupBorder = isLastTrimester ? '' : boldRightBorder;

        // Spans across three monthly columns, prevents wrapping, and scales font-size up[cite: 9]
        mainHeaderCells += `
          <th class="print-th" colspan="3" style="font-size: 13px; font-weight: bold; letter-spacing: 0.5px; white-space: nowrap; ${rightGroupBorder}">
            ${periodLabel}
          </th>`;

        // Creates 3 underlying cells mapping out 5% width segments[cite: 9]
        subHeaderCells += `<th class="print-th" style="width: 5%; padding: 0; ${thinRightBorder}"></th>`;
        subHeaderCells += `<th class="print-th" style="width: 5%; padding: 0; ${thinRightBorder}"></th>`;
        subHeaderCells += `<th class="print-th" style="width: 5%; padding: 0; ${rightGroupBorder}"></th>`;
      });

      let tableRowsHTML = blockResidents.map(r => {
        let rowCells = `
          <td class="print-td text-center" style="${thinRightBorder}">B. ${escapeHtml(r.block)}</td>
          <td class="print-td text-center">${escapeHtml(r.house)}</td>
          <td class="print-td text-left" style="text-transform: uppercase; ${boldRightBorder}">${escapeHtml(r.name)}</td>
        `;
        
        targetPeriods.forEach((p, idx) => {
          const paid = isPaid(r, p);
          const mark = paid ? 'P' : '';
          const isLastTrimester = (idx === targetPeriods.length - 1);
          const rightGroupBorder = isLastTrimester ? '' : boldRightBorder;
          
          rowCells += `
            <td class="print-td text-center" style="font-weight: bold; width: 5%; ${thinRightBorder}">${mark}</td>
            <td class="print-td text-center" style="font-weight: bold; width: 5%; ${thinRightBorder}">${mark}</td>
            <td class="print-td text-center" style="font-weight: bold; width: 5%; ${rightGroupBorder}">${mark}</td>
          `;
        });
        return `<tr class="print-tr">${rowCells}</tr>`;
      }).join('');

      pageWrapper.innerHTML = `
        <div class="print-header">
          <h1>Association LPA200 — Registre</h1>
          <p>Etat de Paiement: <strong>Bloc ${blockKey}</strong> — ${trimesterText}</p>
          <div class="print-date-stamp">Le: ${currentTimestamp}</div>
        </div>
        <table class="print-table" style="border-collapse: collapse; width: 100%; table-layout: fixed;">
          <thead>
            <tr class="print-tr">${mainHeaderCells}</tr>
            <tr class="print-tr">${subHeaderCells}</tr>
          </thead>
          <tbody>
            ${tableRowsHTML}
          </tbody>
        </table>
      `;
      printArea.appendChild(pageWrapper);
    });
  }

  closePrintModal();

  // FIX: Let the browser complete styling layouts before raising the print window[cite: 9]
  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      setTimeout(() => { 
        window.print(); 
      }, 600); // 600ms allows the browser engine to lay out the structures beautifully
    });
  });
}

document.addEventListener('click', () => {
  if (openMenuId) {
    const menu = document.getElementById('menu-' + openMenuId);
    if (menu) menu.classList.remove('show');
    openMenuId = null;
  }
});

// Toggle visibility of Search Tray
searchToggleBtn.addEventListener('click', () => {
  searchBarContainer.classList.toggle('open');
  searchToggleBtn.classList.toggle('active');
  
  if (searchBarContainer.classList.contains('open')) {
    residentSearchInput.focus();
  } else {
    residentSearchInput.value = '';
    searchClearBtn.style.display = 'none';
    render();
  }
});

// Real-time input handling
residentSearchInput.addEventListener('input', () => {
  const query = residentSearchInput.value.trim();
  searchClearBtn.style.display = query.length > 0 ? 'block' : 'none';
  render();
});

// Clear input field manually
searchClearBtn.addEventListener('click', () => {
  residentSearchInput.value = '';
  searchClearBtn.style.display = 'none';
  residentSearchInput.focus();
  render();
});

// Paid / Unpaid Status Tabs Handler Logic
document.getElementById('statusFilterTabs').addEventListener('click', (e) => {
  const clickedTab = e.target.closest('.filter-tab');
  if (!clickedTab) return;

  // Toggle visual active classes across elements
  document.querySelectorAll('#statusFilterTabs .filter-tab').forEach(tab => {
    tab.classList.remove('active');
  });
  clickedTab.classList.add('active');

  // Assign filter status and trigger data refresh loop
  currentStatusFilter = clickedTab.getAttribute('data-status');
  render();
});

periodSelect.addEventListener('change', () => { render(); });
blockFilterSelect.addEventListener('change', () => { render(); });
document.getElementById('addBtn').addEventListener('click', addResident);
document.getElementById('importSubmitBtn').addEventListener('click', processBulkImport);

document.getElementById('blockInput').addEventListener('keydown', (e) => {
  if (e.key === 'Enter') { e.preventDefault(); document.getElementById('houseInput').focus(); }
});
document.getElementById('houseInput').addEventListener('keydown', (e) => {
  if (e.key === 'Enter') { e.preventDefault(); document.getElementById('nameInput').focus(); }
});
document.getElementById('nameInput').addEventListener('keydown', (e) => {
  if (e.key === 'Enter') { e.preventDefault(); addResident(); }
});

function render() {
  const period = getCurrentPeriod();
  const blockFilter = getCurrentBlockFilter();
  const searchQuery = residentSearchInput.value.trim().toLowerCase();
  
  // 1. Filter by Block
  let filtered = residents;
  if (blockFilter !== 'ALL') {
    filtered = residents.filter(r => r.block.toUpperCase() === blockFilter.toUpperCase());
  }
  
  // 2. Filter by search text (Name or House No.)
  if (searchQuery) {
    filtered = filtered.filter(r => {
      const matchName = r.name.toLowerCase().includes(searchQuery);
      const matchHouse = r.house.toLowerCase().includes(searchQuery);
      return matchName || matchHouse;
    });
  }

  // 3. Filter by Paid / Unpaid Status Condition
  if (currentStatusFilter === 'PAID') {
    filtered = filtered.filter(r => isPaid(r, period));
  } else if (currentStatusFilter === 'UNPAID') {
    filtered = filtered.filter(r => !isPaid(r, period));
  }
  
  // 4. Sort structural list entries
  filtered = sortResidents([...filtered]);

  const listEl = document.getElementById('residentsList');
  const emptyEl = document.getElementById('emptyState');

  if (filtered.length === 0) {
    listEl.innerHTML = '';
    emptyEl.style.display = 'block';
  } else {
    emptyEl.style.display = 'none';
    listEl.innerHTML = filtered.map(r => {
      const paid = isPaid(r, period);
      return `
      <div class="resident-row">
        <span class="badge-block">Block ${escapeHtml(r.block)}</span>
        <span class="badge-house">No. ${escapeHtml(r.house)}</span>
        <span class="resident-name">${escapeHtml(r.name)}</span>
        <button class="status-pill ${paid ? 'paid' : 'unpaid'}" onclick="togglePaid('${r.id}')">
          ${paid ? '✓ Paid' : 'Unpaid'}
        </button>
        <div style="position:relative;">
          <button class="menu-btn" onclick="toggleMenu('${r.id}', event)">
            <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
              <circle cx="8" cy="3" r="1.5"/><circle cx="8" cy="8" r="1.5"/><circle cx="8" cy="13" r="1.5"/>
            </svg>
          </button>
          <div class="menu-dropdown" id="menu-${r.id}">
            <button class="menu-item" onclick="deleteResident('${r.id}')">
              <span>🗑️</span> Delete
            </button>
          </div>
        </div>
      </div>
    `;
    }).join('');
  }

  // Summary counts calculate properly based on filtered records
  const total = filtered.length;
  const paidCount = filtered.filter(r => isPaid(r, period)).length;
  const unpaidCount = total - paidCount;
  const collected = paidCount * FEE;
  const outstanding = unpaidCount * FEE;
  const coverage = total > 0 ? Math.round((paidCount / total) * 100) : 0;

  document.getElementById('collectedAmount').textContent = collected.toLocaleString() + ' DZD';
  document.getElementById('outstandingAmount').textContent = outstanding.toLocaleString() + ' DZD';
  document.getElementById('coveragePercent').textContent = coverage + '%';
  document.getElementById('progressFill').style.width = coverage + '%';
  document.getElementById('totalCount').textContent = total;
}

function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}