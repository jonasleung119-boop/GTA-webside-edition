// GTA Web Edition - Main Game File

// Game Constants
const GAME_WIDTH = 800;
const GAME_HEIGHT = 600;
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

// World Map (Simple grid-based city)
const worldMap = {
    width: 100,
    height: 100,
    tiles: []
};

// Initialize world with roads and buildings
function initWorld() {
    for (let y = 0; y < worldMap.height; y++) {
        worldMap.tiles[y] = [];
        for (let x = 0; x < worldMap.width; x++) {
            // Create a simple road pattern
            if (x % 5 === 0 || y % 5 === 0) {
                worldMap.tiles[y][x] = { type: 'road', color: '#333' };
            } else if (Math.random() > 0.7) {
                worldMap.tiles[y][x] = { type: 'building', color: '#555', height: Math.floor(Math.random() * 3) + 1 };
            } else {
                worldMap.tiles[y][x] = { type: 'grass', color: '#228B22' };
            }
        }
    }
    
    // Add some special buildings
    worldMap.tiles[50][50] = { type: 'police', color: '#1E90FF', height: 2 };
    worldMap.tiles[45][45] = { type: 'hospital', color: '#FF6B6B', height: 2 };
    worldMap.tiles[55][55] = { type: 'store', color: '#32CD32', height: 1 };
}

// Player Object
const player = {
    x: 50 * TILE_SIZE,
    y: 50 * TILE_SIZE,
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
    // Spawn some random vehicles
    for (let i = 0; i < 20; i++) {
        const x = Math.random() * worldMap.width * TILE_SIZE;
        const y = Math.random() * worldMap.height * TILE_SIZE;
        const type = ['car', 'truck', 'motorcycle'][Math.floor(Math.random() * 3)];
        
        vehicles.push({
            x: x,
            y: y,
            width: type === 'truck' ? 80 : type === 'motorcycle' ? 30 : 50,
            height: type === 'truck' ? 100 : type === 'motorcycle' ? 40 : 60,
            speed: Math.random() * 2 + 1,
            direction: Math.random() * Math.PI * 2,
            type: type,
            color: getVehicleColor(type),
            velocity: { x: 0, y: 0 },
            targetDirection: null,
            aiState: 'driving'
        });
    }
}

function getVehicleColor(type) {
    const colors = {
        car: ['#FF0000', '#0000FF', '#FFFF00', '#00FF00', '#FF00FF'],
        truck: ['#8B4513', '#556B2F', '#696969'],
        motorcycle: ['#000000', '#808080', '#A9A9A9']
    };
    return colors[type][Math.floor(Math.random() * colors[type].length)];
}

// NPCs (Pedestrians)
const npcs = [];

function spawnNPCs() {
    for (let i = 0; i < 50; i++) {
        const x = Math.random() * worldMap.width * TILE_SIZE;
        const y = Math.random() * worldMap.height * TILE_SIZE;
        
        npcs.push({
            x: x,
            y: y,
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
    // Center camera on player
    gameState.camera.x = player.x - canvas.width / 2;
    gameState.camera.y = player.y - canvas.height / 2;
    
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
    player.x = 50 * TILE_SIZE;
    player.y = 50 * TILE_SIZE;
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
        gameState.mouse.pressed = false; // Prevent continuous shooting
    }
    
    // Vehicle entry/exit
    if (gameState.keys['KeyE']) {
        if (gameState.inVehicle) {
            // Exit vehicle
            gameState.inVehicle = false;
            gameState.currentVehicle = null;
            document.getElementById('vehicle-hud').classList.add('hidden');
        } else {
            // Try to enter nearest vehicle
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
        
        gameState.keys['KeyE'] = false; // Prevent continuous triggering
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
                // Hit NPC
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
        if (vehicle === gameState.currentVehicle) continue; // Skip player's vehicle
        
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
        
        // Wrap around world (or clamp)
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
        if (tile.type === 'building') {
            // Collision with building - push player out
            const overlapX = (player.x % TILE_SIZE) - TILE_SIZE / 2;
            const overlapY = (player.y % TILE_SIZE) - TILE_SIZE / 2;
            
            if (Math.abs(overlapX) > Math.abs(overlapY)) {
                player.x += Math.sign(overlapX) * 2;
            } else {
                player.y += Math.sign(overlapY) * 2;
            }
        }
    }
    
    // Bullets with NPCs
    for (let i = 0; i < bullets.length; i++) {
        const bullet = bullets[i];
        
        for (let j = 0; j < npcs.length; j++) {
            const npc = npcs[j];
            if (checkRectCollision(bullet, npc)) {
                // Hit!
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
                // Push player out of vehicle
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
                // Simple collision response
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
                if (tile.type === 'building' && tile.height > 1) {
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
            // Draw windshield
            ctx.fillStyle = 'rgba(200, 200, 255, 0.3)';
            ctx.fillRect(-vehicle.width / 2 + 5, -vehicle.height / 2, vehicle.width - 10, 15);
        } else if (vehicle.type === 'truck') {
            ctx.fillRect(-vehicle.width / 2, -vehicle.height / 2, vehicle.width, vehicle.height);
            // Draw trailer
            ctx.fillStyle = vehicle.color;
            ctx.fillRect(vehicle.width / 2, -vehicle.height / 2 + 10, vehicle.width / 2, vehicle.height - 20);
        } else if (vehicle.type === 'motorcycle') {
            ctx.fillRect(-vehicle.width / 2, -vehicle.height / 2, vehicle.width, vehicle.height);
            // Draw rider
            ctx.fillStyle = '#000000';
            ctx.fillRect(-5, -vehicle.height / 2 - 10, 10, 20);
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
        
        // Draw head
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
