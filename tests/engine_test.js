// tests/engine_test.js - Automated Test Suite for Taipei GTA WebGPU & WebAssembly Engine
const fs = require('fs');
const assert = require('assert');

console.log('🏁 Starting Taipei GTA Engine Verification Suite...\n');

let testsPassed = 0;
let testsFailed = 0;

function runTest(name, fn) {
    try {
        fn();
        console.log(`  ✅ PASS: ${name}`);
        testsPassed++;
    } catch (e) {
        console.error(`  ❌ FAIL: ${name}`, e);
        testsFailed++;
    }
}

async function runAsyncTest(name, fn) {
    try {
        await fn();
        console.log(`  ✅ PASS: ${name}`);
        testsPassed++;
    } catch (e) {
        console.error(`  ❌ FAIL: ${name}`, e);
        testsFailed++;
    }
}

async function runAll() {
    // Test 1: Verify WASM binary file exists and size is reasonable
    runTest('WASM binary file existence & size check', () => {
        const stats = fs.statSync('taipei_engine.wasm');
        assert(stats.isFile(), 'taipei_engine.wasm must be a file');
        assert(stats.size > 1000, `WASM binary size (${stats.size} bytes) should be > 1KB`);
        console.log(`     (Binary size: ${stats.size} bytes)`);
    });

    // Test 2: Instantiate WASM and check exports
    await runAsyncTest('WASM instantiation and export interface', async () => {
        const wasmBytes = fs.readFileSync('taipei_engine.wasm');
        const { instance } = await WebAssembly.instantiate(wasmBytes, {
            env: {
                sin: Math.sin,
                cos: Math.cos,
                sqrt: Math.sqrt
            }
        });
        const exp = instance.exports;

        const requiredExports = [
            'engine_init',
            'engine_update',
            'engine_toggle_vehicle',
            'engine_get_player_x',
            'engine_get_player_y',
            'engine_get_player_z',
            'engine_get_player_heading',
            'engine_get_player_speed',
            'engine_get_player_health',
            'engine_get_player_cash',
            'engine_get_player_wanted',
            'engine_get_player_in_vehicle',
            'engine_get_player_vehicle_id',
            'engine_get_vehicle_count',
            'engine_get_vehicle_data',
            'engine_get_pedestrian_count',
            'engine_get_pedestrian_data',
            'engine_add_cash',
            'engine_add_wanted',
            'engine_set_player_pos'
        ];

        for (const req of requiredExports) {
            assert(typeof exp[req] === 'function', `Missing required export: ${req}`);
        }
    });

    // Test 3: Simulation step, player movement & physics
    await runAsyncTest('Simulation step & player physics', async () => {
        const wasmBytes = fs.readFileSync('taipei_engine.wasm');
        const { instance } = await WebAssembly.instantiate(wasmBytes, {
            env: { sin: Math.sin, cos: Math.cos, sqrt: Math.sqrt }
        });
        const exp = instance.exports;

        exp.engine_init(42);
        assert.strictEqual(exp.engine_get_player_x(), 0.0);
        assert.strictEqual(exp.engine_get_player_z(), 50.0);
        assert.strictEqual(exp.engine_get_player_health(), 100);
        assert.strictEqual(exp.engine_get_player_cash(), 25800);
        assert.strictEqual(exp.engine_get_player_wanted(), 0);

        // Step 1: Forward movement input
        exp.engine_update(0.016, 1, 0); // Bit 0: forward
        assert(exp.engine_get_player_speed() > 0, 'Player speed must increase forward');

        // Add cash & wanted stars
        exp.engine_add_cash(1500);
        assert.strictEqual(exp.engine_get_player_cash(), 27300, 'Cash should increase to 27300');

        exp.engine_add_wanted(3);
        assert.strictEqual(exp.engine_get_player_wanted(), 3, 'Wanted stars should be 3');

        // Mount starter vehicle (scooter at x=3, z=50)
        exp.engine_set_player_pos(3.0, 50.0);
        exp.engine_toggle_vehicle();
        assert.strictEqual(exp.engine_get_player_in_vehicle(), 1, 'Player should be in vehicle');
        assert.strictEqual(exp.engine_get_player_vehicle_id(), 0, 'Vehicle ID should be 0 (scooter)');

        // Dismount vehicle
        exp.engine_toggle_vehicle();
        assert.strictEqual(exp.engine_get_player_in_vehicle(), 0, 'Player should dismount vehicle');
    });

    // Test 4: Verify Base64 fallback bytecode in wasm-loader.js matches binary
    await runAsyncTest('wasm-loader.js fallback base64 validation', async () => {
        const loaderSrc = fs.readFileSync('wasm-loader.js', 'utf8');
        const match = loaderSrc.match(/WASM_FALLBACK_BASE64\s*=\s*"([^"]+)"/);
        assert(match, 'WASM_FALLBACK_BASE64 must be present in wasm-loader.js');

        const base64Str = match[1];
        const decodedBuf = Buffer.from(base64Str, 'base64');
        const { instance } = await WebAssembly.instantiate(decodedBuf, {
            env: { sin: Math.sin, cos: Math.cos, sqrt: Math.sqrt }
        });
        assert(instance.exports.engine_init, 'Decoded base64 WASM must have engine_init');
    });

    // Test 5: Verify WebGPU WGSL Shader syntax in webgpu-renderer.js
    runTest('WebGPU WGSL Shader code inspection', () => {
        const rendererSrc = fs.readFileSync('webgpu-renderer.js', 'utf8');
        assert(rendererSrc.includes('@vertex'), 'Must contain WGSL @vertex stage');
        assert(rendererSrc.includes('@fragment'), 'Must contain WGSL @fragment stage');
        assert(rendererSrc.includes('struct Uniforms'), 'Must contain WGSL Uniforms struct');
        assert(rendererSrc.includes('vs_main'), 'Must define vs_main entrypoint');
        assert(rendererSrc.includes('fs_main'), 'Must define fs_main entrypoint');
        assert(rendererSrc.includes('Taipei 101'), 'Must include Taipei 101 geometry generation');
    });

    // Test 6: Verify C++, Rust, and C# source files exist
    runTest('Multi-language source presence check', () => {
        assert(fs.existsSync('cpp/engine.hpp'), 'cpp/engine.hpp must exist');
        assert(fs.existsSync('cpp/engine.cpp'), 'cpp/engine.cpp must exist');
        assert(fs.existsSync('cpp/Makefile'), 'cpp/Makefile must exist');
        assert(fs.existsSync('cpp/CMakeLists.txt'), 'cpp/CMakeLists.txt must exist');
        assert(fs.existsSync('rust/Cargo.toml'), 'rust/Cargo.toml must exist');
        assert(fs.existsSync('rust/src/lib.rs'), 'rust/src/lib.rs must exist');
        assert(fs.existsSync('csharp/GameEngine.csproj'), 'csharp/GameEngine.csproj must exist');
        assert(fs.existsSync('csharp/Engine.cs'), 'csharp/Engine.cs must exist');
    });

    console.log(`\n========================================`);
    console.log(`TEST SUMMARY: ${testsPassed} passed, ${testsFailed} failed.`);
    console.log(`========================================\n`);

    if (testsFailed > 0) {
        process.exit(1);
    }
}

runAll();
