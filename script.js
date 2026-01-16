// --- Constants & State ---
const ALGORITHMS = {
    FIRST_FIT: 'First Fit',
    BEST_FIT: 'Best Fit',
    WORST_FIT: 'Worst Fit',
    NEXT_FIT: 'Next Fit',
};

const INITIAL_PARTITIONS = [
    { id: 1, size: 100, process: null },
    { id: 2, size: 500, process: null },
    { id: 3, size: 200, process: null },
    { id: 4, size: 300, process: null },
    { id: 5, size: 600, process: null },
];

const INITIAL_PROCESSES = [
    { id: 1, size: 212, allocated: false, partitionId: null },
    { id: 2, size: 417, allocated: false, partitionId: null },
    { id: 3, size: 112, allocated: false, partitionId: null },
    { id: 4, size: 426, allocated: false, partitionId: null },
];

let state = {
    partitions: JSON.parse(JSON.stringify(INITIAL_PARTITIONS)),
    processes: JSON.parse(JSON.stringify(INITIAL_PROCESSES)),
    selectedAlgorithm: ALGORITHMS.FIRST_FIT,
    isSimulating: false,
    currentProcessIndex: 0,
    lastAllocatedIndex: 0, // For Next Fit
    logs: []
};

// --- DOM Elements ---
const els = {
    algoButtons: document.getElementById('algo-buttons'),
    processesList: document.getElementById('processes-list'),
    partitionsList: document.getElementById('partitions-list'),
    memoryBar: document.getElementById('memory-bar-container'),
    logsContainer: document.getElementById('logs-container'),
    processCount: document.getElementById('process-count'),
    totalMemoryText: document.getElementById('total-memory-text'),
    btnStart: document.getElementById('btn-start'),
    btnStartText: document.getElementById('btn-start-text'),
    btnReset: document.getElementById('btn-reset'),
    btnAddProc: document.getElementById('btn-add-proc'),
    inputProcSize: document.getElementById('input-proc-size'),
    btnAddPart: document.getElementById('btn-add-part'),
    inputPartSize: document.getElementById('input-part-size'),
};

// --- Helper Functions ---

function addLog(message, type = 'info') {
    const logEntry = { message, type, id: Date.now() };
    state.logs.push(logEntry);
    renderLogs();
}

function getFragmentationColor(partitionSize, processSize) {
    const ratio = processSize / partitionSize;
    if (ratio > 0.9) return 'bg-cyan-500';
    if (ratio > 0.5) return 'bg-blue-500';
    return 'bg-yellow-500';
}

// --- Rendering ---

function renderAll() {
    renderAlgoButtons();
    renderProcesses();
    renderPartitionsList();
    renderMemoryBar();
    renderControls();
    lucide.createIcons();
}

function renderControls() {
    els.btnStart.disabled = state.isSimulating;
    els.btnReset.disabled = state.isSimulating;
    els.btnAddProc.disabled = state.isSimulating;
    els.btnAddPart.disabled = state.isSimulating;
    els.btnStartText.textContent = state.isSimulating ? 'Simulating...' : 'Start';

    if (state.isSimulating) {
        els.btnStart.classList.add('opacity-75');
    } else {
        els.btnStart.classList.remove('opacity-75');
    }
}

function renderAlgoButtons() {
    els.algoButtons.innerHTML = '';
    Object.values(ALGORITHMS).forEach(algo => {
        const btn = document.createElement('button');
        const isActive = state.selectedAlgorithm === algo;
        btn.className = `px-4 py-2 rounded-md text-sm font-medium transition-all duration-200 ${isActive
            ? 'bg-cyan-600 text-white shadow-lg'
            : 'text-slate-400 hover:text-white hover:bg-slate-700'
            }`;
        btn.textContent = algo;
        btn.onclick = () => {
            if (!state.isSimulating) {
                state.selectedAlgorithm = algo;
                renderAlgoButtons();
            }
        };
        els.algoButtons.appendChild(btn);
    });
}

function renderProcesses() {
    els.processesList.innerHTML = '';
    els.processCount.textContent = `${state.processes.length} items`;

    if (state.processes.length === 0) {
        els.processesList.innerHTML = '<div class="text-center py-4 text-slate-500 italic text-sm">No processes in queue</div>';
        return;
    }

    state.processes.forEach((p, idx) => {
        const div = document.createElement('div');
        const isCurrent = idx === state.currentProcessIndex && state.isSimulating;

        let bgClass = 'bg-slate-900 border-slate-700';
        if (p.allocated) bgClass = 'bg-cyan-900/20 border-cyan-800';
        else if (isCurrent) bgClass = 'bg-yellow-900/20 border-yellow-700 ring-1 ring-yellow-500';

        div.className = `flex items-center justify-between p-3 rounded-lg border transition-all fade-in ${bgClass}`;

        div.innerHTML = `
            <div class="flex items-center gap-3">
                <div class="w-2 h-2 rounded-full ${p.allocated ? 'bg-cyan-500' : 'bg-slate-500'}"></div>
                <span class="font-mono text-sm">P${p.id}</span>
            </div>
            <div class="flex items-center gap-4">
                <span class="font-bold text-sm">${p.size} KB</span>
                ${!state.isSimulating && !p.allocated ? `
                    <button onclick="removeProcess(${p.id})" class="text-white hover:text-red-400">
                        <i data-lucide="trash-2" class="w-4 h-4"></i>
                    </button>
                ` : ''}
            </div>
        `;
        els.processesList.appendChild(div);
    });
}

function renderPartitionsList() {
    els.partitionsList.innerHTML = '';
    state.partitions.forEach(p => {
        const div = document.createElement('div');
        div.className = 'group relative bg-slate-900 border border-slate-700 px-3 py-2 rounded-md flex items-center gap-2 fade-in';
        div.innerHTML = `
            <span class="text-xs font-mono text-slate-400">Block ${p.id}</span>
            <span class="font-bold text-sm text-cyan-300">${p.size} KB</span>
            ${!state.isSimulating && !p.process ? `
                <button onclick="removePartition(${p.id})" class="opacity-0 group-hover:opacity-100 absolute -top-2 -right-2 bg-red-500 rounded-full p-1 transition-opacity">
                    <i data-lucide="trash-2" class="w-3 h-3 text-white"></i>
                </button>
            ` : ''}
        `;
        els.partitionsList.appendChild(div);
    });
}

function renderMemoryBar() {
    els.memoryBar.innerHTML = '';
    const totalMemory = state.partitions.reduce((acc, p) => acc + p.size, 0);
    els.totalMemoryText.textContent = `Total Memory: ${totalMemory} KB`;

    if (state.partitions.length === 0) {
        els.memoryBar.innerHTML = '<div class="w-full h-full flex items-center justify-center text-slate-500 italic">No partitions initialized</div>';
        return;
    }

    state.partitions.forEach(part => {
        const process = part.process;
        const widthPercent = totalMemory > 0 ? (part.size / totalMemory) * 100 : 0;
        const fillPercent = process ? (process.size / part.size) * 100 : 0;
        const fillColor = getFragmentationColor(part.size, process ? process.size : 0);

        const div = document.createElement('div');
        div.style.width = `${widthPercent}%`;
        div.className = `relative h-full border-r border-slate-600 last:border-r-0 flex flex-col transition-all duration-300 group ${!process ? 'hover:bg-slate-750' : ''}`;

        div.innerHTML = `
            <div class="absolute inset-0 opacity-10 pointer-events-none" style="background-image: radial-gradient(circle, #fff 1px, transparent 1px); background-size: 8px 8px"></div>
            
            <div class="absolute inset-0 flex flex-col">
                <div class="w-full text-center py-2 z-20">
                    <span class="text-xs font-mono text-slate-400 font-bold bg-slate-900/50 px-1 rounded backdrop-blur-sm">${part.size}KB</span>
                </div>
                
                <div class="flex-1 relative w-full">
                    <div class="h-full absolute left-0 top-0 fill-transition border-r border-white/10 ${process ? fillColor : 'w-0'}" style="width: ${fillPercent}%">
                        ${process ? `
                            <div class="absolute inset-0 flex items-center justify-center overflow-hidden">
                                <span class="text-white font-bold text-xs md:text-sm drop-shadow-md whitespace-nowrap px-1 transform -rotate-90 md:rotate-0">P${process.id}</span>
                            </div>
                        ` : ''}
                    </div>
                </div>

                <div class="w-full text-center py-2 z-20 h-8 flex items-end justify-center">
                    ${process ? `
                        <span class="text-[10px] text-cyan-200 bg-slate-900/50 px-1 rounded backdrop-blur-sm whitespace-nowrap">${part.size - process.size}KB Free</span>
                    ` : `<span class="text-[10px] text-slate-500">Free</span>`}
                </div>
            </div>
        `;
        els.memoryBar.appendChild(div);
    });
}

function renderLogs() {
    els.logsContainer.innerHTML = '';
    if (state.logs.length === 0) {
        els.logsContainer.innerHTML = '<div class="text-slate-700">Waiting for simulation to start...</div>';
        return;
    }

    state.logs.forEach(log => {
        const div = document.createElement('div');
        div.className = `fade-in ${log.type === 'error' ? 'text-red-400' :
            log.type === 'success' ? 'text-cyan-400' : 'text-slate-300'
            }`;
        const time = new Date(log.id).toLocaleTimeString();
        div.innerHTML = `<span class="opacity-50 mr-2">[${time}]</span>${log.message}`;
        els.logsContainer.appendChild(div);
    });
    els.logsContainer.scrollTop = els.logsContainer.scrollHeight;
}

// --- Logic & Events ---

function findPartition(processSize) {
    let candidateIndex = -1;

    if (state.selectedAlgorithm === ALGORITHMS.FIRST_FIT) {
        candidateIndex = state.partitions.findIndex(p => p.process === null && p.size >= processSize);
    }
    else if (state.selectedAlgorithm === ALGORITHMS.BEST_FIT) {
        let bestDiff = Infinity;
        state.partitions.forEach((p, index) => {
            if (p.process === null && p.size >= processSize) {
                const diff = p.size - processSize;
                if (diff < bestDiff) {
                    bestDiff = diff;
                    candidateIndex = index;
                }
            }
        });
    }
    else if (state.selectedAlgorithm === ALGORITHMS.WORST_FIT) {
        let worstDiff = -1;
        state.partitions.forEach((p, index) => {
            if (p.process === null && p.size >= processSize) {
                const diff = p.size - processSize;
                if (diff > worstDiff) {
                    worstDiff = diff;
                    candidateIndex = index;
                }
            }
        });
    }
    else if (state.selectedAlgorithm === ALGORITHMS.NEXT_FIT) {
        let found = false;
        let count = 0;
        let ptr = state.lastAllocatedIndex;
        const len = state.partitions.length;

        while (count < len) {
            const index = ptr % len;
            const p = state.partitions[index];
            if (p.process === null && p.size >= processSize) {
                candidateIndex = index;
                found = true;
                break;
            }
            ptr++;
            count++;
        }
    }

    return candidateIndex;
}

function simulationStep() {
    if (!state.isSimulating) return;

    if (state.currentProcessIndex >= state.processes.length) {
        state.isSimulating = false;
        addLog('Simulation Complete.', 'success');
        renderAll();
        return;
    }

    const process = state.processes[state.currentProcessIndex];

    // If already allocated (e.g., from prev run logic if we didn't full clear), skip
    if (process.allocated) {
        state.currentProcessIndex++;
        setTimeout(simulationStep, 500);
        return;
    }

    addLog(`Attempting to allocate Process P${process.id} (${process.size}KB)...`);
    renderProcesses(); // Update highlight

    const partitionIndex = findPartition(process.size);

    if (partitionIndex !== -1) {
        // Update partition
        state.partitions[partitionIndex].process = { ...process };
        // Update process
        state.processes[state.currentProcessIndex].allocated = true;
        state.processes[state.currentProcessIndex].partitionId = state.partitions[partitionIndex].id;

        if (state.selectedAlgorithm === ALGORITHMS.NEXT_FIT) {
            state.lastAllocatedIndex = partitionIndex;
        }

        addLog(`Success: P${process.id} allocated to Block ${state.partitions[partitionIndex].id} (${state.partitions[partitionIndex].size}KB).`, 'success');
    } else {
        addLog(`Failed: No suitable partition found for P${process.id}.`, 'error');
    }

    state.currentProcessIndex++;
    renderAll();

    setTimeout(simulationStep, 1000);
}

// --- Event Listeners ---

els.btnStart.addEventListener('click', () => {
    if (state.processes.every(p => p.allocated)) {
        addLog("All processes already allocated. Reset to run again.", "error");
        return;
    }
    state.isSimulating = true;
    addLog(`Starting ${state.selectedAlgorithm} Simulation...`);
    renderAll();
    simulationStep();
});

els.btnReset.addEventListener('click', () => {
    state.isSimulating = false;
    state.currentProcessIndex = 0;
    state.lastAllocatedIndex = 0;
    state.logs = [];

    state.partitions = state.partitions.map(p => ({ ...p, process: null }));
    state.processes = state.processes.map(p => ({ ...p, allocated: false, partitionId: null }));

    addLog('System Reset.');
    renderAll();
});

els.btnAddProc.addEventListener('click', () => {
    const size = parseInt(els.inputProcSize.value);
    if (!isNaN(size) && size > 0) {
        const newId = state.processes.length > 0 ? Math.max(...state.processes.map(p => p.id)) + 1 : 1;
        state.processes.push({ id: newId, size, allocated: false, partitionId: null });
        els.inputProcSize.value = '';
        renderProcesses();
        lucide.createIcons();
    }
});

els.btnAddPart.addEventListener('click', () => {
    const size = parseInt(els.inputPartSize.value);
    if (!isNaN(size) && size > 0) {
        state.partitions.push({ id: Date.now(), size, process: null });
        els.inputPartSize.value = '';
        renderAll();
    }
});

// Global functions for inline onclicks
window.removeProcess = (id) => {
    if (state.isSimulating) return;
    state.processes = state.processes.filter(p => p.id !== id);
    renderProcesses();
    lucide.createIcons();
};

window.removePartition = (id) => {
    if (state.isSimulating) return;
    state.partitions = state.partitions.filter(p => p.id !== id);
    renderAll();
};

// --- Init ---
// Initialize icons and render initial state
renderAll();
addLog('System Ready. Add processes/partitions or click Start.');
