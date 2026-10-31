// wasm-loader.js - WebAssembly Engine Loader & Memory Bridge
// Bridges compiled C++/Rust/WAT WebAssembly simulation engine with WebGPU / WebGL renderer

const WASM_FALLBACK_BASE64 = "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";

class WasmSimulationBridge {
    constructor() {
        this.instance = null;
        this.exports = null;
        this.memory = null;
        this.isLoaded = false;
        this.backendName = "C++/Rust Wasm Simulation Engine (64-bit SIMD & Linear Memory)";
    }

    async init() {
        const importObject = {
            env: {
                sin: Math.sin,
                cos: Math.cos,
                sqrt: Math.sqrt
            }
        };

        try {
            // First attempt: fetch external .wasm binary
            if (typeof fetch === 'function' && window.location.protocol.startsWith('http')) {
                const response = await fetch('taipei_engine.wasm');
                if (response.ok) {
                    const wasmBytes = await response.arrayBuffer();
                    const result = await WebAssembly.instantiate(wasmBytes, importObject);
                    this.instance = result.instance;
                    this.exports = this.instance.exports;
                    this.memory = this.exports.memory;
                    this.exports.engine_init(Date.now() & 0xFFFFFF);
                    this.isLoaded = true;
                    console.log('⚡ [WASM ENGINE] Loaded successfully from taipei_engine.wasm binary!');
                    return true;
                }
            }
        } catch (err) {
            console.warn('[WASM ENGINE] Fetch binary load failed, falling back to embedded WASM bytecode:', err);
        }

        try {
            // Second attempt: decode base64 embedded WebAssembly binary
            const binaryString = atob(WASM_FALLBACK_BASE64);
            const len = binaryString.length;
            const bytes = new Uint8Array(len);
            for (let i = 0; i < len; i++) {
                bytes[i] = binaryString.charCodeAt(i);
            }

            const result = await WebAssembly.instantiate(bytes.buffer, importObject);
            this.instance = result.instance;
            this.exports = this.instance.exports;
            this.memory = this.exports.memory;
            this.exports.engine_init(Date.now() & 0xFFFFFF);
            this.isLoaded = true;
            console.log('⚡ [WASM ENGINE] Loaded successfully from embedded high-performance bytecode!');
            return true;
        } catch (err2) {
            console.error('❌ [WASM ENGINE] Failed to initialize WebAssembly engine:', err2);
            return false;
        }
    }

    update(dt, input) {
        if (!this.isLoaded || !this.exports) return;

        // Build input bitmask
        let mask = 0;
        if (input.forward)   mask |= (1 << 0);
        if (input.backward)  mask |= (1 << 1);
        if (input.left)      mask |= (1 << 2);
        if (input.right)     mask |= (1 << 3);
        if (input.sprint)    mask |= (1 << 4);
        if (input.handbrake) mask |= (1 << 5);
        if (input.action)    mask |= (1 << 6);

        this.exports.engine_update(dt, mask, 0);
    }

    getPlayer() {
        if (!this.isLoaded) return null;
        return {
            x: this.exports.engine_get_player_x(),
            y: this.exports.engine_get_player_y(),
            z: this.exports.engine_get_player_z(),
            heading: this.exports.engine_get_player_heading(),
            speed: this.exports.engine_get_player_speed(),
            health: this.exports.engine_get_player_health(),
            cash: this.exports.engine_get_player_cash(),
            wanted: this.exports.engine_get_player_wanted(),
            inVehicle: this.exports.engine_get_player_in_vehicle() !== 0,
            vehicleId: this.exports.engine_get_player_vehicle_id()
        };
    }

    getVehicleCount() {
        return this.isLoaded ? this.exports.engine_get_vehicle_count() : 0;
    }

    getVehicle(index) {
        if (!this.isLoaded) return null;
        return {
            active: this.exports.engine_get_vehicle_data(index, 0) !== 0,
            type: Math.round(this.exports.engine_get_vehicle_data(index, 1)),
            x: this.exports.engine_get_vehicle_data(index, 2),
            y: this.exports.engine_get_vehicle_data(index, 3),
            z: this.exports.engine_get_vehicle_data(index, 4),
            heading: this.exports.engine_get_vehicle_data(index, 5),
            speed: this.exports.engine_get_vehicle_data(index, 6),
            steerAngle: this.exports.engine_get_vehicle_data(index, 7),
            leanAngle: this.exports.engine_get_vehicle_data(index, 8),
            isPlayer: this.exports.engine_get_vehicle_data(index, 9) !== 0,
            isDrifting: this.exports.engine_get_vehicle_data(index, 10) !== 0,
            health: this.exports.engine_get_vehicle_data(index, 11)
        };
    }

    getPedestrianCount() {
        return this.isLoaded ? this.exports.engine_get_pedestrian_count() : 0;
    }

    getPedestrian(index) {
        if (!this.isLoaded) return null;
        return {
            active: this.exports.engine_get_pedestrian_data(index, 0) !== 0,
            x: this.exports.engine_get_pedestrian_data(index, 1),
            z: this.exports.engine_get_pedestrian_data(index, 2),
            heading: this.exports.engine_get_pedestrian_data(index, 3),
            speed: this.exports.engine_get_pedestrian_data(index, 4),
            animTime: this.exports.engine_get_pedestrian_data(index, 5),
            health: Math.round(this.exports.engine_get_pedestrian_data(index, 6))
        };
    }

    addCash(amount) {
        if (this.isLoaded) this.exports.engine_add_cash(amount);
    }

    addWanted(stars) {
        if (this.isLoaded) this.exports.engine_add_wanted(stars);
    }

    setPlayerPos(x, z) {
        if (this.isLoaded) this.exports.engine_set_player_pos(x, z);
    }

    toggleVehicle() {
        if (this.isLoaded) this.exports.engine_toggle_vehicle();
    }
}

// Global Wasm instance
window.wasmEngine = new WasmSimulationBridge();
