// GTA Web Edition - Main Game File

// Game Constants
const GAME_WIDTH = 1200;
const GAME_HEIGHT = 800;
const TILE_SIZE = 40;
const GRAVITY = 0.5;
const FRICTION = 0.98;

// Game State
const gameState = {
    currentScreen: 'menu', // 'menu', 'game', 'paused'
    money: 0,
    wantedLevel: 0,
    health: 100,
    maxHealth: 100,
    currentWeapon: 'Fists',
    weapons: ['Fists', 'Pistol', 'Shotgun', 'AK-47', 'Rocket Launcher'],
    mission: 'Free Roam',
    inVehicle: false,
    currentVehicle: null,
    camera: { x: 0, y: 0, zoom: 1 },
    keys: {},
    mouse: { x: 0, y: 0, pressed: false },
    lastTime: 0,
    deltaTime: 0
};

// Canvas Setup
const canvas = document.getElementById('game-canvas');
const ctx = canvas.getContext('2d');

// Set canvas size
function resizeCanvas() {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
}

window.addEventListener('resize', resizeCanvas);
resizeCanvas();

// World Map - GTA-style large city
const worldMap = {
    width: 200,
    height: 200,
    tiles: []
};

// District definitions for GTA-style city
const DISTRICTS = {
    DOWNTOWN: { x: 70, y: 70, width: 60, height: 60 },
    RESIDENTIAL: { x: 0, y: 0, width: 70, height: 70 },
    INDUSTRIAL: { x: 0, y: 130, width: 70, height: 70 },
    BEACH: { x: 130, y: 0, width: 70, height: 70 },
    AIRPORT: { x: 130, y: 130, width: 70, height: 70 }
};

// Initialize world with GTA-style layout
function initWorld() {
    // First, create base layer
    for (let y = 0; y < worldMap.height; y++) {
        worldMap.tiles[y] = [];
        for (let x = 0; x < worldMap.width; x++) {
            worldMap.tiles[y][x] = { type: 'grass', color: '#228B22' };
        }
    }
    
    // Create districts
    createDowntown();
    createResidential();
    createIndustrial();
    createBeach();
    createAirport();
    
    // Create highway system
    createHighways();
    
    // Add special locations
    addSpecialLocations();
}

// Create Downtown District
function createDowntown() {
    const d = DISTRICTS.DOWNTOWN;
    
    // Create grid of roads
    for (let y = d.y; y < d.y + d.height; y++) {
        for (let x = d.x; x < d.x + d.width; x++) {
            // Main avenues (every 8 tiles)
            if (x % 8 === 0 || y % 8 === 0) {
                worldMap.tiles[y][x] = { type: 'road', color: '#444', roadType: 'avenue' };
            }
            // Side streets (every 4 tiles, but not on avenues)
            else if (x % 4 === 0 || y % 4 === 0) {
                worldMap.tiles[y][x] = { type: 'road', color: '#555', roadType: 'street' };
            }
            // Building blocks
            else if (Math.random() > 0.2) {
                const height = Math.floor(Math.random() * 5) + 2; // 2-6 stories
                const color = ['#666', '#777', '#888', '#999'][Math.floor(Math.random() * 4)];
                worldMap.tiles[y][x] = { type: 'building', color: color, height: height };
            }
        }
    }
    
    // Add central park area
    for (let y = d.y + 25; y < d.y + 35; y++) {
        for (let x = d.x + 25; x < d.x + 35; x++) {
            if ((x - d.x - 25) % 2 === 0 || (y - d.y - 25) % 2 === 0) {
                worldMap.tiles[y][x] = { type: 'path', color: '#8B4513' };
            } else {
                worldMap.tiles[y][x] = { type: 'park', color: '#228B22' };
            }
        }
    }
}

// Create Residential District
function createResidential() {
    const d = DISTRICTS.RESIDENTIAL;
    
    for (let y = d.y; y < d.y + d.height; y++) {
        for (let x = d.x; x < d.x + d.width; x++) {
            // Curving roads pattern
            const distFromCenterX = Math.abs(x - (d.x + d.width / 2));
            const distFromCenterY = Math.abs(y - (d.y + d.height / 2));
            
            // Main roads
            if ((x - d.x) % 10 === 0 || (y - d.y) % 10 === 0) {
                worldMap.tiles[y][x] = { type: 'road', color: '#666', roadType: 'residential' };
            }
            // Houses and apartments
            else if (Math.random() > 0.4) {
                const height = Math.random() > 0.5 ? 1 : 2;
                const color = ['#A0522D', '#CD853F', '#DEB887', '#F5DEB3'][Math.floor(Math.random() * 4)];
                worldMap.tiles[y][x] = { type: 'building', color: color, height: height };
            }
            // Gardens and trees
            else if (Math.random() > 0.5) {
                worldMap.tiles[y][x] = { type: 'garden', color: '#90EE90' };
            }
        }
    }
    
    // Add a residential park
    for (let y = d.y + 10; y < d.y + 20; y++) {
        for (let x = d.x + 10; x < d.x + 20; x++) {
            if (Math.random() > 0.1) {
                worldMap.tiles[y][x] = { type: 'park', color: '#228B22' };
            }
        }
    }
}

// Create Industrial District
function createIndustrial() {
    const d = DISTRICTS.INDUSTRIAL;
    
    for (let y = d.y; y < d.y + d.height; y++) {
        for (let x = d.x; x < d.x + d.width; x++) {
            // Wide roads for trucks
            if ((x - d.x) % 12 === 0 || (y - d.y) % 12 === 0) {
                worldMap.tiles[y][x] = { type: 'road', color: '#333', roadType: 'industrial' };
                // Make roads wider
                if ((x - d.x) % 12 === 1 || (y - d.y) % 12 === 1) {
                    worldMap.tiles[y][x] = { type: 'road', color: '#333', roadType: 'industrial' };
                }
            }
            // Factories and warehouses
            else if (Math.random() > 0.3) {
                const height = Math.floor(Math.random() * 3) + 1;
                const color = ['#8B0000', '#A52A2A', '#B22222', '#800000'][Math.floor(Math.random() * 4)];
                worldMap.tiles[y][x] = { type: 'building', color: color, height: height };
            }
            // Docks area (bottom part)
            else if (y > d.y + d.height - 15) {
                if (Math.random() > 0.7) {
                    worldMap.tiles[y][x] = { type: 'dock', color: '#8B4513' };
                } else {
                    worldMap.tiles[y][x] = { type: 'water', color: '#1E90FF' };
                }
            }
        }
    }
    
    // Add shipping containers area
    for (let y = d.y + 5; y < d.y + 15; y++) {
        for (let x = d.x + 50; x < d.x + 60; x++) {
            if (Math.random() > 0.3) {
                worldMap.tiles[y][x] = { type: 'container', color: '#FF4500', height: 1 };
            }
        }
    }
}

// Create Beach District
function createBeach() {
    const d = DISTRICTS.BEACH;
    
    // Beach area (top 30 rows)
    for (let y = d.y; y < d.y + 30; y++) {
        for (let x = d.x; x < d.x + d.width; x++) {
            if (Math.random() > 0.2) {
                worldMap.tiles[y][x] = { type: 'sand', color: '#F5DEB3' };
            } else {
                worldMap.tiles[y][x] = { type: 'water', color: '#1E90FF' };
            }
        }
    }
    
    // Beachfront buildings
    for (let y = d.y + 30; y < d.y + 40; y++) {
        for (let x = d.x; x < d.x + d.width; x++) {
            if ((x - d.x) % 8 === 0 || (y - d.y - 30) % 5 === 0) {
                worldMap.tiles[y][x] = { type: 'road', color: '#777', roadType: 'beach' };
            } else if (Math.random() > 0.5) {
                const height = Math.random() > 0.7 ? 3 : Math.random() > 0.5 ? 2 : 1;
                worldMap.tiles[y][x] = { type: 'building', color: '#FFD700', height: height };
            } else {
                worldMap.tiles[y][x] = { type: 'sand', color: '#F5DEB3' };
            }
        }
    }
    
    // Rest of beach district (residential/commercial)
    for (let y = d.y + 40; y < d.y + d.height; y++) {
        for (let x = d.x; x < d.x + d.width; x++) {
            if ((x - d.x) % 6 === 0 || (y - d.y) % 6 === 0) {
                worldMap.tiles[y][x] = { type: 'road', color: '#666', roadType: 'beach' };
            } else if (Math.random() > 0.4) {
                const height = Math.floor(Math.random() * 3) + 1;
                const color = ['#FFD700', '#FFA500', '#FF8C00'][Math.floor(Math.random() * 3)];
                worldMap.tiles[y][x] = { type: 'building', color: color, height: height };
            }
        }
    }
}

// Create Airport District
function createAirport() {
    const d = DISTRICTS.AIRPORT;
    
    // Runways (horizontal and vertical)
    for (let y = d.y + 10; y < d.y + 20; y++) {
        for (let x = d.x; x < d.x + d.width; x++) {
            worldMap.tiles[y][x] = { type: 'runway', color: '#A9A9A9' };
        }
    }
    for (let y = d.y; y < d.y + d.height; y++) {
        for (let x = d.x + 30; x < d.x + 40; x++) {
            worldMap.tiles[y][x] = { type: 'runway', color: '#A9A9A9' };
        }
    }
    
    // Terminal area
    for (let y = d.y + 20; y < d.y + 50; y++) {
        for (let x = d.x + 10; x < d.x + 60; x++) {
            if ((x - d.x - 10) % 3 === 0 || (y - d.y - 20) % 3 === 0) {
                worldMap.tiles[y][x] = { type: 'road', color: '#888', roadType: 'airport' };
            } else if (Math.random() > 0.3) {
                const height = Math.random() > 0.5 ? 2 : 1;
                worldMap.tiles[y][x] = { type: 'building', color: '#C0C0C0', height: height };
            }
        }
    }
    
    // Hangars
    for (let y = d.y + 50; y < d.y + 60; y++) {
        for (let x = d.x; x < d.x + 30; x++) {
            if (Math.random() > 0.2) {
                worldMap.tiles[y][x] = { type: 'building', color: '#708090', height: 3 };
            }
        }
    }
    for (let y = d.y + 50; y < d.y + 60; y++) {
        for (let x = d.x + 40; x < d.x + 70; x++) {
            if (Math.random() > 0.2) {
                worldMap.tiles[y][x] = { type: 'building', color: '#708090', height: 3 };
            }
        }
    }
}

// Create Highway System
function createHighways() {
    // Horizontal highway through middle
    for (let x = 0; x < worldMap.width; x++) {
        for (let h = 0; h < 4; h++) {
            if (x % 20 === 0 || x % 20 === 1 || x % 20 === 2 || x % 20 === 3) {
                worldMap.tiles[100 - h][x] = { type: 'highway', color: '#222', roadType: 'highway' };
            }
        }
    }
    
    // Vertical highway
    for (let y = 0; y < worldMap.height; y++) {
        for (let w = 0; w < 4; w++) {
            if (y % 20 === 0 || y % 20 === 1 || y % 20 === 2 || y % 20 === 3) {
                worldMap.tiles[y][100 + w] = { type: 'highway', color: '#222', roadType: 'highway' };
            }
        }
    }
    
    // Diagonal highway (top-left to bottom-right)
    for (let i = 0; i < 140; i++) {
        const x = 20 + i;
        const y = 20 + i;
        if (x < worldMap.width && y < worldMap.height) {
            worldMap.tiles[y][x] = { type: 'highway', color: '#222', roadType: 'highway' };
        }
    }
    
    // Connect highways to districts
    connectHighways();
}

// Connect highways to district roads
function connectHighways() {
    // Connect to Downtown
    for (let x = 70; x < 130; x++) {
        if (worldMap.tiles[99][x].type === 'highway') {
            worldMap.tiles[100][x] = { type: 'road', color: '#444', roadType: 'avenue' };
            worldMap.tiles[101][x] = { type: 'road', color: '#444', roadType: 'avenue' };
        }
    }
    
    // Connect to other districts
    for (let y = 0; y < 70; y++) {
        if (worldMap.tiles[y][99].type === 'highway') {
            worldMap.tiles[y][100] = { type: 'road', color: '#666', roadType: 'residential' };
            worldMap.tiles[y][101] = { type: 'road', color: '#666', roadType: 'residential' };
        }
    }
}

// Add Special Locations
function addSpecialLocations() {
    // Police stations (multiple)
    addBuilding(50, 50, 5, 5, 'police', '#1E90FF');
    addBuilding(150, 150, 4, 4, 'police', '#1E90FF');
    
    // Hospitals
    addBuilding(60, 60, 6, 4, 'hospital', '#FF6B6B');
    addBuilding(140, 50, 5, 4, 'hospital', '#FF6B6B');
    
    // Stores and shops
    addBuilding(55, 55, 3, 3, 'store', '#32CD32');
    addBuilding(120, 80, 3, 3, 'store', '#32CD32');
    addBuilding(80, 120, 3, 3, 'store', '#32CD32');
    
    // Gang territories
    addBuilding(10, 10, 4, 4, 'gang', '#8B0000');
    addBuilding(180, 180, 4, 4, 'gang', '#006400');
    
    // Stadium
    addBuilding(120, 120, 8, 6, 'stadium', '#808080');
    
    // Bank
    addBuilding(90, 90, 4, 4, 'bank', '#FFD700');
    
    // Ammunation
    addBuilding(75, 75, 2, 2, 'ammunation', '#FF4500');
    
    // Fast food
    addBuilding(110, 60, 2, 2, 'fastfood', '#FF6347');
}

// Helper to add a building
function addBuilding(startX, startY, width, height, type, color) {
    for (let y = startY; y < startY + height; y++) {
        for (let x = startX; x < startX + width; x++) {
            if (x >= 0 && x < worldMap.width && y >= 0 && y < worldMap.height) {
                worldMap.tiles[y][x] = { type: type, color: color, height: Math.min(height, 5) };
            }
        }
    }
}

// Player Object
const player = {
    x: 100 * TILE_SIZE,
    y: 100 * TILE_SIZE,
    width: 30,
    height: 50,
    speed: 0,
    maxSpeed: 5,
    acceleration: 0.2,
    deceleration: 0.1,
    direction: 0, // in radians
    velocity: { x: 0, y: 0 },
    sprite: null,
    animationFrame: 0,
    animationTimer: 0
};

// Vehicles
const vehicles = [];

function spawnVehicles() {
    // Spawn vehicles on roads only
    const vehicleTypes = ['car', 'car', 'car', 'car', 'truck', 'motorcycle', 'police', 'taxi', 'bus'];
    const spawnCount = 200;
    
    for (let i = 0; i < spawnCount; i++) {
        let x, y, attempts = 0;
        const maxAttempts = 100;
        
        do {
            x = Math.floor(Math.random() * worldMap.width);
            y = Math.floor(Math.random() * worldMap.height);
            attempts++;
            
            if (attempts > maxAttempts) {
                x = Math.floor(Math.random() * worldMap.width);
                y = Math.floor(Math.random() * worldMap.height);
                break;
            }
        } while (worldMap.tiles[y] && worldMap.tiles[y][x] && 
                 worldMap.tiles[y][x].type !== 'road' && 
                 worldMap.tiles[y][x].type !== 'highway' &&
                 worldMap.tiles[y][x].type !== 'avenue');
        
        const type = vehicleTypes[Math.floor(Math.random() * vehicleTypes.length)];
        
        vehicles.push({
            x: x * TILE_SIZE + TILE_SIZE / 2,
            y: y * TILE_SIZE + TILE_SIZE / 2,
            width: type === 'truck' || type === 'bus' ? 80 : type === 'motorcycle' ? 30 : 50,
            height: type === 'truck' || type === 'bus' ? 100 : type === 'motorcycle' ? 40 : 60,
            speed: type === 'police' ? 3 : type === 'bus' ? 1.5 : Math.random() * 2 + 1,
            direction: Math.random() * Math.PI * 2,
            type: type,
            color: getVehicleColor(type),
            velocity: { x: 0, y: 0 },
            targetDirection: null,
            aiState: 'driving',
            siren: type === 'police'
        });
    }
}

function getVehicleColor(type) {
    const colors = {
        car: ['#FF0000', '#0000FF', '#FFFF00', '#00FF00', '#FF00FF', '#800080', '#FFA500'],
        truck: ['#8B4513', '#556B2F', '#696969', '#2F4F4F'],
        motorcycle: ['#000000', '#808080', '#A9A9A9', '#4B0082'],
        police: ['#FFFFFF', '#0000FF'],
        taxi: ['#FFFF00'],
        bus: ['#FF0000', '#00FF00']
    };
    return colors[type] ? colors[type][Math.floor(Math.random() * colors[type].length)] : '#FFFFFF';
}

// NPCs (Pedestrians)
const npcs = [];

function spawnNPCs() {
    for (let i = 0; i < 100; i++) {
        let x, y, attempts = 0;
        const maxAttempts = 50;
        
        // Try to spawn on sidewalk (next to roads)
        do {
            x = Math.floor(Math.random() * worldMap.width);
            y = Math.floor(Math.random() * worldMap.height);
            attempts++;
            
            if (attempts > maxAttempts) break;
        } while (worldMap.tiles[y] && worldMap.tiles[y][x] && 
                 worldMap.tiles[y][x].type === 'building' ||
                 worldMap.tiles[y][x].type === 'water' ||
                 worldMap.tiles[y][x].type === 'highway');
        
        npcs.push({
            x: x * TILE_SIZE + TILE_SIZE / 2,
            y: y * TILE_SIZE + TILE_SIZE / 2,
            width: 20,
            height: 40,
            speed: Math.random() * 1 + 0.5,
            direction: Math.random() * Math.PI * 2,
            type: 'pedestrian',
            color: '#0000FF',
            velocity: { x: 0, y: 0 },
            target: null,
            state: 'walking'
        });
    }
}

// Camera System
function updateCamera() {
    // Center camera on player with smoothing
    const targetX = player.x - canvas.width / 2;
    const targetY = player.y - canvas.height / 2;
    
    gameState.camera.x += (targetX - gameState.camera.x) * 0.1;
    gameState.camera.y += (targetY - gameState.camera.y) * 0.1;
    
    // Clamp camera to world bounds
    gameState.camera.x = Math.max(0, Math.min(worldMap.width * TILE_SIZE - canvas.width, gameState.camera.x));
    gameState.camera.y = Math.max(0, Math.min(worldMap.height * TILE_SIZE - canvas.height, gameState.camera.y));
}

// Input Handling
function initInput() {
    // Keyboard
    window.addEventListener('keydown', (e) => {
        gameState.keys[e.code] = true;
        
        if (e.code === 'Escape') {
            if (gameState.currentScreen === 'game') {
                gameState.currentScreen = 'paused';
                document.getElementById('pause-menu').classList.remove('hidden');
            } else if (gameState.currentScreen === 'paused') {
                gameState.currentScreen = 'game';
                document.getElementById('pause-menu').classList.add('hidden');
            }
        }
        
        // Weapon switching
        if (e.code === 'Digit1') gameState.currentWeapon = gameState.weapons[0];
        if (e.code === 'Digit2') gameState.currentWeapon = gameState.weapons[1];
        if (e.code === 'Digit3') gameState.currentWeapon = gameState.weapons[2];
        if (e.code === 'Digit4') gameState.currentWeapon = gameState.weapons[3];
        if (e.code === 'Digit5') gameState.currentWeapon = gameState.weapons[4];
    });
    
    window.addEventListener('keyup', (e) => {
        gameState.keys[e.code] = false;
    });
    
    // Mouse
    canvas.addEventListener('mousemove', (e) => {
        const rect = canvas.getBoundingClientRect();
        gameState.mouse.x = e.clientX - rect.left;
        gameState.mouse.y = e.clientY - rect.top;
    });
    
    canvas.addEventListener('mousedown', (e) => {
        gameState.mouse.pressed = true;
    });
    
    canvas.addEventListener('mouseup', (e) => {
        gameState.mouse.pressed = false;
    });
    
    // Menu buttons
    document.getElementById('start-game').addEventListener('click', () => {
        gameState.currentScreen = 'game';
        document.getElementById('menu').classList.add('hidden');
        initGame();
    });
    
    document.getElementById('resume').addEventListener('click', () => {
        gameState.currentScreen = 'game';
        document.getElementById('pause-menu').classList.add('hidden');
    });
    
    document.getElementById('quit').addEventListener('click', () => {
        gameState.currentScreen = 'menu';
        document.getElementById('pause-menu').classList.add('hidden');
        document.getElementById('menu').classList.remove('hidden');
    });
}

// Game Initialization
function initGame() {
    initWorld();
    spawnVehicles();
    spawnNPCs();
    
    // Reset player position
    player.x = 100 * TILE_SIZE;
    player.y = 100 * TILE_SIZE;
    player.velocity.x = 0;
    player.velocity.y = 0;
    
    // Reset game state
    gameState.health = 100;
    gameState.money = 0;
    gameState.wantedLevel = 0;
    gameState.inVehicle = false;
    gameState.currentVehicle = null;
    
    // Start game loop
    gameState.lastTime = performance.now();
    requestAnimationFrame(gameLoop);
}

// Main Game Loop
function gameLoop(currentTime) {
    gameState.deltaTime = (currentTime - gameState.lastTime) / 1000;
    gameState.lastTime = currentTime;
    
    if (gameState.currentScreen === 'game') {
        update(gameState.deltaTime);
        render();
    }
    
    requestAnimationFrame(gameLoop);
}

// Update Game State
function update(deltaTime) {
    // Update player
    updatePlayer(deltaTime);
    
    // Update camera
    updateCamera();
    
    // Update vehicles
    updateVehicles(deltaTime);
    
    // Update NPCs
    updateNPCs(deltaTime);
    
    // Check collisions
    checkCollisions();
    
    // Update HUD
    updateHUD();
    
    // Random events
    if (Math.random() < 0.001) {
        // Random mission
        const missions = ['Free Roam', 'Deliver Package', 'Wanted: Stars', 'Find Vehicle', 'Rob Store'];
        gameState.mission = missions[Math.floor(Math.random() * missions.length)];
    }
    
    // Wanted level decay
    if (gameState.wantedLevel > 0 && Math.random() < 0.005) {
        gameState.wantedLevel--;
    }
}

// Update Player
function updatePlayer(deltaTime) {
    // Reset acceleration
    let accelerationX = 0;
    let accelerationY = 0;
    
    if (gameState.inVehicle && gameState.currentVehicle) {
        // Vehicle controls
        const vehicle = gameState.currentVehicle;
        
        if (gameState.keys['ArrowUp'] || gameState.keys['KeyW']) {
            accelerationX = Math.cos(vehicle.direction) * vehicle.speed * 20;
            accelerationY = Math.sin(vehicle.direction) * vehicle.speed * 20;
        }
        if (gameState.keys['ArrowDown'] || gameState.keys['KeyS']) {
            accelerationX = -Math.cos(vehicle.direction) * vehicle.speed * 10;
            accelerationY = -Math.sin(vehicle.direction) * vehicle.speed * 10;
        }
        if (gameState.keys['ArrowLeft'] || gameState.keys['KeyA']) {
            vehicle.direction -= 0.05;
        }
        if (gameState.keys['ArrowRight'] || gameState.keys['KeyD']) {
            vehicle.direction += 0.05;
        }
        
        // Update vehicle position
        vehicle.x += accelerationX * deltaTime;
        vehicle.y += accelerationY * deltaTime;
        
        // Update player position to match vehicle
        player.x = vehicle.x + vehicle.width / 2;
        player.y = vehicle.y + vehicle.height / 2;
        
        // Apply friction
        vehicle.velocity.x *= 0.95;
        vehicle.velocity.y *= 0.95;
    } else {
        // Player on foot
        if (gameState.keys['ArrowUp'] || gameState.keys['KeyW']) {
            accelerationX = Math.cos(player.direction) * player.maxSpeed;
            accelerationY = Math.sin(player.direction) * player.maxSpeed;
        }
        if (gameState.keys['ArrowDown'] || gameState.keys['KeyS']) {
            accelerationX = -Math.cos(player.direction) * player.maxSpeed * 0.5;
            accelerationY = -Math.sin(player.direction) * player.maxSpeed * 0.5;
        }
        if (gameState.keys['ArrowLeft'] || gameState.keys['KeyA']) {
            player.direction -= 0.1;
        }
        if (gameState.keys['ArrowRight'] || gameState.keys['KeyD']) {
            player.direction += 0.1;
        }
        
        // Apply acceleration
        player.velocity.x += accelerationX * player.acceleration * deltaTime * 60;
        player.velocity.y += accelerationY * player.acceleration * deltaTime * 60;
        
        // Apply friction
        player.velocity.x *= FRICTION;
        player.velocity.y *= FRICTION;
        
        // Limit speed
        const speed = Math.sqrt(player.velocity.x * player.velocity.x + player.velocity.y * player.velocity.y);
        if (speed > player.maxSpeed) {
            player.velocity.x = (player.velocity.x / speed) * player.maxSpeed;
            player.velocity.y = (player.velocity.y / speed) * player.maxSpeed;
        }
        
        // Update position
        player.x += player.velocity.x * deltaTime * 60;
        player.y += player.velocity.y * deltaTime * 60;
        
        // Update direction based on movement
        if (Math.abs(player.velocity.x) > 0.1 || Math.abs(player.velocity.y) > 0.1) {
            player.direction = Math.atan2(player.velocity.y, player.velocity.x);
        }
    }
    
    // Mouse aiming (for shooting)
    if (!gameState.inVehicle) {
        const worldMouseX = gameState.camera.x + gameState.mouse.x;
        const worldMouseY = gameState.camera.y + gameState.mouse.y;
        const angleToMouse = Math.atan2(worldMouseY - player.y, worldMouseX - player.x);
        
        // Only rotate player if not moving
        if (Math.abs(player.velocity.x) < 0.1 && Math.abs(player.velocity.y) < 0.1) {
            player.direction = angleToMouse;
        }
    }
    
    // Shooting
    if (gameState.mouse.pressed && !gameState.inVehicle) {
        shoot();
        gameState.mouse.pressed = false;
    }
    
    // Vehicle entry/exit
    if (gameState.keys['KeyE']) {
        if (gameState.inVehicle) {
            gameState.inVehicle = false;
            gameState.currentVehicle = null;
            document.getElementById('vehicle-hud').classList.add('hidden');
        } else {
            let nearestVehicle = null;
            let nearestDistance = 100;
            
            for (const vehicle of vehicles) {
                const dx = vehicle.x + vehicle.width / 2 - player.x;
                const dy = vehicle.y + vehicle.height / 2 - player.y;
                const distance = Math.sqrt(dx * dx + dy * dy);
                
                if (distance < nearestDistance && distance < 80) {
                    nearestDistance = distance;
                    nearestVehicle = vehicle;
                }
            }
            
            if (nearestVehicle) {
                gameState.inVehicle = true;
                gameState.currentVehicle = nearestVehicle;
                document.getElementById('vehicle-hud').classList.remove('hidden');
            }
        }
        
        gameState.keys['KeyE'] = false;
    }
    
    // Update animation
    player.animationTimer += deltaTime;
    if (player.animationTimer > 0.1) {
        player.animationTimer = 0;
        player.animationFrame = (player.animationFrame + 1) % 4;
    }
}

// Shoot Function
function shoot() {
    if (gameState.currentWeapon === 'Fists') {
        // Melee attack
        for (let i = 0; i < npcs.length; i++) {
            const npc = npcs[i];
            const dx = npc.x - player.x;
            const dy = npc.y - player.y;
            const distance = Math.sqrt(dx * dx + dy * dy);
            
            if (distance < 40) {
                npcs.splice(i, 1);
                gameState.money += 10;
                if (gameState.wantedLevel < 5) gameState.wantedLevel++;
                break;
            }
        }
    } else {
        // Ranged weapon
        const bulletSpeed = 10;
        const angle = Math.atan2(gameState.mouse.y - canvas.height / 2, gameState.mouse.x - canvas.width / 2);
        
        bullets.push({
            x: player.x,
            y: player.y,
            width: 5,
            height: 5,
            velocity: {
                x: Math.cos(angle) * bulletSpeed,
                y: Math.sin(angle) * bulletSpeed
            },
            damage: getWeaponDamage(gameState.currentWeapon),
            color: '#FFFF00'
        });
    }
}

function getWeaponDamage(weapon) {
    const damage = {
        'Fists': 10,
        'Pistol': 20,
        'Shotgun': 40,
        'AK-47': 15,
        'Rocket Launcher': 100
    };
    return damage[weapon] || 10;
}

// Bullets
const bullets = [];

// Update Vehicles
function updateVehicles(deltaTime) {
    for (const vehicle of vehicles) {
        if (vehicle === gameState.currentVehicle) continue;
        
        // Simple AI: drive randomly
        if (!vehicle.targetDirection || Math.random() < 0.01) {
            vehicle.targetDirection = Math.random() * Math.PI * 2;
        }
        
        // Turn towards target direction
        const angleDiff = vehicle.targetDirection - vehicle.direction;
        vehicle.direction += Math.sin(angleDiff) * 0.02;
        
        // Move forward
        vehicle.x += Math.cos(vehicle.direction) * vehicle.speed * deltaTime * 60;
        vehicle.y += Math.sin(vehicle.direction) * vehicle.speed * deltaTime * 60;
        
        // Wrap around world
        vehicle.x = Math.max(0, Math.min(worldMap.width * TILE_SIZE - vehicle.width, vehicle.x));
        vehicle.y = Math.max(0, Math.min(worldMap.height * TILE_SIZE - vehicle.height, vehicle.y));
    }
}

// Update NPCs
function updateNPCs(deltaTime) {
    for (const npc of npcs) {
        // Simple AI: walk randomly
        if (!npc.target || Math.random() < 0.01) {
            npc.target = {
                x: npc.x + (Math.random() - 0.5) * 200,
                y: npc.y + (Math.random() - 0.5) * 200
            };
        }
        
        // Move towards target
        const dx = npc.target.x - npc.x;
        const dy = npc.target.y - npc.y;
        const distance = Math.sqrt(dx * dx + dy * dy);
        
        if (distance > 5) {
            npc.direction = Math.atan2(dy, dx);
            npc.x += Math.cos(npc.direction) * npc.speed * deltaTime * 60;
            npc.y += Math.sin(npc.direction) * npc.speed * deltaTime * 60;
        }
        
        // Wrap around world
        npc.x = Math.max(0, Math.min(worldMap.width * TILE_SIZE - npc.width, npc.x));
        npc.y = Math.max(0, Math.min(worldMap.height * TILE_SIZE - npc.height, npc.y));
    }
}

// Check Collisions
function checkCollisions() {
    // Player with world
    const playerTileX = Math.floor(player.x / TILE_SIZE);
    const playerTileY = Math.floor(player.y / TILE_SIZE);
    
    if (playerTileX >= 0 && playerTileX < worldMap.width && 
        playerTileY >= 0 && playerTileY < worldMap.height) {
        const tile = worldMap.tiles[playerTileY][playerTileX];
        if (tile.type === 'building' || tile.type === 'container') {
            const overlapX = (player.x % TILE_SIZE) - TILE_SIZE / 2;
            const overlapY = (player.y % TILE_SIZE) - TILE_SIZE / 2;
            
            if (Math.abs(overlapX) > Math.abs(overlapY)) {
                player.x += Math.sign(overlapX) * 2;
            } else {
                player.y += Math.sign(overlapY) * 2;
            }
        }
        
        // Water collision
        if (tile.type === 'water') {
            player.x -= player.velocity.x * 0.5;
            player.y -= player.velocity.y * 0.5;
            player.velocity.x *= 0.8;
            player.velocity.y *= 0.8;
        }
    }
    
    // Bullets with NPCs
    for (let i = 0; i < bullets.length; i++) {
        const bullet = bullets[i];
        
        for (let j = 0; j < npcs.length; j++) {
            const npc = npcs[j];
            if (checkRectCollision(bullet, npc)) {
                npcs.splice(j, 1);
                bullets.splice(i, 1);
                gameState.money += 20;
                if (gameState.wantedLevel < 5) gameState.wantedLevel++;
                i--;
                break;
            }
        }
        
        // Remove bullets that are out of bounds
        if (bullet.x < 0 || bullet.x > worldMap.width * TILE_SIZE ||
            bullet.y < 0 || bullet.y > worldMap.height * TILE_SIZE) {
            bullets.splice(i, 1);
            i--;
        }
    }
    
    // Player with vehicles (for collision)
    if (!gameState.inVehicle) {
        for (const vehicle of vehicles) {
            if (checkRectCollision(player, vehicle)) {
                const dx = player.x - (vehicle.x + vehicle.width / 2);
                const dy = player.y - (vehicle.y + vehicle.height / 2);
                const distance = Math.sqrt(dx * dx + dy * dy);
                
                if (distance < 30) {
                    player.x += (dx / distance) * 2;
                    player.y += (dy / distance) * 2;
                }
            }
        }
    }
    
    // Vehicle with vehicle collisions
    for (let i = 0; i < vehicles.length; i++) {
        for (let j = i + 1; j < vehicles.length; j++) {
            const v1 = vehicles[i];
            const v2 = vehicles[j];
            
            if (checkRectCollision(v1, v2)) {
                const dx = v1.x - v2.x;
                const dy = v1.y - v2.y;
                const distance = Math.sqrt(dx * dx + dy * dy);
                
                const overlap = (v1.width + v2.width) / 2 - distance;
                if (overlap > 0) {
                    v1.x += (dx / distance) * overlap / 2;
                    v1.y += (dy / distance) * overlap / 2;
                    v2.x -= (dx / distance) * overlap / 2;
                    v2.y -= (dy / distance) * overlap / 2;
                }
            }
        }
    }
}

// Check Rectangle Collision
function checkRectCollision(rect1, rect2) {
    return rect1.x < rect2.x + rect2.width &&
           rect1.x + rect1.width > rect2.x &&
           rect1.y < rect2.y + rect2.height &&
           rect1.y + rect1.height > rect2.y;
}

// Update HUD
function updateHUD() {
    document.getElementById('money-amount').textContent = gameState.money;
    document.getElementById('wanted-stars').textContent = '★'.repeat(gameState.wantedLevel);
    document.getElementById('weapon-name').textContent = gameState.currentWeapon;
    document.getElementById('mission-text').textContent = gameState.mission;
    
    // Update health bar
    const healthBar = document.getElementById('health-bar');
    healthBar.style.width = (gameState.health / gameState.maxHealth * 100) + 'px';
    healthBar.style.background = getHealthColor();
    
    if (gameState.inVehicle && gameState.currentVehicle) {
        document.getElementById('vehicle-name').textContent = gameState.currentVehicle.type;
        document.getElementById('vehicle-speed').textContent = Math.abs(
            Math.sqrt(gameState.currentVehicle.velocity.x ** 2 + gameState.currentVehicle.velocity.y ** 2) * 3.6
        ).toFixed(0);
    }
}

function getHealthColor() {
    if (gameState.health > 70) return '#4CAF50';
    if (gameState.health > 30) return '#FFC107';
    return '#FF5722';
}

// Render Function
function render() {
    // Clear canvas
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    
    // Save context for camera
    ctx.save();
    ctx.translate(-gameState.camera.x, -gameState.camera.y);
    
    // Draw world
    drawWorld();
    
    // Draw vehicles
    drawVehicles();
    
    // Draw NPCs
    drawNPCs();
    
    // Draw bullets
    drawBullets();
    
    // Draw player
    drawPlayer();
    
    // Restore context
    ctx.restore();
    
    // Draw minimap
    drawMinimap();
}

// Draw World
function drawWorld() {
    const startTileX = Math.max(0, Math.floor(gameState.camera.x / TILE_SIZE));
    const startTileY = Math.max(0, Math.floor(gameState.camera.y / TILE_SIZE));
    const endTileX = Math.min(worldMap.width, Math.ceil((gameState.camera.x + canvas.width) / TILE_SIZE));
    const endTileY = Math.min(worldMap.height, Math.ceil((gameState.camera.y + canvas.height) / TILE_SIZE));
    
    for (let y = startTileY; y < endTileY; y++) {
        for (let x = startTileX; x < endTileX; x++) {
            const tile = worldMap.tiles[y][x];
            if (tile) {
                ctx.fillStyle = tile.color;
                ctx.fillRect(x * TILE_SIZE, y * TILE_SIZE, TILE_SIZE, TILE_SIZE);
                
                // Draw building height indicator
                if ((tile.type === 'building' || tile.type === 'container') && tile.height > 1) {
                    ctx.fillStyle = 'rgba(0, 0, 0, 0.3)';
                    for (let h = 1; h < tile.height; h++) {
                        ctx.fillRect(
                            x * TILE_SIZE - 5,
                            y * TILE_SIZE - h * 20,
                            TILE_SIZE + 10,
                            20
                        );
                    }
                }
                
                // Draw road markings for highways
                if (tile.type === 'highway') {
                    ctx.strokeStyle = '#FFF';
                    ctx.lineWidth = 2;
                    ctx.beginPath();
                    ctx.moveTo(x * TILE_SIZE + 10, y * TILE_SIZE + 20);
                    ctx.lineTo(x * TILE_SIZE + 30, y * TILE_SIZE + 20);
                    ctx.stroke();
                }
                
                // Draw water waves
                if (tile.type === 'water') {
                    ctx.strokeStyle = 'rgba(255, 255, 255, 0.3)';
                    ctx.lineWidth = 1;
                    ctx.beginPath();
                    ctx.moveTo(x * TILE_SIZE, y * TILE_SIZE + 10);
                    ctx.quadraticCurveTo(
                        x * TILE_SIZE + 20, y * TILE_SIZE + 5,
                        x * TILE_SIZE + 40, y * TILE_SIZE + 10
                    );
                    ctx.stroke();
                }
            }
        }
    }
}

// Draw Vehicles
function drawVehicles() {
    for (const vehicle of vehicles) {
        ctx.save();
        ctx.translate(vehicle.x + vehicle.width / 2, vehicle.y + vehicle.height / 2);
        ctx.rotate(vehicle.direction);
        
        ctx.fillStyle = vehicle.color;
        
        if (vehicle.type === 'car') {
            ctx.fillRect(-vehicle.width / 2, -vehicle.height / 2, vehicle.width, vehicle.height);
            ctx.fillStyle = 'rgba(200, 200, 255, 0.3)';
            ctx.fillRect(-vehicle.width / 2 + 5, -vehicle.height / 2, vehicle.width - 10, 15);
        } else if (vehicle.type === 'truck') {
            ctx.fillRect(-vehicle.width / 2, -vehicle.height / 2, vehicle.width, vehicle.height);
            ctx.fillStyle = vehicle.color;
            ctx.fillRect(vehicle.width / 2, -vehicle.height / 2 + 10, vehicle.width / 2, vehicle.height - 20);
        } else if (vehicle.type === 'motorcycle') {
            ctx.fillRect(-vehicle.width / 2, -vehicle.height / 2, vehicle.width, vehicle.height);
            ctx.fillStyle = '#000000';
            ctx.fillRect(-5, -vehicle.height / 2 - 10, 10, 20);
        } else if (vehicle.type === 'police') {
            ctx.fillStyle = '#FFFFFF';
            ctx.fillRect(-vehicle.width / 2, -vehicle.height / 2, vehicle.width, vehicle.height);
            ctx.fillStyle = '#0000FF';
            ctx.fillRect(-vehicle.width / 2 + 5, -vehicle.height / 2 + 5, vehicle.width - 10, 10);
            // Police lights
            if (vehicle.siren) {
                ctx.fillStyle = Math.sin(Date.now() / 100) > 0 ? '#FF0000' : '#0000FF';
                ctx.fillRect(vehicle.width / 2 - 5, -vehicle.height / 2 - 5, 10, 5);
            }
        } else if (vehicle.type === 'taxi') {
            ctx.fillStyle = '#FFFF00';
            ctx.fillRect(-vehicle.width / 2, -vehicle.height / 2, vehicle.width, vehicle.height);
            ctx.fillStyle = '#000000';
            ctx.fillRect(-vehicle.width / 2 + 5, -vehicle.height / 2 + 5, vehicle.width - 10, 5);
        } else if (vehicle.type === 'bus') {
            ctx.fillStyle = vehicle.color;
            ctx.fillRect(-vehicle.width / 2, -vehicle.height / 2, vehicle.width, vehicle.height);
            ctx.fillStyle = '#FFFFFF';
            ctx.fillRect(-vehicle.width / 2 + 5, -vehicle.height / 2 + 5, vehicle.width - 10, 10);
        }
        
        ctx.restore();
    }
}

// Draw NPCs
function drawNPCs() {
    for (const npc of npcs) {
        ctx.save();
        ctx.translate(npc.x + npc.width / 2, npc.y + npc.height / 2);
        ctx.rotate(npc.direction);
        
        ctx.fillStyle = npc.color;
        ctx.fillRect(-npc.width / 2, -npc.height / 2, npc.width, npc.height);
        
        ctx.fillStyle = '#FFD700';
        ctx.beginPath();
        ctx.arc(0, -npc.height / 2 - 5, 5, 0, Math.PI * 2);
        ctx.fill();
        
        ctx.restore();
    }
}

// Draw Bullets
function drawBullets() {
    for (const bullet of bullets) {
        ctx.fillStyle = bullet.color;
        ctx.beginPath();
        ctx.arc(bullet.x, bullet.y, bullet.width / 2, 0, Math.PI * 2);
        ctx.fill();
    }
}

// Draw Player
function drawPlayer() {
    ctx.save();
    ctx.translate(player.x + player.width / 2, player.y + player.height / 2);
    ctx.rotate(player.direction);
    
    // Draw body
    ctx.fillStyle = '#0000FF';
    ctx.fillRect(-player.width / 2, -player.height / 2, player.width, player.height);
    
    // Draw head
    ctx.fillStyle = '#FFD700';
    ctx.beginPath();
    ctx.arc(0, -player.height / 2 - 10, 10, 0, Math.PI * 2);
    ctx.fill();
    
    // Draw weapon
    if (gameState.currentWeapon !== 'Fists') {
        ctx.fillStyle = '#8B4513';
        ctx.fillRect(player.width / 2 + 5, -5, 20, 10);
    }
    
    // Draw direction indicator
    ctx.strokeStyle = '#FFFFFF';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(30, 0);
    ctx.stroke();
    
    ctx.restore();
    
    // Draw player name tag
    ctx.fillStyle = '#FFFFFF';
    ctx.font = '12px Arial';
    ctx.fillText('Player', player.x - 20, player.y - player.height / 2 - 15);
}

// Draw Minimap
function drawMinimap() {
    const minimap = document.createElement('canvas');
    minimap.width = 200;
    minimap.height = 200;
    const minimapCtx = minimap.getContext('2d');
    
    // Scale down world
    const scale = 200 / (worldMap.width * TILE_SIZE);
    
    // Draw world
    minimapCtx.fillStyle = '#333';
    minimapCtx.fillRect(0, 0, 200, 200);
    
    for (let y = 0; y < worldMap.height; y += 5) {
        for (let x = 0; x < worldMap.width; x += 5) {
            const tile = worldMap.tiles[y][x];
            if (tile) {
                minimapCtx.fillStyle = tile.color;
                minimapCtx.fillRect(
                    x * TILE_SIZE * scale,
                    y * TILE_SIZE * scale,
                    TILE_SIZE * scale * 5,
                    TILE_SIZE * scale * 5
                );
            }
        }
    }
    
    // Draw player
    minimapCtx.fillStyle = '#FF0000';
    minimapCtx.beginPath();
    minimapCtx.arc(
        player.x * scale,
        player.y * scale,
        3,
        0,
        Math.PI * 2
    );
    minimapCtx.fill();
    
    // Draw vehicles
    minimapCtx.fillStyle = '#FFFF00';
    for (const vehicle of vehicles) {
        minimapCtx.beginPath();
        minimapCtx.arc(
            vehicle.x * scale,
            vehicle.y * scale,
            2,
            0,
            Math.PI * 2
        );
        minimapCtx.fill();
    }
    
    // Draw minimap to main canvas
    ctx.drawImage(minimap, canvas.width - 210, 10, 200, 200);
}

// Initialize the game when the page loads
window.addEventListener('load', () => {
    initInput();
    
    // Show menu initially
    document.getElementById('menu').classList.remove('hidden');
    document.getElementById('pause-menu').classList.add('hidden');
    document.getElementById('vehicle-hud').classList.add('hidden');
});
