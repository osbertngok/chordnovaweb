// Web Audio playback module using WebAudioFont for realistic piano.

let audioCtx = null;
let player = null;
let pianoPreset = null;
let loaded = false;
let activeNodes = [];

export async function initAudio() {
    if (loaded) return;

    audioCtx = new (window.AudioContext || window.webkitAudioContext)();

    // Load WebAudioFont player
    await loadScript('https://surikov.github.io/webaudiofont/npm/dist/WebAudioFontPlayer.js');

    // Load Acoustic Grand Piano preset
    await loadScript('https://surikov.github.io/webaudiofontdata/sound/0000_JCLive_sf2_file.js');

    player = new WebAudioFontPlayer();
    pianoPreset = window._tone_0000_JCLive_sf2_file;
    player.adjustPreset(audioCtx, pianoPreset);

    loaded = true;
}

function loadScript(url) {
    return new Promise((resolve, reject) => {
        // Check if already loaded
        const existing = document.querySelector(`script[src="${url}"]`);
        if (existing) { resolve(); return; }
        const script = document.createElement('script');
        script.src = url;
        script.onload = resolve;
        script.onerror = reject;
        document.head.appendChild(script);
    });
}

export function playChord(midiNotes, durationMs = 1000) {
    if (!loaded || !player || !pianoPreset) return;

    // Resume context if suspended (browser autoplay policy)
    if (audioCtx.state === 'suspended') audioCtx.resume();

    const when = audioCtx.currentTime;
    const duration = durationMs / 1000;

    for (const note of midiNotes) {
        const envelope = player.queueWaveTable(
            audioCtx, audioCtx.destination, pianoPreset,
            when, note, duration, 0.5
        );
        if (envelope) activeNodes.push(envelope);
    }
}

export async function playProgression(chordSequence, durationMs = 800, gapMs = 100) {
    if (!loaded || !player || !pianoPreset) return;

    if (audioCtx.state === 'suspended') await audioCtx.resume();

    const when = audioCtx.currentTime;
    const duration = durationMs / 1000;
    const step = (durationMs + gapMs) / 1000;

    for (let i = 0; i < chordSequence.length; i++) {
        const chord = chordSequence[i];
        const startTime = when + i * step;
        for (const note of chord) {
            const envelope = player.queueWaveTable(
                audioCtx, audioCtx.destination, pianoPreset,
                startTime, note, duration, 0.5
            );
            if (envelope) activeNodes.push(envelope);
        }
    }
}

export function stopAll() {
    if (!player) return;
    for (const node of activeNodes) {
        try { player.cancelQueue(audioCtx); } catch (_) {}
    }
    activeNodes = [];
    if (player) player.cancelQueue(audioCtx);
}

export function isReady() {
    return loaded;
}
