// player.js - 3D Player Character, Procedural Animations, and On-Foot Mechanics

class Player {
    constructor(scene, x = 0, z = 60) {
        this.scene = scene;
        this.x = x;
        this.y = 0;
        this.z = z;
        this.heading = 0;
        this.speed = 0;
        this.walkSpeed = 6.0;
        this.runSpeed = 12.0;
        this.health = 100;
        this.money = 2500;
        this.wantedLevel = 0;
        this.inVehicle = false;
        this.currentVehicle = null;

        // Procedural Animation State
        this.animTime = 0;
        this.isMoving = false;
        this.isAttacking = false;
        this.attackCooldown = 0;

        this.mesh = this.buildCharacterMesh();
        this.mesh.position.set(this.x, 0, this.z);
        this.scene.add(this.mesh);
    }

    buildCharacterMesh() {
        const group = new THREE.Group();

        // 1. Torso / Jacket (Cool Taiwanese streetwear bomber jacket)
        const torsoGeo = new THREE.BoxGeometry(0.7, 0.9, 0.45);
        const torsoMat = new THREE.MeshLambertMaterial({ color: '#2c3e50' }); // Dark navy jacket
        const torso = new THREE.Mesh(torsoGeo, torsoMat);
        torso.position.y = 1.25;
        torso.castShadow = true;
        group.add(torso);

        // 2. Head & Face
        const headGeo = new THREE.BoxGeometry(0.4, 0.45, 0.4);
        const skinMat = new THREE.MeshLambertMaterial({ color: '#f5cba7' });
        const head = new THREE.Mesh(headGeo, skinMat);
        head.position.y = 1.95;
        head.castShadow = true;
        group.add(head);

        // Stylish Hair / Cap
        const hairGeo = new THREE.BoxGeometry(0.44, 0.2, 0.44);
        const hairMat = new THREE.MeshLambertMaterial({ color: '#17202a' });
        const hair = new THREE.Mesh(hairGeo, hairMat);
        hair.position.y = 2.12;
        group.add(hair);

        // Sunglasses (GTA style!)
        const shadesGeo = new THREE.BoxGeometry(0.38, 0.1, 0.1);
        const shadesMat = new THREE.MeshBasicMaterial({ color: '#000000' });
        const shades = new THREE.Mesh(shadesGeo, shadesMat);
        shades.position.set(0, 1.98, 0.22);
        group.add(shades);

        // 3. Limbs (Arms & Legs for procedural animation)
        const limbMat = new THREE.MeshLambertMaterial({ color: '#34495e' });
        const legMat = new THREE.MeshLambertMaterial({ color: '#1f618d' }); // Denim jeans

        // Left & Right Arms
        const armGeo = new THREE.BoxGeometry(0.18, 0.7, 0.18);
        this.leftArm = new THREE.Mesh(armGeo, limbMat);
        this.leftArm.position.set(-0.46, 1.2, 0);
        group.add(this.leftArm);

        this.rightArm = new THREE.Mesh(armGeo, limbMat);
        this.rightArm.position.set(0.46, 1.2, 0);
        group.add(this.rightArm);

        // Left & Right Legs
        const legGeo = new THREE.BoxGeometry(0.24, 0.85, 0.24);
        this.leftLeg = new THREE.Mesh(legGeo, legMat);
        this.leftLeg.position.set(-0.2, 0.45, 0);
        this.leftLeg.castShadow = true;
        group.add(this.leftLeg);

        this.rightLeg = new THREE.Mesh(legGeo, legMat);
        this.rightLeg.position.set(0.2, 0.45, 0);
        this.rightLeg.castShadow = true;
        group.add(this.rightLeg);

        return group;
    }

    update(dt, input, world, cameraHeading = 0) {
        if (this.inVehicle) {
            this.mesh.visible = false;
            if (this.currentVehicle) {
                this.x = this.currentVehicle.x;
                this.z = this.currentVehicle.z;
                this.heading = this.currentVehicle.heading;
                this.mesh.position.set(this.x, 0, this.z);
            }
            return;
        }

        this.mesh.visible = true;

        // Calculate Movement Vector relative to camera orientation
        let moveX = 0;
        let moveZ = 0;

        if (input.forward) moveZ += 1;
        if (input.backward) moveZ -= 1;
        if (input.left) moveX -= 1;
        if (input.right) moveX += 1;

        const len = Math.hypot(moveX, moveZ);
        this.isMoving = len > 0.01;

        if (this.isMoving) {
            // Normalize direction
            moveX /= len;
            moveZ /= len;

            // Rotate direction by camera heading
            const cosCam = Math.cos(cameraHeading);
            const sinCam = Math.sin(cameraHeading);
            const worldDirX = moveX * cosCam + moveZ * sinCam;
            const worldDirZ = -moveX * sinCam + moveZ * cosCam;

            // Smooth heading rotation towards movement direction
            const targetHeading = Math.atan2(worldDirX, worldDirZ);
            this.heading = targetHeading;

            const currentSpeed = input.sprint ? this.runSpeed : this.walkSpeed;
            const nextX = this.x + worldDirX * currentSpeed * dt;
            const nextZ = this.z + worldDirZ * currentSpeed * dt;

            // Collision check against city buildings
            if (!world.checkCollision(nextX, nextZ, 0.6)) {
                this.x = nextX;
                this.z = nextZ;
            }

            // Procedural walking/running animation
            this.animTime += dt * (input.sprint ? 14 : 9);
            const swing = Math.sin(this.animTime) * (input.sprint ? 0.8 : 0.5);

            this.leftLeg.rotation.x = swing;
            this.rightLeg.rotation.x = -swing;
            this.leftArm.rotation.x = -swing * 0.9;
            this.rightArm.rotation.x = swing * 0.9;
        } else {
            // Idle stance
            this.leftLeg.rotation.x *= 0.8;
            this.rightLeg.rotation.x *= 0.8;
            this.leftArm.rotation.x *= 0.8;
            this.rightArm.rotation.x *= 0.8;
        }

        // Punching / Attack Action
        if (this.attackCooldown > 0) this.attackCooldown -= dt;
        if (input.action && this.attackCooldown <= 0) {
            this.isAttacking = true;
            this.attackCooldown = 0.35;
            this.rightArm.rotation.x = -1.6; // Punch punch!
            if (window.soundSystem) window.soundSystem.playHorn(true); // Action sound
        }

        this.mesh.position.set(this.x, 0, this.z);
        this.mesh.rotation.y = this.heading;
    }

    tryEnterVehicle(vehicles) {
        if (this.inVehicle) {
            // Exit current vehicle
            if (this.currentVehicle) {
                // Eject to the left side
                this.x = this.currentVehicle.x - Math.cos(this.currentVehicle.heading) * 2.2;
                this.z = this.currentVehicle.z + Math.sin(this.currentVehicle.heading) * 2.2;
                this.currentVehicle.isPlayer = false;
                this.currentVehicle = null;
            }
            this.inVehicle = false;
            this.mesh.visible = true;
            if (window.soundSystem) window.soundSystem.stopEngine();
            return { action: 'exit' };
        } else {
            // Search for nearest vehicle within 4.5 meters
            let nearest = null;
            let minDist = 4.5;

            vehicles.forEach(v => {
                const dist = Math.hypot(v.x - this.x, v.z - this.z);
                if (dist < minDist) {
                    minDist = dist;
                    nearest = v;
                }
            });

            if (nearest) {
                this.inVehicle = true;
                this.currentVehicle = nearest;
                nearest.isPlayer = true;
                this.mesh.visible = false;
                if (window.soundSystem) {
                    window.soundSystem.startEngine(nearest.type);
                }
                return { action: 'enter', vehicle: nearest };
            }
            return { action: 'none' };
        }
    }
}

window.Player = Player;
