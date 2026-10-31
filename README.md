# 🇹🇼 Taipei GTA - 台北極速 Rush WebGPU & WebAssembly Edition

A next-generation 3D open-world Taipei web game inspired by **Taipei Rush**, engineered with native **WebGPU** (WGSL shaders) and high-performance **WebAssembly (WASM)** simulation core written in **C++**, **Rust**, and **C#**.

🎮 **Live Play:** [https://jonasleung119-boop.github.io/GTA-webside-edition/](https://jonasleung119-boop.github.io/GTA-webside-edition/)

---

## ⚡ Next-Gen Engine Architecture

| Layer | Technology | Description |
|---|---|---|
| **3D GPU Rendering** | **WebGPU + WGSL** | Native hardware GPU render pipelines, vertex & fragment shaders, Blinn-Phong specular, distance fog, and cyberpunk neon emissive boosts. |
| **Fallback 3D Renderer** | **WebGL2 / Three.js** | Seamless fallback for browsers or older mobile devices without WebGPU flags enabled. |
| **Simulation Core** | **WebAssembly (WASM)** | Zero-allocation linear memory simulation loop handling 32 vehicles, 48 pedestrians, and collision dynamics. |
| **Native C++ Engine** | `cpp/engine.hpp`, `cpp/engine.cpp` | Compiles to native binary via `clang++` or to WASM via Emscripten (`emcc`). Includes `CMakeLists.txt` & `Makefile`. |
| **Rust Engine** | `rust/src/lib.rs` | `#![no_std]` high-performance SIMD-ready engine compiling to `wasm32-unknown-unknown`. |
| **C# / .NET 8 Engine** | `csharp/Engine.cs` | Browser WASM compatible via .NET 8 `[JSExport]` architecture. |
| **Audio Synthesizer** | **Web Audio API** | Self-contained procedural synthesis with zero external audio assets (engine RPM, horns, sirens, tire screeches, radio). |

---

## 🌟 Game Features

### 🏙️ 3D Taipei Environment
* **Taipei 101 Landmark**: Towering 8-tiered pagoda architecture, observation crown, spire, and red aviation beacon.
* **Authentic Taiwanese Architecture**: Rooftop corrugated metal sheet additions (鐵皮屋), stainless steel water tanks (白鐵水塔), AC compressor units, and night market food stall canopies.
* **Bilingual Glowing Neon Signs**: 7-Eleven, 全家 FamilyMart, 50嵐 珍珠奶茶, 鼎泰豐 小籠包, 豪大大雞排, 永和豆漿大王, SYM 三陽機車, and 阿宗麵線.
* **Taiwanese Road System**: 4-lane avenues, pedestrian zebra crossings, and yellow Taiwan scooter waiting boxes (**機車停等區**).

### 🛵 Taiwanese Vehicles & Physics
* **Classic Taiwan Scooter (經典速克達機車)**: Agile handling, front shield apron, dual mirrors, and authentic physics lean banking into turns.
* **Taipei Yellow Taxi (台北黃色計程車)**: Vibrant yellow sedan with lighted roof "TAXI / 計程車" sign.
* **Taiwan Blue Truck (中華小貨車)**: Iconic Taiwan blue utility truck with slatted cargo flatbed.
* **Police Cruisers (警車)**: Taiwan police livery with alternating red and blue emergency lightbars.
* **Sports Cars (超跑)**: Aerodynamic high-speed vehicles.
* **Realistic Driving**: Acceleration, braking, handbrake drifting with tire skid effects, and building collisions.

### 👥 Living City AI & Systems
* **Traffic Simulation**: Civilian taxis, scooters, and trucks driving across road lanes with collision avoidance.
* **Pedestrians**: Citizens walking along sidewalks and fleeing if a speeding vehicle approaches.
* **Wanted Level & Police Pursuit**: Reckless driving and crashing into vehicles alerts police cruisers to pursue the player with sirens!

### 🎵 Synthesized Web Audio API (Zero External MP3 Assets)
* Engine sound with dynamic pitch/RPM modulation.
* Dual-tone car horns & scooter beep-beeps.
* Police pursuit sirens.
* Tire screech sound during high-speed drifts.
* Interactive in-game Synthwave & Lo-Fi radio channels.

---

## 🕹️ Controls

| Action | Desktop Keyboard | Mobile Touch |
|---|---|---|
| **Drive / Walk / Steer** | `W / A / S / D` or Arrow Keys | Left Virtual Joystick |
| **Accelerate** | `W` or `↑` | `GO` Button |
| **Brake / Reverse** | `S` or `↓` | `STOP` Button |
| **Sprint (On Foot)** | `Shift` | Joystick outward |
| **Drift / Handbrake** | `Spacebar` | `DRIFT` Button |
| **Enter / Exit Vehicle** | `F` or `Enter` | `VEHICLE` Button |
| **Horn / Scooter Beep** | `H` | `HORN` Button |
| **Switch Radio Station** | `R` | Top toolbar 📻 |
| **Switch Camera Mode** | `C` | Top toolbar 📷 |
| **Toggle Day / Night** | `T` | Top toolbar ☀️/🌙 |
| **Rotate Camera** | Click & Drag Mouse | Swipe Screen |

---

## 🛠️ Building the Engine from Source

### 1. Compile WebAssembly Binary (`taipei_engine.wasm`)
```bash
bunx wat2wasm engine.wat -o taipei_engine.wasm
```

### 2. Compile Native C++
```bash
make -C cpp
```

### 3. Compile C++ to WebAssembly with Emscripten
```bash
make -C cpp wasm
```

### 4. Compile Rust to WebAssembly
```bash
cd rust && cargo build --target wasm32-unknown-unknown --release
```

### 5. Compile C# to WebAssembly
```bash
cd csharp && dotnet build -c Release
```
