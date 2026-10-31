// vehicles.js - Procedural 3D Taiwanese Vehicles & Physics Engine
// Includes: Taiwan Scooter (機車), Taipei Yellow Taxi (計程車), Taiwan Blue Truck (中華小貨車), Police Cruiser (警車), Sports Car

class Vehicle {
    constructor(type, x, z, heading = 0, isPlayer = false) {
        this.type = type; // 'scooter', 'taxi', 'truck', 'police', 'sports'
        this.isPlayer = isPlayer;
        this.x = x;
        this.y = 0;
        this.z = z;
        this.heading = heading; // angle in radians
        this.speed = 0;
        this.steerAngle = 0;
        this.leanAngle = 0; // for scooters
        this.health = 100;
        this.isDrifting = false;

        // Vehicle specifications by type
        this.specs = {
            scooter: {
                maxSpeed: 75,
                accel: 28,
                brake: 45,
                steerSpeed: 3.2,
                maxSteer: 0.65,
                drag: 0.985,
                mass: 120,
                radius: 1.4,
                length: 2.2,
                width: 0.8
            },
            taxi: {
                maxSpeed: 105,
                accel: 30,
                brake: 50,
                steerSpeed: 2.6,
                maxSteer: 0.52,
                drag: 0.988,
                mass: 1400,
                radius: 2.4,
                length: 4.6,
                width: 1.9
            },
            truck: {
                maxSpeed: 85,
                accel: 20,
                brake: 40,
                steerSpeed: 2.0,
                maxSteer: 0.44,
                drag: 0.982,
                mass: 2200,
                radius: 2.8,
                length: 5.2,
                width: 2.1
            },
            police: {
                maxSpeed: 120,
                accel: 38,
                brake: 58,
                steerSpeed: 2.9,
                maxSteer: 0.55,
                drag: 0.990,
                mass: 1600,
                radius: 2.4,
                length: 4.8,
                width: 1.9
            },
            sports: {
                maxSpeed: 145,
                accel: 48,
                brake: 65,
                steerSpeed: 3.2,
                maxSteer: 0.58,
                drag: 0.992,
                mass: 1300,
                radius: 2.3,
                length: 4.5,
                width: 2.0
            }
        }[type] || {};

        this.wheels = [];
        this.sirenLights = [];
        this.mesh = this.buildMesh();
        this.mesh.position.set(this.x, this.y, this.z);
        this.mesh.rotation.y = this.heading;
    }

    buildMesh() {
        const group = new THREE.Group();

        switch (this.type) {
            case 'scooter':
                this.buildScooterMesh(group);
                break;
            case 'taxi':
                this.buildTaxiMesh(group);
                break;
            case 'truck':
                this.buildTruckMesh(group);
                break;
            case 'police':
                this.buildPoliceMesh(group);
                break;
            case 'sports':
                this.buildSportsMesh(group);
                break;
            default:
                this.buildTaxiMesh(group);
        }

        return group;
    }

    // --- Helper: Wheel Geometry ---
    createWheel(radius, width, rimColor = '#bdc3c7') {
        const wheelGroup = new THREE.Group();
        // Rubber tire
        const tireGeo = new THREE.CylinderGeometry(radius, radius, width, 14);
        const tireMat = new THREE.MeshLambertMaterial({ color: '#17202a' });
        const tire = new THREE.Mesh(tireGeo, tireMat);
        tire.rotation.z = Math.PI / 2;
        tire.castShadow = true;
        wheelGroup.add(tire);

        // Center hubcap / rim
        const rimGeo = new THREE.CylinderGeometry(radius * 0.6, radius * 0.6, width * 1.05, 10);
        const rimMat = new THREE.MeshStandardMaterial({ color: rimColor, metalness: 0.7, roughness: 0.3 });
        const rim = new THREE.Mesh(rimGeo, rimMat);
        rim.rotation.z = Math.PI / 2;
        wheelGroup.add(rim);

        return wheelGroup;
    }

    // --- Taiwan Scooter (經典機車) ---
    buildScooterMesh(group) {
        const scooterColor = '#e74c3c'; // Vibrant red/white scooter

        // Main chassis frame
        const frameGeo = new THREE.BoxGeometry(0.5, 0.45, 1.8);
        const frameMat = new THREE.MeshLambertMaterial({ color: scooterColor });
        const frame = new THREE.Mesh(frameGeo, frameMat);
        frame.position.y = 0.55;
        group.add(frame);

        // Footrest floorboard (踩踏板)
        const floorGeo = new THREE.BoxGeometry(0.7, 0.1, 0.9);
        const floorMat = new THREE.MeshLambertMaterial({ color: '#2c3e50' });
        const floor = new THREE.Mesh(floorGeo, floorMat);
        floor.position.set(0, 0.38, 0);
        group.add(floor);

        // Front shield apron (斜板車頭)
        const shieldGeo = new THREE.BoxGeometry(0.65, 0.75, 0.35);
        const shield = new THREE.Mesh(shieldGeo, frameMat);
        shield.position.set(0, 0.85, 0.7);
        shield.rotation.x = -0.2;
        group.add(shield);

        // Handlebars (龍頭)
        const barGeo = new THREE.BoxGeometry(0.85, 0.1, 0.12);
        const barMat = new THREE.MeshLambertMaterial({ color: '#2c3e50' });
        const bar = new THREE.Mesh(barGeo, barMat);
        bar.position.set(0, 1.25, 0.65);
        group.add(bar);

        // Dual rearview mirrors (照後鏡)
        [-0.42, 0.42].forEach(ox => {
            const stemGeo = new THREE.CylinderGeometry(0.02, 0.02, 0.22, 6);
            const stem = new THREE.Mesh(stemGeo, barMat);
            stem.position.set(ox, 1.35, 0.65);
            group.add(stem);

            const mirrorGeo = new THREE.BoxGeometry(0.12, 0.08, 0.04);
            const mirrorMat = new THREE.MeshStandardMaterial({ color: '#bdc3c7', metalness: 0.9 });
            const mirror = new THREE.Mesh(mirrorGeo, mirrorMat);
            mirror.position.set(ox, 1.45, 0.65);
            group.add(mirror);
        });

        // Bright LED headlight
        const headLightGeo = new THREE.BoxGeometry(0.25, 0.15, 0.08);
        const headLightMat = new THREE.MeshBasicMaterial({ color: '#ffffd0' });
        const headLight = new THREE.Mesh(headLightGeo, headLightMat);
        headLight.position.set(0, 1.25, 0.73);
        group.add(headLight);

        // Dual rider seat (坐墊)
        const seatGeo = new THREE.BoxGeometry(0.48, 0.2, 1.0);
        const seatMat = new THREE.MeshLambertMaterial({ color: '#17202a' });
        const seat = new THREE.Mesh(seatGeo, seatMat);
        seat.position.set(0, 0.85, -0.3);
        group.add(seat);

        // Rear grab bar / license plate
        const plateGeo = new THREE.BoxGeometry(0.3, 0.2, 0.02);
        const plateMat = new THREE.MeshBasicMaterial({ color: '#ffffff' });
        const plate = new THREE.Mesh(plateGeo, plateMat);
        plate.position.set(0, 0.5, -0.92);
        group.add(plate);

        // Dual wheels (Front & Rear)
        const wFront = this.createWheel(0.28, 0.14);
        wFront.position.set(0, 0.28, 0.8);
        group.add(wFront);
        this.wheels.push(wFront);

        const wRear = this.createWheel(0.28, 0.14);
        wRear.position.set(0, 0.28, -0.75);
        group.add(wRear);
        this.wheels.push(wRear);
    }

    // --- Taipei Yellow Taxi (經典小黃計程車) ---
    buildTaxiMesh(group) {
        const taxiYellow = '#f4d03f'; // Taiwan Taxi Yellow

        // Lower Chassis
        const bodyGeo = new THREE.BoxGeometry(1.9, 0.75, 4.5);
        const bodyMat = new THREE.MeshLambertMaterial({ color: taxiYellow });
        const body = new THREE.Mesh(bodyGeo, bodyMat);
        body.position.y = 0.65;
        body.castShadow = true;
        group.add(body);

        // Cabin / Roof (with windshield rake)
        const cabinGeo = new THREE.BoxGeometry(1.7, 0.75, 2.3);
        const cabinMat = new THREE.MeshLambertMaterial({ color: taxiYellow });
        const cabin = new THREE.Mesh(cabinGeo, cabinMat);
        cabin.position.set(0, 1.35, -0.2);
        group.add(cabin);

        // Glass Windows (Tinted)
        const glassMat = new THREE.MeshLambertMaterial({ color: '#1b2631' });
        // Front windshield
        const windGeo = new THREE.BoxGeometry(1.6, 0.6, 0.1);
        const wind = new THREE.Mesh(windGeo, glassMat);
        wind.position.set(0, 1.3, 0.96);
        wind.rotation.x = 0.35;
        group.add(wind);

        // Rear window
        const rearWind = new THREE.Mesh(windGeo, glassMat);
        rearWind.position.set(0, 1.3, -1.36);
        rearWind.rotation.x = -0.35;
        group.add(rearWind);

        // Iconic Roof "TAXI / 計程車" Sign
        const signGeo = new THREE.BoxGeometry(0.85, 0.22, 0.4);
        const signMat = new THREE.MeshBasicMaterial({ color: '#ffffff' });
        const sign = new THREE.Mesh(signGeo, signMat);
        sign.position.set(0, 1.82, -0.2);
        group.add(sign);

        // Taxi roof light text plate
        const redBarGeo = new THREE.BoxGeometry(0.7, 0.08, 0.42);
        const redBarMat = new THREE.MeshBasicMaterial({ color: '#e74c3c' });
        const redBar = new THREE.Mesh(redBarGeo, redBarMat);
        redBar.position.set(0, 1.82, -0.2);
        group.add(redBar);

        // Headlights & Taillights
        const hlGeo = new THREE.BoxGeometry(0.35, 0.2, 0.1);
        const hlMat = new THREE.MeshBasicMaterial({ color: '#ffffd0' });
        const tlMat = new THREE.MeshBasicMaterial({ color: '#e74c3c' });
        [-0.7, 0.7].forEach(ox => {
            const hl = new THREE.Mesh(hlGeo, hlMat);
            hl.position.set(ox, 0.75, 2.26);
            group.add(hl);

            const tl = new THREE.Mesh(hlGeo, tlMat);
            tl.position.set(ox, 0.75, -2.26);
            group.add(tl);
        });

        // 4 Wheels
        const wheelOffsets = [
            { x: -0.92, z: 1.35 },
            { x: 0.92, z: 1.35 },
            { x: -0.92, z: -1.35 },
            { x: 0.92, z: -1.35 }
        ];

        wheelOffsets.forEach(wo => {
            const w = this.createWheel(0.38, 0.24);
            w.position.set(wo.x, 0.38, wo.z);
            group.add(w);
            this.wheels.push(w);
        });
    }

    // --- Taiwan Blue Small Truck (中華菱利小貨車) ---
    buildTruckMesh(group) {
        const truckBlue = '#1e88e5'; // Classic Taiwan Blue Cab

        // Front Driver Cab
        const cabGeo = new THREE.BoxGeometry(2.0, 1.45, 1.8);
        const cabMat = new THREE.MeshLambertMaterial({ color: truckBlue });
        const cab = new THREE.Mesh(cabGeo, cabMat);
        cab.position.set(0, 1.15, 1.4);
        cab.castShadow = true;
        group.add(cab);

        // Windshield
        const windGeo = new THREE.BoxGeometry(1.8, 0.7, 0.1);
        const windMat = new THREE.MeshLambertMaterial({ color: '#17202a' });
        const wind = new THREE.Mesh(windGeo, windMat);
        wind.position.set(0, 1.35, 2.31);
        group.add(wind);

        // Rear Flatbed Cargo Box (木紋貨斗)
        const bedGeo = new THREE.BoxGeometry(2.1, 0.35, 3.2);
        const bedMat = new THREE.MeshLambertMaterial({ color: '#795548' }); // Wood slat bed
        const bed = new THREE.Mesh(bedGeo, bedMat);
        bed.position.set(0, 0.85, -1.05);
        bed.castShadow = true;
        group.add(bed);

        // Cargo Side Rails
        const railGeo = new THREE.BoxGeometry(0.1, 0.5, 3.2);
        const railMat = new THREE.MeshLambertMaterial({ color: truckBlue });
        [-1.02, 1.02].forEach(ox => {
            const rail = new THREE.Mesh(railGeo, railMat);
            rail.position.set(ox, 1.25, -1.05);
            group.add(rail);
        });

        // 4 Heavy Wheels
        const wheelOffsets = [
            { x: -0.95, z: 1.4 },
            { x: 0.95, z: 1.4 },
            { x: -0.95, z: -1.3 },
            { x: 0.95, z: -1.3 }
        ];

        wheelOffsets.forEach(wo => {
            const w = this.createWheel(0.42, 0.28, '#7f8c8d');
            w.position.set(wo.x, 0.42, wo.z);
            group.add(w);
            this.wheels.push(w);
        });
    }

    // --- Police Cruiser (警車) ---
    buildPoliceMesh(group) {
        // Base Sedan Body
        const bodyGeo = new THREE.BoxGeometry(1.9, 0.75, 4.6);
        const bodyMat = new THREE.MeshLambertMaterial({ color: '#ffffff' });
        const body = new THREE.Mesh(bodyGeo, bodyMat);
        body.position.y = 0.65;
        body.castShadow = true;
        group.add(body);

        // Black Hood and Trunk (Taiwan Police Livery)
        const blackGeo = new THREE.BoxGeometry(1.88, 0.1, 1.3);
        const blackMat = new THREE.MeshLambertMaterial({ color: '#17202a' });
        const hood = new THREE.Mesh(blackGeo, blackMat);
        hood.position.set(0, 1.03, 1.4);
        group.add(hood);

        const trunk = new THREE.Mesh(blackGeo, blackMat);
        trunk.position.set(0, 1.03, -1.4);
        group.add(trunk);

        // Cabin
        const cabinGeo = new THREE.BoxGeometry(1.7, 0.75, 2.2);
        const cabinMat = new THREE.MeshLambertMaterial({ color: '#ffffff' });
        const cabin = new THREE.Mesh(cabinGeo, cabinMat);
        cabin.position.set(0, 1.35, -0.15);
        group.add(cabin);

        // Roof Emergency Lightbar (紅藍警示燈)
        const barGeo = new THREE.BoxGeometry(1.2, 0.15, 0.35);
        const barMat = new THREE.MeshBasicMaterial({ color: '#ffffff' });
        const lightbar = new THREE.Mesh(barGeo, barMat);
        lightbar.position.set(0, 1.8, -0.15);
        group.add(lightbar);

        // Red Light (Left) & Blue Light (Right)
        const redGeo = new THREE.BoxGeometry(0.5, 0.18, 0.36);
        const redMat = new THREE.MeshBasicMaterial({ color: '#ff0033' });
        const redLight = new THREE.Mesh(redGeo, redMat);
        redLight.position.set(-0.35, 1.82, -0.15);
        group.add(redLight);

        const blueGeo = new THREE.BoxGeometry(0.5, 0.18, 0.36);
        const blueMat = new THREE.MeshBasicMaterial({ color: '#0066ff' });
        const blueLight = new THREE.Mesh(blueGeo, blueMat);
        blueLight.position.set(0.35, 1.82, -0.15);
        group.add(blueLight);

        this.sirenLights.push(redLight, blueLight);

        // 4 Wheels
        const wheelOffsets = [
            { x: -0.92, z: 1.35 },
            { x: 0.92, z: 1.35 },
            { x: -0.92, z: -1.35 },
            { x: 0.92, z: -1.35 }
        ];

        wheelOffsets.forEach(wo => {
            const w = this.createWheel(0.38, 0.24, '#2c3e50');
            w.position.set(wo.x, 0.38, wo.z);
            group.add(w);
            this.wheels.push(w);
        });
    }

    // --- Sports Car (超跑) ---
    buildSportsMesh(group) {
        const sportsColor = '#e74c3c';

        // Wedge Body
        const bodyGeo = new THREE.BoxGeometry(2.0, 0.55, 4.5);
        const bodyMat = new THREE.MeshStandardMaterial({ color: sportsColor, metalness: 0.6, roughness: 0.2 });
        const body = new THREE.Mesh(bodyGeo, bodyMat);
        body.position.y = 0.5;
        body.castShadow = true;
        group.add(body);

        // Slanted Cockpit
        const cockGeo = new THREE.BoxGeometry(1.6, 0.5, 2.0);
        const cockMat = new THREE.MeshStandardMaterial({ color: '#17202a', roughness: 0.1 });
        const cock = new THREE.Mesh(cockGeo, cockMat);
        cock.position.set(0, 1.0, -0.2);
        group.add(cock);

        // Aerodynamic Rear Wing / Spoiler
        const wingGeo = new THREE.BoxGeometry(1.8, 0.08, 0.4);
        const wingMat = new THREE.MeshLambertMaterial({ color: '#17202a' });
        const wing = new THREE.Mesh(wingGeo, wingMat);
        wing.position.set(0, 1.15, -2.1);
        group.add(wing);

        [-0.7, 0.7].forEach(ox => {
            const pGeo = new THREE.CylinderGeometry(0.04, 0.04, 0.3, 6);
            const p = new THREE.Mesh(pGeo, wingMat);
            p.position.set(ox, 0.95, -2.1);
            group.add(p);
        });

        // 4 Sports Wheels with Alloy Rims
        const wheelOffsets = [
            { x: -0.95, z: 1.35 },
            { x: 0.95, z: 1.35 },
            { x: -0.95, z: -1.35 },
            { x: 0.95, z: -1.35 }
        ];

        wheelOffsets.forEach(wo => {
            const w = this.createWheel(0.36, 0.26, '#f39c12');
            w.position.set(wo.x, 0.36, wo.z);
            group.add(w);
            this.wheels.push(w);
        });
    }

    // --- Physics Update ---
    update(dt, input, world) {
        if (!this.specs) return;

        // Acceleration & Braking
        if (input.forward) {
            this.speed += this.specs.accel * dt;
            if (this.speed > this.specs.maxSpeed) this.speed = this.specs.maxSpeed;
        } else if (input.backward) {
            this.speed -= this.specs.brake * dt * 0.7;
            if (this.speed < -this.specs.maxSpeed * 0.4) this.speed = -this.specs.maxSpeed * 0.4;
        } else {
            // Natural coasting drag
            this.speed *= Math.pow(this.specs.drag, dt * 60);
            if (Math.abs(this.speed) < 0.5) this.speed = 0;
        }

        // Handbrake Drift
        this.isDrifting = false;
        let effectiveSteerSpeed = this.specs.steerSpeed;
        if (input.handbrake && Math.abs(this.speed) > 15) {
            this.isDrifting = true;
            this.speed *= 0.97; // drift scrubbing speed
            effectiveSteerSpeed *= 1.8;
            if (window.soundSystem && this.isPlayer && Math.random() > 0.6) {
                window.soundSystem.playTireScreech();
            }
        }

        // Steering Angle Interpolation
        if (input.left) {
            this.steerAngle += effectiveSteerSpeed * dt;
            if (this.steerAngle > this.specs.maxSteer) this.steerAngle = this.specs.maxSteer;
        } else if (input.right) {
            this.steerAngle -= effectiveSteerSpeed * dt;
            if (this.steerAngle < -this.specs.maxSteer) this.steerAngle = -this.specs.maxSteer;
        } else {
            // Return to center
            this.steerAngle *= Math.pow(0.85, dt * 60);
            if (Math.abs(this.steerAngle) < 0.01) this.steerAngle = 0;
        }

        // Turn heading based on speed and steer angle (Ackermann approximation)
        if (Math.abs(this.speed) > 0.1) {
            const turnRate = (this.speed / this.specs.length) * Math.tan(this.steerAngle);
            this.heading += turnRate * dt;
        }

        // Calculate potential new position
        const vx = Math.sin(this.heading) * this.speed * dt;
        const vz = Math.cos(this.heading) * this.speed * dt;
        const nextX = this.x + vx;
        const nextZ = this.z + vz;

        // Collision Check against world buildings
        if (world && world.checkCollision(nextX, nextZ, this.specs.radius)) {
            // Rebound bounce
            this.speed = -this.speed * 0.35;
            this.health = Math.max(0, this.health - Math.abs(this.speed) * 0.2);
            if (window.soundSystem && this.isPlayer) {
                window.soundSystem.playCrash();
            }
        } else {
            this.x = nextX;
            this.z = nextZ;
        }

        // Scooter Lean Dynamics
        if (this.type === 'scooter') {
            const targetLean = -this.steerAngle * (Math.abs(this.speed) / this.specs.maxSpeed) * 0.7;
            this.leanAngle += (targetLean - this.leanAngle) * dt * 10;
            this.mesh.rotation.z = this.leanAngle;
        }

        // Update 3D Transform
        this.mesh.position.set(this.x, 0, this.z);
        this.mesh.rotation.y = this.heading;

        // Animate Wheels Spin & Front Steer
        const wheelSpin = (this.speed * dt) / (this.wheels[0] ? 0.35 : 1);
        this.wheels.forEach((w, idx) => {
            w.children[0].rotation.x += wheelSpin;
            // Front wheels turn with steer
            if (idx < 2 && this.type !== 'scooter') {
                w.rotation.y = this.steerAngle;
            } else if (idx === 0 && this.type === 'scooter') {
                w.rotation.y = this.steerAngle;
            }
        });

        // Flash Police Sirens
        if (this.type === 'police' && this.sirenLights.length === 2) {
            const strobe = Math.floor(Date.now() / 150) % 2;
            this.sirenLights[0].material.color.setHex(strobe === 0 ? 0xff0033 : 0x330000);
            this.sirenLights[1].material.color.setHex(strobe === 1 ? 0x0066ff : 0x000033);
        }
    }
}

window.Vehicle = Vehicle;
