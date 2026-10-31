// webgpu-renderer.js - Native Next-Gen WebGPU 3D Engine for Taipei GTA
// Implements WGSL shaders, pipeline caching, uniform buffers, and procedural Taipei landmarks

class WebGPURenderer {
    constructor(canvas) {
        this.canvas = canvas;
        this.device = null;
        this.context = null;
        this.format = null;
        this.pipeline = null;
        this.depthTexture = null;
        this.uniformBuffer = null;
        this.bindGroup = null;

        // Buffers for static & dynamic world geometry
        this.staticVertexBuffer = null;
        this.staticVertexCount = 0;
        this.dynamicVertexBuffer = null;
        this.dynamicMaxVertices = 65536;

        this.isSupported = false;
        this.initialized = false;

        // Camera & Scene State
        this.aspect = 1.0;
        this.timeOfDay = 2; // 0: Day, 1: Sunset, 2: Cyberpunk Night
        this.elapsedTime = 0;
    }

    async init() {
        if (!navigator.gpu) {
            console.warn('[WebGPU] navigator.gpu is not available in this browser. Falling back to WebGL.');
            return false;
        }

        try {
            const adapter = await navigator.gpu.requestAdapter({
                powerPreference: 'high-performance'
            });

            if (!adapter) {
                console.warn('[WebGPU] No suitable GPU adapter found.');
                return false;
            }

            this.device = await adapter.requestDevice();
            this.context = this.canvas.getContext('webgpu');
            this.format = navigator.gpu.getPreferredCanvasFormat();

            this.context.configure({
                device: this.device,
                format: this.format,
                alphaMode: 'premultiplied'
            });

            this.createShadersAndPipelines();
            this.createDepthTexture();
            this.buildStaticCityGeometry();
            this.createDynamicBuffer();

            this.isSupported = true;
            this.initialized = true;
            console.log('⚡ [WebGPU] Native GPU Pipeline & WGSL Shaders initialized successfully!');
            return true;
        } catch (err) {
            console.error('[WebGPU] Failed to initialize WebGPU renderer:', err);
            return false;
        }
    }

    createShadersAndPipelines() {
        const shaderWGSL = `
        struct Uniforms {
            viewProj: mat4x4<f32>,
            cameraPos: vec3<f32>,
            time: f32,
            sunDir: vec3<f32>,
            timeOfDay: f32,
            ambientLight: vec3<f32>,
            sunColor: vec3<f32>,
            fogColor: vec3<f32>,
            fogDensity: f32,
        };

        @group(0) @binding(0) var<uniform> uniforms: Uniforms;

        struct VertexInput {
            @location(0) position: vec3<f32>,
            @location(1) normal: vec3<f32>,
            @location(2) color: vec4<f32>,
        };

        struct VertexOutput {
            @builtin(position) clipPos: vec4<f32>,
            @location(0) worldPos: vec3<f32>,
            @location(1) normal: vec3<f32>,
            @location(2) color: vec4<f32>,
        };

        @vertex
        fn vs_main(in: VertexInput) -> VertexOutput {
            var out: VertexOutput;
            out.worldPos = in.position;
            out.normal = in.normal;
            out.color = in.color;
            out.clipPos = uniforms.viewProj * vec4<f32>(in.position, 1.0);
            return out;
        }

        @fragment
        fn fs_main(in: VertexOutput) -> @location(0) vec4<f32> {
            let N = normalize(in.normal);
            let L = normalize(uniforms.sunDir);
            let V = normalize(uniforms.cameraPos - in.worldPos);
            let H = normalize(L + V);

            // Diffuse Lighting
            let NdotL = max(dot(N, L), 0.0);
            let diffuse = uniforms.sunColor * NdotL;

            // Specular Blinn-Phong highlight
            let NdotH = max(dot(N, H), 0.0);
            let specular = uniforms.sunColor * pow(NdotH, 24.0) * 0.35;

            // Ambient + Diffuse
            var finalColor = in.color.rgb * (uniforms.ambientLight + diffuse) + specular;

            // Taipei Cyberpunk Neon Emissive Boost for bright objects (lights, signs, headlights)
            if (in.color.a > 1.05) {
                let neonBoost = in.color.a - 1.0;
                finalColor = in.color.rgb * (1.0 + neonBoost * 1.5);
            }

            // Atmospheric Distance Fog
            let dist = length(uniforms.cameraPos - in.worldPos);
            let fogFactor = clamp(1.0 - exp(-dist * uniforms.fogDensity), 0.0, 1.0);
            finalColor = mix(finalColor, uniforms.fogColor, fogFactor);

            return vec4<f32>(finalColor, 1.0);
        }
        `;

        const shaderModule = this.device.createShaderModule({
            code: shaderWGSL
        });

        // Uniform buffer layout (size: 144 bytes aligned to 256)
        this.uniformBuffer = this.device.createBuffer({
            size: 256,
            usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST
        });

        const bindGroupLayout = this.device.createBindGroupLayout({
            entries: [{
                binding: 0,
                visibility: GPUShaderStage.VERTEX | GPUShaderStage.FRAGMENT,
                buffer: { type: 'uniform' }
            }]
        });

        this.bindGroup = this.device.createBindGroup({
            layout: bindGroupLayout,
            entries: [{
                binding: 0,
                resource: { buffer: this.uniformBuffer }
            }]
        });

        const pipelineLayout = this.device.createPipelineLayout({
            bindGroupLayouts: [bindGroupLayout]
        });

        this.pipeline = this.device.createRenderPipeline({
            layout: pipelineLayout,
            vertex: {
                module: shaderModule,
                entryPoint: 'vs_main',
                buffers: [{
                    arrayStride: 40, // 3 floats pos + 3 floats normal + 4 floats color = 10 * 4 = 40 bytes
                    attributes: [
                        { shaderLocation: 0, offset: 0, format: 'float32x3' },
                        { shaderLocation: 1, offset: 12, format: 'float32x3' },
                        { shaderLocation: 2, offset: 24, format: 'float32x4' }
                    ]
                }]
            },
            fragment: {
                module: shaderModule,
                entryPoint: 'fs_main',
                targets: [{
                    format: this.format
                }]
            },
            primitive: {
                topology: 'triangle-list',
                cullMode: 'none'
            },
            depthStencil: {
                format: 'depth24plus',
                depthWriteEnabled: true,
                depthCompare: 'less'
            }
        });
    }

    createDepthTexture() {
        if (this.depthTexture) this.depthTexture.destroy();
        this.depthTexture = this.device.createTexture({
            size: [Math.max(1, this.canvas.width), Math.max(1, this.canvas.height)],
            format: 'depth24plus',
            usage: GPUTextureUsage.RENDER_ATTACHMENT
        });
    }

    createDynamicBuffer() {
        this.dynamicVertexBuffer = this.device.createBuffer({
            size: this.dynamicMaxVertices * 40,
            usage: GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST
        });
    }

    buildStaticCityGeometry() {
        const vertices = [];

        const addQuad = (p1, p2, p3, p4, norm, col) => {
            // Triangle 1
            vertices.push(
                p1[0], p1[1], p1[2], norm[0], norm[1], norm[2], col[0], col[1], col[2], col[3],
                p2[0], p2[1], p2[2], norm[0], norm[1], norm[2], col[0], col[1], col[2], col[3],
                p3[0], p3[1], p3[2], norm[0], norm[1], norm[2], col[0], col[1], col[2], col[3]
            );
            // Triangle 2
            vertices.push(
                p1[0], p1[1], p1[2], norm[0], norm[1], norm[2], col[0], col[1], col[2], col[3],
                p3[0], p3[1], p3[2], norm[0], norm[1], norm[2], col[0], col[1], col[2], col[3],
                p4[0], p4[1], p4[2], norm[0], norm[1], norm[2], col[0], col[1], col[2], col[3]
            );
        };

        const addBox = (minX, minY, minZ, maxX, maxY, maxZ, col) => {
            // Top (+Y)
            addQuad([minX, maxY, minZ], [minX, maxY, maxZ], [maxX, maxY, maxZ], [maxX, maxY, minZ], [0, 1, 0], col);
            // Bottom (-Y)
            addQuad([minX, minY, minZ], [maxX, minY, minZ], [maxX, minY, maxZ], [minX, minY, maxZ], [0, -1, 0], col);
            // Front (+Z)
            addQuad([minX, minY, maxZ], [maxX, minY, maxZ], [maxX, maxY, maxZ], [minX, maxY, maxZ], [0, 0, 1], col);
            // Back (-Z)
            addQuad([minX, minY, minZ], [minX, maxY, minZ], [maxX, maxY, minZ], [maxX, minY, minZ], [0, 0, -1], col);
            // Right (+X)
            addQuad([maxX, minY, minZ], [maxX, maxY, minZ], [maxX, maxY, maxZ], [maxX, minY, maxZ], [1, 0, 0], col);
            // Left (-X)
            addQuad([minX, minY, minZ], [minX, minY, maxZ], [minX, maxY, maxZ], [minX, maxY, minZ], [-1, 0, 0], col);
        };

        // 1. Ground Plane (Asphalt dark gray)
        const groundSize = 650;
        addQuad(
            [-groundSize, -0.05, -groundSize],
            [-groundSize, -0.05,  groundSize],
            [ groundSize, -0.05,  groundSize],
            [ groundSize, -0.05, -groundSize],
            [0, 1, 0],
            [0.12, 0.14, 0.17, 1.0]
        );

        // 2. City Road Network & Sidewalks
        const roadWidth = 24;
        const blockSize = 120;
        const numBlocks = 5;

        for (let i = -numBlocks; i <= numBlocks; i++) {
            const coord = i * blockSize;

            // X-Road
            addQuad(
                [-groundSize, 0.01, coord - roadWidth/2],
                [-groundSize, 0.01, coord + roadWidth/2],
                [ groundSize, 0.01, coord + roadWidth/2],
                [ groundSize, 0.01, coord - roadWidth/2],
                [0, 1, 0],
                [0.18, 0.20, 0.23, 1.0]
            );

            // Z-Road
            addQuad(
                [coord - roadWidth/2, 0.01, -groundSize],
                [coord - roadWidth/2, 0.01,  groundSize],
                [coord + roadWidth/2, 0.01,  groundSize],
                [coord + roadWidth/2, 0.01, -groundSize],
                [0, 1, 0],
                [0.18, 0.20, 0.23, 1.0]
            );

            // Yellow Center Stripes (dashed look)
            for (let seg = -groundSize; seg < groundSize; seg += 30) {
                // X-axis road stripe
                addQuad(
                    [seg, 0.03, coord - 0.2],
                    [seg, 0.03, coord + 0.2],
                    [seg + 15, 0.03, coord + 0.2],
                    [seg + 15, 0.03, coord - 0.2],
                    [0, 1, 0],
                    [0.95, 0.75, 0.10, 1.0]
                );

                // Z-axis road stripe
                addQuad(
                    [coord - 0.2, 0.03, seg],
                    [coord - 0.2, 0.03, seg + 15],
                    [coord + 0.2, 0.03, seg + 15],
                    [coord + 0.2, 0.03, seg],
                    [0, 1, 0],
                    [0.95, 0.75, 0.10, 1.0]
                );
            }

            // Scooter Waiting Box (機車停等區) near intersections
            if (Math.abs(coord) > 30) {
                addBox(coord + 14, 0.03, coord + 14, coord + 22, 0.04, coord + 20, [0.95, 0.85, 0.1, 1.0]);
                addBox(coord - 22, 0.03, coord - 20, coord - 14, 0.04, coord - 14, [0.95, 0.85, 0.1, 1.0]);
            }
        }

        // 3. Iconic TAIPEI 101 Landmark (Center at 0, 0)
        // Base Podium
        addBox(-34, 0, -34, 34, 18, 34, [0.35, 0.40, 0.45, 1.0]);
        addBox(-30, 18, -30, 30, 36, 30, [0.25, 0.35, 0.40, 1.0]);

        // 8 Pagoda Segments (Expanding inverted slopes)
        let curY = 36;
        for (let tier = 0; tier < 8; tier++) {
            const h = 24;
            const bBottom = 22 - tier * 0.5;
            const bTop = 26 - tier * 0.5;

            // Inverted pagoda tier box
            addBox(-bTop, curY, -bTop, bTop, curY + h, bTop, [0.15, 0.45, 0.52, 1.0]);

            // Ornamental Ruyi Emblem Badges (Brass Gold)
            addBox(-bTop - 1, curY + h/2 - 2, -2, -bTop, curY + h/2 + 2, 2, [0.95, 0.82, 0.20, 1.0]);
            addBox(bTop, curY + h/2 - 2, -2, bTop + 1, curY + h/2 + 2, 2, [0.95, 0.82, 0.20, 1.0]);

            // Glowing Neon Edge Strip around tier rim
            addBox(-bTop - 0.5, curY + h - 1, -bTop - 0.5, bTop + 0.5, curY + h, bTop + 0.5, [0.0, 0.95, 1.0, 1.8]);

            curY += h;
        }

        // Taipei 101 Crown & Spire Antenna
        addBox(-12, curY, -12, 12, curY + 22, 12, [0.9, 0.9, 0.95, 1.0]);
        // Spire
        addBox(-1.5, curY + 22, -1.5, 1.5, curY + 95, 1.5, [0.85, 0.85, 0.90, 1.0]);
        // Antenna beacon tip (Glowing Red)
        addBox(-0.8, curY + 95, -0.8, 0.8, curY + 105, 0.8, [1.0, 0.1, 0.1, 2.5]);

        // 4. Surrounding Taipei Skyscraper & Commercial Blocks
        const buildingColors = [
            [0.25, 0.35, 0.48, 1.0], // Glass blue
            [0.45, 0.45, 0.48, 1.0], // Concrete modern
            [0.20, 0.38, 0.35, 1.0], // Teal high-rise
            [0.55, 0.40, 0.30, 1.0], // Taipei brick
            [0.18, 0.22, 0.28, 1.0]  // Dark obsidian
        ];

        const neonColors = [
            [1.0, 0.15, 0.45, 2.0], // Neon Pink (小籠包)
            [0.1, 0.95, 0.85, 2.0], // Neon Cyan (台北101)
            [1.0, 0.85, 0.10, 2.0], // Neon Yellow (計程車)
            [0.2, 1.00, 0.30, 2.0], // Neon Green (7-ELEVEN)
            [0.8, 0.20, 1.00, 2.0]  // Neon Purple (珍珠奶茶)
        ];

        for (let bx = -numBlocks; bx < numBlocks; bx++) {
            for (let bz = -numBlocks; bz < numBlocks; bz++) {
                if (bx === 0 && bz === 0) continue; // Skip Taipei 101 central block

                const cx = bx * blockSize + blockSize/2;
                const cz = bz * blockSize + blockSize/2;

                // Sidewalk platform for block
                const pW = (blockSize - roadWidth) / 2;
                addBox(cx - pW, 0, cz - pW, cx + pW, 0.4, cz + pW, [0.72, 0.74, 0.76, 1.0]);

                // 2 Buildings per block
                const bHeight1 = 35 + ((Math.abs(bx * 7 + bz * 13)) % 75);
                const bCol1 = buildingColors[(Math.abs(bx + bz)) % buildingColors.length];
                addBox(cx - pW + 4, 0.4, cz - pW + 4, cx - 2, bHeight1, cz + pW - 4, bCol1);

                // Neon Sign on building facade
                const neonCol = neonColors[(Math.abs(bx * 3 + bz * 5)) % neonColors.length];
                addBox(cx - 1.8, 8, cz - 12, cx - 1.4, 20, cz + 12, neonCol);

                const bHeight2 = 28 + ((Math.abs(bx * 11 + bz * 17)) % 65);
                const bCol2 = buildingColors[(Math.abs(bx * 2 + bz)) % buildingColors.length];
                addBox(cx + 2, 0.4, cz - pW + 4, cx + pW - 4, bHeight2, cz + pW - 4, bCol2);
            }
        }

        // Store into static vertex buffer
        this.staticVertexCount = vertices.length / 10;
        const vertexData = new Float32Array(vertices);

        this.staticVertexBuffer = this.device.createBuffer({
            size: vertexData.byteLength,
            usage: GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST
        });

        this.device.queue.writeBuffer(this.staticVertexBuffer, 0, vertexData);
    }

    render(camera, playerState, vehicles, pedestrians, timeOfDay) {
        if (!this.initialized || !this.isSupported) return;

        this.timeOfDay = timeOfDay;
        this.elapsedTime += 0.016;

        // Resize depth texture if canvas size changed
        if (this.depthTexture.width !== this.canvas.width || this.depthTexture.height !== this.canvas.height) {
            this.createDepthTexture();
        }

        this.updateUniforms(camera);
        const dynamicVertexCount = this.buildDynamicGeometry(playerState, vehicles, pedestrians);

        const commandEncoder = this.device.createCommandEncoder();

        // Background color based on Time of Day
        let clearColor = { r: 0.04, g: 0.05, b: 0.08, a: 1.0 }; // Night
        if (this.timeOfDay === 0) clearColor = { r: 0.52, g: 0.75, b: 0.92, a: 1.0 }; // Day
        else if (this.timeOfDay === 1) clearColor = { r: 0.75, g: 0.35, b: 0.15, a: 1.0 }; // Sunset

        const renderPass = commandEncoder.beginRenderPass({
            colorAttachments: [{
                view: this.context.getCurrentTexture().createView(),
                clearValue: clearColor,
                loadOp: 'clear',
                storeOp: 'store'
            }],
            depthStencilAttachment: {
                view: this.depthTexture.createView(),
                depthClearValue: 1.0,
                depthLoadOp: 'clear',
                depthStoreOp: 'store'
            }
        });

        renderPass.setPipeline(this.pipeline);
        renderPass.setBindGroup(0, this.bindGroup);

        // 1. Draw Static City (Taipei 101, Roads, High-Rises)
        renderPass.setVertexBuffer(0, this.staticVertexBuffer);
        renderPass.draw(this.staticVertexCount, 1, 0, 0);

        // 2. Draw Dynamic Entities (Player, Vehicles, Pedestrians)
        if (dynamicVertexCount > 0) {
            renderPass.setVertexBuffer(0, this.dynamicVertexBuffer);
            renderPass.draw(dynamicVertexCount, 1, 0, 0);
        }

        renderPass.end();
        this.device.queue.submit([commandEncoder.finish()]);
    }

    updateUniforms(camera) {
        // Build Projection & View Matrices
        const aspect = this.canvas.width / Math.max(1, this.canvas.height);
        const proj = this.mat4Perspective(60 * (Math.PI / 180), aspect, 0.5, 1200);
        const view = this.mat4LookAt(
            [camera.position.x, camera.position.y, camera.position.z],
            [camera.target.x, camera.target.y, camera.target.z],
            [0, 1, 0]
        );
        const viewProj = this.mat4Multiply(proj, view);

        // Lighting settings based on Time of Day
        let ambient = [0.15, 0.18, 0.25];
        let sunCol = [0.25, 0.35, 0.50];
        let sunDir = [0.3, 0.9, 0.4];
        let fogCol = [0.04, 0.05, 0.08];
        let fogDensity = 0.0035;

        if (this.timeOfDay === 0) { // DAY
            ambient = [0.45, 0.48, 0.52];
            sunCol = [1.0, 0.98, 0.90];
            sunDir = [0.5, 1.0, 0.3];
            fogCol = [0.52, 0.75, 0.92];
            fogDensity = 0.0018;
        } else if (this.timeOfDay === 1) { // SUNSET
            ambient = [0.35, 0.25, 0.22];
            sunCol = [1.0, 0.55, 0.15];
            sunDir = [0.8, 0.3, 0.5];
            fogCol = [0.75, 0.35, 0.15];
            fogDensity = 0.0028;
        }

        const uniformData = new Float32Array(64);
        // viewProj (16 floats)
        for (let i = 0; i < 16; i++) uniformData[i] = viewProj[i];
        // cameraPos (3 floats) + time (1 float)
        uniformData[16] = camera.position.x;
        uniformData[17] = camera.position.y;
        uniformData[18] = camera.position.z;
        uniformData[19] = this.elapsedTime;
        // sunDir (3 floats) + timeOfDay (1 float)
        uniformData[20] = sunDir[0];
        uniformData[21] = sunDir[1];
        uniformData[22] = sunDir[2];
        uniformData[23] = this.timeOfDay;
        // ambientLight (3 floats) + pad
        uniformData[24] = ambient[0];
        uniformData[25] = ambient[1];
        uniformData[26] = ambient[2];
        uniformData[27] = 0.0;
        // sunColor (3 floats) + pad
        uniformData[28] = sunCol[0];
        uniformData[29] = sunCol[1];
        uniformData[30] = sunCol[2];
        uniformData[31] = 0.0;
        // fogColor (3 floats) + fogDensity (1 float)
        uniformData[32] = fogCol[0];
        uniformData[33] = fogCol[1];
        uniformData[34] = fogCol[2];
        uniformData[35] = fogDensity;

        this.device.queue.writeBuffer(this.uniformBuffer, 0, uniformData);
    }

    buildDynamicGeometry(player, vehicles, pedestrians) {
        const dynVerts = [];

        const addQuad = (p1, p2, p3, p4, norm, col) => {
            dynVerts.push(
                p1[0], p1[1], p1[2], norm[0], norm[1], norm[2], col[0], col[1], col[2], col[3],
                p2[0], p2[1], p2[2], norm[0], norm[1], norm[2], col[0], col[1], col[2], col[3],
                p3[0], p3[1], p3[2], norm[0], norm[1], norm[2], col[0], col[1], col[2], col[3],
                p1[0], p1[1], p1[2], norm[0], norm[1], norm[2], col[0], col[1], col[2], col[3],
                p3[0], p3[1], p3[2], norm[0], norm[1], norm[2], col[0], col[1], col[2], col[3],
                p4[0], p4[1], p4[2], norm[0], norm[1], norm[2], col[0], col[1], col[2], col[3]
            );
        };

        const addRotatedBox = (cx, cy, cz, hx, hy, hz, yaw, col) => {
            const cos = Math.cos(yaw);
            const sin = Math.sin(yaw);

            const rot = (x, z) => [
                cx + x * cos - z * sin,
                cz + x * sin + z * cos
            ];

            const p00 = rot(-hx, -hz);
            const p10 = rot( hx, -hz);
            const p11 = rot( hx,  hz);
            const p01 = rot(-hx,  hz);

            const y0 = cy - hy;
            const y1 = cy + hy;

            // Top
            addQuad([p00[0], y1, p00[1]], [p01[0], y1, p01[1]], [p11[0], y1, p11[1]], [p10[0], y1, p10[1]], [0, 1, 0], col);
            // Front (+Z local)
            addQuad([p01[0], y0, p01[1]], [p11[0], y0, p11[1]], [p11[0], y1, p11[1]], [p01[0], y1, p01[1]], [sin, 0, cos], col);
            // Back (-Z local)
            addQuad([p10[0], y0, p10[1]], [p00[0], y0, p00[1]], [p00[0], y1, p00[1]], [p10[0], y1, p10[1]], [-sin, 0, -cos], col);
            // Right (+X local)
            addQuad([p11[0], y0, p11[1]], [p10[0], y0, p10[1]], [p10[0], y1, p10[1]], [p11[0], y1, p11[1]], [cos, 0, -sin], col);
            // Left (-X local)
            addQuad([p00[0], y0, p00[1]], [p01[0], y0, p01[1]], [p01[0], y1, p01[1]], [p00[0], y1, p00[1]], [-cos, 0, sin], col);
        };

        // 1. Draw Player Character (if not in vehicle)
        if (player && !player.inVehicle) {
            // Torso (Dark navy streetwear)
            addRotatedBox(player.x, 1.2, player.z, 0.35, 0.45, 0.22, player.heading, [0.18, 0.24, 0.32, 1.0]);
            // Head (Skin tone)
            addRotatedBox(player.x, 1.9, player.z, 0.2, 0.22, 0.2, player.heading, [0.96, 0.80, 0.65, 1.0]);
            // Sunglasses
            addRotatedBox(player.x, 1.92, player.z, 0.18, 0.05, 0.05, player.heading, [0.05, 0.05, 0.05, 1.0]);
            // Denim Jeans Legs
            addRotatedBox(player.x, 0.45, player.z, 0.25, 0.45, 0.22, player.heading, [0.12, 0.38, 0.55, 1.0]);
        }

        // 2. Draw Vehicles (Scooter, Taxi, Truck, Sports, Police)
        if (vehicles && vehicles.length) {
            const strobePhase = Math.floor(this.elapsedTime * 8) % 2;

            for (const v of vehicles) {
                if (!v.active) continue;

                if (v.type === 0) { // Taiwan Scooter (SYM / Kymco style)
                    // Chassis
                    addRotatedBox(v.x, 0.55, v.z, 0.25, 0.25, 0.75, v.heading, [0.85, 0.15, 0.15, 1.0]); // Sport red
                    // Seat
                    addRotatedBox(v.x, 0.75, v.z, 0.22, 0.08, 0.35, v.heading, [0.1, 0.1, 0.1, 1.0]);
                    // Front Handlebar
                    addRotatedBox(v.x, 1.05, v.z + 0.5, 0.35, 0.04, 0.04, v.heading, [0.2, 0.2, 0.2, 1.0]);
                    // Scooter Headlight (Warm yellow glow)
                    addRotatedBox(v.x, 0.85, v.z + 0.65, 0.12, 0.08, 0.05, v.heading, [1.0, 0.95, 0.6, 2.2]);
                    // Taillight (Red glow)
                    addRotatedBox(v.x, 0.65, v.z - 0.7, 0.12, 0.06, 0.05, v.heading, [1.0, 0.1, 0.1, 2.0]);
                    // Rider (if player is on scooter)
                    if (v.isPlayer) {
                        addRotatedBox(v.x, 1.35, v.z, 0.25, 0.35, 0.2, v.heading, [0.2, 0.3, 0.4, 1.0]);
                        addRotatedBox(v.x, 1.85, v.z, 0.18, 0.18, 0.18, v.heading, [0.96, 0.8, 0.65, 1.0]);
                    }
                } else if (v.type === 1) { // Taipei Yellow Taxi
                    // Yellow Main Body
                    addRotatedBox(v.x, 0.75, v.z, 0.95, 0.45, 2.2, v.heading, [0.96, 0.76, 0.06, 1.0]);
                    // Cabin / Roof
                    addRotatedBox(v.x, 1.35, v.z - 0.1, 0.85, 0.35, 1.2, v.heading, [0.15, 0.15, 0.18, 1.0]);
                    // TAXI Roof Dome Sign (Glowing Amber)
                    addRotatedBox(v.x, 1.82, v.z, 0.28, 0.12, 0.15, v.heading, [1.0, 0.75, 0.05, 2.2]);
                    // Headlights
                    addRotatedBox(v.x + 0.6, 0.65, v.z + 2.15, 0.18, 0.12, 0.08, v.heading, [1.0, 1.0, 0.85, 2.5]);
                    addRotatedBox(v.x - 0.6, 0.65, v.z + 2.15, 0.18, 0.12, 0.08, v.heading, [1.0, 1.0, 0.85, 2.5]);
                } else if (v.type === 2) { // Taiwan Blue Truck (中華菱利 CMC Veryca)
                    // Blue Cabin
                    addRotatedBox(v.x, 1.25, v.z + 1.1, 1.05, 0.75, 1.0, v.heading, [0.10, 0.42, 0.75, 1.0]);
                    // White Roof
                    addRotatedBox(v.x, 2.05, v.z + 1.1, 1.08, 0.08, 1.02, v.heading, [0.95, 0.95, 0.95, 1.0]);
                    // Rear Open Flatbed Cargo
                    addRotatedBox(v.x, 0.65, v.z - 1.2, 1.05, 0.35, 1.5, v.heading, [0.30, 0.32, 0.35, 1.0]);
                    // Wooden Cargo Crates
                    addRotatedBox(v.x, 1.35, v.z - 1.0, 0.75, 0.45, 0.85, v.heading, [0.65, 0.45, 0.25, 1.0]);
                } else if (v.type === 3) { // Police Cruiser
                    // Black & White Chassis
                    addRotatedBox(v.x, 0.75, v.z, 0.95, 0.45, 2.3, v.heading, [0.95, 0.95, 0.95, 1.0]);
                    addRotatedBox(v.x, 1.35, v.z - 0.1, 0.85, 0.35, 1.25, v.heading, [0.10, 0.10, 0.12, 1.0]);
                    // Police Emergency Flashing Lightbar
                    const leftCol = strobePhase === 0 ? [1.0, 0.05, 0.05, 3.0] : [0.1, 0.1, 0.1, 1.0];
                    const rightCol = strobePhase === 1 ? [0.05, 0.4, 1.0, 3.0] : [0.1, 0.1, 0.1, 1.0];
                    addRotatedBox(v.x - 0.3, 1.82, v.z, 0.25, 0.12, 0.12, v.heading, leftCol);
                    addRotatedBox(v.x + 0.3, 1.82, v.z, 0.25, 0.12, 0.12, v.heading, rightCol);
                } else { // Sports Car
                    // Sleek Metallic Chassis
                    addRotatedBox(v.x, 0.60, v.z, 1.0, 0.35, 2.2, v.heading, [0.12, 0.75, 0.35, 1.0]); // Acid green
                    // Cockpit Canopy
                    addRotatedBox(v.x, 1.05, v.z - 0.2, 0.75, 0.25, 1.0, v.heading, [0.1, 0.1, 0.1, 1.0]);
                    // Rear Spoiler Wing
                    addRotatedBox(v.x, 1.15, v.z - 2.0, 0.95, 0.06, 0.25, v.heading, [0.1, 0.1, 0.1, 1.0]);
                }
            }
        }

        // 3. Draw Pedestrians
        if (pedestrians && pedestrians.length) {
            const pColors = [
                [0.9, 0.2, 0.2, 1.0],
                [0.2, 0.6, 0.9, 1.0],
                [0.2, 0.8, 0.4, 1.0],
                [0.9, 0.7, 0.1, 1.0],
                [0.7, 0.2, 0.8, 1.0]
            ];

            for (let i = 0; i < pedestrians.length; i++) {
                const p = pedestrians[i];
                if (!p.active) continue;

                const col = pColors[i % pColors.length];
                // Body
                addRotatedBox(p.x, 1.1, p.z, 0.22, 0.35, 0.15, p.heading, col);
                // Head
                addRotatedBox(p.x, 1.65, p.z, 0.15, 0.16, 0.15, p.heading, [0.96, 0.8, 0.65, 1.0]);
                // Legs
                addRotatedBox(p.x, 0.4, p.z, 0.18, 0.38, 0.14, p.heading, [0.2, 0.25, 0.3, 1.0]);
            }
        }

        const count = dynVerts.length / 10;
        if (count > 0 && count <= this.dynamicMaxVertices) {
            this.device.queue.writeBuffer(this.dynamicVertexBuffer, 0, new Float32Array(dynVerts));
        }
        return count;
    }

    // --- High-Performance 4x4 Matrix Utilities ---
    mat4Perspective(fovy, aspect, near, far) {
        const out = new Float32Array(16);
        const f = 1.0 / Math.tan(fovy / 2);
        const nf = 1 / (near - far);
        out[0] = f / aspect;
        out[5] = f;
        out[10] = (far + near) * nf;
        out[11] = -1;
        out[14] = (2 * far * near) * nf;
        return out;
    }

    mat4LookAt(eye, center, up) {
        const out = new Float32Array(16);
        let z0 = eye[0] - center[0], z1 = eye[1] - center[1], z2 = eye[2] - center[2];
        let len = 1 / Math.hypot(z0, z1, z2);
        z0 *= len; z1 *= len; z2 *= len;

        let x0 = up[1] * z2 - up[2] * z1, x1 = up[2] * z0 - up[0] * z2, x2 = up[0] * z1 - up[1] * z0;
        len = Math.hypot(x0, x1, x2);
        if (!len) { x0 = 1; x1 = 0; x2 = 0; } else { len = 1 / len; x0 *= len; x1 *= len; x2 *= len; }

        let y0 = z1 * x2 - z2 * x1, y1 = z2 * x0 - z0 * x2, y2 = z0 * x1 - z1 * x0;

        out[0] = x0; out[1] = y0; out[2] = z0; out[3] = 0;
        out[4] = x1; out[5] = y1; out[6] = z1; out[7] = 0;
        out[8] = x2; out[9] = y2; out[10] = z2; out[11] = 0;
        out[12] = -(x0 * eye[0] + x1 * eye[1] + x2 * eye[2]);
        out[13] = -(y0 * eye[0] + y1 * eye[1] + y2 * eye[2]);
        out[14] = -(z0 * eye[0] + z1 * eye[1] + z2 * eye[2]);
        out[15] = 1;
        return out;
    }

    mat4Multiply(a, b) {
        const out = new Float32Array(16);
        for (let i = 0; i < 4; i++) {
            const ai0 = a[i], ai1 = a[i+4], ai2 = a[i+8], ai3 = a[i+12];
            out[i]    = ai0 * b[0]  + ai1 * b[1]  + ai2 * b[2]  + ai3 * b[3];
            out[i+4]  = ai0 * b[4]  + ai1 * b[5]  + ai2 * b[6]  + ai3 * b[7];
            out[i+8]  = ai0 * b[8]  + ai1 * b[9]  + ai2 * b[10] + ai3 * b[11];
            out[i+12] = ai0 * b[12] + ai1 * b[13] + ai2 * b[14] + ai3 * b[15];
        }
        return out;
    }
}

window.WebGPURenderer = WebGPURenderer;
