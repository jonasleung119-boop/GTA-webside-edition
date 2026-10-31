// traffic.js - Ambient Traffic AI, Pedestrians, and Police Pursuit Systems

class TrafficManager {
    constructor(scene, world) {
        this.scene = scene;
        this.world = world;
        this.vehicles = [];
        this.pedestrians = [];
        this.maxVehicles = 22;
        this.maxPedestrians = 35;
        this.policeChasing = false;
    }

    init(player) {
        this.player = player;
        this.spawnInitialVehicles();
        this.spawnInitialPedestrians();
    }

    spawnInitialVehicles() {
        const types = ['scooter', 'scooter', 'taxi', 'taxi', 'truck', 'sports'];
        const half = this.world.worldSize / 2 - 40;

        for (let i = 0; i < this.maxVehicles; i++) {
            const type = types[Math.floor(Math.random() * types.length)];
            // Pick a road from world
            const road = this.world.roads[Math.floor(Math.random() * this.world.roads.length)];
            let x = 0, z = 0, heading = 0;

            if (road.axis === 'x') {
                z = road.z + (Math.random() > 0.5 ? 5 : -5); // right-hand drive lane
                x = (Math.random() - 0.5) * half;
                heading = z > road.z ? Math.PI / 2 : -Math.PI / 2;
            } else {
                x = road.x + (Math.random() > 0.5 ? 5 : -5);
                z = (Math.random() - 0.5) * half;
                heading = x > road.x ? 0 : Math.PI;
            }

            const veh = new Vehicle(type, x, z, heading, false);
            this.scene.add(veh.mesh);
            this.vehicles.push(veh);
        }
    }

    spawnInitialPedestrians() {
        const half = this.world.worldSize / 2 - 40;
        const clothesColors = ['#e74c3c', '#3498db', '#2ecc71', '#9b59b6', '#f39c12', '#1abc9c', '#34495e'];

        for (let i = 0; i < this.maxPedestrians; i++) {
            const pGroup = new THREE.Group();
            
            // Torso
            const tGeo = new THREE.BoxGeometry(0.5, 0.7, 0.35);
            const tMat = new THREE.MeshLambertMaterial({
                color: clothesColors[Math.floor(Math.random() * clothesColors.length)]
            });
            const torso = new THREE.Mesh(tGeo, tMat);
            torso.position.y = 1.05;
            pGroup.add(torso);

            // Head
            const hGeo = new THREE.BoxGeometry(0.32, 0.35, 0.32);
            const hMat = new THREE.MeshLambertMaterial({ color: '#f5cba7' });
            const head = new THREE.Mesh(hGeo, hMat);
            head.position.y = 1.62;
            pGroup.add(head);

            // Legs
            const lGeo = new THREE.BoxGeometry(0.18, 0.7, 0.18);
            const lMat = new THREE.MeshLambertMaterial({ color: '#2c3e50' });
            const leftLeg = new THREE.Mesh(lGeo, lMat);
            leftLeg.position.set(-0.14, 0.35, 0);
            pGroup.add(leftLeg);

            const rightLeg = new THREE.Mesh(lGeo, lMat);
            rightLeg.position.set(0.14, 0.35, 0);
            pGroup.add(rightLeg);

            // Position on sidewalk
            const rx = (Math.random() - 0.5) * half;
            const rz = (Math.random() - 0.5) * half;

            pGroup.position.set(rx, 0, rz);
            this.scene.add(pGroup);

            this.pedestrians.push({
                group: pGroup,
                x: rx,
                z: rz,
                heading: Math.random() * Math.PI * 2,
                speed: 1.8 + Math.random() * 1.5,
                animTime: Math.random() * 10,
                leftLeg: leftLeg,
                rightLeg: rightLeg
            });
        }
    }

    spawnPoliceCruiser(nearX, nearZ) {
        // Spawn police just offscreen behind or in front of player
        const angle = Math.random() * Math.PI * 2;
        const spawnX = nearX + Math.cos(angle) * 85;
        const spawnZ = nearZ + Math.sin(angle) * 85;

        const police = new Vehicle('police', spawnX, spawnZ, angle + Math.PI, false);
        this.scene.add(police);
        this.vehicles.push(police);
        return police;
    }

    update(dt, player, wantedLevel) {
        // Manage Police Pursuit
        const policeCars = this.vehicles.filter(v => v.type === 'police' && !v.isPlayer);
        if (wantedLevel > 0) {
            if (!this.policeChasing && window.soundSystem) {
                window.soundSystem.startSiren();
                this.policeChasing = true;
            }

            // Spawn police cruiser if none nearby
            if (policeCars.length < Math.min(wantedLevel, 3)) {
                this.spawnPoliceCruiser(player.x, player.z);
            }
        } else {
            if (this.policeChasing && window.soundSystem) {
                window.soundSystem.stopSiren();
                this.policeChasing = false;
            }
        }

        // Update Vehicles AI
        this.vehicles.forEach(veh => {
            if (veh.isPlayer) return; // Player vehicle updated in main loop

            const input = { forward: true, backward: false, left: false, right: false, handbrake: false };

            // Police AI targeting player
            if (veh.type === 'police' && wantedLevel > 0) {
                const dx = player.x - veh.x;
                const dz = player.z - veh.z;
                const targetAngle = Math.atan2(dx, dz);
                let angleDiff = targetAngle - veh.heading;
                while (angleDiff > Math.PI) angleDiff -= Math.PI * 2;
                while (angleDiff < -Math.PI) angleDiff += Math.PI * 2;

                if (angleDiff > 0.1) input.left = true;
                else if (angleDiff < -0.1) input.right = true;
                input.forward = true;

                // High pursuit speed
                veh.specs.maxSpeed = 120;
            } else {
                // Normal Civilian Traffic Logic
                // Raycast ahead for traffic collision avoidance
                let blocked = false;
                for (let other of this.vehicles) {
                    if (other === veh) continue;
                    const fwdX = veh.x + Math.sin(veh.heading) * 12;
                    const fwdZ = veh.z + Math.cos(veh.heading) * 12;
                    const dist = Math.hypot(other.x - fwdX, other.z - fwdZ);
                    if (dist < 6.5) {
                        blocked = true;
                        break;
                    }
                }

                if (blocked) {
                    input.forward = false;
                    input.backward = true; // Brake
                } else {
                    input.forward = true;
                }

                // Random intersection turning
                if (Math.random() < 0.008) {
                    if (Math.random() > 0.5) input.left = true;
                    else input.right = true;
                }
            }

            veh.update(dt, input, this.world);

            // Keep traffic vehicles around player (recycling far vehicles)
            const distToPlayer = Math.hypot(veh.x - player.x, veh.z - player.z);
            if (distToPlayer > 300) {
                const relocateAngle = Math.random() * Math.PI * 2;
                veh.x = player.x + Math.cos(relocateAngle) * 140;
                veh.z = player.z + Math.sin(relocateAngle) * 140;
                veh.speed = 25;
            }
        });

        // Update Pedestrians
        this.pedestrians.forEach(p => {
            // Check proximity to player or fast cars (flee reaction)
            const pDist = Math.hypot(p.x - player.x, p.z - player.z);
            let speed = p.speed;

            if (pDist < 8 && player.speed > 10) {
                // Flee from speeding vehicle/player!
                const fleeAngle = Math.atan2(p.x - player.x, p.z - player.z);
                p.heading = fleeAngle;
                speed *= 2.5; // sprint
            } else if (Math.random() < 0.01) {
                // Occasional wandering turn
                p.heading += (Math.random() - 0.5) * 1.5;
            }

            // Move
            p.x += Math.sin(p.heading) * speed * dt;
            p.z += Math.cos(p.heading) * speed * dt;

            // Animate walking legs
            p.animTime += dt * 8;
            const swing = Math.sin(p.animTime) * 0.5;
            p.leftLeg.rotation.x = swing;
            p.rightLeg.rotation.x = -swing;

            p.group.position.set(p.x, 0, p.z);
            p.group.rotation.y = p.heading;

            // Recycle far pedestrians
            if (pDist > 180) {
                const angle = Math.random() * Math.PI * 2;
                p.x = player.x + Math.cos(angle) * 70;
                p.z = player.z + Math.sin(angle) * 70;
            }
        });
    }
}

window.TrafficManager = TrafficManager;
