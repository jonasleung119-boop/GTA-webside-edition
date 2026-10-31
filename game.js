// game.js - Core 3D Taipei GTA Game Loop, Camera, Minimap, and Event Handling

class Game {
    constructor() {
        this.container = document.getElementById('game-container');
        this.canvas = document.getElementById('game-canvas');
        this.width = window.innerWidth;
        this.height = window.innerHeight;

        // Three.js Core
        this.scene = null;
        this.camera = null;
        this.renderer = null;

        // Subsystems
        this.world = null;
        this.player = null;
        this.traffic = null;

        // Camera Modes
        this.cameraMode = 0; // 0: Normal Chase, 1: Far Chase, 2: Classic Top-Down
        this.cameraAngle = { yaw: 0, pitch: 0.25, dist: 8.5 };
        this.isPointerDown = false;
        this.prevPointer = { x: 0, y: 0 };

        // Time of Day
        this.timeOfDay = 2; // 0: Day, 1: Sunset, 2: Cyberpunk Night
        this.dirLight = null;
        this.hemiLight = null;

        // Timing
        this.clock = new THREE.Clock();
        this.lastWantedCrimeTime = 0;

        // Input State
        this.input = {
            forward: false,
            backward: false,
            left: false,
            right: false,
            sprint: false,
            handbrake: false,
            action: false
        };

        // Engine Architecture State (WebGPU + WebAssembly Core)
        this.webgpuRenderer = null;
        this.useWebGPU = false;
        this.wasmLoaded = false;
        this.gpuVehicles = [];
        this.gpuPedestrians = [];

        // Minimap Radar
        this.minimapCanvas = document.getElementById('minimap-canvas');
        this.mctx = this.minimapCanvas ? this.minimapCanvas.getContext('2d') : null;

        this.init();
    }

    async init() {
        // 1. Initialize WebAssembly Simulation Engine (C++/Rust binary)
        if (window.wasmEngine) {
            this.wasmLoaded = await window.wasmEngine.init();
        }

        // 2. Initialize Native WebGPU 3D Engine
        if (window.WebGPURenderer) {
            this.webgpuRenderer = new WebGPURenderer(this.canvas);
            this.useWebGPU = await this.webgpuRenderer.init();
        }

        // 3. Setup Three.js scene (full simulation & WebGL fallback)
        this.setupThree();
        this.setupLighting();
        
        // Initialize Game Entities
        this.world = new TaipeiWorld(this.scene);
        this.world.init();

        this.player = new Player(this.scene, 0, 50);

        // Spawn player starter scooter right next to player!
        const starterScooter = new Vehicle('scooter', 3, 50, Math.PI / 2, false);
        this.scene.add(starterScooter.mesh);

        // Spawn a taxi and sports car nearby
        const starterTaxi = new Vehicle('taxi', -8, 48, 0, false);
        this.scene.add(starterTaxi.mesh);

        const starterSports = new Vehicle('sports', 8, 48, 0, false);
        this.scene.add(starterSports.mesh);

        this.traffic = new TrafficManager(this.scene, this.world);
        this.traffic.vehicles.push(starterScooter, starterTaxi, starterSports);
        this.traffic.init(this.player);

        this.initGPUState();
        this.setupEvents();
        this.setupTouchControls();
        this.applyTimeOfDay();
        this.updateTechStatusHUD();

        // Start render loop
        this.animate();
    }

    initGPUState() {
        this.syncGPUState();
    }

    syncGPUState() {
        const typeMap = { 'scooter': 0, 'taxi': 1, 'truck': 2, 'police': 3, 'sports': 4 };
        this.gpuVehicles = this.traffic.vehicles.map((v, idx) => ({
            id: idx,
            active: true,
            type: typeMap[v.type] !== undefined ? typeMap[v.type] : 0,
            x: v.x,
            y: v.y || 0,
            z: v.z,
            heading: v.heading,
            speed: v.speed,
            steerAngle: v.steerAngle || 0,
            leanAngle: v.leanAngle || 0,
            isPlayer: v === this.player.currentVehicle,
            isDrifting: !!v.isDrifting,
            health: v.health || 100
        }));

        this.gpuPedestrians = this.traffic.pedestrians.map((p, idx) => ({
            id: idx,
            active: true,
            x: p.x,
            z: p.z,
            heading: p.heading,
            speed: p.speed,
            animTime: p.animTime || 0
        }));
    }

    updateTechStatusHUD() {
        const gpuStatus = document.getElementById('gpu-status');
        const wasmStatus = document.getElementById('wasm-status');
        if (gpuStatus) {
            if (this.useWebGPU) {
                gpuStatus.innerText = '⚡ WebGPU Active';
                gpuStatus.style.color = '#00ffcc';
            } else {
                gpuStatus.innerText = '🌐 WebGL Fallback';
                gpuStatus.style.color = '#f59e0b';
            }
        }
        if (wasmStatus) {
            if (this.wasmLoaded) {
                wasmStatus.innerText = '🦀 C++/Rust WASM SIMD';
                wasmStatus.style.color = '#38bdf8';
            } else {
                wasmStatus.innerText = 'JS Mode';
                wasmStatus.style.color = '#a855f7';
            }
        }
    }

    setupThree() {
        this.scene = new THREE.Scene();
        this.scene.fog = new THREE.FogExp2('#0b0e14', 0.0035);

        this.camera = new THREE.PerspectiveCamera(60, this.width / this.height, 0.5, 1500);
        this.camera.position.set(0, 15, 30);

        this.renderer = new THREE.WebGLRenderer({
            canvas: this.canvas,
            antialias: true,
            powerPreference: 'high-performance'
        });
        this.renderer.setSize(this.width, this.height);
        this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
        this.renderer.shadowMap.enabled = true;
        this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    }

    setupLighting() {
        this.hemiLight = new THREE.HemisphereLight('#ffffff', '#22252a', 0.6);
        this.scene.add(this.hemiLight);

        this.dirLight = new THREE.DirectionalLight('#ffffff', 1.2);
        this.dirLight.position.set(100, 200, 100);
        this.dirLight.castShadow = true;
        this.dirLight.shadow.mapSize.width = 2048;
        this.dirLight.shadow.mapSize.height = 2048;
        this.dirLight.shadow.camera.near = 10;
        this.dirLight.shadow.camera.far = 400;
        const d = 120;
        this.dirLight.shadow.camera.left = -d;
        this.dirLight.shadow.camera.right = d;
        this.dirLight.shadow.camera.top = d;
        this.dirLight.shadow.camera.bottom = -d;
        this.scene.add(this.dirLight);
    }

    applyTimeOfDay() {
        // 0: Day, 1: Sunset, 2: Night (Taipei Cyberpunk)
        if (this.timeOfDay === 0) { // DAY
            this.scene.background = new THREE.Color('#87ceeb');
            this.scene.fog.color.set('#87ceeb');
            this.dirLight.color.set('#ffffff');
            this.dirLight.intensity = 1.3;
            this.hemiLight.intensity = 0.7;
            this.world.streetLights.forEach(l => l.intensity = 0);
        } else if (this.timeOfDay === 1) { // SUNSET
            this.scene.background = new THREE.Color('#d35400');
            this.scene.fog.color.set('#ba4a00');
            this.dirLight.color.set('#f39c12');
            this.dirLight.intensity = 0.9;
            this.hemiLight.intensity = 0.5;
            this.world.streetLights.forEach(l => l.intensity = 0.6);
        } else { // CYBERPUNK NIGHT
            this.scene.background = new THREE.Color('#0a0d14');
            this.scene.fog.color.set('#0b0e14');
            this.dirLight.color.set('#2c3e50');
            this.dirLight.intensity = 0.25;
            this.hemiLight.intensity = 0.3;
            this.world.streetLights.forEach(l => l.intensity = 1.2);
        }
    }

    cycleTimeOfDay() {
        this.timeOfDay = (this.timeOfDay + 1) % 3;
        this.applyTimeOfDay();
        const names = ['Daytime', 'Sunset Golden Hour', 'Cyberpunk Neon Night'];
        this.showNotification(`Time: ${names[this.timeOfDay]}`);
    }

    setupEvents() {
        window.addEventListener('resize', () => {
            this.width = window.innerWidth;
            this.height = window.innerHeight;
            this.camera.aspect = this.width / this.height;
            this.camera.updateProjectionMatrix();
            this.renderer.setSize(this.width, this.height);
        });

        // Keyboard Controls
        window.addEventListener('keydown', (e) => {
            this.handleKey(e.code, true);
        });

        window.addEventListener('keyup', (e) => {
            this.handleKey(e.code, false);
        });

        // Mouse Drag Orbit
        window.addEventListener('mousedown', (e) => {
            if (e.target.closest('#hud') || e.target.closest('#touch-controls')) return;
            this.isPointerDown = true;
            this.prevPointer = { x: e.clientX, y: e.clientY };
            if (window.soundSystem) window.soundSystem.resume();
        });

        window.addEventListener('mousemove', (e) => {
            if (!this.isPointerDown) return;
            const dx = e.clientX - this.prevPointer.x;
            const dy = e.clientY - this.prevPointer.y;
            this.prevPointer = { x: e.clientX, y: e.clientY };

            this.cameraAngle.yaw -= dx * 0.005;
            this.cameraAngle.pitch += dy * 0.004;
            this.cameraAngle.pitch = Math.max(0.05, Math.min(Math.PI / 2.3, this.cameraAngle.pitch));
        });

        window.addEventListener('mouseup', () => {
            this.isPointerDown = false;
        });

        // Shortcut buttons on HUD
        const btnTime = document.getElementById('btn-time');
        if (btnTime) btnTime.addEventListener('click', () => this.cycleTimeOfDay());

        const btnCamera = document.getElementById('btn-camera');
        if (btnCamera) btnCamera.addEventListener('click', () => this.cycleCamera());

        const btnRadio = document.getElementById('btn-radio');
        if (btnRadio) btnRadio.addEventListener('click', () => {
            const track = window.soundSystem.cycleRadio();
            this.showNotification(`Radio: ${track}`);
        });
    }

    handleKey(code, isPressed) {
        if (window.soundSystem) window.soundSystem.resume();

        switch (code) {
            case 'KeyW':
            case 'ArrowUp':
                this.input.forward = isPressed;
                break;
            case 'KeyS':
            case 'ArrowDown':
                this.input.backward = isPressed;
                break;
            case 'KeyA':
            case 'ArrowLeft':
                this.input.left = isPressed;
                break;
            case 'KeyD':
            case 'ArrowRight':
                this.input.right = isPressed;
                break;
            case 'ShiftLeft':
            case 'ShiftRight':
                this.input.sprint = isPressed;
                break;
            case 'Space':
                this.input.handbrake = isPressed;
                break;
            case 'KeyE':
                this.input.action = isPressed;
                break;
            case 'KeyF':
            case 'Enter':
                if (isPressed) this.toggleVehicleEntry();
                break;
            case 'KeyH':
                if (isPressed && window.soundSystem) {
                    const isScooter = this.player.inVehicle && this.player.currentVehicle.type === 'scooter';
                    window.soundSystem.playHorn(isScooter);
                }
                break;
            case 'KeyR':
                if (isPressed && window.soundSystem) {
                    const track = window.soundSystem.cycleRadio();
                    this.showNotification(`Radio: ${track}`);
                }
                break;
            case 'KeyC':
                if (isPressed) this.cycleCamera();
                break;
            case 'KeyT':
                if (isPressed) this.cycleTimeOfDay();
                break;
        }
    }

    setupTouchControls() {
        const joy = document.getElementById('virtual-joystick');
        const knob = document.getElementById('joystick-knob');
        if (!joy || !knob) return;

        let joyActive = false;
        let startPos = { x: 0, y: 0 };

        joy.addEventListener('touchstart', (e) => {
            e.preventDefault();
            joyActive = true;
            const touch = e.touches[0];
            const rect = joy.getBoundingClientRect();
            startPos = { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 };
            this.updateJoystick(touch.clientX, touch.clientY, startPos, knob);
        }, { passive: false });

        window.addEventListener('touchmove', (e) => {
            if (!joyActive) return;
            const touch = e.touches[0];
            this.updateJoystick(touch.clientX, touch.clientY, startPos, knob);
        });

        const resetJoy = () => {
            joyActive = false;
            knob.style.transform = 'translate(-50%, -50%)';
            this.input.forward = false;
            this.input.backward = false;
            this.input.left = false;
            this.input.right = false;
        };

        window.addEventListener('touchend', resetJoy);
        window.addEventListener('touchcancel', resetJoy);

        // Touch action buttons
        const bindTouchBtn = (id, onDown, onUp) => {
            const el = document.getElementById(id);
            if (!el) return;
            el.addEventListener('touchstart', (e) => { e.preventDefault(); onDown(); }, { passive: false });
            el.addEventListener('touchend', (e) => { e.preventDefault(); if (onUp) onUp(); });
        };

        bindTouchBtn('touch-drive', () => { this.input.forward = true; }, () => { this.input.forward = false; });
        bindTouchBtn('touch-brake', () => { this.input.backward = true; }, () => { this.input.backward = false; });
        bindTouchBtn('touch-drift', () => { this.input.handbrake = true; }, () => { this.input.handbrake = false; });
        bindTouchBtn('touch-enter', () => { this.toggleVehicleEntry(); });
        bindTouchBtn('touch-horn', () => {
            if (window.soundSystem) {
                const isScooter = this.player.inVehicle && this.player.currentVehicle.type === 'scooter';
                window.soundSystem.playHorn(isScooter);
            }
        });
    }

    updateJoystick(clientX, clientY, center, knob) {
        const dx = clientX - center.x;
        const dy = clientY - center.y;
        const dist = Math.hypot(dx, dy);
        const maxDist = 45;
        const clampedDist = Math.min(dist, maxDist);
        const angle = Math.atan2(dy, dx);

        const nx = Math.cos(angle) * clampedDist;
        const ny = Math.sin(angle) * clampedDist;

        knob.style.transform = `translate(calc(-50% + ${nx}px), calc(-50% + ${ny}px))`;

        this.input.forward = ny < -15;
        this.input.backward = ny > 15;
        this.input.left = nx < -15;
        this.input.right = nx > 15;
    }

    toggleVehicleEntry() {
        if (window.wasmEngine && this.wasmLoaded) {
            window.wasmEngine.toggleVehicle();
        }
        const res = this.player.tryEnterVehicle(this.traffic.vehicles);
        if (res.action === 'enter') {
            this.showNotification(`Mounted: ${res.vehicle.type.toUpperCase()}`);
            document.getElementById('vehicle-hud').classList.remove('hidden');
            document.getElementById('vehicle-name').innerText = res.vehicle.type.toUpperCase();
        } else if (res.action === 'exit') {
            this.showNotification('On Foot');
            document.getElementById('vehicle-hud').classList.add('hidden');
        }
    }

    cycleCamera() {
        this.cameraMode = (this.cameraMode + 1) % 3;
        const names = ['Third-Person Chase', 'Wide Orbit View', 'Classic Top-Down GTA'];
        this.showNotification(`Camera: ${names[this.cameraMode]}`);
    }

    showNotification(msg) {
        const el = document.getElementById('notification-banner');
        if (!el) return;
        el.innerText = msg;
        el.classList.remove('fade-out');
        el.classList.add('fade-in');
        clearTimeout(this.notifTimeout);
        this.notifTimeout = setTimeout(() => {
            el.classList.remove('fade-in');
            el.classList.add('fade-out');
        }, 2200);
    }

    updateCamera(dt) {
        let targetX = this.player.x;
        let targetZ = this.player.z;
        let heading = this.player.heading;
        let speed = this.player.inVehicle && this.player.currentVehicle ? this.player.currentVehicle.speed : this.player.speed;

        if (this.cameraMode === 2) {
            // Classic Top-Down GTA Perspective
            this.camera.position.set(targetX, 55, targetZ + 0.1);
            this.camera.lookAt(targetX, 0, targetZ);
            return;
        }

        // Third person follow
        let baseDist = this.cameraMode === 1 ? 14 : (this.player.inVehicle ? 9.5 : 5.8);
        baseDist += Math.abs(speed) * 0.05; // Zoom out with speed

        const effectiveYaw = this.cameraAngle.yaw + (this.player.inVehicle ? heading + Math.PI : 0);
        const camX = targetX + Math.sin(effectiveYaw) * baseDist * Math.cos(this.cameraAngle.pitch);
        const camY = 2.0 + Math.sin(this.cameraAngle.pitch) * baseDist;
        const camZ = targetZ + Math.cos(effectiveYaw) * baseDist * Math.cos(this.cameraAngle.pitch);

        // Smooth camera damping
        this.camera.position.lerp(new THREE.Vector3(camX, camY, camZ), dt * 10);
        this.camera.lookAt(targetX, 1.8, targetZ);
    }

    renderMinimap() {
        if (!this.mctx || !this.minimapCanvas) return;
        const w = this.minimapCanvas.width;
        const h = this.minimapCanvas.height;
        const cx = w / 2;
        const cy = h / 2;
        const scale = 0.55;

        // Clear circular minimap
        this.mctx.save();
        this.mctx.clearRect(0, 0, w, h);
        this.mctx.beginPath();
        this.mctx.arc(cx, cy, cx - 2, 0, Math.PI * 2);
        this.mctx.clip();

        // Background
        this.mctx.fillStyle = 'rgba(15, 23, 42, 0.9)';
        this.mctx.fillRect(0, 0, w, h);

        this.mctx.translate(cx, cy);
        // Rotate map with player heading
        this.mctx.rotate(-this.player.heading);

        // Draw Roads
        this.mctx.fillStyle = '#334155';
        this.world.roads.forEach(r => {
            if (r.axis === 'x') {
                const ry = (r.z - this.player.z) * scale;
                this.mctx.fillRect(-w, ry - (r.width * scale) / 2, w * 2, r.width * scale);
            } else {
                const rx = (r.x - this.player.x) * scale;
                this.mctx.fillRect(rx - (r.width * scale) / 2, -h, r.width * scale, h * 2);
            }
        });

        // Draw Taipei 101 Icon
        const t101x = (0 - this.player.x) * scale;
        const t101z = (0 - this.player.z) * scale;
        this.mctx.fillStyle = '#00ffff';
        this.mctx.beginPath();
        this.mctx.arc(t101x, t101z, 6, 0, Math.PI * 2);
        this.mctx.fill();

        // Draw Traffic Vehicles
        this.traffic.vehicles.forEach(v => {
            if (v.isPlayer) return;
            const vx = (v.x - this.player.x) * scale;
            const vz = (v.z - this.player.z) * scale;
            if (Math.hypot(vx, vz) > cx) return;

            this.mctx.fillStyle = v.type === 'police' ? '#3b82f6' : (v.type === 'taxi' ? '#eab308' : '#ef4444');
            this.mctx.beginPath();
            this.mctx.arc(vx, vz, 3, 0, Math.PI * 2);
            this.mctx.fill();
        });

        this.mctx.restore();

        // Draw Player Arrow at Center (Always pointing up)
        this.mctx.save();
        this.mctx.translate(cx, cy);
        this.mctx.fillStyle = '#10b981';
        this.mctx.beginPath();
        this.mctx.moveTo(0, -8);
        this.mctx.lineTo(6, 6);
        this.mctx.lineTo(0, 3);
        this.mctx.lineTo(-6, 6);
        this.mctx.closePath();
        this.mctx.fill();
        this.mctx.strokeStyle = '#ffffff';
        this.mctx.lineWidth = 1.5;
        this.mctx.stroke();
        this.mctx.restore();
    }

    updateHUD() {
        // District Name based on player position
        const distElem = document.getElementById('district-name');
        if (distElem) {
            if (Math.hypot(this.player.x, this.player.z) < 90) {
                distElem.innerText = '信義區 Xinyi (Taipei 101)';
            } else if (this.player.x > 100 && this.player.z > 100) {
                distElem.innerText = '士林夜市 Shilin Night Market';
            } else if (this.player.x < -100) {
                distElem.innerText = '西門町 Ximending';
            } else {
                distElem.innerText = '大安區 Da\'an District';
            }
        }

        // Wanted Stars
        const starsElem = document.getElementById('wanted-stars');
        if (starsElem) {
            starsElem.innerText = '★'.repeat(this.player.wantedLevel) + '☆'.repeat(5 - this.player.wantedLevel);
        }

        // Speedometer
        const speedElem = document.getElementById('vehicle-speed');
        if (speedElem) {
            const spd = this.player.inVehicle && this.player.currentVehicle ? Math.round(Math.abs(this.player.currentVehicle.speed)) : Math.round(this.player.speed);
            speedElem.innerText = spd;
        }

        // Audio Engine RPM Update
        if (this.player.inVehicle && this.player.currentVehicle && window.soundSystem) {
            window.soundSystem.updateEngine(this.player.currentVehicle.speed, this.player.currentVehicle.specs.maxSpeed);
        }
    }

    animate() {
        requestAnimationFrame(() => this.animate());
        const dt = Math.min(this.clock.getDelta(), 0.1);

        // 1. Step WebAssembly Simulation Engine (C++/Rust compiled Wasm)
        if (this.wasmLoaded && window.wasmEngine) {
            window.wasmEngine.update(dt, this.input);
        }

        // 2. Update Player or Vehicle
        if (this.player.inVehicle && this.player.currentVehicle) {
            this.player.currentVehicle.update(dt, this.input, this.world);
            this.player.x = this.player.currentVehicle.x;
            this.player.z = this.player.currentVehicle.z;
            this.player.heading = this.player.currentVehicle.heading;
        } else {
            this.player.update(dt, this.input, this.world, this.cameraAngle.yaw);
        }

        // 3. Update Traffic & AI
        this.traffic.update(dt, this.player, this.player.wantedLevel);

        // 4. Check Vehicle-Vehicle Player Collisions
        if (this.player.inVehicle && this.player.currentVehicle) {
            this.traffic.vehicles.forEach(other => {
                if (other === this.player.currentVehicle) return;
                const d = Math.hypot(other.x - this.player.currentVehicle.x, other.z - this.player.currentVehicle.z);
                if (d < 3.2 && Math.abs(this.player.currentVehicle.speed) > 18) {
                    if (Date.now() - this.lastWantedCrimeTime > 5000) {
                        this.player.wantedLevel = Math.min(5, this.player.wantedLevel + 1);
                        this.lastWantedCrimeTime = Date.now();
                        this.showNotification(`WANTED LEVEL INCREASED: ${this.player.wantedLevel} STAR(S)!`);
                        if (this.wasmLoaded && window.wasmEngine) {
                            window.wasmEngine.addWanted(1);
                        }
                    }
                }
            });
        }

        // 5. Update Camera, Minimap & HUD
        this.updateCamera(dt);
        this.renderMinimap();
        this.updateHUD();

        // 6. 3D Render Pass: WebGPU Native Engine OR WebGL Fallback
        if (this.useWebGPU && this.webgpuRenderer) {
            this.syncGPUState();
            const camTarget = { x: this.player.x, y: 1.5, z: this.player.z };
            const camPos = {
                x: this.camera.position.x,
                y: this.camera.position.y,
                z: this.camera.position.z
            };
            this.webgpuRenderer.render({ position: camPos, target: camTarget }, this.player, this.gpuVehicles, this.gpuPedestrians, this.timeOfDay);
        } else {
            this.renderer.render(this.scene, this.camera);
        }
    }
}

// Start Game on window load
window.addEventListener('DOMContentLoaded', () => {
    window.game = new Game();
});
