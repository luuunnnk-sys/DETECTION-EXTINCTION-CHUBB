let scene, camera, renderer, controls;
let buildingGroup = new THREE.Group();
let furnitureGroup = new THREE.Group();
let detectionGroup = new THREE.Group();
let extinctionGroup = new THREE.Group();
let manualGroup = new THREE.Group();
let wallColliders = [];
let manualItems = [];

let currentNozzles = [];

let raycaster = new THREE.Raycaster();
let mouse = new THREE.Vector2();
let interactionMode = 'view';
let ghostMesh = null;

const materials = {
    wall: new THREE.MeshStandardMaterial({ color: 0xf5f5f5, roughness: 0.8 }),
    wallInvisible: new THREE.MeshBasicMaterial({ visible: false }),
    floorRoom: new THREE.MeshStandardMaterial({ color: 0xd2b48c, roughness: 0.6 }),
    floorBath: new THREE.MeshStandardMaterial({ color: 0x94a3b8, roughness: 0.4 }),
    ceramic: new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.2, metalness: 0.1 }),
    glass: new THREE.MeshStandardMaterial({ color: 0xa5f3fc, transparent: true, opacity: 0.3, metalness: 0.9, roughness: 0.0 }),
    chrome: new THREE.MeshStandardMaterial({ color: 0xaaaaaa, metalness: 0.9, roughness: 0.1 }),
    wood: new THREE.MeshStandardMaterial({ color: 0x5d4037 }),
    door: new THREE.MeshStandardMaterial({ color: 0x8d6e63 }),
    doorHandle: new THREE.MeshStandardMaterial({ color: 0xcccccc }),
    detector: new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.5 }),
    detectorLed: new THREE.MeshBasicMaterial({ color: 0xff0000 }),
    vesdaPipe: new THREE.MeshStandardMaterial({ color: 0xdc2626 }),
    vesdaBox: new THREE.MeshStandardMaterial({ color: 0x1a1a1a }),
    ig55Cylinder: new THREE.MeshStandardMaterial({ color: 0x22c55e, metalness: 0.4, roughness: 0.4 }), // Green
    ig55Shoulder: new THREE.MeshStandardMaterial({ color: 0x22c55e, metalness: 0.4, roughness: 0.4 }), // Green
    pipeBlack: new THREE.MeshStandardMaterial({ color: 0x1a1a1a, metalness: 0.6, roughness: 0.4 }),
    nozzleChrome: new THREE.MeshStandardMaterial({ color: 0xcccccc, metalness: 0.8, roughness: 0.2 }),
    tankSteel: new THREE.MeshStandardMaterial({ color: 0x94a3b8, metalness: 0.6, roughness: 0.3 }),
    bedSheet: new THREE.MeshStandardMaterial({ color: 0xffffff })
};

const COLORS = { fp: 0xeab308, amb: 0xf97316, fc: 0x22c55e };

function init() {
    const container = document.getElementById('canvas-container');
    scene = new THREE.Scene();
    scene.background = new THREE.Color(0x111111);

    camera = new THREE.PerspectiveCamera(45, window.innerWidth / window.innerHeight, 0.1, 1000);
    camera.position.set(20, 30, 20);

    renderer = new THREE.WebGLRenderer({
        antialias: true,
        preserveDrawingBuffer: true
    });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.shadowMap.enabled = true;
    container.appendChild(renderer.domElement);

    controls = new THREE.OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;

    const ambLight = new THREE.AmbientLight(0xffffff, 0.6);
    scene.add(ambLight);
    const dirLight = new THREE.DirectionalLight(0xffffff, 0.7);
    dirLight.position.set(10, 20, 10);
    dirLight.castShadow = true;
    scene.add(dirLight);

    scene.add(buildingGroup);
    scene.add(furnitureGroup);
    scene.add(detectionGroup);
    scene.add(extinctionGroup);
    scene.add(manualGroup);

    window.addEventListener('resize', () => {
        camera.aspect = window.innerWidth / window.innerHeight;
        camera.updateProjectionMatrix();
        renderer.setSize(window.innerWidth, window.innerHeight);
    });

    renderer.domElement.addEventListener('click', onCanvasClick);
    renderer.domElement.addEventListener('mousemove', onCanvasMove);
    renderer.domElement.addEventListener('contextmenu', (e) => {
        e.preventDefault();
        setMode('view');
    });

    updateUseCaseUI();
    updateDetectionUI();
    updateExtinctionUI();
    updateAll();
    animate();
}

// --- Python Backend Integration ---
async function fetchGasCalculation() {
    const L = parseFloat(document.getElementById('dim-l').value);
    const W = parseFloat(document.getElementById('dim-w').value);
    const hFP = parseFloat(document.getElementById('h-fp').value);
    const hAmb = parseFloat(document.getElementById('h-amb').value);
    const hFC = parseFloat(document.getElementById('h-fc').value);

    const payload = {
        length: L,
        width: W,
        height_fp: hFP,
        height_amb: hAmb,
        height_fc: hFC,
        temperature: 20 // Could add a UI input for this
    };

    try {
        const response = await fetch('/api/calculate-gas', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });

        if (response.ok) {
            const data = await response.json();
            updateGasResultsUI(data);
            updateExtinctionResultsUI(data); // New function
            updateExtinction3D(data); // Trigger 3D update with data
        } else {
            console.error("Erreur API Python:", response.status);
        }
    } catch (error) {
        console.error("Erreur connexion Backend:", error);
    }
}

function updateGasResultsUI(data) {
    const container = document.getElementById('gas-results-content');
    if (!container) return;

    let html = `<p><strong>Volume Total (Norme):</strong> ${data.volume_total} m³</p>`;
    for (const [agent, details] of Object.entries(data.agent_details)) {
        html += `<div style="margin-top:5px; border-top:1px dashed #ccc; padding-top:2px;">
            <span style="font-weight:bold; color:#0369a1;">${agent}</span><br>
            Qté: <strong>${details.mass_kg} kg</strong> (Conc: ${details.concentration_design}%)
        </div>`;
    }
    container.innerHTML = html;
}

function updateExtinctionResultsUI(data) {
    const container = document.getElementById('ext-details');
    const type = document.getElementById('ext-type').value;
    if (!container || type === 'none') {
        document.getElementById('ext-results').classList.add('hidden');
        return;
    }
    document.getElementById('ext-results').classList.remove('hidden');

    if (type === 'ig55') {
        container.innerHTML = `<p><strong>IG55 (Chubb):</strong> ${data.extinction_system.ig55_cylinders} Bouteilles (80L/300bar)</p>`;
    } else if (type === 'hifog') {
        container.innerHTML = `<p><strong>Hi-Fog (Marioff):</strong> Réservoir min. ${data.extinction_system.hifog_tank_liters} Litres</p>`;
    }
}

// ----------------------------------

function updateAll() {
    updateBuilding();
    updateDetection();
    // updateExtinction3D called by fetch callback
    fetchGasCalculation();
}

function updateBuilding() {
    while (buildingGroup.children.length > 0) buildingGroup.remove(buildingGroup.children[0]);
    while (furnitureGroup.children.length > 0) furnitureGroup.remove(furnitureGroup.children[0]);
    wallColliders = [];

    const L = parseFloat(document.getElementById('dim-l').value);
    const W = parseFloat(document.getElementById('dim-w').value);
    const hFP = parseFloat(document.getElementById('h-fp').value);
    const hAmb = parseFloat(document.getElementById('h-amb').value);
    const hFC = parseFloat(document.getElementById('h-fc').value);

    let curY = 0;
    const createL = (c, h, y) => {
        const m = new THREE.Mesh(new THREE.BoxGeometry(L, h, W), new THREE.MeshStandardMaterial({ color: c, transparent: true, opacity: 0.15, side: THREE.DoubleSide, depthWrite: false }));
        m.position.y = y + h / 2;
        m.add(new THREE.LineSegments(new THREE.EdgesGeometry(m.geometry), new THREE.LineBasicMaterial({ color: 0xffffff, opacity: 0.2, transparent: true })));
        return m;
    };

    if (document.getElementById('vis-fp').checked) buildingGroup.add(createL(COLORS.fp, hFP, curY));
    curY += hFP;
    if (document.getElementById('vis-amb').checked) buildingGroup.add(createL(COLORS.amb, hAmb, curY));

    const wallH = hAmb; const wallY = curY + hAmb / 2;
    createCollider(L, wallH, 0, wallY, W / 2, 0, Math.PI, 'Z', new THREE.Vector3(0, 0, -1));
    createCollider(L, wallH, 0, wallY, -W / 2, 0, 0, 'Z', new THREE.Vector3(0, 0, 1));
    createCollider(W, wallH, -L / 2, wallY, 0, 0, Math.PI / 2, 'X', new THREE.Vector3(1, 0, 0));
    createCollider(W, wallH, L / 2, wallY, 0, 0, -Math.PI / 2, 'X', new THREE.Vector3(-1, 0, 0));

    const floorCollider = new THREE.Mesh(new THREE.PlaneGeometry(L, W), materials.wallInvisible);
    floorCollider.rotation.x = -Math.PI / 2;
    floorCollider.position.y = curY;
    floorCollider.userData.isFloor = true;
    buildingGroup.add(floorCollider);
    wallColliders.push(floorCollider);

    const useCase = document.getElementById('use-case').value;
    if (useCase === 'datacenter') generateDataCenter(L, W, curY + 0.05);
    else if (useCase === 'ehpad') generateEHPAD(L, W, curY + 0.05);
    else if (useCase === 'hotel') generateHotel(L, W, curY + 0.05);

    curY += hAmb;
    if (document.getElementById('vis-fc').checked) buildingGroup.add(createL(COLORS.fc, hFC, curY));

    // Updated by Python now, but keeping local update for immediate feedback if needed
    document.getElementById('vol-total').innerText = (L * W * (hFP + hAmb + hFC)).toFixed(2);
}

function createCollider(w, h, x, y, z, rotX, rotY, axis, normal) {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), materials.wallInvisible);
    m.position.set(x, y, z);
    m.rotation.x = rotX; m.rotation.y = rotY;
    m.userData.axis = axis;
    m.userData.isWall = true;
    m.userData.normal = normal;
    buildingGroup.add(m);
    wallColliders.push(m);
}

// --- ID Management ---
function getNextId(type, prefix) {
    const existing = manualItems
        .filter(i => i.type === type)
        .map(i => parseInt(i.name.replace(prefix, '')))
        .filter(n => !isNaN(n))
        .sort((a, b) => a - b);
    let next = 1;
    for (let i = 0; i < existing.length; i++) {
        if (existing[i] !== next) return next;
        next++;
    }
    return next;
}

// --- Detection Logic ---
function updateDetection() {
    while (detectionGroup.children.length > 0) detectionGroup.remove(detectionGroup.children[0]);

    const type = document.getElementById('det-type').value;
    const L = parseFloat(document.getElementById('dim-l').value);
    const W = parseFloat(document.getElementById('dim-w').value);
    const hFP = parseFloat(document.getElementById('h-fp').value);
    const hAmb = parseFloat(document.getElementById('h-amb').value);
    const hFC = parseFloat(document.getElementById('h-fc').value);

    if (type === 'vesda') {
        generateVesdaPipes(L, W, { hFP, hAmb, hFC });
    }
    updateDetectorList();
    updateVesdaList();
    updateDoorList();
}

function generateVesdaPipes(L, W, heights) {
    const layers = [];
    if (document.getElementById('vesda-layer-fc').checked) layers.push({ name: 'fc', y: heights.hFP + heights.hAmb + heights.hFC - 0.2 });
    if (document.getElementById('vesda-layer-amb').checked) layers.push({ name: 'amb', y: heights.hFP + heights.hAmb - 0.2 });
    if (document.getElementById('vesda-layer-fp').checked) layers.push({ name: 'fp', y: heights.hFP - 0.1 });

    const margin = 1.0;
    const pipeEnds = [];

    layers.forEach(l => {
        const y = l.y;
        const lines = Math.max(2, Math.floor(W / 4));
        const spacing = (W - 2 * margin) / (lines - 1 || 1);
        for (let i = 0; i < lines; i++) {
            const z = -W / 2 + margin + i * spacing;
            const len = L - 2 * margin;
            const tube = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, len), materials.vesdaPipe);
            tube.rotation.z = Math.PI / 2; tube.position.set(0, y, z);
            detectionGroup.add(tube);
            for (let x = -len / 2; x <= len / 2; x += 3) {
                const point = new THREE.Mesh(new THREE.SphereGeometry(0.03), materials.vesdaPipe);
                point.position.set(x, y, z); detectionGroup.add(point);
            }
            pipeEnds.push(new THREE.Vector3(-len / 2, y, z));
            pipeEnds.push(new THREE.Vector3(len / 2, y, z));
        }
    });

    // Advanced VESDA Routing
    const vesdaUnits = manualItems.filter(i => i.type === 'vesda');
    const stacks = [];
    vesdaUnits.forEach(u => {
        let found = stacks.find(s => Math.abs(s.x - u.mesh.position.x) < 0.1 && Math.abs(s.z - u.mesh.position.z) < 0.1);
        if (found) found.units.push(u);
        else stacks.push({ x: u.mesh.position.x, z: u.mesh.position.z, units: [u] });
    });

    // Find LOWEST unit per stack
    stacks.forEach(s => {
        s.lowest = s.units.reduce((prev, curr) => (prev.mesh.position.y < curr.mesh.position.y ? prev : curr));
        // Mark others as upper
        s.units.forEach(u => u.isUpper = (u !== s.lowest));
    });

    if (vesdaUnits.length > 0) {
        pipeEnds.forEach(end => {
            let nearestUnit = null;
            let minD = Infinity;
            vesdaUnits.forEach(unit => {
                // Connect to any unit, we will redirect to stack leader later
                const inletPos = unit.mesh.position.clone().add(new THREE.Vector3(0, 0.2, 0));
                const d = end.distanceTo(inletPos);
                if (d < minD) { minD = d; nearestUnit = unit; }
            });

            if (nearestUnit) {
                // Find Stack Target
                const stack = stacks.find(s => s.units.includes(nearestUnit));
                const targetUnit = stack ? stack.lowest : nearestUnit;

                const inletPos = targetUnit.mesh.position.clone().add(new THREE.Vector3(0, 0.2, 0));

                // Path finding with invisible segments through upper units
                const corner1 = new THREE.Vector3(inletPos.x, end.y, end.z);
                createTube(end, corner1); // Horizontal to wall X
                const corner2 = new THREE.Vector3(inletPos.x, end.y, inletPos.z);
                createTube(corner1, corner2); // Horizontal along wall to Z

                // Vertical Drop Logic
                const topY = corner2.y;
                const botY = inletPos.y;

                if (topY > botY) {
                    const unitsAbove = stack ? stack.units.filter(u => u !== targetUnit && u.mesh.position.y > targetUnit.mesh.position.y) : [];
                    unitsAbove.sort((a, b) => b.mesh.position.y - a.mesh.position.y);

                    let currentY = topY;

                    unitsAbove.forEach(u => {
                        const uTop = u.mesh.position.y + 0.2;
                        const uBot = u.mesh.position.y - 0.2;
                        if (currentY > uTop) {
                            createTube(new THREE.Vector3(inletPos.x, currentY, inletPos.z), new THREE.Vector3(inletPos.x, uTop, inletPos.z));
                        }
                        currentY = Math.min(currentY, uBot);
                    });
                    if (currentY > botY) {
                        createTube(new THREE.Vector3(inletPos.x, currentY, inletPos.z), new THREE.Vector3(inletPos.x, botY, inletPos.z));
                    }
                } else {
                    createTube(corner2, inletPos);
                }
            }
        });
    }
}

function createTube(p1, p2) {
    const d = p1.distanceTo(p2);
    if (d < 0.01) return;
    const mid = p1.clone().add(p2).multiplyScalar(0.5);
    const tube = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, d), materials.vesdaPipe);
    tube.position.copy(mid); tube.lookAt(p2); tube.rotateX(Math.PI / 2);
    detectionGroup.add(tube);
}

// --- Interaction ---
function setMode(mode) {
    interactionMode = mode;
    const toast = document.getElementById('toast-msg');
    const txt = document.getElementById('toast-text');

    document.querySelectorAll('.btn-active').forEach(e => e.classList.remove('btn-active'));
    document.querySelectorAll('.btn-delete-active').forEach(e => e.classList.remove('btn-delete-active'));
    renderer.domElement.style.cursor = 'default';
    if (ghostMesh) { scene.remove(ghostMesh); ghostMesh = null; }

    if (mode === 'view') {
        toast.style.display = 'none';
    } else {
        toast.style.display = 'block';
        renderer.domElement.style.cursor = 'crosshair';
        if (mode === 'place_vesda') {
            document.getElementById('btn-place-vesda').classList.add('btn-active');
            txt.innerText = "Poser VESDA (Mur)";
        } else if (mode === 'place_optical') {
            document.getElementById('btn-place-opt').classList.add('btn-active');
            txt.innerText = "Poser DI";
        } else if (mode === 'place_door') {
            document.getElementById('btn-place-door').classList.add('btn-active');
            txt.innerText = "Poser Porte";
            createGhostDoor();
        } else if (mode === 'delete') {
            txt.innerText = "Gomme";
            renderer.domElement.style.cursor = 'not-allowed';
            ['btn-delete-vesda', 'btn-delete-det'].forEach(id => {
                const el = document.getElementById(id);
                if (el) el.classList.add('btn-delete-active');
            });
        }
    }
}

function toggleVesdaMode() { setMode(interactionMode === 'place_vesda' ? 'view' : 'place_vesda'); }
function toggleOpticalMode() { setMode(interactionMode === 'place_optical' ? 'view' : 'place_optical'); }
function toggleDoorMode() { setMode(interactionMode === 'place_door' ? 'view' : 'place_door'); }
function toggleDeleteMode() { setMode(interactionMode === 'delete' ? 'view' : 'delete'); }

// Snapping
function getSnapPos(pos, isOptical) {
    if (isOptical) {
        if (!document.getElementById('snap-toggle-opt').checked) return pos;
        return new THREE.Vector3(Math.round(pos.x * 2) / 2, pos.y, Math.round(pos.z * 2) / 2);
    }
    return pos;
}
function getWallSnapPos(pos, wall) {
    if (!document.getElementById('snap-toggle-vesda').checked) return pos;
    const axis = wall.userData.axis;
    const step = 0.5;
    let sx = pos.x, sy = pos.y, sz = pos.z;
    sy = Math.round(pos.y / step) * step;
    if (axis === 'Z') sx = Math.round(pos.x / step) * step;
    else sz = Math.round(pos.z / step) * step;
    return new THREE.Vector3(sx, sy, sz);
}

function createGhostDoor() {
    const w = document.getElementById('door-type').value === 'double' ? 1.8 : 0.9;
    const h = 2.1;
    ghostMesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, 0.1), new THREE.MeshBasicMaterial({ color: 0x00ff00, transparent: true, opacity: 0.5 }));
    scene.add(ghostMesh);
}

function onCanvasMove(e) {
    if (interactionMode === 'view' || interactionMode === 'delete') return;

    mouse.x = (e.clientX / window.innerWidth) * 2 - 1;
    mouse.y = -(e.clientY / window.innerHeight) * 2 + 1;
    raycaster.setFromCamera(mouse, camera);

    if (interactionMode === 'place_optical') {
        const hFP = parseFloat(document.getElementById('h-fp').value);
        const hAmb = parseFloat(document.getElementById('h-amb').value);
        const hFC = parseFloat(document.getElementById('h-fc').value);
        const layer = document.getElementById('opt-layer-select').value;
        let targetY = 0;
        if (layer === 'fp') targetY = 0.05; else if (layer === 'amb') targetY = hFP + hAmb; else targetY = hFP + hAmb + hFC;
        const plane = new THREE.Plane(new THREE.Vector3(0, -1, 0), targetY);
        const target = new THREE.Vector3();
        raycaster.ray.intersectPlane(plane, target);
        if (target) {
            const s = getSnapPos(target, true);
            let distMsg = "";
            const lastDI = manualItems.filter(i => i.type === 'optical').pop();
            if (lastDI) {
                const d = s.distanceTo(lastDI.mesh.position);
                distMsg = ` (Dist: ${d.toFixed(2)}m)`;
            }
            document.getElementById('cursor-coords-opt').innerText = `${s.x.toFixed(1)} / ${s.z.toFixed(1)}${distMsg}`;
        }
    } else if (interactionMode === 'place_vesda') {
        const hits = raycaster.intersectObjects(wallColliders);
        if (hits.length > 0) {
            const s = getWallSnapPos(hits[0].point, hits[0].object);
            document.getElementById('cursor-coords-vesda').innerText = `X:${s.x.toFixed(1)} Y:${s.y.toFixed(1)} Z:${s.z.toFixed(1)}`;
        }
    } else if (interactionMode === 'place_door') {
        const hits = raycaster.intersectObjects(wallColliders);
        if (hits.length > 0 && ghostMesh) {
            const hit = hits[0];
            ghostMesh.position.copy(hit.point);
            const doorH = 2.1;
            ghostMesh.position.y = hit.point.y + doorH / 2;
            const hFP = parseFloat(document.getElementById('h-fp').value);
            if (hit.object.userData.isFloor) ghostMesh.position.y = hFP + doorH / 2;

            if (hit.object.userData.normal) {
                const n = hit.object.userData.normal;
                ghostMesh.lookAt(ghostMesh.position.clone().add(n));
            } else {
                if (document.getElementById('snap-door-angle').checked) ghostMesh.rotation.y = 0;
            }
        }
    }
}



function toggleVesdaMode() { setMode(interactionMode === 'place_vesda' ? 'view' : 'place_vesda'); }
function toggleOpticalMode() { setMode(interactionMode === 'place_optical' ? 'view' : 'place_optical'); }
function toggleDoorMode() { setMode(interactionMode === 'place_door' ? 'view' : 'place_door'); }
function toggleDeleteMode() { setMode(interactionMode === 'delete' ? 'view' : 'delete'); }

// Snapping
function getSnapPos(pos, isOptical) {
    if (isOptical) {
        if (!document.getElementById('snap-toggle-opt').checked) return pos;
        return new THREE.Vector3(Math.round(pos.x * 2) / 2, pos.y, Math.round(pos.z * 2) / 2);
    }
    return pos;
}
function getWallSnapPos(pos, wall) {
    if (!document.getElementById('snap-toggle-vesda').checked) return pos;
    const axis = wall.userData.axis;
    const step = 0.5;
    let sx = pos.x, sy = pos.y, sz = pos.z;
    sy = Math.round(pos.y / step) * step;
    if (axis === 'Z') sx = Math.round(pos.x / step) * step;
    else sz = Math.round(pos.z / step) * step;
    return new THREE.Vector3(sx, sy, sz);
}

function createGhostDoor() {
    const w = document.getElementById('door-type').value === 'double' ? 1.8 : 0.9;
    const h = 2.1;
    ghostMesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, 0.1), new THREE.MeshBasicMaterial({ color: 0x00ff00, transparent: true, opacity: 0.5 }));
    scene.add(ghostMesh);
}

function onCanvasMove(e) {
    if (interactionMode === 'view' || interactionMode === 'delete') return;

    mouse.x = (e.clientX / window.innerWidth) * 2 - 1;
    mouse.y = -(e.clientY / window.innerHeight) * 2 + 1;
    raycaster.setFromCamera(mouse, camera);

    if (interactionMode === 'place_optical') {
        const hFP = parseFloat(document.getElementById('h-fp').value);
        const hAmb = parseFloat(document.getElementById('h-amb').value);
        const hFC = parseFloat(document.getElementById('h-fc').value);
        const layer = document.getElementById('opt-layer-select').value;
        let targetY = 0;
        if (layer === 'fp') targetY = 0.05; else if (layer === 'amb') targetY = hFP + hAmb; else targetY = hFP + hAmb + hFC;
        const plane = new THREE.Plane(new THREE.Vector3(0, -1, 0), targetY);
        const target = new THREE.Vector3();
        raycaster.ray.intersectPlane(plane, target);
        if (target) {
            const s = getSnapPos(target, true);
            let distMsg = "";
            const lastDI = manualItems.filter(i => i.type === 'optical').pop();
            if (lastDI) {
                const d = s.distanceTo(lastDI.mesh.position);
                distMsg = ` (Dist: ${d.toFixed(2)}m)`;
            }
            document.getElementById('cursor-coords-opt').innerText = `${s.x.toFixed(1)} / ${s.z.toFixed(1)}${distMsg}`;
        }
    } else if (interactionMode === 'place_vesda') {
        const hits = raycaster.intersectObjects(wallColliders);
        if (hits.length > 0) {
            const s = getWallSnapPos(hits[0].point, hits[0].object);
            document.getElementById('cursor-coords-vesda').innerText = `X:${s.x.toFixed(1)} Y:${s.y.toFixed(1)} Z:${s.z.toFixed(1)}`;
        }
    } else if (interactionMode === 'place_vent') {
        const hits = raycaster.intersectObjects(wallColliders);
        if (hits.length > 0) {
            const s = getWallSnapPos(hits[0].point, hits[0].object);
            document.getElementById('cursor-coords-vent').innerText = `X:${s.x.toFixed(1)} Y:${s.y.toFixed(1)} Z:${s.z.toFixed(1)}`;
        }
    } else if (interactionMode === 'place_door') {
        const hits = raycaster.intersectObjects(wallColliders);
        if (hits.length > 0 && ghostMesh) {
            const hit = hits[0];
            ghostMesh.position.copy(hit.point);
            const doorH = 2.1;
            ghostMesh.position.y = hit.point.y + doorH / 2;
            const hFP = parseFloat(document.getElementById('h-fp').value);
            if (hit.object.userData.isFloor) ghostMesh.position.y = hFP + doorH / 2;

            if (hit.object.userData.normal) {
                const n = hit.object.userData.normal;
                ghostMesh.lookAt(ghostMesh.position.clone().add(n));
            } else {
                if (document.getElementById('snap-door-angle').checked) ghostMesh.rotation.y = 0;
            }
        }
    }
}

function onCanvasClick(e) {
    if (interactionMode === 'view') return;
    mouse.x = (e.clientX / window.innerWidth) * 2 - 1;
    mouse.y = -(e.clientY / window.innerHeight) * 2 + 1;
    raycaster.setFromCamera(mouse, camera);

    if (interactionMode === 'place_vesda') {
        const hits = raycaster.intersectObjects(wallColliders.filter(o => !o.userData.isFloor));
        if (hits.length > 0) {
            const pos = getWallSnapPos(hits[0].point, hits[0].object);
            placeVesdaUnit(pos, hits[0].object.userData.normal || hits[0].face.normal);
            updateDetection();
        }
    }
    else if (interactionMode === 'place_optical') {
        const hFP = parseFloat(document.getElementById('h-fp').value);
        const hAmb = parseFloat(document.getElementById('h-amb').value);
        const hFC = parseFloat(document.getElementById('h-fc').value);
        const layer = document.getElementById('opt-layer-select').value;
        let targetY = 0;
        if (layer === 'fp') targetY = 0.05; else if (layer === 'amb') targetY = hFP + hAmb; else targetY = hFP + hAmb + hFC;
        const plane = new THREE.Plane(new THREE.Vector3(0, -1, 0), targetY);
        const target = new THREE.Vector3();
        raycaster.ray.intersectPlane(plane, target);
        if (target) {
            const s = getSnapPos(target, true);
            const L = parseFloat(document.getElementById('dim-l').value);
            const W = parseFloat(document.getElementById('dim-w').value);
            if (Math.abs(s.x) < L / 2 && Math.abs(s.z) < W / 2) placeOptical(s, layer);
        }
    }
    else if (interactionMode === 'place_vent') {
        const hits = raycaster.intersectObjects(wallColliders);
        if (hits.length > 0) {
            const pos = getWallSnapPos(hits[0].point, hits[0].object);
            placeVent(pos, hits[0].object.userData.normal || hits[0].face.normal);
        }
    }
    else if (interactionMode === 'place_door') {
        const hits = raycaster.intersectObjects(wallColliders);
        if (hits.length > 0) {
            const hit = hits[0];
            let pos = hit.point.clone();
            let rotY = 0;
            const hFP = parseFloat(document.getElementById('h-fp').value);
            const doorH = 2.1;
            pos.y = hFP + doorH / 2;

            if (hit.object.userData.isFloor) {
                if (document.getElementById('snap-door-angle').checked) rotY = Math.PI / 2;
            } else if (hit.object.userData.normal) {
                const n = hit.object.userData.normal;
                if (Math.abs(n.x) > 0.5) rotY = Math.PI / 2; else rotY = 0;
            }
            placeDoor(pos, rotY);
        }
    }
    else if (interactionMode === 'delete') {
        const hits = raycaster.intersectObjects(manualGroup.children, true);
        if (hits.length > 0) {
            let obj = hits[0].object;
            while (obj.parent && obj.parent !== manualGroup) obj = obj.parent;
            const item = manualItems.find(i => i.mesh === obj);
            if (item) deleteItem(item);
        }
    }
}

function placeVesdaUnit(pos, normal) {
    const id = getNextId('vesda', 'VESDA ');
    const name = "VESDA " + id;

    const box = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.4, 0.15), materials.vesdaBox);
    box.position.copy(pos).add(normal.multiplyScalar(0.075));
    box.lookAt(box.position.clone().add(normal));
    manualGroup.add(box);
    manualItems.push({ mesh: box, type: 'vesda', name: name });
    updateVesdaList();
}

function placeOptical(pos, layer) {
    const id = getNextId('optical', 'DI');
    const name = "DI" + id;

    const det = new THREE.Group();
    const body = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.1, 0.05, 16), materials.detector);
    const led = new THREE.Mesh(new THREE.SphereGeometry(0.02), materials.detectorLed);
    led.position.y = -0.03;
    if (layer === 'fp') det.position.set(pos.x, pos.y, pos.z); else det.position.set(pos.x, pos.y - 0.025, pos.z);
    det.add(body, led);
    manualGroup.add(det);

    manualItems.push({ mesh: det, type: 'optical', name: name, layer: layer });
    updateDetectorList();
}

function placeDoor(pos, rotY) {
    const id = getNextId('door', 'Porte ');
    const name = "Porte " + id;

    const type = document.getElementById('door-type').value;
    const w = type === 'double' ? 1.8 : 0.9;
    const h = 2.1;
    const grp = new THREE.Group();
    grp.position.copy(pos);
    grp.rotation.y = rotY;

    const frame = new THREE.Mesh(new THREE.BoxGeometry(w, h, 0.1), materials.door);
    const panel = new THREE.Mesh(new THREE.BoxGeometry(w - 0.2, h - 0.2, 0.05), new THREE.MeshStandardMaterial({ color: 0x87ceeb, transparent: true, opacity: 0.4 }));
    const handle = new THREE.Mesh(new THREE.SphereGeometry(0.05), materials.doorHandle);
    handle.position.set(w / 2 - 0.1, 0, 0.06);

    // Warning Signs (Voyant Entrée Interdite)
    const signGeo = new THREE.BoxGeometry(0.4, 0.15, 0.05);
    const signMat = new THREE.MeshStandardMaterial({ color: 0xff0000, emissive: 0xff0000, emissiveIntensity: 0.6 });

    // Exterior sign
    const signExt = new THREE.Mesh(signGeo, signMat);
    signExt.position.set(0, h / 2 + 0.15, 0.06);

    // Interior sign
    const signInt = new THREE.Mesh(signGeo, signMat);
    signInt.position.set(0, h / 2 + 0.15, -0.06);

    grp.add(frame, panel, handle, signExt, signInt);
    manualGroup.add(grp);
    manualItems.push({ mesh: grp, type: 'door', name: name });
    updateDoorList();
}

function updateDetectorList() { updateGenericList('detector-list', 'optical', 'Aucun détecteur'); }
function updateVesdaList() { updateGenericList('vesda-list', 'vesda', 'Aucun VESDA'); }
function updateDoorList() { updateGenericList('door-list', 'door', 'Aucune porte'); }

function updateGenericList(id, type, emptyMsg) {
    const list = document.getElementById(id);
    list.innerHTML = '';
    const items = manualItems.filter(i => i.type === type).sort((a, b) => parseInt(a.name.replace(/\D/g, '')) - parseInt(b.name.replace(/\D/g, '')));
    if (items.length === 0) list.innerHTML = `<div class="p-2 text-center text-xs text-gray-400">${emptyMsg}</div>`;
    items.forEach(item => {
        const row = document.createElement('div'); row.className = 'list-row';
        row.innerHTML = `<span>${item.name}</span><i class="fas fa-trash btn-sm-del" onclick="deleteByName('${item.name}')"></i>`;
        list.appendChild(row);
    });
}

window.deleteByName = function (name) {
    const item = manualItems.find(i => i.name === name);
    if (item) deleteItem(item);
};

function deleteItem(item) {
    manualGroup.remove(item.mesh);
    manualItems = manualItems.filter(i => i !== item);
    if (item.type === 'optical') updateDetectorList();
    if (item.type === 'vesda') { updateVesdaList(); updateDetection(); }
    if (item.type === 'door') updateDoorList();
}

function clearVesdas() {
    const keep = manualItems.filter(i => i.type !== 'vesda');
    manualItems.filter(i => i.type === 'vesda').forEach(i => manualGroup.remove(i.mesh));
    manualItems = keep;
    updateVesdaList();
    updateDetection();
}

// Generators (Compacted)
function generateEHPAD(L, W, y) { const rX = parseFloat(document.getElementById('ehpad-room-x').value), rZ = parseFloat(document.getElementById('ehpad-room-z').value), bed = document.getElementById('ehpad-bed-type').value, h = 2.5; const c = Math.floor(L / rX), r = Math.floor(W / rZ), oX = (L - c * rX) / 2, oZ = (W - r * rZ) / 2; for (let i = 0; i < r; i++)for (let j = 0; j < c; j++) { const g = new THREE.Group(); g.position.set(-L / 2 + oX + j * rX + rX / 2, y, -W / 2 + oZ + i * rZ + rZ / 2); g.add(createWall(0.1, h, rZ, -rX / 2, 0, 0), createWall(rX, h, 0.1, 0, 0, -rZ / 2), new THREE.Mesh(new THREE.BoxGeometry(rX - 0.1, 0.01, rZ - 0.1), materials.floorRoom)); g.add(createDetailedBed(1, 2, 0.5, bed === 'pmr').translateY(0).translateX(0.5)); const b = createBathroomUnit(2, 1.8, h); b.position.set(-rX / 2 + 1.1, 0, -rZ / 2 + 1); g.add(b, createWall(0.1, h, 1.8, -rX / 2 + 2, 0, -rZ / 2 + 0.9), createWall(0.8, h, 0.1, -rX / 2 + 0.4, 0, -rZ / 2 + 1.8)); furnitureGroup.add(g); } }
function generateHotel(L, W, y) { const rX = parseFloat(document.getElementById('hotel-x').value), rZ = parseFloat(document.getElementById('hotel-z').value), h = 2.5; const c = Math.floor(L / rX), r = Math.floor(W / rZ), oX = (L - c * rX) / 2, oZ = (W - r * rZ) / 2; for (let i = 0; i < r; i++)for (let j = 0; j < c; j++) { const g = new THREE.Group(); g.position.set(-L / 2 + oX + j * rX + rX / 2, y, -W / 2 + oZ + i * rZ + rZ / 2); g.add(createWall(0.1, h, rZ, -rX / 2, 0, 0), createWall(rX, h, 0.1, 0, 0, -rZ / 2), new THREE.Mesh(new THREE.BoxGeometry(rX - 0.1, 0.01, rZ - 0.1), materials.floorRoom)); const bed = createDetailedBed(1.8, 2, 0.6, false); bed.position.set(0, 0, 0.5); g.add(bed); const b = createBathroomUnit(1.8, 1.5, h); b.rotation.y = Math.PI; b.position.set(-rX / 2 + 1, 0, rZ / 2 - 0.8); g.add(b, createWall(0.1, h, 1.5, -rX / 2 + 1.8, 0, rZ / 2 - 0.75)); furnitureGroup.add(g); } }
function generateDataCenter(L, W, y) { const w = parseFloat(document.getElementById('dc-w').value), d = parseFloat(document.getElementById('dc-d').value), h = parseFloat(document.getElementById('dc-h').value), gap = parseFloat(document.getElementById('dc-gap').value); const rIn = parseInt(document.getElementById('dc-rows-count').value), cIn = parseInt(document.getElementById('dc-racks-per-row').value); const tR = rIn > 0 ? rIn : 100, tC = cIn > 0 ? cIn : Math.floor((L - 4) / (w + 0.05)); const sX = -L / 2 + 2, sZ = -W / 2 + 2; loop: for (let r = 0; r < tR; r++) { let z = sZ + Math.floor(r / 2) * (2 * d + gap) + d / 2; if (r % 2) z += d; if (z + d / 2 > W / 2 - 1) break; for (let k = 0; k < tC; k++) { const x = sX + k * (w + 0.05) + w / 2; if (x + w / 2 > L / 2 - 1) break; const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), new THREE.MeshStandardMaterial({ color: 0x1a1a1a, roughness: 0.5 })); m.position.set(x, y + h / 2, z); m.add(new THREE.Mesh(new THREE.BoxGeometry(w * 0.8, 0.05, 0.02), new THREE.MeshBasicMaterial({ color: 0x00ff00 })).translateY(h / 2 - 0.2).translateZ(r % 2 ? d / 2 + 0.01 : -d / 2 - 0.01)); furnitureGroup.add(m); } } }
function createDetailedBed(w, l, h, isM) { const g = new THREE.Group(); g.add(new THREE.Mesh(new THREE.BoxGeometry(w, 0.15, l), materials.wood).translateY(0.375), new THREE.Mesh(new THREE.BoxGeometry(w - 0.05, 0.2, l - 0.05), materials.bedSheet).translateY(0.55));[[1, 1], [1, -1], [-1, 1], [-1, -1]].forEach(p => g.add(new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.3), materials.chrome).translateX(p[0] * (w / 2 - 0.05)).translateZ(p[1] * (l / 2 - 0.05)).translateY(0.15))); return g; }
function createBathroomUnit(w, d, h) { const g = new THREE.Group(); g.add(new THREE.Mesh(new THREE.BoxGeometry(w, 0.02, d), materials.floorBath)); g.add(new THREE.Mesh(new THREE.BoxGeometry(w, h, 0.1), materials.wall).translateZ(-d / 2).translateY(h / 2), new THREE.Mesh(new THREE.BoxGeometry(0.1, h, d), materials.wall).translateX(-w / 2).translateY(h / 2)); return g; }
function createWall(w, h, d, x, y, z) { const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), materials.wall); m.position.set(x, y + h / 2, z); return m; }
// --- Extinction Logic ---
function updateExtinction3D(data) {
    while (extinctionGroup.children.length > 0) extinctionGroup.remove(extinctionGroup.children[0]);

    const type = document.getElementById('ext-type').value;
    if (type === 'none') return;

    const L = parseFloat(document.getElementById('dim-l').value);
    const W = parseFloat(document.getElementById('dim-w').value);
    const hFP = parseFloat(document.getElementById('h-fp').value);
    const hAmb = parseFloat(document.getElementById('h-amb').value);

    // Determine nozzle locations based on use case
    const useCase = document.getElementById('use-case').value;
    const nozzles = [];

    if (useCase === 'datacenter') {
        const w = parseFloat(document.getElementById('dc-w').value);
        const d = parseFloat(document.getElementById('dc-d').value);
        const gap = parseFloat(document.getElementById('dc-gap').value);
        const rIn = parseInt(document.getElementById('dc-rows-count').value);
        const tR = rIn > 0 ? rIn : 100;
        const sZ = -W / 2 + 2;

        for (let r = 0; r < tR; r++) {
            let z = sZ + Math.floor(r / 2) * (2 * d + gap) + d / 2;
            if (r % 2 !== 0) {
                const aisleZ = z - d / 2 - gap / 2;
                if (aisleZ + gap / 2 < W / 2 - 1) {
                    for (let x = -L / 2 + 2; x < L / 2 - 2; x += 3) {
                        nozzles.push(new THREE.Vector3(x, hFP + hAmb - 0.2, aisleZ));
                    }
                }
                z += d;
            }
            if (z + d / 2 > W / 2 - 1) break;
        }
    } else if (useCase === 'ehpad' || useCase === 'hotel') {
        let rX, rZ;
        if (useCase === 'ehpad') { rX = parseFloat(document.getElementById('ehpad-room-x').value); rZ = parseFloat(document.getElementById('ehpad-room-z').value); }
        else { rX = parseFloat(document.getElementById('hotel-x').value); rZ = parseFloat(document.getElementById('hotel-z').value); }

        const c = Math.floor(L / rX);
        const r = Math.floor(W / rZ);
        const oX = (L - c * rX) / 2;
        const oZ = (W - r * rZ) / 2;

        for (let i = 0; i < r; i++) {
            for (let j = 0; j < c; j++) {
                const x = -L / 2 + oX + j * rX + rX / 2;
                const z = -W / 2 + oZ + i * rZ + rZ / 2;
                nozzles.push(new THREE.Vector3(x, hFP + hAmb - 0.2, z));
            }
        }
    } else {
        // Default grid based on calculated nozzle count
        const targetCount = (data && data.extinction_system && data.extinction_system.ig55_nozzles) ? data.extinction_system.ig55_nozzles : Math.ceil((L * W) / 30);
        const areaPerNozzle = (L * W) / targetCount;
        const spacing = Math.sqrt(areaPerNozzle);
        const cols = Math.floor(L / spacing);
        const rows = Math.floor(W / spacing);
        const startX = -(cols - 1) * spacing / 2;
        const startZ = -(rows - 1) * spacing / 2;

        for (let i = 0; i < cols; i++) {
            for (let j = 0; j < rows; j++) {
                nozzles.push(new THREE.Vector3(startX + i * spacing, hFP + hAmb - 0.2, startZ + j * spacing));
            }
        }
    }

    currentNozzles = nozzles;

    if (type === 'ig55') {
        generateIG55((data && data.extinction_system && data.extinction_system.ig55_cylinders) ? data.extinction_system.ig55_cylinders : 1, nozzles, hFP);
    } else if (type === 'hifog') {
        generateHiFog(nozzles, hFP);
    }
}

function generateIG55(count, nozzles, hFP) {
    const startPos = new THREE.Vector3(-parseFloat(document.getElementById('dim-l').value) / 2 + 1, hFP, -parseFloat(document.getElementById('dim-w').value) / 2 + 1);
    const cylR = 0.12;
    const cylH = 1.6;
    const manifoldY = hFP + cylH + 0.2;

    for (let i = 0; i < count; i++) {
        const row = Math.floor(i / 10);
        const col = i % 10;
        const pos = startPos.clone().add(new THREE.Vector3(col * 0.3, 0, row * 0.3));

        const cyl = new THREE.Group();
        const body = new THREE.Mesh(new THREE.CylinderGeometry(cylR, cylR, cylH, 16), materials.ig55Cylinder);
        body.position.y = cylH / 2;
        const shoulder = new THREE.Mesh(new THREE.SphereGeometry(cylR, 16, 0, Math.PI * 2, 0, Math.PI / 2), materials.ig55Shoulder);
        shoulder.position.y = cylH;
        const valve = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.15), materials.chrome);
        valve.position.y = cylH + 0.05;

        cyl.add(body, shoulder, valve);
        cyl.position.copy(pos);
        extinctionGroup.add(cyl);

        createPipe(new THREE.Vector3(pos.x, hFP + cylH + 0.1, pos.z), new THREE.Vector3(pos.x, manifoldY, pos.z), 0.01);
    }

    const bankLen = Math.min(count, 10) * 0.3;
    createPipe(new THREE.Vector3(startPos.x, manifoldY, startPos.z), new THREE.Vector3(startPos.x + bankLen, manifoldY, startPos.z), 0.03);

    const mainRiserX = startPos.x + bankLen / 2;
    const mainRiserZ = startPos.z;
    const ceilingY = nozzles.length > 0 ? nozzles[0].y : hFP + 3;

    createPipe(new THREE.Vector3(mainRiserX, manifoldY, mainRiserZ), new THREE.Vector3(mainRiserX, ceilingY, mainRiserZ), 0.04);
    connectNozzles(new THREE.Vector3(mainRiserX, ceilingY, mainRiserZ), nozzles);
}

function generateHiFog(nozzles, hFP) {
    const L = parseFloat(document.getElementById('dim-l').value);
    const tankPos = new THREE.Vector3(L / 2 + 3, hFP, 0);
    const tankH = 3;
    const tankR = 1.5;
    const tank = new THREE.Mesh(new THREE.CylinderGeometry(tankR, tankR, tankH, 32), materials.tankSteel);
    tank.position.copy(tankPos);
    tank.position.y += tankH / 2;
    extinctionGroup.add(tank);

    const entryPoint = new THREE.Vector3(L / 2, hFP + 3, 0);
    createPipe(new THREE.Vector3(tankPos.x, hFP + tankH - 0.5, tankPos.z), entryPoint, 0.05);
    connectNozzles(entryPoint, nozzles);
}

function connectNozzles(source, nozzles) {
    if (nozzles.length === 0) return;
    let minZ = Infinity, maxZ = -Infinity;
    nozzles.forEach(n => { if (n.z < minZ) minZ = n.z; if (n.z > maxZ) maxZ = n.z; });

    const spineX = source.x;
    createPipe(source, new THREE.Vector3(spineX, source.y, minZ), 0.04);
    createPipe(new THREE.Vector3(spineX, source.y, minZ), new THREE.Vector3(spineX, source.y, maxZ), 0.04);

    nozzles.forEach(n => {
        const noz = new THREE.Mesh(new THREE.ConeGeometry(0.05, 0.1, 8), materials.nozzleChrome);
        noz.position.copy(n);
        noz.rotation.x = Math.PI;
        extinctionGroup.add(noz);
        createPipe(new THREE.Vector3(spineX, n.y, n.z), n, 0.02);
    });
}

function createPipe(p1, p2, r) {
    const d = p1.distanceTo(p2);
    if (d < 0.01) return;
    const mid = p1.clone().add(p2).multiplyScalar(0.5);
    const tube = new THREE.Mesh(new THREE.CylinderGeometry(r, r, d, 8), materials.pipeBlack);
    tube.position.copy(mid);
    tube.lookAt(p2);
    tube.rotateX(Math.PI / 2);
    extinctionGroup.add(tube);
}

function animate() {
    requestAnimationFrame(animate);
    controls.update();
    renderer.render(scene, camera);
}

init();

// --- UI Helpers ---
function switchTab(tabId) {
    document.querySelectorAll('.tab-content').forEach(el => el.classList.add('hidden'));
    document.querySelectorAll('.tab-btn').forEach(el => el.classList.remove('active'));

    document.getElementById('tab-' + tabId).classList.remove('hidden');
    document.getElementById('btn-tab-' + tabId).classList.add('active');
}

function updateUseCaseUI() {
    const uc = document.getElementById('use-case').value;
    ['datacenter', 'ehpad', 'hotel'].forEach(id => {
        document.getElementById('controls-' + id).classList.add('hidden');
    });
    if (uc !== 'none') {
        document.getElementById('controls-' + uc).classList.remove('hidden');
    }
}

function updateDetectionUI() {
    const type = document.getElementById('det-type').value;
    document.getElementById('controls-optical').classList.add('hidden');
    document.getElementById('controls-vesda').classList.add('hidden');
    if (type === 'optical') document.getElementById('controls-optical').classList.remove('hidden');
    else if (type === 'vesda') document.getElementById('controls-vesda').classList.remove('hidden');
}

function updateExtinctionUI() {
    const type = document.getElementById('ext-type').value;
    document.getElementById('controls-ig55').classList.add('hidden');
    document.getElementById('controls-hifog').classList.add('hidden');
    if (type === 'ig55') document.getElementById('controls-ig55').classList.remove('hidden');
    else if (type === 'hifog') document.getElementById('controls-hifog').classList.remove('hidden');
}
