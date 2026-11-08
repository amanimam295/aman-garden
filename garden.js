/**
 * Botanica Sanctuary - Interactive 3D Living Flower Garden
 * Built with Three.js
 */

(function() {
    'use strict';

    // Scene variables
    let scene, camera, renderer, controls;
    let clock = new THREE.Clock();
    let flowers = [];
    let butterflies = [];
    let petalParticles, fireflyParticles, waterParticles;
    let grassInstancedMesh;
    let windStrength = 0.5;
    let currentTimeOfDay = 'day';
    let isTouring = false;
    let tourAngle = 0;
    let isWatering = false;

    // Lights
    let sunLight, hemiLight, ambientLight, roseSpotLight;
    let skyMesh;

    // Camera targets for smooth cinematic tweening
    let targetCameraPos = new THREE.Vector3(0, 3.2, 7.8);
    let targetLookAt = new THREE.Vector3(0, 1.2, 2.5);
    let currentLookAt = new THREE.Vector3(0, 1.2, 2.5);
    let isTransitioningCamera = false;
    let cameraTransitionProgress = 1;

    // Raycaster for flower interactions
    const raycaster = new THREE.Raycaster();
    const mouse = new THREE.Vector2();

    // Botanical Flower Database
    const flowerData = {
        rose: {
            tag: 'Front Centre Feature',
            title: 'Velvet Grandiflora Red Rose',
            latin: 'Rosa grandiflora "Crimson Majesty"',
            desc: 'Over 140 velvety crimson red roses dominate the very front center of the sanctuary. Known as the undisputed queen of flowers, each blossom features dozens of spiraling petals imbued with deep ruby hues, velvet sheen, and morning dew.',
            symbolism: 'Immortal Love, Passion, Majesty',
            scent: 'Rich Damask, Honeyed Velvet',
            bloom: 'Perpetual Spring to Autumn',
            count: '150+ Blossoms in Center Mound'
        },
        sunflower: {
            tag: 'Majestic Backdrop',
            title: 'Golden Mammoth Sunflower',
            latin: 'Helianthus annuus',
            desc: 'Towering at over 10 feet along the northern garden perimeter, these golden beacons turn their textured spiral seed heads toward the sun, providing an awe-inspiring sunny backdrop.',
            symbolism: 'Adoration, Loyalty, Radiant Vitality',
            scent: 'Earthy, Sweet Meadow Sunshine',
            bloom: 'High Summer to Harvest',
            count: '42 Towering Beacons'
        },
        tulip: {
            tag: 'Western Flank',
            title: 'Royal Chalice Tulips',
            latin: 'Tulipa gesneriana',
            desc: 'Gracefully curving chalices in shades of royal magenta, warm gold, violet, and scarlet. Their smooth upright posture and silken petals create elegant ribbons of color along the western terrace.',
            symbolism: 'Elegance, Rebirth, Perfect Grace',
            scent: 'Crisp Green, Subtle Spice',
            bloom: 'Early to Mid Spring',
            count: '75 Blossoms in Waves'
        },
        lily: {
            tag: 'Eastern Flank',
            title: 'Star-Gazer & Madonna Lilies',
            latin: 'Lilium orientalis & candidum',
            desc: 'Dramatic starburst blossoms featuring six recurved reflexed petals with delicate crimson freckles, powdery golden anthers, and an intoxicating, sweet fragrance drifting through the breeze.',
            symbolism: 'Purity, Divine Radiance, Renewal',
            scent: 'Intense Heady Floral Perfume',
            bloom: 'Mid Summer',
            count: '54 Stargazer & White Blooms'
        },
        daisy: {
            tag: 'Meadow Carpeting',
            title: 'Crisp Meadow Daisies',
            latin: 'Bellis perennis',
            desc: 'Cheerful golden button florets framed by pure white ray petals dancing happily across the grassy slopes and framing the front rose garden path.',
            symbolism: 'Innocence, Joy, Cheerful New Beginnings',
            scent: 'Fresh Cut Grass & Herbal Nectar',
            bloom: 'All Season Long',
            count: '110+ Cheerful Wildflowers'
        }
    };

    // Initialize Everything
    window.addEventListener('DOMContentLoaded', init);

    function init() {
        const container = document.getElementById('canvas-container');

        // Scene
        scene = new THREE.Scene();
        scene.fog = new THREE.FogExp2(0xd6e8f7, 0.022);

        // Camera
        camera = new THREE.PerspectiveCamera(52, window.innerWidth / window.innerHeight, 0.1, 150);
        camera.position.copy(targetCameraPos);

        // Renderer
        renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false, powerPreference: 'high-performance' });
        renderer.setSize(window.innerWidth, window.innerHeight);
        renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
        renderer.shadowMap.enabled = true;
        renderer.shadowMap.type = THREE.PCFSoftShadowMap;
        renderer.toneMapping = THREE.ACESFilmicToneMapping;
        renderer.toneMappingExposure = 1.15;
        container.appendChild(renderer.domElement);

        // OrbitControls
        controls = new THREE.OrbitControls(camera, renderer.domElement);
        controls.enableDamping = true;
        controls.dampingFactor = 0.05;
        controls.maxPolarAngle = Math.PI / 2 - 0.02; // Don't go below ground
        controls.minDistance = 2.0;
        controls.maxDistance = 25.0;
        controls.target.copy(currentLookAt);

        // Build Environment & Flowers
        setupLighting();
        setupSkyDome();
        setupTerrain();
        setupGrass();

        // Build Garden Flora:
        createRosesInFrontCenter(); // THE HELL LOT OF RED ROSES IN VERY FRONT CENTRE!
        createSunflowers();         // Back arc
        createTulips();             // Left side
        createLilies();             // Right side
        createDaisies();            // Scattered carpeting

        // Atmospheric Systems
        setupFallingRosePetals();
        setupFirefliesAndDust();
        setupWaterDroplets();
        setupButterflies();

        // UI Listeners & Interactions
        setupUIEvents();
        window.addEventListener('resize', onWindowResize);
        renderer.domElement.addEventListener('click', onSceneClick);

        // Hide loader after brief warm-up
        setTimeout(() => {
            const loader = document.getElementById('loader-overlay');
            if (loader) {
                const bar = document.querySelector('.loader-bar');
                if (bar) bar.style.width = '100%';
                setTimeout(() => loader.classList.add('hidden'), 400);
            }
        }, 600);

        // Start render loop
        animate();
    }

    // --------------------------------------------------------------------------
    // LIGHTING & ATMOSPHERE
    // --------------------------------------------------------------------------
    function setupLighting() {
        ambientLight = new THREE.AmbientLight(0xfff5ea, 0.55);
        scene.add(ambientLight);

        hemiLight = new THREE.HemisphereLight(0x90c8f8, 0x3d5a28, 0.65);
        scene.add(hemiLight);

        sunLight = new THREE.DirectionalLight(0xfff7e6, 1.45);
        sunLight.position.set(12, 18, 10);
        sunLight.castShadow = true;
        sunLight.shadow.mapSize.width = 2048;
        sunLight.shadow.mapSize.height = 2048;
        sunLight.shadow.camera.near = 0.5;
        sunLight.shadow.camera.far = 45;
        const d = 14;
        sunLight.shadow.camera.left = -d;
        sunLight.shadow.camera.right = d;
        sunLight.shadow.camera.top = d;
        sunLight.shadow.camera.bottom = -d;
        sunLight.shadow.bias = -0.0004;
        scene.add(sunLight);

        // Dedicated soft glamour spotlight pointing at the front-center red roses
        roseSpotLight = new THREE.SpotLight(0xff7088, 1.2, 18, Math.PI / 4, 0.5, 1.2);
        roseSpotLight.position.set(0, 7, 6);
        roseSpotLight.target.position.set(0, 0.8, 3.2);
        scene.add(roseSpotLight);
        scene.add(roseSpotLight.target);
    }

    function setupSkyDome() {
        const skyGeo = new THREE.SphereGeometry(80, 32, 16);
        const skyMat = new THREE.MeshBasicMaterial({
            color: 0x82b8ec,
            side: THREE.BackSide
        });
        skyMesh = new THREE.Mesh(skyGeo, skyMat);
        scene.add(skyMesh);
    }

    // --------------------------------------------------------------------------
    // TERRAIN & MOUNDS
    // --------------------------------------------------------------------------
    function setupTerrain() {
        const terrainGeo = new THREE.PlaneGeometry(36, 36, 64, 64);
        terrainGeo.rotateX(-Math.PI / 2);

        const pos = terrainGeo.attributes.position;
        for (let i = 0; i < pos.count; i++) {
            const x = pos.getX(i);
            const z = pos.getZ(i);

            // Natural rolling garden slopes
            let y = Math.sin(x * 0.18) * Math.cos(z * 0.18) * 0.45;

            // Mound for the front center red roses bed
            // Centered around x: 0, z: 3.2
            const distFromRoseCenter = Math.hypot(x, z - 3.2);
            if (distFromRoseCenter < 4.2) {
                const moundElev = Math.cos((distFromRoseCenter / 4.2) * (Math.PI / 2)) * 0.55;
                y += moundElev;
            }

            // Gentle rise toward the back for the towering sunflowers
            if (z < -1.5) {
                y += Math.min(1.2, Math.abs(z + 1.5) * 0.18);
            }

            pos.setY(i, y);
        }
        terrainGeo.computeVertexNormals();

        // Lush turf material with dark rich loam in the center rose bed
        const canvas = document.createElement('canvas');
        canvas.width = 512;
        canvas.height = 512;
        const ctx = canvas.getContext('2d');
        // Rich grass base
        ctx.fillStyle = '#2d5a27';
        ctx.fillRect(0, 0, 512, 512);

        // Add organic micro-texture spots
        for (let i = 0; i < 4000; i++) {
            const px = Math.random() * 512;
            const py = Math.random() * 512;
            const r = Math.random() * 3 + 1;
            ctx.fillStyle = Math.random() > 0.4 ? '#386c31' : (Math.random() > 0.5 ? '#24491f' : '#3e4a28');
            ctx.beginPath();
            ctx.arc(px, py, r, 0, Math.PI * 2);
            ctx.fill();
        }

        const groundTex = new THREE.CanvasTexture(canvas);
        groundTex.wrapS = THREE.RepeatWrapping;
        groundTex.wrapT = THREE.RepeatWrapping;
        groundTex.repeat.set(10, 10);

        const terrainMat = new THREE.MeshStandardMaterial({
            map: groundTex,
            roughness: 0.88,
            metalness: 0.05
        });

        const terrain = new THREE.Mesh(terrainGeo, terrainMat);
        terrain.receiveShadow = true;
        scene.add(terrain);

        // Decorative stone garden border around the red rose sanctuary
        createRoseGardenBorder();
    }

    function createRoseGardenBorder() {
        const stoneGeo = new THREE.DodecahedronGeometry(0.18, 1);
        const stoneMat = new THREE.MeshStandardMaterial({
            color: 0x8a847e,
            roughness: 0.9,
            metalness: 0.1
        });

        const numStones = 38;
        const radiusX = 3.8;
        const radiusZ = 2.4;
        const centerZ = 3.2;

        for (let i = 0; i < numStones; i++) {
            const angle = (i / numStones) * Math.PI * 2;
            const x = Math.sin(angle) * radiusX + (Math.random() - 0.5) * 0.15;
            const z = centerZ + Math.cos(angle) * radiusZ + (Math.random() - 0.5) * 0.15;

            // Compute ground height
            const y = getTerrainHeight(x, z) + 0.04;

            const stone = new THREE.Mesh(stoneGeo, stoneMat);
            stone.position.set(x, y, z);
            stone.scale.set(
                0.8 + Math.random() * 0.5,
                0.5 + Math.random() * 0.4,
                0.8 + Math.random() * 0.5
            );
            stone.rotation.set(Math.random(), Math.random(), Math.random());
            stone.castShadow = true;
            stone.receiveShadow = true;
            scene.add(stone);
        }
    }

    // Helper: calculate terrain height at (x, z)
    function getTerrainHeight(x, z) {
        let y = Math.sin(x * 0.18) * Math.cos(z * 0.18) * 0.45;
        const distFromRose = Math.hypot(x, z - 3.2);
        if (distFromRose < 4.2) {
            y += Math.cos((distFromRose / 4.2) * (Math.PI / 2)) * 0.55;
        }
        if (z < -1.5) {
            y += Math.min(1.2, Math.abs(z + 1.5) * 0.18);
        }
        return y;
    }

    // --------------------------------------------------------------------------
    // INSTANCED GRASS BLADES FOR DELIGHTFUL SWAY
    // --------------------------------------------------------------------------
    function setupGrass() {
        const bladeGeo = new THREE.ConeGeometry(0.045, 0.42, 3);
        bladeGeo.translate(0, 0.21, 0);

        const bladeMat = new THREE.MeshStandardMaterial({
            color: 0x478036,
            roughness: 0.7,
            metalness: 0.02
        });

        const count = 3800;
        grassInstancedMesh = new THREE.InstancedMesh(bladeGeo, bladeMat, count);
        const dummy = new THREE.Object3D();

        for (let i = 0; i < count; i++) {
            // Scatter grass over the grounds
            const x = (Math.random() - 0.5) * 26;
            const z = (Math.random() - 0.5) * 26;
            const y = getTerrainHeight(x, z);

            dummy.position.set(x, y, z);
            const scale = 0.6 + Math.random() * 0.7;
            dummy.scale.set(scale, scale * (0.8 + Math.random() * 0.5), scale);
            dummy.rotation.y = Math.random() * Math.PI * 2;
            dummy.rotation.x = (Math.random() - 0.5) * 0.35;
            dummy.rotation.z = (Math.random() - 0.5) * 0.35;
            dummy.updateMatrix();

            grassInstancedMesh.setMatrixAt(i, dummy.matrix);
        }

        grassInstancedMesh.receiveShadow = true;
        scene.add(grassInstancedMesh);
    }

    // --------------------------------------------------------------------------
    // 1. THE FRONT CENTRE: A HELL LOT OF RED ROSES! (140+ Dense Crimson Blooms)
    // --------------------------------------------------------------------------
    function createRosesInFrontCenter() {
        // Red rose color variations for depth & velvety luster
        const roseColorHues = [
            0x880012, // Deep wine crimson
            0xa40b24, // Rich ruby
            0xc41432, // Classic vivid rose red
            0xd91636, // Scarlet bloom highlight
            0x720412, // Velvet midnight crimson
            0xb20d2b  // Cardinal red
        ];

        // Shared reusable geometries for performance with high-detail look
        const petalInnerGeo = createCurvedPetalGeometry(0.18, 0.32, 0.12);
        const petalMidGeo = createCurvedPetalGeometry(0.28, 0.42, 0.18);
        const petalOuterGeo = createCurvedPetalGeometry(0.38, 0.52, 0.24);
        const sepalGeo = new THREE.ConeGeometry(0.04, 0.22, 3);
        sepalGeo.rotateX(Math.PI);

        const stemGeo = new THREE.CylinderGeometry(0.024, 0.03, 0.8, 6);
        stemGeo.translate(0, 0.4, 0);

        const leafGeo = createRoseLeafGeometry();

        // 145 lush red roses tightly packed in the front center!
        const totalRoses = 145;
        const centerZ = 3.2;
        const radiusX = 3.4;
        const radiusZ = 2.1;

        for (let i = 0; i < totalRoses; i++) {
            // Distribute densely inside an ellipse centered right in the front
            // Use polar sampling with square root of radius for uniform/dense packing
            const angle = Math.random() * Math.PI * 2;
            const r = Math.sqrt(Math.random());
            const x = Math.cos(angle) * radiusX * r + (Math.random() - 0.5) * 0.2;
            const z = centerZ + Math.sin(angle) * radiusZ * r + (Math.random() - 0.5) * 0.2;

            const groundY = getTerrainHeight(x, z);

            // Group for this rose
            const roseGroup = new THREE.Group();
            roseGroup.position.set(x, groundY, z);

            // Stem height and natural tilt
            const stemHeight = 0.65 + Math.random() * 0.45;
            const roseScale = 0.8 + Math.random() * 0.45;
            roseGroup.scale.set(roseScale, roseScale, roseScale);

            // Rose stem
            const stemMat = new THREE.MeshStandardMaterial({
                color: 0x1f471e,
                roughness: 0.6,
                metalness: 0.05
            });
            const stemMesh = new THREE.Mesh(stemGeo, stemMat);
            stemMesh.scale.set(1, stemHeight, 1);
            stemMesh.castShadow = true;
            roseGroup.add(stemMesh);

            // Add small rose leaves branching from stem
            const leavesCount = 2 + Math.floor(Math.random() * 2);
            for (let l = 0; l < leavesCount; l++) {
                const leafMat = new THREE.MeshStandardMaterial({
                    color: 0x1b431c,
                    roughness: 0.4,
                    metalness: 0.1,
                    side: THREE.DoubleSide
                });
                const leafMesh = new THREE.Mesh(leafGeo, leafMat);
                leafMesh.position.set(0, 0.25 + l * 0.22, 0);
                leafMesh.rotation.y = (l * 2.2) + Math.random() * 0.5;
                leafMesh.rotation.z = 0.55 + Math.random() * 0.2;
                leafMesh.scale.set(0.7, 0.7, 0.7);
                roseGroup.add(leafMesh);
            }

            // Head group positioned at the top of stem
            const headGroup = new THREE.Group();
            headGroup.position.set(0, stemHeight * 0.8, 0);

            // Pick color hue
            const primaryColor = roseColorHues[Math.floor(Math.random() * roseColorHues.length)];
            const petalMat = new THREE.MeshStandardMaterial({
                color: primaryColor,
                roughness: 0.32, // Velvety soft sheen
                metalness: 0.08,
                side: THREE.DoubleSide,
                shadowSide: THREE.DoubleSide
            });

            // 1. Inner core: 4 tightly furled spiral petals
            for (let p = 0; p < 4; p++) {
                const petal = new THREE.Mesh(petalInnerGeo, petalMat);
                petal.rotation.y = (p / 4) * Math.PI * 2 + Math.random() * 0.2;
                petal.rotation.x = 0.15;
                petal.castShadow = true;
                headGroup.add(petal);
            }

            // 2. Middle layer: 6 cupped overlapping petals
            for (let p = 0; p < 6; p++) {
                const petal = new THREE.Mesh(petalMidGeo, petalMat);
                petal.rotation.y = (p / 6) * Math.PI * 2 + 0.35;
                petal.rotation.x = 0.38 + Math.random() * 0.12;
                petal.position.y = -0.02;
                petal.castShadow = true;
                headGroup.add(petal);
            }

            // 3. Outer glorious flared petals: 8 broad reflexed petals
            for (let p = 0; p < 8; p++) {
                const petal = new THREE.Mesh(petalOuterGeo, petalMat);
                petal.rotation.y = (p / 8) * Math.PI * 2 + 0.75;
                petal.rotation.x = 0.72 + Math.random() * 0.15; // Elegantly drooping open
                petal.position.y = -0.05;
                petal.castShadow = true;
                headGroup.add(petal);
            }

            // 4. Calyx green sepals at the base
            const sepalMat = new THREE.MeshStandardMaterial({ color: 0x1f471e, roughness: 0.6 });
            for (let s = 0; s < 5; s++) {
                const sepal = new THREE.Mesh(sepalGeo, sepalMat);
                sepal.rotation.y = (s / 5) * Math.PI * 2;
                sepal.rotation.z = 1.1;
                sepal.position.set(0, -0.06, 0);
                headGroup.add(sepal);
            }

            // 5. Glistening dewdrop on some petals!
            if (Math.random() > 0.45) {
                const dewGeo = new THREE.SphereGeometry(0.024, 8, 8);
                const dewMat = new THREE.MeshStandardMaterial({
                    color: 0xffffff,
                    roughness: 0.05,
                    metalness: 0.85
                });
                const dew = new THREE.Mesh(dewGeo, dewMat);
                dew.position.set(0.12, 0.15, 0.14);
                headGroup.add(dew);
            }

            // Tilt head gracefully
            headGroup.rotation.x = (Math.random() - 0.4) * 0.4;
            headGroup.rotation.z = (Math.random() - 0.5) * 0.4;
            headGroup.rotation.y = Math.random() * Math.PI * 2;

            roseGroup.add(headGroup);

            // Keep reference for wind animation and interaction
            roseGroup.userData = {
                type: 'rose',
                headGroup: headGroup,
                baseRotX: roseGroup.rotation.x,
                baseRotZ: roseGroup.rotation.z,
                swaySpeed: 1.2 + Math.random() * 0.6,
                swayPhase: x * 1.5 + z * 1.2
            };

            scene.add(roseGroup);
            flowers.push(roseGroup);
        }
    }

    // Helper: Construct curved rose petal geometry
    function createCurvedPetalGeometry(width, height, curl) {
        const shape = new THREE.Shape();
        shape.moveTo(0, 0);
        shape.bezierCurveTo(-width * 0.8, height * 0.35, -width, height * 0.85, 0, height);
        shape.bezierCurveTo(width, height * 0.85, width * 0.8, height * 0.35, 0, 0);

        const geo = new THREE.ShapeGeometry(shape, 8);
        const pos = geo.attributes.position;
        // Curve the vertices in Z to make cupped 3D petals
        for (let i = 0; i < pos.count; i++) {
            const vy = pos.getY(i);
            const factor = vy / height;
            const zCurve = Math.sin(factor * Math.PI) * curl;
            pos.setZ(i, zCurve);
        }
        geo.computeVertexNormals();
        return geo;
    }

    // Helper: Rose serrated leaf geometry
    function createRoseLeafGeometry() {
        const shape = new THREE.Shape();
        shape.moveTo(0, 0);
        shape.bezierCurveTo(-0.12, 0.1, -0.14, 0.28, 0, 0.4);
        shape.bezierCurveTo(0.14, 0.28, 0.12, 0.1, 0, 0);
        const geo = new THREE.ShapeGeometry(shape, 6);
        geo.computeVertexNormals();
        return geo;
    }

    // --------------------------------------------------------------------------
    // 2. SUNFLOWERS (Towering Grand Backdrop)
    // --------------------------------------------------------------------------
    function createSunflowers() {
        const totalSunflowers = 38;
        const stemGeo = new THREE.CylinderGeometry(0.065, 0.08, 4.2, 8);
        stemGeo.translate(0, 2.1, 0);

        // Center disk geometry
        const centerGeo = new THREE.CylinderGeometry(0.68, 0.65, 0.18, 24);
        centerGeo.rotateX(Math.PI / 2);

        // Dark chocolate textured center disk
        const discMat = new THREE.MeshStandardMaterial({
            color: 0x3d2010,
            roughness: 0.9,
            metalness: 0.05
        });

        // Golden ray petal geometry
        const rayShape = new THREE.Shape();
        rayShape.moveTo(0, 0);
        rayShape.bezierCurveTo(-0.14, 0.35, -0.16, 0.7, 0, 1.05);
        rayShape.bezierCurveTo(0.16, 0.7, 0.14, 0.35, 0, 0);
        const rayGeo = new THREE.ShapeGeometry(rayShape, 6);
        rayGeo.computeVertexNormals();

        const petalMat = new THREE.MeshStandardMaterial({
            color: 0xffb703,
            roughness: 0.38,
            metalness: 0.05,
            side: THREE.DoubleSide
        });

        const stemMat = new THREE.MeshStandardMaterial({ color: 0x2e5c24, roughness: 0.7 });

        for (let i = 0; i < totalSunflowers; i++) {
            // Arc along the back of the garden
            const t = (i / totalSunflowers) * Math.PI * 1.1 - (Math.PI * 0.05);
            const arcRadius = 10.5 + (Math.random() - 0.5) * 2.2;
            const x = Math.cos(t) * arcRadius;
            const z = -Math.sin(t) * 4.2 - 3.8 + (Math.random() - 0.5) * 1.8;

            const groundY = getTerrainHeight(x, z);

            const group = new THREE.Group();
            group.position.set(x, groundY, z);

            const heightScale = 0.85 + Math.random() * 0.35;
            group.scale.set(heightScale, heightScale, heightScale);

            // Tall thick stem
            const stemMesh = new THREE.Mesh(stemGeo, stemMat);
            stemMesh.castShadow = true;
            group.add(stemMesh);

            // Big broad leaves along stem
            for (let l = 0; l < 4; l++) {
                const leafGroup = new THREE.Group();
                leafGroup.position.set(0, 1.0 + l * 0.7, 0);
                leafGroup.rotation.y = l * 1.8 + Math.random() * 0.4;
                leafGroup.rotation.z = 0.65;

                const leafMesh = new THREE.Mesh(rayGeo, stemMat);
                leafMesh.scale.set(1.4, 1.2, 1);
                leafGroup.add(leafMesh);
                group.add(leafGroup);
            }

            // Sunflower Flower Head
            const head = new THREE.Group();
            head.position.set(0, 4.2, 0);

            // Center seed disc
            const centerMesh = new THREE.Mesh(centerGeo, discMat);
            centerMesh.castShadow = true;
            head.add(centerMesh);

            // Ring of 28 vibrant golden petals
            for (let p = 0; p < 28; p++) {
                const ray = new THREE.Mesh(rayGeo, petalMat);
                const angle = (p / 28) * Math.PI * 2;
                ray.rotation.z = angle;
                ray.position.set(Math.cos(angle) * 0.65, Math.sin(angle) * 0.65, 0.02);
                ray.scale.set(1, 0.95 + Math.random() * 0.2, 1);
                ray.castShadow = true;
                head.add(ray);
            }

            // Tilt head toward sunlight/camera
            head.rotation.x = 0.35;
            head.rotation.y = Math.atan2(-x, 6 - z) * 0.4; // Face gently forward

            group.add(head);

            group.userData = {
                type: 'sunflower',
                headGroup: head,
                swaySpeed: 0.8 + Math.random() * 0.3,
                swayPhase: x * 0.8
            };

            scene.add(group);
            flowers.push(group);
        }
    }

    // --------------------------------------------------------------------------
    // 3. TULIPS (Western Flank: Jewel-Tone Chalices)
    // --------------------------------------------------------------------------
    function createTulips() {
        const tulipColors = [
            0x9d174d, // Royal wine/magenta
            0xf59e0b, // Golden yellow
            0xec4899, // Pink blush
            0xe11d48, // Crimson scarlet
            0x7c3aed, // Velvet violet
            0xffedd5  // Soft cream white
        ];

        const totalTulips = 70;
        const stemGeo = new THREE.CylinderGeometry(0.02, 0.024, 0.9, 6);
        stemGeo.translate(0, 0.45, 0);

        // Cup petal geometry
        const shape = new THREE.Shape();
        shape.moveTo(0, 0);
        shape.bezierCurveTo(-0.16, 0.2, -0.18, 0.6, 0, 0.72);
        shape.bezierCurveTo(0.18, 0.6, 0.16, 0.2, 0, 0);
        const petalGeo = new THREE.ShapeGeometry(shape, 6);
        petalGeo.computeVertexNormals();

        // Tulip leaf
        const leafShape = new THREE.Shape();
        leafShape.moveTo(0, 0);
        leafShape.bezierCurveTo(-0.1, 0.3, -0.12, 0.7, 0, 0.95);
        leafShape.bezierCurveTo(0.12, 0.7, 0.1, 0.3, 0, 0);
        const leafGeo = new THREE.ShapeGeometry(leafShape, 6);
        leafGeo.computeVertexNormals();

        const stemMat = new THREE.MeshStandardMaterial({ color: 0x4d7c0f, roughness: 0.6 });

        for (let i = 0; i < totalTulips; i++) {
            // Grouped along west flank: x: -7.5 to -2.2, z: -2.5 to 2.2
            const x = -3.0 - Math.random() * 4.6;
            const z = -2.5 + Math.random() * 4.8;
            const groundY = getTerrainHeight(x, z);

            const group = new THREE.Group();
            group.position.set(x, groundY, z);

            const scale = 0.8 + Math.random() * 0.4;
            group.scale.set(scale, scale, scale);

            // Stem
            const stem = new THREE.Mesh(stemGeo, stemMat);
            stem.castShadow = true;
            group.add(stem);

            // Upright broad leaves
            const leafMesh = new THREE.Mesh(leafGeo, stemMat);
            leafMesh.position.set(0, 0.05, 0);
            leafMesh.rotation.y = Math.random() * Math.PI;
            leafMesh.rotation.z = 0.32;
            group.add(leafMesh);

            // Head
            const head = new THREE.Group();
            head.position.set(0, 0.9, 0);

            const col = tulipColors[Math.floor(Math.random() * tulipColors.length)];
            const petalMat = new THREE.MeshStandardMaterial({
                color: col,
                roughness: 0.35,
                side: THREE.DoubleSide
            });

            // 6 overlapping cup petals
            for (let p = 0; p < 6; p++) {
                const petal = new THREE.Mesh(petalGeo, petalMat);
                petal.rotation.y = (p / 6) * Math.PI * 2;
                petal.rotation.x = 0.22; // Inward cup angle
                petal.castShadow = true;
                head.add(petal);
            }

            group.add(head);

            group.userData = {
                type: 'tulip',
                headGroup: head,
                swaySpeed: 1.4 + Math.random() * 0.5,
                swayPhase: x * 1.2
            };

            scene.add(group);
            flowers.push(group);
        }
    }

    // --------------------------------------------------------------------------
    // 4. LILIES (Eastern Flank: Stargazer & Pure White Lilies)
    // --------------------------------------------------------------------------
    function createLilies() {
        const totalLilies = 52;
        const stemGeo = new THREE.CylinderGeometry(0.024, 0.028, 1.1, 6);
        stemGeo.translate(0, 0.55, 0);

        // Long starry reflexed petal
        const shape = new THREE.Shape();
        shape.moveTo(0, 0);
        shape.bezierCurveTo(-0.14, 0.25, -0.16, 0.65, 0, 0.9);
        shape.bezierCurveTo(0.16, 0.65, 0.14, 0.25, 0, 0);
        const petalGeo = new THREE.ShapeGeometry(shape, 8);
        petalGeo.computeVertexNormals();

        const stemMat = new THREE.MeshStandardMaterial({ color: 0x3f6212, roughness: 0.6 });

        const pinkMat = new THREE.MeshStandardMaterial({
            color: 0xf472b6, // Stargazer vibrant pink
            roughness: 0.35,
            side: THREE.DoubleSide
        });

        const whiteMat = new THREE.MeshStandardMaterial({
            color: 0xfefefe, // Madonna pristine white
            roughness: 0.35,
            side: THREE.DoubleSide
        });

        const antherMat = new THREE.MeshStandardMaterial({ color: 0xc2410c, roughness: 0.8 }); // Rust orange pollen

        for (let i = 0; i < totalLilies; i++) {
            // East flank: x: 2.2 to 7.5, z: -2.5 to 2.2
            const x = 3.0 + Math.random() * 4.6;
            const z = -2.5 + Math.random() * 4.8;
            const groundY = getTerrainHeight(x, z);

            const group = new THREE.Group();
            group.position.set(x, groundY, z);

            const scale = 0.8 + Math.random() * 0.45;
            group.scale.set(scale, scale, scale);

            // Stem
            const stem = new THREE.Mesh(stemGeo, stemMat);
            stem.castShadow = true;
            group.add(stem);

            // Head
            const head = new THREE.Group();
            head.position.set(0, 1.1, 0);

            const isPink = Math.random() > 0.45;
            const petalMat = isPink ? pinkMat : whiteMat;

            // 6 star-flared reflexed petals
            for (let p = 0; p < 6; p++) {
                const petal = new THREE.Mesh(petalGeo, petalMat);
                petal.rotation.y = (p / 6) * Math.PI * 2;
                petal.rotation.x = 0.85; // Flared outward
                petal.castShadow = true;
                head.add(petal);
            }

            // Stamens with pollen anthers
            for (let s = 0; s < 6; s++) {
                const filamentGeo = new THREE.CylinderGeometry(0.006, 0.006, 0.35, 4);
                filamentGeo.translate(0, 0.17, 0);
                const filament = new THREE.Mesh(filamentGeo, stemMat);
                filament.rotation.y = (s / 6) * Math.PI * 2 + 0.3;
                filament.rotation.x = 0.45;

                const anther = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.07, 0.03), antherMat);
                anther.position.set(0, 0.35, 0);
                filament.add(anther);

                head.add(filament);
            }

            // Tilt bloom towards viewer
            head.rotation.x = 0.45 + (Math.random() - 0.5) * 0.2;
            head.rotation.y = Math.random() * Math.PI * 2;

            group.add(head);

            group.userData = {
                type: 'lily',
                headGroup: head,
                swaySpeed: 1.3 + Math.random() * 0.4,
                swayPhase: x * 1.1
            };

            scene.add(group);
            flowers.push(group);
        }
    }

    // --------------------------------------------------------------------------
    // 5. DAISIES (Delightful White & Gold Wildflower Carpeting)
    // --------------------------------------------------------------------------
    function createDaisies() {
        const totalDaisies = 95;
        const stemGeo = new THREE.CylinderGeometry(0.015, 0.018, 0.55, 5);
        stemGeo.translate(0, 0.27, 0);

        const centerGeo = new THREE.SphereGeometry(0.12, 10, 8);
        centerGeo.scale(1, 0.45, 1);

        const petalGeo = new THREE.PlaneGeometry(0.07, 0.35);
        petalGeo.translate(0, 0.17, 0);

        const discMat = new THREE.MeshStandardMaterial({ color: 0xfacc15, roughness: 0.6 });
        const petalMat = new THREE.MeshStandardMaterial({
            color: 0xffffff,
            roughness: 0.4,
            side: THREE.DoubleSide
        });
        const stemMat = new THREE.MeshStandardMaterial({ color: 0x65a30d, roughness: 0.7 });

        for (let i = 0; i < totalDaisies; i++) {
            // Scattered naturally across the lawn, edging the borders
            let x, z;
            if (Math.random() > 0.5) {
                // Front corners flanking the red roses
                x = (Math.random() > 0.5 ? 1 : -1) * (2.8 + Math.random() * 4.5);
                z = 1.2 + Math.random() * 3.8;
            } else {
                // Midfield drifts
                x = (Math.random() - 0.5) * 16;
                z = -1.2 + Math.random() * 3.0;
            }

            const groundY = getTerrainHeight(x, z);

            const group = new THREE.Group();
            group.position.set(x, groundY, z);

            const scale = 0.7 + Math.random() * 0.4;
            group.scale.set(scale, scale, scale);

            // Stem
            const stem = new THREE.Mesh(stemGeo, stemMat);
            stem.castShadow = true;
            group.add(stem);

            // Head
            const head = new THREE.Group();
            head.position.set(0, 0.55, 0);

            // Golden button center
            const disc = new THREE.Mesh(centerGeo, discMat);
            head.add(disc);

            // 18 white radiating petals
            for (let p = 0; p < 18; p++) {
                const petal = new THREE.Mesh(petalGeo, petalMat);
                petal.rotation.z = (p / 18) * Math.PI * 2;
                petal.rotation.x = Math.PI / 2 + 0.1;
                head.add(petal);
            }

            group.add(head);

            group.userData = {
                type: 'daisy',
                headGroup: head,
                swaySpeed: 1.6 + Math.random() * 0.6,
                swayPhase: x * 1.5 + z
            };

            scene.add(group);
            flowers.push(group);
        }
    }

    // --------------------------------------------------------------------------
    // FLOATING ROSE PETALS DRIFTING IN THE WIND
    // --------------------------------------------------------------------------
    function setupFallingRosePetals() {
        const petalCount = 220;
        const geo = new THREE.BufferGeometry();
        const positions = new Float32Array(petalCount * 3);
        const rotations = new Float32Array(petalCount * 3);
        const scales = new Float32Array(petalCount);
        const speeds = new Float32Array(petalCount);

        for (let i = 0; i < petalCount; i++) {
            positions[i * 3 + 0] = (Math.random() - 0.5) * 16;
            positions[i * 3 + 1] = 0.5 + Math.random() * 6.5;
            positions[i * 3 + 2] = -2 + Math.random() * 12;

            rotations[i * 3 + 0] = Math.random() * Math.PI * 2;
            rotations[i * 3 + 1] = Math.random() * Math.PI * 2;
            rotations[i * 3 + 2] = Math.random() * Math.PI * 2;

            scales[i] = 0.08 + Math.random() * 0.09;
            speeds[i] = 0.4 + Math.random() * 0.5;
        }

        geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));

        // Create individual petal quad meshes inside a parent group for realistic tumbling
        const petalShape = createCurvedPetalGeometry(0.12, 0.18, 0.05);
        const petalMat = new THREE.MeshStandardMaterial({
            color: 0xbe123c,
            roughness: 0.35,
            side: THREE.DoubleSide
        });

        petalParticles = new THREE.Group();
        for (let i = 0; i < petalCount; i++) {
            const mesh = new THREE.Mesh(petalShape, petalMat);
            mesh.position.set(positions[i * 3], positions[i * 3 + 1], positions[i * 3 + 2]);
            const s = scales[i];
            mesh.scale.set(s, s, s);
            mesh.userData = {
                speedY: speeds[i],
                rotSpeedX: (Math.random() - 0.5) * 2.5,
                rotSpeedY: (Math.random() - 0.5) * 2.5,
                driftPhase: Math.random() * Math.PI * 2
            };
            petalParticles.add(mesh);
        }

        scene.add(petalParticles);
    }

    // --------------------------------------------------------------------------
    // FIREFLIES & SUN POLLEN PARTICLES
    // --------------------------------------------------------------------------
    function setupFirefliesAndDust() {
        const count = 300;
        const geo = new THREE.BufferGeometry();
        const positions = new Float32Array(count * 3);
        const phases = new Float32Array(count);

        for (let i = 0; i < count; i++) {
            positions[i * 3 + 0] = (Math.random() - 0.5) * 18;
            positions[i * 3 + 1] = 0.4 + Math.random() * 5.0;
            positions[i * 3 + 2] = -4 + Math.random() * 14;
            phases[i] = Math.random() * Math.PI * 2;
        }

        geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
        geo.setAttribute('phase', new THREE.BufferAttribute(phases, 1));

        // Particle texture
        const canvas = document.createElement('canvas');
        canvas.width = 64;
        canvas.height = 64;
        const ctx = canvas.getContext('2d');
        const grad = ctx.createRadialGradient(32, 32, 0, 32, 32, 32);
        grad.addColorStop(0, 'rgba(255,255,255,1)');
        grad.addColorStop(0.3, 'rgba(253, 224, 71, 0.85)');
        grad.addColorStop(1, 'rgba(253, 224, 71, 0)');
        ctx.fillStyle = grad;
        ctx.fillRect(0, 0, 64, 64);
        const particleTex = new THREE.CanvasTexture(canvas);

        const mat = new THREE.PointsMaterial({
            size: 0.18,
            map: particleTex,
            transparent: true,
            blending: THREE.AdditiveBlending,
            depthWrite: false,
            color: 0xfef08a
        });

        fireflyParticles = new THREE.Points(geo, mat);
        scene.add(fireflyParticles);
    }

    // --------------------------------------------------------------------------
    // WATER DROPLET PARTICLES (FOR "WATER GARDEN" BUTTON)
    // --------------------------------------------------------------------------
    function setupWaterDroplets() {
        const count = 350;
        const geo = new THREE.BufferGeometry();
        const positions = new Float32Array(count * 3);
        const velocities = new Float32Array(count);

        for (let i = 0; i < count; i++) {
            positions[i * 3 + 0] = (Math.random() - 0.5) * 10;
            positions[i * 3 + 1] = -10; // hidden until triggered
            positions[i * 3 + 2] = 1.0 + Math.random() * 5.0;
            velocities[i] = 4.0 + Math.random() * 3.0;
        }

        geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));

        const mat = new THREE.PointsMaterial({
            size: 0.08,
            color: 0x93c5fd,
            transparent: true,
            opacity: 0.85,
            blending: THREE.AdditiveBlending
        });

        waterParticles = new THREE.Points(geo, mat);
        waterParticles.userData = { velocities: velocities };
        scene.add(waterParticles);
    }

    // --------------------------------------------------------------------------
    // BUTTERFLIES WITH FLAPPING WINGS
    // --------------------------------------------------------------------------
    function setupButterflies() {
        const butterflyColors = [
            0xf97316, // Monarch orange
            0x38bdf8, // Morpho sky blue
            0xa855f7, // Royal purple
            0xfacc15  // Sulphur yellow
        ];

        for (let i = 0; i < 5; i++) {
            const bGroup = new THREE.Group();

            // Wing geometry: simple triangular wings
            const wingShape = new THREE.Shape();
            wingShape.moveTo(0, 0);
            wingShape.lineTo(-0.16, 0.22);
            wingShape.lineTo(-0.14, -0.15);
            wingShape.closePath();

            const wingGeo = new THREE.ShapeGeometry(wingShape);
            wingGeo.computeVertexNormals();

            const color = butterflyColors[i % butterflyColors.length];
            const wingMat = new THREE.MeshStandardMaterial({
                color: color,
                roughness: 0.4,
                side: THREE.DoubleSide
            });

            const leftWing = new THREE.Mesh(wingGeo, wingMat);
            const rightWing = new THREE.Mesh(wingGeo, wingMat);
            rightWing.scale.x = -1;

            bGroup.add(leftWing);
            bGroup.add(rightWing);

            // Small butterfly body
            const bodyGeo = new THREE.CylinderGeometry(0.015, 0.015, 0.18, 5);
            const bodyMat = new THREE.MeshBasicMaterial({ color: 0x1e293b });
            const body = new THREE.Mesh(bodyGeo, bodyMat);
            bGroup.add(body);

            bGroup.position.set(
                (Math.random() - 0.5) * 8,
                1.2 + Math.random() * 1.5,
                1.5 + Math.random() * 4
            );

            bGroup.userData = {
                leftWing: leftWing,
                rightWing: rightWing,
                orbitRadius: 2.2 + Math.random() * 2.5,
                orbitSpeed: 0.4 + Math.random() * 0.4,
                orbitCenter: new THREE.Vector3(
                    (Math.random() - 0.5) * 5,
                    1.4,
                    2.8 + (Math.random() - 0.5) * 2.5
                ),
                phase: Math.random() * Math.PI * 2,
                flapSpeed: 14 + Math.random() * 6
            };

            butterflies.push(bGroup);
            scene.add(bGroup);
        }
    }

    // --------------------------------------------------------------------------
    // USER INTERACTIONS & EVENT LISTENERS
    // --------------------------------------------------------------------------
    function setupUIEvents() {
        // Preset Tour Buttons
        document.querySelectorAll('.nav-pill').forEach(btn => {
            btn.addEventListener('click', (e) => {
                document.querySelectorAll('.nav-pill').forEach(b => b.classList.remove('active'));
                btn.classList.add('active');

                const target = btn.getAttribute('data-target');
                if (target === 'tour') {
                    isTouring = true;
                    closeDrawer();
                } else {
                    isTouring = false;
                    switchCameraTarget(target);
                }
            });
        });

        // Time of Day Toggle
        document.querySelectorAll('[data-time]').forEach(btn => {
            btn.addEventListener('click', () => {
                document.querySelectorAll('[data-time]').forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                setTimeOfDay(btn.getAttribute('data-time'));
            });
        });

        // Special Actions: Petal Shower
        const showerBtn = document.getElementById('btn-shower');
        if (showerBtn) {
            showerBtn.addEventListener('click', triggerPetalBurst);
        }

        // Water Garden
        const waterBtn = document.getElementById('btn-water');
        if (waterBtn) {
            waterBtn.addEventListener('click', triggerWaterShower);
        }

        // Wind Slider
        const windSlider = document.getElementById('wind-slider');
        if (windSlider) {
            windSlider.addEventListener('input', (e) => {
                windStrength = parseFloat(e.target.value);
            });
        }

        // Audio Button
        const audioBtn = document.getElementById('btn-audio');
        if (audioBtn) {
            audioBtn.addEventListener('click', () => {
                if (window.gardenAudio) {
                    const isPlaying = window.gardenAudio.toggle();
                    audioBtn.classList.toggle('active', isPlaying);
                    audioBtn.innerHTML = isPlaying ? '🔊 Nature Audio: On' : '🔇 Audio: Muted';
                }
            });
        }

        // Close Drawer Button
        const closeBtn = document.querySelector('.drawer-close');
        if (closeBtn) {
            closeBtn.addEventListener('click', closeDrawer);
        }
    }

    function switchCameraTarget(preset) {
        isTransitioningCamera = true;
        cameraTransitionProgress = 0;

        switch (preset) {
            case 'rose':
                // Macro view right into the massive sea of red roses in front center!
                targetCameraPos.set(0, 2.1, 4.6);
                targetLookAt.set(0, 1.1, 3.2);
                showFlowerDetails('rose');
                break;
            case 'sunflower':
                targetCameraPos.set(0, 3.5, 3.0);
                targetLookAt.set(0, 3.8, -4.5);
                showFlowerDetails('sunflower');
                break;
            case 'tulip':
                targetCameraPos.set(-2.2, 2.0, 3.5);
                targetLookAt.set(-5.0, 1.0, 0);
                showFlowerDetails('tulip');
                break;
            case 'lily':
                targetCameraPos.set(2.2, 2.0, 3.5);
                targetLookAt.set(5.0, 1.1, 0);
                showFlowerDetails('lily');
                break;
            case 'daisy':
                targetCameraPos.set(-2.8, 1.3, 4.2);
                targetLookAt.set(-3.6, 0.6, 2.5);
                showFlowerDetails('daisy');
                break;
            default:
                targetCameraPos.set(0, 3.5, 8.0);
                targetLookAt.set(0, 1.2, 2.5);
                closeDrawer();
                break;
        }

        if (window.gardenAudio && !window.gardenAudio.isMuted) {
            window.gardenAudio.playChime();
        }
    }

    function showFlowerDetails(type) {
        const info = flowerData[type];
        if (!info) return;

        const drawer = document.getElementById('info-drawer');
        document.getElementById('drawer-tag').textContent = info.tag;
        document.getElementById('drawer-title').textContent = info.title;
        document.getElementById('drawer-latin').textContent = info.latin;
        document.getElementById('drawer-desc').textContent = info.desc;
        document.getElementById('drawer-symbol').textContent = info.symbolism;
        document.getElementById('drawer-scent').textContent = info.scent;

        drawer.classList.add('open');
    }

    function closeDrawer() {
        const drawer = document.getElementById('info-drawer');
        if (drawer) drawer.classList.remove('open');
    }

    // Time of Day Transitions
    function setTimeOfDay(time) {
        currentTimeOfDay = time;
        if (time === 'day') {
            scene.fog.color.setHex(0xd6e8f7);
            skyMesh.material.color.setHex(0x82b8ec);
            sunLight.color.setHex(0xfff7e6);
            sunLight.intensity = 1.45;
            sunLight.position.set(12, 18, 10);
            ambientLight.color.setHex(0xfff5ea);
            ambientLight.intensity = 0.55;
            roseSpotLight.intensity = 1.2;
            fireflyParticles.material.color.setHex(0xfef08a);
        } else if (time === 'sunset') {
            scene.fog.color.setHex(0xf4a261);
            skyMesh.material.color.setHex(0xd97736);
            sunLight.color.setHex(0xff7a45);
            sunLight.intensity = 1.6;
            sunLight.position.set(18, 5, 8); // Low golden horizon angle
            ambientLight.color.setHex(0xbd5338);
            ambientLight.intensity = 0.45;
            roseSpotLight.intensity = 1.8;
            roseSpotLight.color.setHex(0xff5252);
            fireflyParticles.material.color.setHex(0xfbbf24);
        } else if (time === 'night') {
            scene.fog.color.setHex(0x060d17);
            skyMesh.material.color.setHex(0x040810);
            sunLight.color.setHex(0x60a5fa); // Moonlight
            sunLight.intensity = 0.35;
            sunLight.position.set(-8, 16, -6);
            ambientLight.color.setHex(0x1e293b);
            ambientLight.intensity = 0.3;
            roseSpotLight.intensity = 2.4;
            roseSpotLight.color.setHex(0xf43f5e);
            fireflyParticles.material.color.setHex(0xa3e635); // Vivid glowing lime fireflies
        }
    }

    // Interactive Petal Shower Burst
    function triggerPetalBurst() {
        if (!petalParticles) return;
        petalParticles.children.forEach(mesh => {
            mesh.position.set(
                (Math.random() - 0.5) * 12,
                3.5 + Math.random() * 4,
                1.5 + Math.random() * 5
            );
            mesh.userData.speedY = 1.2 + Math.random() * 1.5;
        });

        if (window.gardenAudio && !window.gardenAudio.isMuted) {
            window.gardenAudio.playChime(783.99);
        }
    }

    // Interactive Water Droplets Shower
    function triggerWaterShower() {
        if (!waterParticles) return;
        const pos = waterParticles.geometry.attributes.position;
        for (let i = 0; i < pos.count; i++) {
            pos.setY(i, 4.0 + Math.random() * 3.0);
            pos.setX(i, (Math.random() - 0.5) * 10);
            pos.setZ(i, 1.2 + Math.random() * 4.5);
        }
        pos.needsUpdate = true;
        isWatering = true;
        setTimeout(() => { isWatering = false; }, 3500);

        if (window.gardenAudio && !window.gardenAudio.isMuted) {
            window.gardenAudio.playChime(1046.50);
        }
    }

    // Scene Click / Tap detection
    function onSceneClick(e) {
        mouse.x = (e.clientX / window.innerWidth) * 2 - 1;
        mouse.y = -(e.clientY / window.innerHeight) * 2 + 1;

        raycaster.setFromCamera(mouse, camera);
        const intersects = raycaster.intersectObjects(flowers, true);

        if (intersects.length > 0) {
            let hit = intersects[0].object;
            // Traverse up to find root flower group
            while (hit.parent && !hit.userData.type && hit.parent !== scene) {
                hit = hit.parent;
            }
            if (hit.userData && hit.userData.type) {
                showFlowerDetails(hit.userData.type);
                if (window.gardenAudio && !window.gardenAudio.isMuted) {
                    window.gardenAudio.playChime();
                }

                // Play little bounce ripple
                if (hit.userData.headGroup) {
                    hit.userData.headGroup.scale.multiplyScalar(1.2);
                    setTimeout(() => {
                        hit.userData.headGroup.scale.set(1, 1, 1);
                    }, 350);
                }
            }
        }
    }

    function onWindowResize() {
        camera.aspect = window.innerWidth / window.innerHeight;
        camera.updateProjectionMatrix();
        renderer.setSize(window.innerWidth, window.innerHeight);
    }

    // --------------------------------------------------------------------------
    // MAIN ANIMATION LOOP
    // --------------------------------------------------------------------------
    function animate() {
        requestAnimationFrame(animate);

        const delta = clock.getDelta();
        const time = clock.getElapsedTime();

        // 1. Natural Wind Sway on Flowers
        const windWave = Math.sin(time * 1.8) * windStrength;
        for (let i = 0; i < flowers.length; i++) {
            const f = flowers[i];
            const sway = Math.sin(time * f.userData.swaySpeed + f.userData.swayPhase) * 0.08 * windStrength;
            f.rotation.z = sway;
            f.rotation.x = sway * 0.5;
        }

        // 2. Falling & Tumbling Rose Petals
        if (petalParticles) {
            for (let i = 0; i < petalParticles.children.length; i++) {
                const p = petalParticles.children[i];
                p.position.y -= p.userData.speedY * delta;
                p.position.x += Math.sin(time + p.userData.driftPhase) * 0.02 * (windStrength + 0.5);
                p.rotation.x += p.userData.rotSpeedX * delta;
                p.rotation.y += p.userData.rotSpeedY * delta;

                // Loop reset
                if (p.position.y < getTerrainHeight(p.position.x, p.position.z)) {
                    p.position.y = 5.5 + Math.random() * 2.0;
                    p.position.x = (Math.random() - 0.5) * 14;
                    p.position.z = -1 + Math.random() * 9;
                }
            }
        }

        // 3. Fireflies / Dust Pulsation & Orbit
        if (fireflyParticles) {
            const pos = fireflyParticles.geometry.attributes.position;
            const phase = fireflyParticles.geometry.attributes.phase;
            for (let i = 0; i < pos.count; i++) {
                let y = pos.getY(i) + Math.sin(time * 2 + phase.getX(i)) * 0.005;
                let x = pos.getX(i) + Math.cos(time * 1.5 + phase.getX(i)) * 0.004;
                pos.setY(i, y);
                pos.setX(i, x);
            }
            pos.needsUpdate = true;
        }

        // 4. Water Droplets Animation
        if (isWatering && waterParticles) {
            const pos = waterParticles.geometry.attributes.position;
            const vels = waterParticles.userData.velocities;
            for (let i = 0; i < pos.count; i++) {
                let py = pos.getY(i) - vels[i] * delta;
                if (py < 0.2) py = 5.0 + Math.random() * 2;
                pos.setY(i, py);
            }
            pos.needsUpdate = true;
        }

        // 5. Butterflies Flying in Organic Loops
        for (let i = 0; i < butterflies.length; i++) {
            const b = butterflies[i];
            const u = b.userData;
            const angle = time * u.orbitSpeed + u.phase;

            // Figure-eight / flower-hopping flight path
            b.position.x = u.orbitCenter.x + Math.sin(angle) * u.orbitRadius;
            b.position.z = u.orbitCenter.z + Math.sin(angle * 2) * (u.orbitRadius * 0.6);
            b.position.y = u.orbitCenter.y + Math.sin(angle * 3) * 0.35;

            // Orient butterfly along movement tangent
            b.rotation.y = angle + Math.PI / 2;

            // Flap wings smoothly
            const flap = Math.sin(time * u.flapSpeed) * 0.85;
            u.leftWing.rotation.y = flap;
            u.rightWing.rotation.y = -flap;
        }

        // 6. Camera Cinematic Tour or Smooth Transitions
        if (isTouring) {
            tourAngle += delta * 0.18;
            camera.position.x = Math.sin(tourAngle) * 8.5;
            camera.position.z = 3.2 + Math.cos(tourAngle) * 5.5;
            camera.position.y = 2.6 + Math.sin(tourAngle * 2) * 0.8;
            controls.target.set(0, 1.2, 2.8);
            controls.update();
        } else if (isTransitioningCamera) {
            cameraTransitionProgress += delta * 1.6;
            if (cameraTransitionProgress >= 1) {
                cameraTransitionProgress = 1;
                isTransitioningCamera = false;
            }
            // Smooth ease-out cubic
            const t = 1 - Math.pow(1 - cameraTransitionProgress, 3);
            camera.position.lerp(targetCameraPos, t * 0.15);
            controls.target.lerp(targetLookAt, t * 0.15);
            controls.update();
        } else {
            controls.update();
        }

        renderer.render(scene, camera);
    }

})();
