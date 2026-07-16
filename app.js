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

// Globals: Dues System
const FEE = 3600;
let residents = [];
let openMenuId = null;
let currentStatusFilter = 'ALL'; 

const periodsConfig = [
  { value: 'T1-2026', label: 'Trimestre 1' },
  { value: 'T2-2026', label: 'Trimestre 2' },
  { value: 'T3-2026', label: 'Trimestre 3' },
  { value: 'T4-2026', label: 'Trimestre 4' }
];

// Globals: Parking System
let parkingSpots = [];
let parkingStatusFilter = 'ALL';

// Common Workspace Selectors
const authContainer = document.getElementById('authContainer');
const portalSelector = document.getElementById('portalSelector');
const mainApp = document.getElementById('mainApp');
const parkingApp = document.getElementById('parkingApp');

// Login Input Selectors
const authEmailInput = document.getElementById('authEmail');
const authPasswordInput = document.getElementById('authPassword');
const authSubmitBtn = document.getElementById('authSubmitBtn');
const authError = document.getElementById('authError');

// Hub Routing Listeners
document.getElementById('selectNeighborhoodBtn').addEventListener('click', () => {
  portalSelector.style.display = 'none';
  mainApp.style.display = 'flex';
  listenToLiveDatabaseUpdates(); 
});

document.getElementById('selectParkingBtn').addEventListener('click', () => {
  portalSelector.style.display = 'none';
  parkingApp.style.display = 'flex';
  listenToParkingDatabaseUpdates(); 
});

window.showPortalSelector = function() {
  mainApp.style.display = 'none';
  parkingApp.style.display = 'none';
  portalSelector.style.display = 'flex';
};

// Authentication state monitor callback
onAuthStateChanged(auth, (user) => {
  if (user) {
    authContainer.style.display = 'none';
    portalSelector.style.display = 'flex'; // Forward users straight to choice portal hub
    mainApp.style.display = 'none';
    parkingApp.style.display = 'none';
  } else {
    authContainer.style.display = 'flex';
    portalSelector.style.display = 'none';
    mainApp.style.display = 'none';
    parkingApp.style.display = 'none';
    residents = [];
    parkingSpots = [];
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

// Bind general termination buttons 
document.getElementById('logoutBtn').addEventListener('click', () => { signOut(auth); });
document.getElementById('portalLogoutBtn').addEventListener('click', () => { signOut(auth); });
document.getElementById('parkingLogoutBtn').addEventListener('click', () => { signOut(auth); });

/* ==========================================================================
   SYSTEM A: NEIGHBORHOOD DUES SYSTEM BUSINESS LOGIC
   ========================================================================== */
const periodSelect = document.getElementById('periodSelect');
const blockFilterSelect = document.getElementById('blockFilterSelect');
const searchToggleBtn = document.getElementById('searchToggleBtn');
const searchBarContainer = document.getElementById('searchBarContainer');
const residentSearchInput = document.getElementById('residentSearchInput');
const searchClearBtn = document.getElementById('searchClearBtn');

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
};

window.deleteResident = function(id) {
  const r = residents.find(x => x.id === id);
  if (!r) return;
  if (confirm(`Are you absolutely sure you want to completely remove ${r.name}?`)) {
    remove(ref(db, 'residents/' + id));
  }
};

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
};

window.openManualAddModal = function() {
  document.getElementById('houseInput').value = '';
  document.getElementById('nameInput').value = '';
  document.getElementById('manualAddModal').classList.add('show');
};
window.closeManualAddModal = function() { document.getElementById('manualAddModal').classList.remove('show'); };
window.openPrintModal = function() { document.getElementById('printModal').classList.add('show'); };
window.closePrintModal = function() { document.getElementById('printModal').classList.remove('show'); };
window.openBulkModal = function() { 
  document.getElementById('bulkInputText').value = '';
  document.getElementById('bulkModal').classList.add('show'); 
};
window.closeBulkModal = function() { document.getElementById('bulkModal').classList.remove('show'); };

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
    alert(`Success! Successfully processed and saved ${addedCount} residents.`);
    closeBulkModal();
  } else {
    alert('Error parsing lines. Format: Block, House, Full Name');
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

      let mainHeaderCells = `
        <th class="print-th" rowspan="2" style="width: 7%; ${thinRightBorder}">Bloc</th>
        <th class="print-th" rowspan="2" style="width: 9%; ${thinRightBorder}">N° Appt</th>
        <th class="print-th" rowspan="2" style="text-align: left; width: 24%; ${boldRightBorder}">Nom Complet</th>
      `;

      let subHeaderCells = '';

      targetPeriods.forEach((p, idx) => {
        const cfg = periodsConfig.find(c => c.value === p);
        const periodLabel = cfg ? cfg.label : p;
        const isLastTrimester = (idx === targetPeriods.length - 1);
        const rightGroupBorder = isLastTrimester ? '' : boldRightBorder;

        mainHeaderCells += `
          <th class="print-th" colspan="3" style="font-size: 13px; font-weight: bold; letter-spacing: 0.5px; white-space: nowrap; ${rightGroupBorder}">
            ${periodLabel}
          </th>`;

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

  setTimeout(() => { window.print(); }, 350);
};

document.addEventListener('click', () => {
  if (openMenuId) {
    const menu = document.getElementById('menu-' + openMenuId);
    if (menu) menu.classList.remove('show');
    openMenuId = null;
  }
});

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

residentSearchInput.addEventListener('input', () => {
  const query = residentSearchInput.value.trim();
  searchClearBtn.style.display = query.length > 0 ? 'block' : 'none';
  render();
});

searchClearBtn.addEventListener('click', () => {
  residentSearchInput.value = '';
  searchClearBtn.style.display = 'none';
  residentSearchInput.focus();
  render();
});

document.getElementById('statusFilterTabs').addEventListener('click', (e) => {
  const clickedTab = e.target.closest('.filter-tab');
  if (!clickedTab) return;

  document.querySelectorAll('#statusFilterTabs .filter-tab').forEach(tab => {
    tab.classList.remove('active');
  });
  clickedTab.classList.add('active');

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
  
  let filtered = residents;
  if (blockFilter !== 'ALL') {
    filtered = residents.filter(r => r.block.toUpperCase() === blockFilter.toUpperCase());
  }
  
  if (searchQuery) {
    filtered = filtered.filter(r => {
      const matchName = r.name.toLowerCase().includes(searchQuery);
      const matchHouse = r.house.toLowerCase().includes(searchQuery);
      return matchName || matchHouse;
    });
  }

  if (currentStatusFilter === 'PAID') {
    filtered = filtered.filter(r => isPaid(r, period));
  } else if (currentStatusFilter === 'UNPAID') {
    filtered = filtered.filter(r => !isPaid(r, period));
  }
  
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

/* ==========================================================================
   SYSTEM B: PARKING LOT SYSTEM BUSINESS LOGIC
   ========================================================================== */
const parkingSearchInput = document.getElementById('parkingSearchInput');

function listenToParkingDatabaseUpdates() {
  const parkingRef = ref(db, 'parking');
  onValue(parkingRef, (snapshot) => {
    const data = snapshot.val();
    if (data) {
      parkingSpots = Object.keys(data).map(key => ({
        id: key,
        ...data[key]
      }));
    } else {
      parkingSpots = [];
    }
    renderParking();
  });
}

window.openAddVehicleModal = function() {
  document.getElementById('parkingSlotInput').value = '';
  document.getElementById('parkingPlateInput').value = '';
  document.getElementById('parkingOwnerInput').value = '';
  document.getElementById('parkingPhoneInput').value = '';
  document.getElementById('parkingAddModal').classList.add('show');
};

window.closeAddVehicleModal = function() {
  document.getElementById('parkingAddModal').classList.remove('show');
};

window.saveVehicleSpot = function() {
  const slot = document.getElementById('parkingSlotInput').value.trim();
  const plate = document.getElementById('parkingPlateInput').value.trim().toUpperCase();
  const owner = document.getElementById('parkingOwnerInput').value.trim();
  const phone = document.getElementById('parkingPhoneInput').value.trim();

  if (!slot) {
    alert('Please specify a valid slot designator.');
    return;
  }

  // Create or Update Firebase path
  const newId = 'park_' + slot.replace(/[^a-zA-Z0-9]/g, '-').toLowerCase();
  
  set(ref(db, 'parking/' + newId), {
    slot: slot,
    plate: plate || 'EMPTY',
    owner: owner || 'None',
    phone: phone || 'N/A',
    occupied: !!plate,
    timestamp: Date.now()
  });

  closeAddVehicleModal();
};

window.toggleParkingStatus = function(id) {
  const spot = parkingSpots.find(x => x.id === id);
  if (!spot) return;
  const nextOccupied = !spot.occupied;

  update(ref(db, `parking/${id}`), {
    occupied: nextOccupied,
    plate: nextOccupied ? spot.plate : 'EMPTY',
    owner: nextOccupied ? spot.owner : 'None',
    phone: nextOccupied ? spot.phone : 'N/A'
  });
};

window.deleteParkingSpot = function(id) {
  if (confirm('Permanently remove this parking spot slot coordinate from the dashboard?')) {
    remove(ref(db, 'parking/' + id));
  }
};

parkingSearchInput.addEventListener('input', () => { renderParking(); });

document.getElementById('parkingFilterTabs').addEventListener('click', (e) => {
  const clickedTab = e.target.closest('.filter-tab');
  if (!clickedTab) return;

  document.querySelectorAll('#parkingFilterTabs .filter-tab').forEach(tab => {
    tab.classList.remove('active');
  });
  clickedTab.classList.add('active');

  parkingStatusFilter = clickedTab.getAttribute('data-status');
  renderParking();
});

function renderParking() {
  const searchQuery = parkingSearchInput.value.trim().toLowerCase();
  let filtered = [...parkingSpots];

  // 1. Search Query Filter
  if (searchQuery) {
    filtered = filtered.filter(p => {
      return p.slot.toLowerCase().includes(searchQuery) ||
             p.plate.toLowerCase().includes(searchQuery) ||
             p.owner.toLowerCase().includes(searchQuery);
    });
  }

  // 2. Status Filter Tab condition
  if (parkingStatusFilter === 'OCCUPIED') {
    filtered = filtered.filter(p => p.occupied);
  } else if (parkingStatusFilter === 'VACANT') {
    filtered = filtered.filter(p => !p.occupied);
  }

  // Sort slot designations alphanumerically
  filtered.sort((a, b) => a.slot.localeCompare(b.slot, undefined, { numeric: true, sensitivity: 'base' }));

  const listEl = document.getElementById('parkingSlotsList');
  const emptyEl = document.getElementById('parkingEmptyState');

  if (filtered.length === 0) {
    listEl.innerHTML = '';
    emptyEl.style.display = 'block';
  } else {
    emptyEl.style.display = 'none';
    listEl.innerHTML = filtered.map(p => {
      return `
        <div class="resident-row">
          <span class="badge-house" style="background: var(--primary); color: white;">📍 ${escapeHtml(p.slot)}</span>
          <span class="badge-block" style="${p.occupied ? 'background: #fef2f2; color: var(--danger);' : 'background: #f0fdf4; color: var(--success);'} font-weight:bold;">
            ${p.occupied ? 'Occupied' : 'Vacant'}
          </span>
          <div class="resident-name" style="display:flex; flex-direction:column; gap:4px;">
            <div style="font-weight: 800; font-family: monospace; font-size: 16px;">${escapeHtml(p.plate)}</div>
            <div style="font-size:12px; color:var(--text-muted);">
              👤 ${escapeHtml(p.owner)} — 📞 ${escapeHtml(p.phone)}
            </div>
          </div>
          <button class="status-pill ${p.occupied ? 'unpaid' : 'paid'}" onclick="toggleParkingStatus('${p.id}')">
            ${p.occupied ? '❌ Clear Spot' : '✓ Check-In'}
          </button>
          <div style="position:relative;">
            <button class="menu-btn" onclick="toggleMenu('${p.id}', event)">
              <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
                <circle cx="8" cy="3" r="1.5"/><circle cx="8" cy="8" r="1.5"/><circle cx="8" cy="13" r="1.5"/>
              </svg>
            </button>
            <div class="menu-dropdown" id="menu-${p.id}">
              <button class="menu-item" onclick="deleteParkingSpot('${p.id}')">
                <span>🗑️</span> Remove Spot
              </button>
            </div>
          </div>
        </div>
      `;
    }).join('');
  }

  // UI Calculations
  const totalSlots = parkingSpots.length;
  const occupiedSlots = parkingSpots.filter(p => p.occupied).length;
  const vacantSlots = totalSlots - occupiedSlots;
  const occupancyRate = totalSlots > 0 ? Math.round((occupiedSlots / totalSlots) * 100) : 0;

  document.getElementById('parkingTotal').textContent = totalSlots;
  document.getElementById('parkingOccupied').textContent = occupiedSlots;
  document.getElementById('parkingAvailable').textContent = vacantSlots;
  document.getElementById('parkingOccupancyRate').textContent = occupancyRate + '%';
  document.getElementById('parkingProgressFill').style.width = occupancyRate + '%';
}

function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}