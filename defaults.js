// Default configuration objects matching Rust defaults.

export function getDefaultProgressionConfig() {
    return {
        voice_leading: {
            vl_min: 0,
            vl_max: 4,
            vl_setting: "Default",
            steady_min: 0.0,
            steady_max: 100.0,
            ascending_min: 0.0,
            ascending_max: 100.0,
            descending_min: 0.0,
            descending_max: 100.0
        },
        range: {
            lowest: 0,
            highest: 127,
            m_min: 1,
            m_max: 15,
            n_min: 1,
            n_max: 12,
            h_min: 0.0,
            h_max: 50.0,
            r_min: 0,
            r_max: 11,
            g_min: 0,
            g_max: 100
        },
        harmonic: {
            k_min: 0.0,
            k_max: 100.0,
            kk_min: 0.0,
            kk_max: 100.0,
            t_min: 0.0,
            t_max: 100.0,
            c_min: 0,
            c_max: 15,
            sv_min: 0,
            sv_max: 100,
            s_min: 0,
            s_max: 12,
            ss_min: 0,
            ss_max: 12,
            q_min: -500.0,
            q_max: 500.0,
            x_min: 0,
            x_max: 100
        },
        alignment: {
            align_mode: "Unlimited",
            i_min: 0,
            i_max: 24,
            i_low: 0,
            i_high: 24,
            alignment_list: []
        },
        exclusion: {
            enabled: false,
            exclusion_notes: [],
            exclusion_roots: [],
            exclusion_intervals: []
        },
        pedal: {
            enabled: false,
            pedal_notes: [],
            pedal_notes_set: [],
            in_bass: false,
            realign: false,
            period: 1,
            connect_pedal: false
        },
        uniqueness: {
            unique_mode: "Disabled"
        },
        scale: {
            overall_scale: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11]
        },
        similarity: {
            enabled: false,
            sim_period: [],
            sim_min: [],
            sim_max: []
        },
        root_movement: {
            enabled: false,
            rm_priority: []
        },
        bass: {
            bass_avail: [1, 3, 5, 7, 9, 11, 13]
        },
        chord_library: {
            chord_library: []
        },
        sort: {
            sort_order: ""
        },
        continual: false,
        loop_count: 1,
        output_mode: "Both"
    };
}

export function getDefaultSubstitutionConfig() {
    const defaultParam = () => ({
        center: 0,
        radius: 0,
        use_percentage: false,
        min_sub: 0,
        max_sub: 0
    });
    return {
        object: "Postchord",
        test_all: false,
        sample_size: 100000,
        sort_order: "",
        reset_list: "",
        percentage_list: "",
        sim_orig: defaultParam(),
        cardinality: defaultParam(),
        tension: defaultParam(),
        chroma: defaultParam(),
        common_note: defaultParam(),
        span: defaultParam(),
        sspan: defaultParam(),
        sv: defaultParam(),
        q_indicator: defaultParam(),
        similarity: defaultParam(),
        chroma_old: defaultParam(),
        root: defaultParam(),
        rm_priority: []
    };
}

// Note name helpers
const NOTE_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];

export function midiToNoteName(midi) {
    const note = NOTE_NAMES[midi % 12];
    const octave = Math.floor(midi / 12) - 1;
    return `${note}${octave}`;
}

export function noteNameToMidi(name) {
    const match = name.match(/^([A-G])(#|-|b)?(\d+)$/i);
    if (!match) return null;
    const step = match[1].toUpperCase();
    const acc = match[2] || '';
    const octave = parseInt(match[3]);
    const stepMap = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };
    let pc = stepMap[step];
    if (pc === undefined) return null;
    if (acc === '#') pc += 1;
    else if (acc === '-' || acc === 'b') pc -= 1;
    return (octave + 1) * 12 + pc;
}

// Scale presets
export const SCALE_PRESETS = {
    'Chromatic': [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11],
    'Major': [0, 2, 4, 5, 7, 9, 11],
    'Natural Minor': [0, 2, 3, 5, 7, 8, 10],
    'Harmonic Minor': [0, 2, 3, 5, 7, 8, 11],
    'Pentatonic': [0, 2, 4, 7, 9],
    'Blues': [0, 3, 5, 6, 7, 10],
    'Whole Tone': [0, 2, 4, 6, 8, 10],
};
