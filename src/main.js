import * as THREE from 'three';

let scene, camera, renderer;
let player1, player2;
let keys = {};
let gameActive = false;
let gameTime = 99;
let timerInterval;

const gravity = -0.015;
const playerSpeed = 0.12;
const jumpForce = 0.35;

// Player states
const p1State = {
    x: -8,
    y: 0,
    z: 0,
    vx: 0,
    vy: 0,
    health: 100,
    isJumping: false,
    isAttacking: false,
    attackCooldown: false,
    facing: 1, // 1 is Right, -1 is Left
    mesh: null
};

const p2State = {
    x: 8,
    y: 0,
    z: 0,
    vx: 0,
    vy: 0,
    health: 100,
    isJumping: false,
    isAttacking: false,
    attackCooldown: false,
    facing: -1,
    mesh: null
};

function init() {
    // 1. Scene Setup
    scene = new THREE.Scene();
    scene.background = new THREE.Color(0x05050a);
    scene.fog = new THREE.FogExp2(0x05050a, 0.015);

    // 2. Camera Setup
    camera = new THREE.PerspectiveCamera(50, window.innerWidth / window.innerHeight, 0.1, 1000);
    camera.position.set(0, 4, 18);
    camera.lookAt(0, 1.5, 0);

    // 3. Renderer Setup
    const canvas = document.getElementById('gameCanvas');
    renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;

    // 4. Lights
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.15);
    scene.add(ambientLight);

    const dirLight = new THREE.DirectionalLight(0xffffff, 0.8);
    dirLight.position.set(0, 20, 10);
    dirLight.castShadow = true;
    dirLight.shadow.mapSize.width = 1024;
    dirLight.shadow.mapSize.height = 1024;
    scene.add(dirLight);

    // Neon Center Spotlight
    const spotLight = new THREE.SpotLight(0x00f0ff, 5, 40, Math.PI / 3, 0.5, 1);
    spotLight.position.set(0, 15, 0);
    spotLight.target.position.set(0, 0, 0);
    scene.add(spotLight);

    // 5. Arena Ground (Grid & Neon Plate)
    const floorGeo = new THREE.BoxGeometry(30, 1, 10);
    const floorMat = new THREE.MeshStandardMaterial({
        color: 0x111122,
        roughness: 0.8,
        metalness: 0.5
    });
    const floor = new THREE.Mesh(floorGeo, floorMat);
    floor.position.y = -0.5;
    floor.receiveShadow = true;
    scene.add(floor);

    // Neon Border Lines
    const borderGeo = new THREE.BoxGeometry(30.4, 0.1, 10.4);
    const borderMat = new THREE.MeshBasicMaterial({ color: 0x00f0ff, wireframe: true });
    const border = new THREE.Mesh(borderGeo, borderMat);
    border.position.y = 0.01;
    scene.add(border);

    // Grid Helper for Visual Reference
    const gridHelper = new THREE.GridHelper(30, 15, 0xff007f, 0x444444);
    gridHelper.position.y = 0.02;
    scene.add(gridHelper);

    // 6. Create Fighter Meshes (Stylized Cylinders/Spheres representing Cyber fighters)
    p1State.mesh = createFighter(0x00f0ff); // Player 1 (Neon Blue)
    p2State.mesh = createFighter(0xff007f); // Player 2 (Neon Pink)

    scene.add(p1State.mesh);
    scene.add(p2State.mesh);

    // Set initial positions
    updateFighterPositions();

    // Event Listeners
    window.addEventListener('resize', onWindowResize);
    window.addEventListener('keydown', (e) => keys[e.code] = true);
    window.addEventListener('keyup', (e) => keys[e.code] = false);

    // Keydown for single event triggers (like Attack)
    window.addEventListener('keydown', handleKeyPress);

    animate();
}

function createFighter(color) {
    const group = new THREE.Group();

    // Body
    const bodyGeo = new THREE.CylinderGeometry(0.5, 0.5, 1.8, 16);
    const bodyMat = new THREE.MeshStandardMaterial({ color: color, roughness: 0.3, metalness: 0.8 });
    const body = new THREE.Mesh(bodyGeo, bodyMat);
    body.position.y = 0.9;
    body.castShadow = true;
    group.add(body);

    // Head
    const headGeo = new THREE.SphereGeometry(0.4, 16, 16);
    const headMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.1 });
    const head = new THREE.Mesh(headGeo, headMat);
    head.position.y = 2.1;
    head.castShadow = true;
    group.add(head);

    // Neon Visor
    const visorGeo = new THREE.BoxGeometry(0.6, 0.15, 0.4);
    const visorMat = new THREE.MeshBasicMaterial({ color: color });
    const visor = new THREE.Mesh(visorGeo, visorMat);
    visor.position.set(0, 2.1, 0.25);
    group.add(visor);

    // Fist (Indicator for punches)
    const fistGeo = new THREE.SphereGeometry(0.25, 8, 8);
    const fistMat = new THREE.MeshStandardMaterial({ color: 0xffffff });
    const fist = new THREE.Mesh(fistGeo, fistMat);
    fist.name = "fist";
    fist.position.set(0.5, 0.9, 0.4);
    fist.castShadow = true;
    group.add(fist);

    return group;
}

function handleKeyPress(e) {
    if (!gameActive) return;

    // Player 1 Attack (Key F)
    if (e.code === 'KeyF' && !p1State.isAttacking && !p1State.attackCooldown) {
        performAttack(p1State, p2State, 'blue');
    }

    // Player 2 Attack (Slash Key '/')
    if (e.code === 'Slash' && !p2State.isAttacking && !p2State.attackCooldown) {
        performAttack(p2State, p1State, 'pink');
    }
}

function performAttack(attacker, defender, colorName) {
    attacker.isAttacking = true;
    attacker.attackCooldown = true;

    // Visual Punch Animation (extend fist)
    const fist = attacker.mesh.getObjectByName("fist");
    const originalX = fist.position.x;
    
    // Stretch fist forward
    fist.position.x = attacker.facing * 1.5;

    // Collision Check (Basic overlap range)
    const distance = Math.abs(attacker.x - defender.x);
    if (distance < 2.5 && Math.abs(attacker.y - defender.y) < 1.5) {
        // Hit registered
        defender.health = Math.max(0, defender.health - 12);
        updateHealthUI();
        createHitEffect(defender.x, defender.y + 1);

        // Knockback
        defender.vx = attacker.facing * 0.15;
    }

    // Retract fist and end attack
    setTimeout(() => {
        fist.position.x = originalX;
        attacker.isAttacking = false;
    }, 180);

    setTimeout(() => {
        attacker.attackCooldown = false;
    }, 450);
}

function createHitEffect(x, y) {
    const particleGeo = new THREE.SphereGeometry(0.12, 8, 8);
    const particleMat = new THREE.MeshBasicMaterial({ color: 0xffffff });
    
    const particles = [];
    for(let i=0; i<6; i++) {
        const p = new THREE.Mesh(particleGeo, particleMat);
        p.position.set(x, y, 0);
        scene.add(p);
        particles.push({
            mesh: p,
            vx: (Math.random() - 0.5) * 0.3,
            vy: (Math.random() - 0.5) * 0.3 + 0.1,
            life: 1.0
        });
    }

    const animateParticles = () => {
        let alive = false;
        particles.forEach(p => {
            if (p.life > 0) {
                p.mesh.position.x += p.vx;
                p.mesh.position.y += p.vy;
                p.life -= 0.05;
                p.mesh.scale.set(p.life, p.life, p.life);
                alive = true;
            } else {
                scene.remove(p.mesh);
            }
        });
        if (alive) {
            requestAnimationFrame(animateParticles);
        }
    };
    animateParticles();
}

function updateHealthUI() {
    document.getElementById('p1Health').style.width = p1State.health + '%';
    document.getElementById('p2Health').style.width = p2State.health + '%';

    // Game Over check
    if (p1State.health <= 0 || p2State.health <= 0) {
        endGame();
    }
}

function updatePhysics() {
    if (!gameActive) return;

    // Player 1 controls (A, D, W)
    if (keys['KeyA']) {
        p1State.vx = -playerSpeed;
        p1State.facing = -1;
    } else if (keys['KeyD']) {
        p1State.vx = playerSpeed;
        p1State.facing = 1;
    } else {
        p1State.vx *= 0.8; // Friction
    }

    if (keys['KeyW'] && !p1State.isJumping) {
        p1State.vy = jumpForce;
        p1State.isJumping = true;
    }

    // Player 2 controls (Arrows)
    if (keys['ArrowLeft']) {
        p2State.vx = -playerSpeed;
        p2State.facing = -1;
    } else if (keys['ArrowRight']) {
        p2State.vx = playerSpeed;
        p2State.facing = 1;
    } else {
        p2State.vx *= 0.8;
    }

    if (keys['ArrowUp'] && !p2State.isJumping) {
        p2State.vy = jumpForce;
        p2State.isJumping = true;
    }

    // Apply gravity & boundaries
    applyPlayerPhysics(p1State);
    applyPlayerPhysics(p2State);

    // Keep players facing each other
    if (p1State.x < p2State.x) {
        p1State.facing = 1;
        p2State.facing = -1;
    } else {
        p1State.facing = -1;
        p2State.facing = 1;
    }

    // Rotate player meshes to face their direction
    p1State.mesh.rotation.y = (p1State.facing === 1) ? 0 : Math.PI;
    p2State.mesh.rotation.y = (p2State.facing === 1) ? 0 : Math.PI;

    // Dynamic Camera Tracking (smooth middle track)
    const midX = (p1State.x + p2State.x) / 2;
    const distance = Math.abs(p1State.x - p2State.x);
    camera.position.x += (midX - camera.position.x) * 0.05;
    camera.position.z += (Math.max(14, distance + 6) - camera.position.z) * 0.05;
}

function applyPlayerPhysics(player) {
    // Apply velocity
    player.x += player.vx;
    player.y += player.vy;

    // Gravity
    if (player.y > 0) {
        player.vy += gravity;
    } else {
        player.y = 0;
        player.vy = 0;
        player.isJumping = false;
    }

    // Ring limits (Arena bounding box)
    player.x = Math.max(-14, Math.min(14, player.x));
}

function updateFighterPositions() {
    p1State.mesh.position.set(p1State.x, p1State.y, p1State.z);
    p2State.mesh.position.set(p2State.x, p2State.y, p2State.z);
}

function animate() {
    requestAnimationFrame(animate);

    updatePhysics();
    updateFighterPositions();

    renderer.render(scene, camera);
}

function startTimer() {
    clearInterval(timerInterval);
    timerInterval = setInterval(() => {
        if (!gameActive) return;
        gameTime--;
        document.getElementById('timer').innerText = gameTime;
        if (gameTime <= 0) {
            endGame();
        }
    }, 1000);
}

function endGame() {
    gameActive = false;
    clearInterval(timerInterval);
    
    let winnerMsg = "DRAW GAME";
    if (p1State.health > p2State.health) {
        winnerMsg = "PLAYER 1 WINS";
        document.getElementById('winnerText').className = "winner-text p1-win";
    } else if (p2State.health > p1State.health) {
        winnerMsg = "PLAYER 2 WINS";
        document.getElementById('winnerText').className = "winner-text p2-win";
    } else {
        document.getElementById('winnerText').className = "winner-text";
    }
    
    document.getElementById('winnerText').innerText = winnerMsg;
    document.getElementById('gameOverScreen').classList.remove('hidden');
}

window.initGame = function() {
    gameActive = true;
    gameTime = 99;
    p1State.health = 100;
    p2State.health = 100;
    p1State.x = -8;
    p2State.x = 8;
    updateHealthUI();
    document.getElementById('timer').innerText = gameTime;
    startTimer();
};

window.resetGame = function() {
    window.initGame();
};

onWindowResize();
init();

function onWindowResize() {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
}
