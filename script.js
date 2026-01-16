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
    els.processCount.textContent = `${state.processes.length} items`;

    if (state.processes.length === 0) {
        els.processesList.innerHTML = '<div class="text-center py-4 text-slate-500 italic text-sm">No processes in queue</div>';
        return;
    }

    // Remove empty message if it exists
    if (els.processesList.querySelector('.text-center')) {
        els.processesList.innerHTML = '';
    }

    // Sync DOM with State
    const existingIds = new Set();

    state.processes.forEach((p, idx) => {
        const domId = `proc-${p.id}`; // Use stable ID based on process ID (which changes on reorder, effectively position based for now?)
        // Actually, if we renumber IDs on drag, p.id changes.
        // But for simulation highlighting, we just want the row at index X to highlight.
        // Let's rely on dataset-index for order, but use a unique key if possible?
        // User wants renumbering, so ID basically EQUALS Index + 1.
        // So `proc-${p.id}` is effectively `proc-${index+1}`.

        existingIds.add(domId);

        let div = document.getElementById(domId);
        const isCurrent = idx === state.currentProcessIndex && state.isSimulating;

        let bgClass = 'bg-slate-900 border-slate-700';
        if (p.allocated) bgClass = 'bg-cyan-900/20 border-cyan-800';
        else if (isCurrent) bgClass = 'bg-yellow-900/20 border-yellow-700 ring-1 ring-yellow-500';

        const finalClass = `draggable flex items-center justify-between p-3 rounded-lg border transition-all duration-300 fade-in ${bgClass}`;

        if (!div) {
            // Create new
            div = document.createElement('div');
            div.id = domId;
            div.draggable = true;
            // Add static listeners once
            div.addEventListener('dragstart', handleDragStart);
            div.addEventListener('dragend', handleDragEnd);
            div.addEventListener('dragover', handleDragOver);
            div.addEventListener('drop', handleDrop);
            els.processesList.appendChild(div);
        }

        // Update Attributes & Content (Only if changed to avoid thrashing, though className is cheap)
        if (div.className !== finalClass) div.className = finalClass;
        div.dataset.index = idx;
        div.dataset.type = 'process';

        // Update Inner HTML
        // We can optimize this by only updating text nodes if we really wanted to, but innerHTML is okay for small content if the container is stable.
        // To prevent inner element flickering (like icon re-renders), let's compare.
        const newHTML = `
            <div class="flex items-center gap-3 pointer-events-none">
                <div class="w-2 h-2 rounded-full ${p.allocated ? 'bg-cyan-500' : 'bg-slate-500'} transition-colors duration-300"></div>
                <span class="font-mono text-sm">P${p.id}</span>
            </div>
            <div class="flex items-center gap-4 pointer-events-none">
                <span class="font-bold text-sm">${p.size} KB</span>
                ${!state.isSimulating && !p.allocated ? `
                    <button onclick="removeProcess(${p.id})" class="text-white hover:text-red-400 pointer-events-auto">
                        <i data-lucide="trash-2" class="w-4 h-4"></i>
                    </button>
                ` : ''}
            </div>
        `;

        if (div.innerHTML !== newHTML) {
            div.innerHTML = newHTML;
            lucide.createIcons(); // usage of icons inside re-render
        }
    });

    // Cleanup removed nodes
    Array.from(els.processesList.children).forEach(child => {
        if (child.id && !existingIds.has(child.id)) {
            child.remove();
        }
    });
}

function renderPartitionsList() {
    // Sync DOM with State for Partitions
    const existingIds = new Set();

    state.partitions.forEach((p, index) => {
        const domId = `part-${p.id}`; // Use ID-based key
        existingIds.add(domId);

        let div = document.getElementById(domId);
        const finalClass = 'draggable group relative bg-slate-900 border border-slate-700 px-3 py-2 rounded-md flex items-center gap-2 fade-in';

        if (!div) {
            div = document.createElement('div');
            div.id = domId;
            div.className = finalClass;
            div.draggable = true;
            div.addEventListener('dragstart', handleDragStart);
            div.addEventListener('dragend', handleDragEnd);
            div.addEventListener('dragover', handleDragOver);
            div.addEventListener('drop', handleDrop);
            els.partitionsList.appendChild(div);
        }

        if (div.className !== finalClass) div.className = finalClass;
        div.dataset.index = index;
        div.dataset.type = 'partition';

        const newHTML = `
            <span class="text-xs font-mono text-slate-400 pointer-events-none">Block ${p.id}</span>
            <span class="font-bold text-sm text-cyan-300 pointer-events-none">${p.size} KB</span>
            ${!state.isSimulating && !p.process ? `
                <button onclick="removePartition(${p.id})" class="opacity-0 group-hover:opacity-100 absolute -top-2 -right-2 bg-red-500 rounded-full p-1 transition-opacity pointer-events-auto">
                    <i data-lucide="trash-2" class="w-3 h-3 text-white"></i>
                </button>
            ` : ''}
        `;

        if (div.innerHTML !== newHTML) {
            div.innerHTML = newHTML;
            lucide.createIcons();
        }
    });

    // Cleanup
    Array.from(els.partitionsList.children).forEach(child => {
        if (child.id && !existingIds.has(child.id)) {
            child.remove();
        }
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

// --- Drag & Drop Logic ---

let draggedItem = null;

function handleDragStart(e) {
    if (state.isSimulating) {
        e.preventDefault();
        return;
    }
    draggedItem = this;
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', this.dataset.index);
    e.dataTransfer.setData('type', this.dataset.type);

    // Slight delay to allow the ghost image to be created before hiding the element
    setTimeout(() => {
        this.classList.add('dragging');
    }, 0);
}

function handleDragEnd(e) {
    this.classList.remove('dragging');
    draggedItem = null;

    // Remove drag-over styles from all items
    document.querySelectorAll('.drag-over').forEach(el => el.classList.remove('drag-over'));
}

function handleDragOver(e) {
    if (e.preventDefault) {
        e.preventDefault(); // Necessary. Allows us to drop.
    }
    e.dataTransfer.dropEffect = 'move';
    return false;
}

function handleDrop(e) {
    e.stopPropagation(); // stops the browser from redirecting.

    const type = e.dataTransfer.getData('type');
    const fromIndex = parseInt(e.dataTransfer.getData('text/plain'));
    const toIndex = parseInt(this.dataset.index);
    const targetType = this.dataset.type;

    // Ensure we are dropping on the same type of list
    if (type !== targetType || isNaN(fromIndex) || isNaN(toIndex)) {
        return false;
    }

    if (fromIndex !== toIndex) {
        // Reorder array
        if (type === 'process') {
            const item = state.processes.splice(fromIndex, 1)[0];
            state.processes.splice(toIndex, 0, item);

            // Renumber Processes
            state.processes.forEach((p, i) => {
                p.id = i + 1;
            });

            renderProcesses();
        } else if (type === 'partition') {
            const item = state.partitions.splice(fromIndex, 1)[0];
            state.partitions.splice(toIndex, 0, item);

            // Renumber Partitions and update process references
            const idMap = new Map();
            state.partitions.forEach((p, i) => {
                const oldId = p.id;
                const newId = i + 1;
                idMap.set(oldId, newId);
                p.id = newId;
            });

            // Update attached processes (if any have valid partition refs)
            state.processes.forEach(p => {
                if (p.partitionId !== null && idMap.has(p.partitionId)) {
                    p.partitionId = idMap.get(p.partitionId);
                }
            });

            renderAll(); // Rerender all because partitions affect memory bar
        }
        lucide.createIcons(); // Refresh icons
    }

    return false;
}

// --- Event Listeners ---

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
