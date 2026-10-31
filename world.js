// world.js - Procedural 3D Taipei City Generator for Three.js
// Features iconic Taipei architecture, Taipei 101, Taiwanese neon signboards, and authentic street layouts.

class TaipeiWorld {
    constructor(scene) {
        this.scene = scene;
        this.buildings = [];
        this.colliders = [];
        this.roads = [];
        this.intersections = [];
        this.trafficLights = [];
        this.neonSigns = [];
        this.streetLights = [];
        this.worldSize = 1200; // 1200m x 1200m city
        this.blockSize = 120; // 120m block
        this.roadWidth = 24;  // 24m wide avenues
        
        // Materials cache
        this.materials = {};
        this.textures = {};
    }

    init() {
        this.initTextures();
        this.createGround();
        this.createRoadGrid();
        this.createTaipei101(0, 0); // Landmark at city center
        this.populateCityBlocks();
        this.createNightMarketAlley();
        this.createStreetFurniture();
    }

    initTextures() {
        // Procedural Asphalt Road with Scooter Stop Zone (機車停等區)
        const roadCanvas = document.createElement('canvas');
        roadCanvas.width = 512;
        roadCanvas.height = 512;
        const rctx = roadCanvas.getContext('2d');

        // Dark asphalt background with subtle noise
        rctx.fillStyle = '#22252a';
        rctx.fillRect(0, 0, 512, 512);
        for (let i = 0; i < 4000; i++) {
            const v = Math.random() * 25 + 30;
            rctx.fillStyle = `rgba(${v},${v},${v},0.08)`;
            rctx.fillRect(Math.random() * 512, Math.random() * 512, 2, 2);
        }

        // White edge lines
        rctx.fillStyle = '#ffffff';
        rctx.fillRect(20, 0, 6, 512);
        rctx.fillRect(486, 0, 6, 512);

        // Dashed center yellow line
        rctx.fillStyle = '#f5b041';
        rctx.setLineDash([40, 30]);
        rctx.lineWidth = 6;
        rctx.beginPath();
        rctx.moveTo(256, 0);
        rctx.lineTo(256, 512);
        rctx.stroke();
        rctx.setLineDash([]);

        // White lane dashes
        rctx.fillStyle = '#ffffff';
        rctx.setLineDash([30, 30]);
        rctx.lineWidth = 4;
        rctx.beginPath();
        rctx.moveTo(138, 0);
        rctx.lineTo(138, 512);
        rctx.moveTo(374, 0);
        rctx.lineTo(374, 512);
        rctx.stroke();
        rctx.setLineDash([]);

        // Taiwan Scooter Waiting Zone Box (機車停等區)
        rctx.strokeStyle = '#f4d03f';
        rctx.lineWidth = 8;
        rctx.strokeRect(50, 340, 180, 140);
        rctx.fillStyle = '#f4d03f';
        rctx.font = 'bold 20px "PingFang TC", "Microsoft JhengHei", sans-serif';
        rctx.textAlign = 'center';
        rctx.fillText('機車停等區', 140, 420);

        this.textures.road = new THREE.CanvasTexture(roadCanvas);
        this.textures.road.wrapS = THREE.RepeatWrapping;
        this.textures.road.wrapT = THREE.RepeatWrapping;

        // Sidewalk Tiled Texture
        const swCanvas = document.createElement('canvas');
        swCanvas.width = 256;
        swCanvas.height = 256;
        const swctx = swCanvas.getContext('2d');
        swctx.fillStyle = '#bdc3c7';
        swctx.fillRect(0, 0, 256, 256);
        swctx.strokeStyle = '#7f8c8d';
        swctx.lineWidth = 2;
        for (let x = 0; x <= 256; x += 32) {
            swctx.beginPath();
            swctx.moveTo(x, 0);
            swctx.lineTo(x, 256);
            swctx.stroke();
        }
        for (let y = 0; y <= 256; y += 32) {
            swctx.beginPath();
            swctx.moveTo(0, y);
            swctx.lineTo(256, y);
            swctx.stroke();
        }
        this.textures.sidewalk = new THREE.CanvasTexture(swCanvas);
        this.textures.sidewalk.wrapS = THREE.RepeatWrapping;
        this.textures.sidewalk.wrapT = THREE.RepeatWrapping;
        this.textures.sidewalk.repeat.set(4, 4);

        // Building Facade Texture with Windows and AC Units
        this.textures.buildingFacades = [];
        const buildingColors = ['#d5dbdb', '#f5cba7', '#aed6f1', '#d2b4de', '#f9e79f'];
        buildingColors.forEach(bgCol => {
            const bCanvas = document.createElement('canvas');
            bCanvas.width = 256;
            bCanvas.height = 256;
            const bctx = bCanvas.getContext('2d');
            bctx.fillStyle = bgCol;
            bctx.fillRect(0, 0, 256, 256);

            // Windows grid
            for (let y = 16; y < 240; y += 48) {
                for (let x = 16; x < 240; x += 40) {
                    const isLit = Math.random() > 0.4;
                    bctx.fillStyle = isLit ? '#fef9e7' : '#2c3e50';
                    bctx.fillRect(x, y, 24, 30);
                    bctx.strokeStyle = '#1a252f';
                    bctx.lineWidth = 2;
                    bctx.strokeRect(x, y, 24, 30);

                    // Outdoor AC Unit (Taiwanese trademark!)
                    if (Math.random() > 0.5) {
                        bctx.fillStyle = '#ecf0f1';
                        bctx.fillRect(x + 2, y + 32, 16, 10);
                        bctx.strokeStyle = '#7f8c8d';
                        bctx.strokeRect(x + 2, y + 32, 16, 10);
                        bctx.fillStyle = '#34495e';
                        bctx.fillRect(x + 12, y + 34, 4, 6);
                    }
                }
            }
            const bTex = new THREE.CanvasTexture(bCanvas);
            bTex.wrapS = THREE.RepeatWrapping;
            bTex.wrapT = THREE.RepeatWrapping;
            this.textures.buildingFacades.push(bTex);
        });

        // Generate Neon Sign Textures
        this.neonConfigs = [
            { title: '7-ELEVEN', sub: '便利商店', bg: '#00843D', accent: '#E8112D', textCol: '#FFFFFF' },
            { title: '全家 FamilyMart', sub: '全家就是你家', bg: '#009944', accent: '#0070BA', textCol: '#FFFFFF' },
            { title: '50嵐 珍珠奶茶', sub: '鮮茶專賣連鎖', bg: '#FFD700', accent: '#0055A5', textCol: '#0055A5' },
            { title: '鼎泰豐 小籠包', sub: '台灣第一名點', bg: '#C0392B', accent: '#F1C40F', textCol: '#FFFFFF' },
            { title: '豪大大雞排', sub: '士林夜市創始店', bg: '#D35400', accent: '#F39C12', textCol: '#FFFFFF' },
            { title: '永和豆漿大王', sub: '燒餅油條 溫熱豆漿', bg: '#8E44AD', accent: '#E74C3C', textCol: '#FFFFFF' },
            { title: 'SYM 三陽機車', sub: '維修 保養 道路救援', bg: '#2980B9', accent: '#E74C3C', textCol: '#FFFFFF' },
            { title: '阿宗麵線', sub: '西門町名物 柴魚高湯', bg: '#A93226', accent: '#F4D03F', textCol: '#FFFFFF' }
        ];

        this.textures.neonSigns = this.neonConfigs.map(cfg => {
            const nCanvas = document.createElement('canvas');
            nCanvas.width = 256;
            nCanvas.height = 128;
            const nctx = nCanvas.getContext('2d');

            nctx.fillStyle = cfg.bg;
            nctx.fillRect(0, 0, 256, 128);

            nctx.fillStyle = cfg.accent;
            nctx.fillRect(0, 0, 256, 18);
            nctx.fillRect(0, 110, 256, 18);

            nctx.fillStyle = cfg.textCol;
            nctx.font = 'bold 26px "PingFang TC", "Microsoft JhengHei", sans-serif';
            nctx.textAlign = 'center';
            nctx.textBaseline = 'middle';
            nctx.fillText(cfg.title, 128, 55);

            nctx.font = '14px "PingFang TC", "Microsoft JhengHei", sans-serif';
            nctx.fillText(cfg.sub, 128, 88);

            // Outer glowing border
            nctx.strokeStyle = '#FFFFFF';
            nctx.lineWidth = 4;
            nctx.strokeRect(4, 4, 248, 120);

            const tex = new THREE.CanvasTexture(nCanvas);
            return { texture: tex, color: cfg.accent };
        });
    }

    createGround() {
        const groundGeo = new THREE.PlaneGeometry(this.worldSize * 1.5, this.worldSize * 1.5);
        const groundMat = new THREE.MeshLambertMaterial({ color: '#273746' });
        const ground = new THREE.Mesh(groundGeo, groundMat);
        ground.rotation.x = -Math.PI / 2;
        ground.position.y = -0.1;
        ground.receiveShadow = true;
        this.scene.add(ground);
    }

    createRoadGrid() {
        const halfSize = this.worldSize / 2;
        const roadStep = this.blockSize + this.roadWidth;
        const roadMaterial = new THREE.MeshLambertMaterial({
            map: this.textures.road,
            roughness: 0.8
        });

        // Longitudinal & Latitudinal avenues
        for (let p = -halfSize + roadStep / 2; p <= halfSize; p += roadStep) {
            // Skip center block for Taipei 101 plaza
            // X-direction roads (East-West)
            const roadXGeo = new THREE.PlaneGeometry(this.worldSize, this.roadWidth);
            const roadX = new THREE.Mesh(roadXGeo, roadMaterial);
            roadX.rotation.x = -Math.PI / 2;
            roadX.rotation.z = Math.PI / 2;
            roadX.position.set(0, 0.05, p);
            roadX.receiveShadow = true;
            this.scene.add(roadX);
            this.roads.push({ axis: 'x', z: p, width: this.roadWidth });

            // Z-direction roads (North-South)
            const roadZGeo = new THREE.PlaneGeometry(this.worldSize, this.roadWidth);
            const roadZ = new THREE.Mesh(roadZGeo, roadMaterial);
            roadZ.rotation.x = -Math.PI / 2;
            roadZ.position.set(p, 0.05, 0);
            roadZ.receiveShadow = true;
            this.scene.add(roadZ);
            this.roads.push({ axis: 'z', x: p, width: this.roadWidth });

            // Collect intersections
            for (let q = -halfSize + roadStep / 2; q <= halfSize; q += roadStep) {
                this.intersections.push({ x: p, z: q });
                this.createIntersectionLights(p, q);
            }
        }
    }

    createIntersectionLights(x, z) {
        // 4 corner traffic light poles
        const offsets = [
            { dx: 14, dz: 14, rot: 0 },
            { dx: -14, dz: 14, rot: Math.PI / 2 },
            { dx: -14, dz: -14, rot: Math.PI },
            { dx: 14, dz: -14, rot: -Math.PI / 2 }
        ];

        offsets.forEach(off => {
            const poleGeo = new THREE.CylinderGeometry(0.2, 0.2, 6, 8);
            const poleMat = new THREE.MeshLambertMaterial({ color: '#2c3e50' });
            const pole = new THREE.Mesh(poleGeo, poleMat);
            pole.position.set(x + off.dx, 3, z + off.dz);
            this.scene.add(pole);

            // Overhead arm
            const armGeo = new THREE.BoxGeometry(4, 0.2, 0.2);
            const arm = new THREE.Mesh(armGeo, poleMat);
            arm.position.set(x + off.dx - Math.sign(off.dx) * 2, 5.8, z + off.dz);
            this.scene.add(arm);

            // Signal housing
            const boxGeo = new THREE.BoxGeometry(0.8, 1.8, 0.6);
            const boxMat = new THREE.MeshLambertMaterial({ color: '#17202a' });
            const box = new THREE.Mesh(boxGeo, boxMat);
            box.position.set(x + off.dx - Math.sign(off.dx) * 3.5, 5.2, z + off.dz);
            this.scene.add(box);

            // Green/Red light emissive circles
            const lightGeo = new THREE.SphereGeometry(0.25, 8, 8);
            const greenMat = new THREE.MeshBasicMaterial({ color: '#2ecc71' });
            const gLight = new THREE.Mesh(lightGeo, greenMat);
            gLight.position.set(x + off.dx - Math.sign(off.dx) * 3.5, 4.7, z + off.dz + 0.32);
            this.scene.add(gLight);
        });
    }

    createTaipei101(centerX, centerZ) {
        const group = new THREE.Group();
        group.position.set(centerX, 0, centerZ);

        // Plaza Base
        const plazaGeo = new THREE.BoxGeometry(110, 2, 110);
        const plazaMat = new THREE.MeshLambertMaterial({ color: '#34495e' });
        const plaza = new THREE.Mesh(plazaGeo, plazaMat);
        plaza.position.y = 1;
        group.add(plaza);

        // Podium Mall (Basement to 5th floor)
        const mallGeo = new THREE.BoxGeometry(84, 26, 84);
        const mallMat = new THREE.MeshLambertMaterial({
            color: '#1a5276',
            map: this.textures.buildingFacades[2],
            roughness: 0.3
        });
        const mall = new THREE.Mesh(mallGeo, mallMat);
        mall.position.y = 14;
        group.add(mall);

        // 8 Multi-Tiered Pagoda Blocks (Taipei 101's iconic 8 segments)
        // Each trapezoid section flares outwards at the top
        const numSegments = 8;
        let currentY = 27;
        const segmentHeight = 22;
        const baseWidth = 44;

        const glassMat = new THREE.MeshPhongMaterial({
            color: '#1abc9c',
            emissive: '#0e6251',
            specular: '#a2d9ce',
            shininess: 90,
            opacity: 0.92,
            transparent: true
        });

        const goldCoinMat = new THREE.MeshLambertMaterial({ color: '#f39c12' });

        for (let i = 0; i < numSegments; i++) {
            const bottomRadius = (baseWidth - i * 1.2) * Math.SQRT1_2;
            const topRadius = bottomRadius * 1.15; // Inverted trapezoid flare

            // 4-sided flared tower section
            const segGeo = new THREE.CylinderGeometry(topRadius, bottomRadius, segmentHeight, 4, 1);
            const seg = new THREE.Mesh(segGeo, glassMat);
            seg.rotation.y = Math.PI / 4;
            seg.position.y = currentY + segmentHeight / 2;
            group.add(seg);

            // Glowing neon ring at the segment border
            const ringGeo = new THREE.BoxGeometry((baseWidth - i * 1.2) * 1.18, 1.2, (baseWidth - i * 1.2) * 1.18);
            const ringMat = new THREE.MeshBasicMaterial({ color: '#00ffff' });
            const ring = new THREE.Mesh(ringGeo, ringMat);
            ring.position.y = currentY + segmentHeight;
            group.add(ring);

            // Traditional Chinese Ruyi / Gold Coin symbol motif on 4 sides
            const coinGeo = new THREE.CylinderGeometry(3.5, 3.5, 0.8, 16);
            for (let side = 0; side < 4; side++) {
                const coin = new THREE.Mesh(coinGeo, goldCoinMat);
                coin.rotation.x = Math.PI / 2;
                coin.rotation.z = side * Math.PI / 2;
                const dist = (baseWidth - i * 1.2) * 0.58;
                coin.position.set(
                    Math.cos(side * Math.PI / 2) * dist,
                    currentY + segmentHeight * 0.5,
                    Math.sin(side * Math.PI / 2) * dist
                );
                group.add(coin);
            }

            currentY += segmentHeight;
        }

        // Observation Deck Crown
        const crownGeo = new THREE.CylinderGeometry(14, 22, 18, 8);
        const crown = new THREE.Mesh(crownGeo, mallMat);
        crown.position.y = currentY + 9;
        group.add(crown);
        currentY += 18;

        // Pinnacle Spire (Total height reaching over 300 units)
        const spireBaseGeo = new THREE.CylinderGeometry(4, 9, 20, 8);
        const spireBase = new THREE.Mesh(spireBaseGeo, goldCoinMat);
        spireBase.position.y = currentY + 10;
        group.add(spireBase);
        currentY += 20;

        const spireMastGeo = new THREE.CylinderGeometry(0.8, 3, 50, 8);
        const spireMastMat = new THREE.MeshLambertMaterial({ color: '#ecf0f1' });
        const spire = new THREE.Mesh(spireMastGeo, spireMastMat);
        spire.position.y = currentY + 25;
        group.add(spire);
        currentY += 50;

        // Red Aviation Warning Beacon on the tip
        const beaconGeo = new THREE.SphereGeometry(1.5, 8, 8);
        const beaconMat = new THREE.MeshBasicMaterial({ color: '#ff0033' });
        const beacon = new THREE.Mesh(beaconGeo, beaconMat);
        beacon.position.y = currentY;
        group.add(beacon);

        // Point light on spire tip
        const beaconLight = new THREE.PointLight('#ff0033', 2, 120);
        beaconLight.position.y = currentY;
        group.add(beaconLight);

        this.scene.add(group);

        // Add collider for Taipei 101
        this.colliders.push({
            minX: centerX - 45,
            maxX: centerX + 45,
            minZ: centerZ - 45,
            maxZ: centerZ + 45
        });
    }

    populateCityBlocks() {
        const halfSize = this.worldSize / 2;
        const roadStep = this.blockSize + this.roadWidth;

        for (let bx = -halfSize + roadStep / 2 + this.roadWidth; bx < halfSize - this.roadWidth; bx += roadStep) {
            for (let bz = -halfSize + roadStep / 2 + this.roadWidth; bz < halfSize - this.roadWidth; bz += roadStep) {
                // Keep the center block for Taipei 101 plaza
                if (Math.abs(bx) < this.blockSize && Math.abs(bz) < this.blockSize) {
                    continue;
                }
                this.buildUrbanBlock(bx, bz);
            }
        }
    }

    buildUrbanBlock(blockX, blockZ) {
        // Sidewalk Base for this block
        const swWidth = this.blockSize;
        const swGeo = new THREE.BoxGeometry(swWidth, 0.4, swWidth);
        const swMat = new THREE.MeshLambertMaterial({
            map: this.textures.sidewalk,
            roughness: 0.9
        });
        const sidewalk = new THREE.Mesh(swGeo, swMat);
        sidewalk.position.set(blockX, 0.2, blockZ);
        sidewalk.receiveShadow = true;
        this.scene.add(sidewalk);

        // Each block contains 4 to 6 buildings
        const subSlots = [
            { dx: -28, dz: -28, w: 50, d: 50 },
            { dx: 28, dz: -28, w: 50, d: 50 },
            { dx: -28, dz: 28, w: 50, d: 50 },
            { dx: 28, dz: 28, w: 50, d: 50 }
        ];

        subSlots.forEach((slot, idx) => {
            const bx = blockX + slot.dx;
            const bz = blockZ + slot.dz;
            const height = 25 + Math.random() * 55; // Multi-story buildings

            const facadeTex = this.textures.buildingFacades[(idx + Math.floor(Math.random() * 3)) % this.textures.buildingFacades.length];
            const bGeo = new THREE.BoxGeometry(slot.w, height, slot.d);
            const bMat = new THREE.MeshLambertMaterial({
                map: facadeTex,
                roughness: 0.6
            });
            const building = new THREE.Mesh(bGeo, bMat);
            building.position.set(bx, height / 2 + 0.4, bz);
            building.castShadow = true;
            building.receiveShadow = true;
            this.scene.add(building);

            // Add Collider
            this.colliders.push({
                minX: bx - slot.w / 2 - 1,
                maxX: bx + slot.w / 2 + 1,
                minZ: bz - slot.d / 2 - 1,
                maxZ: bz + slot.d / 2 + 1
            });

            // Rooftop Additions (Taiwan Signature!)
            // 1. Corrugated Green/Blue Tin Roof Shed (鐵皮加蓋)
            if (Math.random() > 0.4) {
                const tinGeo = new THREE.BoxGeometry(slot.w * 0.7, 4, slot.d * 0.7);
                const tinMat = new THREE.MeshLambertMaterial({
                    color: Math.random() > 0.5 ? '#1e8449' : '#2874a6' // Green or Blue tin
                });
                const tinRoof = new THREE.Mesh(tinGeo, tinMat);
                tinRoof.position.set(bx, height + 2.4, bz);
                this.scene.add(tinRoof);
            }

            // 2. Stainless Steel Cylindrical Water Tanks (白鐵水塔)
            if (Math.random() > 0.3) {
                const tankGeo = new THREE.CylinderGeometry(2.5, 2.5, 5, 12);
                const tankMat = new THREE.MeshStandardMaterial({
                    color: '#d5dbdb',
                    metalness: 0.8,
                    roughness: 0.2
                });
                const tank = new THREE.Mesh(tankGeo, tankMat);
                tank.position.set(bx + (Math.random() - 0.5) * 15, height + 2.9, bz + (Math.random() - 0.5) * 15);
                this.scene.add(tank);
            }

            // 3. Neon Storefront Sign on Ground Floor Facing Road
            if (Math.random() > 0.25) {
                this.attachNeonSign(bx, bz, slot.w, slot.d, height);
            }
        });
    }

    attachNeonSign(bx, bz, w, d, height) {
        const signData = this.textures.neonSigns[Math.floor(Math.random() * this.textures.neonSigns.length)];
        const signGeo = new THREE.BoxGeometry(10, 5, 0.6);
        const signMat = new THREE.MeshBasicMaterial({
            map: signData.texture,
            color: '#FFFFFF'
        });

        const sign = new THREE.Mesh(signGeo, signMat);
        
        // Project sign protruding over the street
        const isXFacing = Math.abs(bx) > Math.abs(bz);
        if (isXFacing) {
            sign.position.set(bx + Math.sign(bx) * (w / 2 + 0.4), 6, bz);
            sign.rotation.y = Math.PI / 2;
        } else {
            sign.position.set(bx, 6, bz + Math.sign(bz) * (d / 2 + 0.4));
        }

        // Add soft neon point glow
        const glowLight = new THREE.PointLight(signData.color, 1.2, 18);
        glowLight.position.copy(sign.position);
        this.scene.add(glowLight);
        this.streetLights.push(glowLight);

        this.scene.add(sign);
        this.neonSigns.push(sign);
    }

    createNightMarketAlley() {
        // Night market alley along one of the side blocks
        const startX = 160;
        const startZ = 160;

        for (let i = -40; i <= 40; i += 12) {
            // Left & Right Food Stalls (夜市攤販)
            [-6, 6].forEach(offset => {
                const stallGeo = new THREE.BoxGeometry(5, 3.2, 7);
                const awningColors = ['#e74c3c', '#f39c12', '#2ecc71', '#9b59b6'];
                const stallMat = new THREE.MeshLambertMaterial({
                    color: awningColors[Math.floor(Math.random() * awningColors.length)]
                });
                const stall = new THREE.Mesh(stallGeo, stallMat);
                stall.position.set(startX + offset, 1.6, startZ + i);
                this.scene.add(stall);

                // Hanging Red Lantern
                const lanternGeo = new THREE.SphereGeometry(0.6, 8, 8);
                const lanternMat = new THREE.MeshBasicMaterial({ color: '#ff2200' });
                const lantern = new THREE.Mesh(lanternGeo, lanternMat);
                lantern.position.set(startX + offset * 0.7, 3.8, startZ + i);
                this.scene.add(lantern);

                // Warm lantern glow
                const lanternLight = new THREE.PointLight('#ff6600', 0.8, 10);
                lanternLight.position.copy(lantern.position);
                this.scene.add(lanternLight);
                this.streetLights.push(lanternLight);
            });
        }
    }

    createStreetFurniture() {
        // Trees and Streetlamps along sidewalks
        const halfSize = this.worldSize / 2;
        const roadStep = this.blockSize + this.roadWidth;

        for (let p = -halfSize + roadStep / 2; p <= halfSize - roadStep / 2; p += 40) {
            [-120, -60, 60, 120].forEach(q => {
                if (Math.abs(p) < 80 && Math.abs(q) < 80) return; // avoid 101 center

                // Street Tree (Subtropical Banyan / Palm)
                if (Math.random() > 0.4) {
                    const trunkGeo = new THREE.CylinderGeometry(0.3, 0.4, 5, 6);
                    const trunkMat = new THREE.MeshLambertMaterial({ color: '#5d4037' });
                    const trunk = new THREE.Mesh(trunkGeo, trunkMat);
                    trunk.position.set(p, 2.5, q + 13);
                    this.scene.add(trunk);

                    const leavesGeo = new THREE.SphereGeometry(2.5, 8, 8);
                    const leavesMat = new THREE.MeshLambertMaterial({ color: '#27ae60' });
                    const leaves = new THREE.Mesh(leavesGeo, leavesMat);
                    leaves.position.set(p, 5.8, q + 13);
                    leaves.scale.set(1.2, 0.8, 1.2);
                    this.scene.add(leaves);
                }

                // Street Lamp with Point Light
                if (Math.random() > 0.5) {
                    const lampPoleGeo = new THREE.CylinderGeometry(0.15, 0.15, 7, 6);
                    const lampPoleMat = new THREE.MeshLambertMaterial({ color: '#34495e' });
                    const pole = new THREE.Mesh(lampPoleGeo, lampPoleMat);
                    pole.position.set(p, 3.5, q - 13);
                    this.scene.add(pole);

                    const headGeo = new THREE.BoxGeometry(0.8, 0.4, 1.2);
                    const headMat = new THREE.MeshBasicMaterial({ color: '#f9e79f' });
                    const head = new THREE.Mesh(headGeo, headMat);
                    head.position.set(p, 7, q - 13);
                    this.scene.add(head);

                    const light = new THREE.PointLight('#f9e79f', 0.7, 24);
                    light.position.set(p, 6.8, q - 13);
                    this.scene.add(light);
                    this.streetLights.push(light);
                }
            });
        }
    }

    checkCollision(x, z, radius = 1.2) {
        for (let i = 0; i < this.colliders.length; i++) {
            const c = this.colliders[i];
            if (x + radius > c.minX && x - radius < c.maxX &&
                z + radius > c.minZ && z - radius < c.maxZ) {
                return true;
            }
        }
        return false;
    }
}

window.TaipeiWorld = TaipeiWorld;
