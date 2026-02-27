import init, { generate, analyse_chords, substitute_chords } from './chordnovars/pkg/chordnovars.js';
import { getDefaultProgressionConfig, getDefaultSubstitutionConfig, midiToNoteName, noteNameToMidi, SCALE_PRESETS } from './defaults.js';
import { initAudio, playChord, playProgression, stopAll } from './audio.js';

let wasmReady = false;
let currentChord = [60, 64, 67]; // C4 E4 G4

// ── Initialization ───────────────────────────────────────────────────────────

async function start() {
    try {
        await init();
        wasmReady = true;
        document.getElementById('status').textContent = 'WASM loaded';
        document.getElementById('status').className = 'status ready';
    } catch (e) {
        document.getElementById('status').textContent = 'WASM failed: ' + e.message;
        document.getElementById('status').className = 'status error';
        console.error('WASM init failed:', e);
        return;
    }

    try {
        await initAudio();
        document.getElementById('audio-status').textContent = 'Audio ready';
        document.getElementById('audio-status').className = 'status ready';
    } catch (e) {
        document.getElementById('audio-status').textContent = 'Audio failed (click page first)';
        document.getElementById('audio-status').className = 'status error';
        console.warn('Audio init failed:', e);
    }

    setupTabs();
    setupGenerateTab();
    setupAnalyseTab();
    setupSubstituteTab();
    setupPianoKeyboards();
    updateChordDisplay('gen-chord-input', currentChord);
}

// ── Tabs ─────────────────────────────────────────────────────────────────────

function setupTabs() {
    document.querySelectorAll('.tab-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
            document.querySelectorAll('.tab-panel').forEach(p => p.classList.remove('active'));
            btn.classList.add('active');
            document.getElementById(btn.dataset.tab).classList.add('active');
        });
    });
}

// ── Piano Keyboard Widget ────────────────────────────────────────────────────

function setupPianoKeyboards() {
    document.querySelectorAll('.piano-keyboard').forEach(container => {
        buildPianoKeyboard(container);
    });
}

function buildPianoKeyboard(container) {
    const inputId = container.dataset.input;
    const startNote = 48; // C3
    const endNote = 84;   // C6

    container.innerHTML = '';
    const wrapper = document.createElement('div');
    wrapper.className = 'piano-keys';

    for (let midi = startNote; midi <= endNote; midi++) {
        const pc = midi % 12;
        const isBlack = [1, 3, 6, 8, 10].includes(pc);
        const key = document.createElement('div');
        key.className = isBlack ? 'piano-key black' : 'piano-key white';
        key.dataset.midi = midi;
        key.title = midiToNoteName(midi);

        key.addEventListener('click', () => {
            key.classList.toggle('selected');
            syncPianoToInput(container, inputId);
        });

        wrapper.appendChild(key);
    }

    container.appendChild(wrapper);
}

function syncPianoToInput(container, inputId) {
    const selected = [...container.querySelectorAll('.piano-key.selected')]
        .map(k => parseInt(k.dataset.midi))
        .sort((a, b) => a - b);
    const input = document.getElementById(inputId);
    if (input) input.value = selected.join(',');
    updateNoteNameDisplay(inputId);
}

function syncInputToPiano(inputId) {
    const input = document.getElementById(inputId);
    const container = input.closest('.chord-input-group').querySelector('.piano-keyboard');
    if (!container) return;

    const notes = parseChordInput(input.value);
    container.querySelectorAll('.piano-key').forEach(key => {
        key.classList.toggle('selected', notes.includes(parseInt(key.dataset.midi)));
    });
    updateNoteNameDisplay(inputId);
}

function updateNoteNameDisplay(inputId) {
    const input = document.getElementById(inputId);
    const display = document.getElementById(inputId + '-names');
    if (!display) return;
    const notes = parseChordInput(input.value);
    display.textContent = notes.map(midiToNoteName).join(' ');
}

function updateChordDisplay(inputId, notes) {
    const input = document.getElementById(inputId);
    if (input) input.value = notes.join(',');
    syncInputToPiano(inputId);
}

function parseChordInput(value) {
    return value.split(',')
        .map(s => s.trim())
        .filter(s => s.length > 0)
        .map(s => {
            const n = parseInt(s);
            if (!isNaN(n)) return n;
            const midi = noteNameToMidi(s);
            return midi !== null ? midi : NaN;
        })
        .filter(n => !isNaN(n) && n >= 0 && n <= 127);
}

// ── Generate Tab ─────────────────────────────────────────────────────────────

function setupGenerateTab() {
    // Scale preset buttons
    document.querySelectorAll('.scale-preset').forEach(btn => {
        btn.addEventListener('click', () => {
            const preset = SCALE_PRESETS[btn.dataset.preset];
            if (preset) {
                document.querySelectorAll('.scale-checkbox').forEach(cb => {
                    cb.checked = preset.includes(parseInt(cb.value));
                });
            }
        });
    });

    // Chord input sync
    const chordInput = document.getElementById('gen-chord-input');
    chordInput.addEventListener('input', () => {
        syncInputToPiano('gen-chord-input');
    });

    // Play chord button
    document.getElementById('play-initial-chord').addEventListener('click', async () => {
        await ensureAudio();
        const notes = parseChordInput(chordInput.value);
        if (notes.length > 0) playChord(notes);
    });

    // Generate button
    document.getElementById('generate-btn').addEventListener('click', runGenerate);

    // Stop button
    document.getElementById('stop-audio').addEventListener('click', stopAll);

    // Collapsible sections
    document.querySelectorAll('.collapsible-header').forEach(header => {
        header.addEventListener('click', () => {
            header.classList.toggle('open');
            header.nextElementSibling.classList.toggle('open');
        });
    });

    // Initial sync
    syncInputToPiano('gen-chord-input');
}

function buildConfig() {
    const cfg = getDefaultProgressionConfig();

    // Range
    cfg.range.lowest = intVal('range-lowest', 0);
    cfg.range.highest = intVal('range-highest', 127);
    cfg.range.m_min = intVal('range-m-min', 1);
    cfg.range.m_max = intVal('range-m-max', 15);
    cfg.range.n_min = intVal('range-n-min', 1);
    cfg.range.n_max = intVal('range-n-max', 12);

    // Voice leading
    cfg.voice_leading.vl_max = intVal('vl-max', 4);

    // Scale
    const scale = [];
    document.querySelectorAll('.scale-checkbox:checked').forEach(cb => {
        scale.push(parseInt(cb.value));
    });
    cfg.scale.overall_scale = scale.length > 0 ? scale : [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11];

    // Harmonic constraints
    cfg.harmonic.t_min = floatVal('harm-t-min', 0);
    cfg.harmonic.t_max = floatVal('harm-t-max', 100);
    cfg.harmonic.k_min = floatVal('harm-k-min', 0);
    cfg.harmonic.k_max = floatVal('harm-k-max', 100);
    cfg.harmonic.c_min = intVal('harm-c-min', 0);
    cfg.harmonic.c_max = intVal('harm-c-max', 15);
    cfg.harmonic.sv_min = intVal('harm-sv-min', 0);
    cfg.harmonic.sv_max = intVal('harm-sv-max', 100);

    // Alignment
    const alignMode = document.getElementById('align-mode')?.value || 'Unlimited';
    cfg.alignment.align_mode = alignMode;
    cfg.alignment.i_min = intVal('align-i-min', 0);
    cfg.alignment.i_max = intVal('align-i-max', 24);

    // Exclusion
    const exEnabled = document.getElementById('exclusion-enabled')?.checked || false;
    cfg.exclusion.enabled = exEnabled;
    if (exEnabled) {
        const exNotes = document.getElementById('exclusion-notes')?.value || '';
        cfg.exclusion.exclusion_notes = exNotes.split(',').map(s => parseInt(s.trim())).filter(n => !isNaN(n));
    }

    // Pedal
    const pedalEnabled = document.getElementById('pedal-enabled')?.checked || false;
    cfg.pedal.enabled = pedalEnabled;
    if (pedalEnabled) {
        const pedalNotes = document.getElementById('pedal-notes')?.value || '';
        cfg.pedal.pedal_notes = pedalNotes.split(',').map(s => parseInt(s.trim())).filter(n => !isNaN(n));
        cfg.pedal.pedal_notes_set = [...new Set(cfg.pedal.pedal_notes.map(n => n % 12))];
        cfg.pedal.in_bass = document.getElementById('pedal-in-bass')?.checked || false;
    }

    // Uniqueness
    cfg.uniqueness.unique_mode = document.getElementById('unique-mode')?.value || 'Disabled';

    // Sort
    cfg.sort.sort_order = document.getElementById('sort-order')?.value || '';

    // Continual
    cfg.continual = document.getElementById('continual-mode')?.checked || false;
    cfg.loop_count = intVal('loop-count', 1);

    return cfg;
}

function runGenerate() {
    if (!wasmReady) { showError('gen-results', 'WASM not loaded'); return; }

    const chordInput = document.getElementById('gen-chord-input');
    const notes = parseChordInput(chordInput.value);
    if (notes.length === 0) { showError('gen-results', 'Enter at least one MIDI note'); return; }

    currentChord = notes;
    const config = buildConfig();

    const resultArea = document.getElementById('gen-results');
    resultArea.innerHTML = '<div class="loading">Generating...</div>';

    // Run in a timeout to let UI update
    setTimeout(() => {
        try {
            const chordJson = JSON.stringify(notes);
            const configJson = JSON.stringify(config);
            const resultStr = generate(chordJson, configJson);
            const result = JSON.parse(resultStr);

            if (result.error) {
                showError('gen-results', result.error);
                return;
            }

            renderGenerateResults(result, notes);
        } catch (e) {
            showError('gen-results', 'Error: ' + e.message);
            console.error(e);
        }
    }, 10);
}

function renderGenerateResults(result, initialChord) {
    const area = document.getElementById('gen-results');
    const candidates = result.candidates || [];

    let html = `<div class="result-summary">${candidates.length} candidates found (${result.total_evaluated} evaluated)</div>`;

    if (candidates.length === 0) {
        html += '<div class="no-results">No candidates match the constraints. Try relaxing parameters.</div>';
        area.innerHTML = html;
        return;
    }

    html += `<div class="result-actions">
        <button id="play-all-btn" class="btn btn-small">Play All Sequentially</button>
        <button id="stop-btn" class="btn btn-small btn-danger" onclick="window._stopAll()">Stop</button>
    </div>`;

    html += `<table class="result-table">
        <thead><tr>
            <th>#</th><th>Chord</th><th>Notes</th><th>Root</th>
            <th>t</th><th>k</th><th>c</th><th>sv</th><th>x</th><th>Q</th>
            <th>Actions</th>
        </tr></thead><tbody>`;

    candidates.forEach((c, i) => {
        const s = c.stats;
        html += `<tr class="candidate-row" data-index="${i}">
            <td>${i + 1}</td>
            <td class="chord-notes">${s.name_with_octave || s.notes?.join(', ')}</td>
            <td class="midi-notes">[${s.notes?.join(', ')}]</td>
            <td>${s.root_name || '-'}</td>
            <td>${fmtNum(s.tension)}</td>
            <td>${fmtNum(s.chroma)}</td>
            <td>${s.common_note ?? '-'}</td>
            <td>${s.sv ?? '-'}</td>
            <td>${s.similarity ?? '-'}</td>
            <td>${fmtNum(s.q_indicator)}</td>
            <td>
                <button class="btn btn-tiny play-candidate" data-notes="${JSON.stringify(s.notes)}">Play</button>
                <button class="btn btn-tiny play-progression-btn" data-notes="${JSON.stringify(s.notes)}" data-initial="${JSON.stringify(initialChord)}">Prog</button>
                <button class="btn btn-tiny use-as-initial" data-notes="${JSON.stringify(s.notes)}">Use</button>
            </td>
        </tr>`;
    });

    html += '</tbody></table>';
    area.innerHTML = html;

    // Wire up buttons
    area.querySelectorAll('.play-candidate').forEach(btn => {
        btn.addEventListener('click', async (e) => {
            e.stopPropagation();
            await ensureAudio();
            playChord(JSON.parse(btn.dataset.notes));
        });
    });

    area.querySelectorAll('.play-progression-btn').forEach(btn => {
        btn.addEventListener('click', async (e) => {
            e.stopPropagation();
            await ensureAudio();
            const initial = JSON.parse(btn.dataset.initial);
            const target = JSON.parse(btn.dataset.notes);
            playProgression([initial, target], 800, 200);
        });
    });

    area.querySelectorAll('.use-as-initial').forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.stopPropagation();
            const notes = JSON.parse(btn.dataset.notes);
            currentChord = notes;
            updateChordDisplay('gen-chord-input', notes);
        });
    });

    document.getElementById('play-all-btn')?.addEventListener('click', async () => {
        await ensureAudio();
        const allChords = [initialChord, ...candidates.slice(0, 20).map(c => c.stats.notes)];
        playProgression(allChords, 600, 150);
    });
}

// ── Analyse Tab ──────────────────────────────────────────────────────────────

function setupAnalyseTab() {
    document.getElementById('analyse-ante-input').addEventListener('input', () => {
        syncInputToPiano('analyse-ante-input');
    });
    document.getElementById('analyse-post-input').addEventListener('input', () => {
        syncInputToPiano('analyse-post-input');
    });

    document.getElementById('play-ante-chord').addEventListener('click', async () => {
        await ensureAudio();
        const notes = parseChordInput(document.getElementById('analyse-ante-input').value);
        if (notes.length > 0) playChord(notes);
    });
    document.getElementById('play-post-chord').addEventListener('click', async () => {
        await ensureAudio();
        const notes = parseChordInput(document.getElementById('analyse-post-input').value);
        if (notes.length > 0) playChord(notes);
    });

    document.getElementById('analyse-btn').addEventListener('click', runAnalyse);
}

function runAnalyse() {
    if (!wasmReady) { showError('analyse-results', 'WASM not loaded'); return; }

    const ante = parseChordInput(document.getElementById('analyse-ante-input').value);
    const post = parseChordInput(document.getElementById('analyse-post-input').value);

    if (ante.length === 0 || post.length === 0) {
        showError('analyse-results', 'Enter both chords');
        return;
    }

    try {
        const resultStr = analyse_chords(JSON.stringify(ante), JSON.stringify(post));
        const result = JSON.parse(resultStr);

        if (result.error) {
            showError('analyse-results', result.error);
            return;
        }

        renderAnalyseResults(result);
    } catch (e) {
        showError('analyse-results', 'Error: ' + e.message);
        console.error(e);
    }
}

function renderAnalyseResults(result) {
    const area = document.getElementById('analyse-results');
    const { ante_stats, post_stats, vl_result, bigram_stats } = result;

    let html = '<div class="analysis-grid">';

    // Antecedent stats
    html += '<div class="analysis-card"><h3>Antecedent Chord</h3>';
    html += renderChordStats(ante_stats);
    html += '</div>';

    // Consequent stats
    html += '<div class="analysis-card"><h3>Consequent Chord</h3>';
    html += renderChordStats(post_stats);
    html += '</div>';

    // Voice leading
    html += '<div class="analysis-card"><h3>Voice Leading</h3>';
    html += `<div class="stat-row"><span>Vector:</span><span>[${vl_result.vec.join(', ')}]</span></div>`;
    html += `<div class="stat-row"><span>Total distance (sv):</span><span>${vl_result.sv}</span></div>`;
    html += '</div>';

    // Bigram stats
    html += '<div class="analysis-card"><h3>Bigram Statistics</h3>';
    html += renderBigramStats(bigram_stats);
    html += '</div>';

    html += '</div>';
    area.innerHTML = html;
}

function renderChordStats(stats) {
    let html = '';
    html += `<div class="stat-row"><span>Pitches (n):</span><span>${stats.num_of_pitches}</span></div>`;
    html += `<div class="stat-row"><span>Unique PC (m):</span><span>${stats.num_of_unique_pitch_classes}</span></div>`;
    html += `<div class="stat-row"><span>Tension (t):</span><span>${fmtNum(stats.tension)}</span></div>`;
    html += `<div class="stat-row"><span>Thickness (h):</span><span>${fmtNum(stats.thickness)}</span></div>`;
    html += `<div class="stat-row"><span>Root:</span><span>${stats.root ?? 'none'}</span></div>`;
    html += `<div class="stat-row"><span>Geo. Center (g):</span><span>${fmtNum(stats.geometrical_center)}</span></div>`;
    html += `<div class="stat-row"><span>Alignment:</span><span>[${stats.alignment?.join(', ')}]</span></div>`;
    html += `<div class="stat-row"><span>Self-diff:</span><span>[${stats.self_diff?.join(', ')}]</span></div>`;
    html += `<div class="stat-row"><span>IC vector:</span><span>[${stats.count_vec?.join(', ')}]</span></div>`;
    return html;
}

function renderBigramStats(s) {
    let html = '';
    html += `<div class="stat-row"><span>Name:</span><span>${s.name_with_octave || s.name || '-'}</span></div>`;
    html += `<div class="stat-row"><span>Root:</span><span>${s.root_name || '-'}</span></div>`;
    html += `<div class="stat-row"><span>Tension (t):</span><span>${fmtNum(s.tension)}</span></div>`;
    html += `<div class="stat-row"><span>Chroma (k):</span><span>${fmtNum(s.chroma)}</span></div>`;
    html += `<div class="stat-row"><span>Common notes (c):</span><span>${s.common_note ?? '-'}</span></div>`;
    html += `<div class="stat-row"><span>VL distance (sv):</span><span>${s.sv ?? '-'}</span></div>`;
    html += `<div class="stat-row"><span>Similarity (x):</span><span>${s.similarity ?? '-'}</span></div>`;
    html += `<div class="stat-row"><span>Q indicator:</span><span>${fmtNum(s.q_indicator)}</span></div>`;
    html += `<div class="stat-row"><span>Span (s):</span><span>${s.span ?? '-'}</span></div>`;
    html += `<div class="stat-row"><span>Super-span (ss):</span><span>${s.sspan ?? '-'}</span></div>`;
    html += `<div class="stat-row"><span>Root movement:</span><span>${s.root_movement ?? '-'}</span></div>`;
    return html;
}

// ── Substitute Tab ───────────────────────────────────────────────────────────

function setupSubstituteTab() {
    document.getElementById('sub-ante-input').addEventListener('input', () => {
        syncInputToPiano('sub-ante-input');
    });
    document.getElementById('sub-post-input').addEventListener('input', () => {
        syncInputToPiano('sub-post-input');
    });

    document.getElementById('play-sub-ante').addEventListener('click', async () => {
        await ensureAudio();
        const notes = parseChordInput(document.getElementById('sub-ante-input').value);
        if (notes.length > 0) playChord(notes);
    });
    document.getElementById('play-sub-post').addEventListener('click', async () => {
        await ensureAudio();
        const notes = parseChordInput(document.getElementById('sub-post-input').value);
        if (notes.length > 0) playChord(notes);
    });

    document.getElementById('substitute-btn').addEventListener('click', runSubstitute);
}

function runSubstitute() {
    if (!wasmReady) { showError('sub-results', 'WASM not loaded'); return; }

    const ante = parseChordInput(document.getElementById('sub-ante-input').value);
    const post = parseChordInput(document.getElementById('sub-post-input').value);

    if (ante.length === 0 || post.length === 0) {
        showError('sub-results', 'Enter both chords');
        return;
    }

    const config = getDefaultSubstitutionConfig();
    config.object = document.getElementById('sub-object')?.value || 'Postchord';

    const resultArea = document.getElementById('sub-results');
    resultArea.innerHTML = '<div class="loading">Finding substitutions...</div>';

    setTimeout(() => {
        try {
            const resultStr = substitute_chords(
                JSON.stringify(ante),
                JSON.stringify(post),
                JSON.stringify(config)
            );
            const result = JSON.parse(resultStr);

            if (result.error) {
                showError('sub-results', result.error);
                return;
            }

            renderSubstituteResults(result);
        } catch (e) {
            showError('sub-results', 'Error: ' + e.message);
            console.error(e);
        }
    }, 10);
}

function renderSubstituteResults(result) {
    const area = document.getElementById('sub-results');
    const entries = result.entries || [];
    const pairs = result.pairs || [];

    let html = `<div class="result-summary">${entries.length} single substitutes, ${pairs.length} pair substitutes (${result.total_evaluated} evaluated)</div>`;

    if (entries.length > 0) {
        html += `<table class="result-table">
            <thead><tr>
                <th>#</th><th>Chord</th><th>Notes</th><th>Root</th>
                <th>sim%</th><th>t</th><th>k</th><th>sv</th>
                <th>Actions</th>
            </tr></thead><tbody>`;

        entries.forEach((e, i) => {
            const s = e.stats;
            html += `<tr>
                <td>${i + 1}</td>
                <td>${s.name_with_octave || s.notes?.join(', ')}</td>
                <td>[${s.notes?.join(', ')}]</td>
                <td>${s.root_name || '-'}</td>
                <td>${e.sim_orig ?? '-'}</td>
                <td>${fmtNum(s.tension)}</td>
                <td>${fmtNum(s.chroma)}</td>
                <td>${s.sv ?? '-'}</td>
                <td>
                    <button class="btn btn-tiny play-candidate" data-notes="${JSON.stringify(s.notes)}">Play</button>
                </td>
            </tr>`;
        });

        html += '</tbody></table>';
    }

    if (pairs.length > 0) {
        html += '<h3>Paired Substitutions</h3>';
        html += `<table class="result-table">
            <thead><tr>
                <th>#</th><th>Ante</th><th>Post</th><th>Ante sim%</th><th>Post sim%</th>
                <th>Actions</th>
            </tr></thead><tbody>`;

        pairs.forEach((p, i) => {
            html += `<tr>
                <td>${i + 1}</td>
                <td>${p.ante.stats.name_with_octave || p.ante.stats.notes?.join(', ')}</td>
                <td>${p.post.stats.name_with_octave || p.post.stats.notes?.join(', ')}</td>
                <td>${p.ante.sim_orig ?? '-'}</td>
                <td>${p.post.sim_orig ?? '-'}</td>
                <td>
                    <button class="btn btn-tiny play-pair"
                        data-ante="${JSON.stringify(p.ante.stats.notes)}"
                        data-post="${JSON.stringify(p.post.stats.notes)}">Play</button>
                </td>
            </tr>`;
        });

        html += '</tbody></table>';
    }

    if (entries.length === 0 && pairs.length === 0) {
        html += '<div class="no-results">No substitutes found.</div>';
    }

    area.innerHTML = html;

    // Wire play buttons
    area.querySelectorAll('.play-candidate').forEach(btn => {
        btn.addEventListener('click', async () => {
            await ensureAudio();
            playChord(JSON.parse(btn.dataset.notes));
        });
    });
    area.querySelectorAll('.play-pair').forEach(btn => {
        btn.addEventListener('click', async () => {
            await ensureAudio();
            const ante = JSON.parse(btn.dataset.ante);
            const post = JSON.parse(btn.dataset.post);
            playProgression([ante, post], 800, 200);
        });
    });
}

// ── Helpers ──────────────────────────────────────────────────────────────────

async function ensureAudio() {
    try { await initAudio(); } catch (_) {}
}

function showError(containerId, message) {
    document.getElementById(containerId).innerHTML = `<div class="error-msg">${escapeHtml(message)}</div>`;
}

function intVal(id, fallback) {
    const el = document.getElementById(id);
    if (!el) return fallback;
    const v = parseInt(el.value);
    return isNaN(v) ? fallback : v;
}

function floatVal(id, fallback) {
    const el = document.getElementById(id);
    if (!el) return fallback;
    const v = parseFloat(el.value);
    return isNaN(v) ? fallback : v;
}

function fmtNum(v) {
    if (v === undefined || v === null) return '-';
    if (typeof v === 'number') return Number.isInteger(v) ? v.toString() : v.toFixed(2);
    return String(v);
}

function escapeHtml(s) {
    const div = document.createElement('div');
    div.textContent = s;
    return div.innerHTML;
}

// Global stop for inline onclick
window._stopAll = stopAll;

// Start
start();
