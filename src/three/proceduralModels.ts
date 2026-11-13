import * as THREE from 'three';
import type { AlbumItem } from '../types/album';

function makeCanvasTexture(
  width: number,
  height: number,
  draw: (ctx: CanvasRenderingContext2D, w: number, h: number) => void,
  maxAnisotropy: number,
  isColorMap = true,
): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (ctx) {
    draw(ctx, width, height);
  }
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = isColorMap ? THREE.SRGBColorSpace : THREE.NoColorSpace;
  tex.anisotropy = Math.max(1, maxAnisotropy);
  tex.needsUpdate = true;
  return tex;
}

function buildZenitModel(maxAnisotropy: number): THREE.Group {
  const group = new THREE.Group();

  // Procedural pebbled leatherette bump + dark charcoal texture
  const leatherTex = makeCanvasTexture(
    256,
    256,
    (ctx, w, h) => {
      ctx.fillStyle = '#22201E';
      ctx.fillRect(0, 0, w, h);
      for (let i = 0; i < 1800; i++) {
        const x = (Math.sin(i * 12.9898) * 43758.5453) % 1;
        const y = (Math.sin(i * 78.233) * 43758.5453) % 1;
        const px = Math.abs(x) * w;
        const py = Math.abs(y) * h;
        ctx.fillStyle = i % 2 === 0 ? '#2D2A27' : '#181614';
        ctx.fillRect(px, py, 2, 2);
      }
    },
    maxAnisotropy,
    true,
  );

  // Front silver badge plate with "ЗЕНИТ-Е"
  const badgeTex = makeCanvasTexture(
    256,
    96,
    (ctx, w, h) => {
      ctx.fillStyle = '#D5D2CC';
      ctx.fillRect(0, 0, w, h);
      ctx.fillStyle = '#262320';
      ctx.font = 'bold 30px sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('ЗЕНИТ-Е', w / 2, h / 2);
    },
    maxAnisotropy,
    true,
  );

  const leatherMat = new THREE.MeshStandardMaterial({
    map: leatherTex,
    roughness: 0.85,
    metalness: 0.05,
  });

  const brushedAluminumMat = new THREE.MeshStandardMaterial({
    color: 0xd8d4cc,
    roughness: 0.24,
    metalness: 0.88,
  });

  const darkMetalMat = new THREE.MeshStandardMaterial({
    color: 0x262422,
    roughness: 0.42,
    metalness: 0.65,
  });

  const lensGlassMat = new THREE.MeshPhysicalMaterial({
    color: 0x1e3a5f,
    roughness: 0.08,
    metalness: 0.1,
    clearcoat: 1.0,
    clearcoatRoughness: 0.05,
  });

  // 1. Primary camera body
  const body = new THREE.Mesh(new THREE.BoxGeometry(1.48, 0.72, 0.56), leatherMat);
  body.position.set(0, 0.44, 0);
  body.castShadow = true;
  body.receiveShadow = true;
  group.add(body);

  // 2. Top brushed metal plate
  const topPlate = new THREE.Mesh(
    new THREE.BoxGeometry(1.5, 0.22, 0.58),
    brushedAluminumMat,
  );
  topPlate.position.set(0, 0.88, 0);
  topPlate.castShadow = true;
  group.add(topPlate);

  // 3. Bottom baseplate
  const bottomPlate = new THREE.Mesh(
    new THREE.BoxGeometry(1.5, 0.08, 0.58),
    brushedAluminumMat,
  );
  bottomPlate.position.set(0, 0.04, 0);
  group.add(bottomPlate);

  // 4. Pentaprism housing (beveled extrusion)
  const prismShape = new THREE.Shape();
  prismShape.moveTo(-0.26, 0);
  prismShape.lineTo(0.26, 0);
  prismShape.lineTo(0.16, 0.24);
  prismShape.lineTo(-0.16, 0.24);
  prismShape.closePath();

  const prismGeo = new THREE.ExtrudeGeometry(prismShape, {
    depth: 0.44,
    bevelEnabled: true,
    bevelThickness: 0.025,
    bevelSize: 0.02,
    bevelSegments: 2,
  });
  prismGeo.center();
  const prism = new THREE.Mesh(prismGeo, brushedAluminumMat);
  prism.position.set(0, 1.09, -0.02);
  prism.castShadow = true;
  group.add(prism);

  // 5. Hot shoe on top of pentaprism
  const hotShoe = new THREE.Mesh(
    new THREE.BoxGeometry(0.22, 0.04, 0.2),
    darkMetalMat,
  );
  hotShoe.position.set(0, 1.24, -0.02);
  group.add(hotShoe);

  // 6. Front name badge
  const badge = new THREE.Mesh(
    new THREE.PlaneGeometry(0.38, 0.13),
    new THREE.MeshStandardMaterial({
      map: badgeTex,
      roughness: 0.3,
      metalness: 0.7,
      polygonOffset: true,
      polygonOffsetFactor: -1,
    }),
  );
  badge.position.set(-0.46, 0.88, 0.295);
  group.add(badge);

  // 7. Selenium light meter window
  const meterWindow = new THREE.Mesh(
    new THREE.BoxGeometry(0.46, 0.14, 0.04),
    darkMetalMat,
  );
  meterWindow.position.set(0.36, 0.88, 0.29);
  group.add(meterWindow);

  // 8. Helios lens barrel (outer, focus ring, front rim)
  const lensOuter = new THREE.Mesh(
    new THREE.CylinderGeometry(0.32, 0.34, 0.36, 28),
    brushedAluminumMat,
  );
  lensOuter.rotation.x = Math.PI / 2;
  lensOuter.position.set(0.04, 0.44, 0.44);
  lensOuter.castShadow = true;
  group.add(lensOuter);

  const focusRing = new THREE.Mesh(
    new THREE.CylinderGeometry(0.34, 0.34, 0.14, 24),
    darkMetalMat,
  );
  focusRing.rotation.x = Math.PI / 2;
  focusRing.position.set(0.04, 0.44, 0.46);
  group.add(focusRing);

  const lensHood = new THREE.Mesh(
    new THREE.CylinderGeometry(0.29, 0.31, 0.12, 28, 1, true),
    darkMetalMat,
  );
  lensHood.rotation.x = Math.PI / 2;
  lensHood.position.set(0.04, 0.44, 0.64);
  group.add(lensHood);

  // 9. Optical glass element
  const glass = new THREE.Mesh(
    new THREE.SphereGeometry(0.24, 20, 12, 0, Math.PI * 2, 0, Math.PI * 0.38),
    lensGlassMat,
  );
  glass.rotation.x = Math.PI / 2;
  glass.position.set(0.04, 0.44, 0.47);
  group.add(glass);

  // 10. Shutter dial & rewind knob
  const shutterDial = new THREE.Mesh(
    new THREE.CylinderGeometry(0.11, 0.11, 0.09, 20),
    brushedAluminumMat,
  );
  shutterDial.position.set(0.48, 1.02, 0.04);
  group.add(shutterDial);

  const rewindKnob = new THREE.Mesh(
    new THREE.CylinderGeometry(0.12, 0.12, 0.08, 20),
    brushedAluminumMat,
  );
  rewindKnob.position.set(-0.5, 1.02, 0);
  group.add(rewindKnob);

  // 11. Viewfinder eyepiece on back
  const viewfinder = new THREE.Mesh(
    new THREE.BoxGeometry(0.2, 0.14, 0.06),
    darkMetalMat,
  );
  viewfinder.position.set(0, 0.9, -0.3);
  group.add(viewfinder);

  return group;
}

function buildSingleSneaker(
  maxAnisotropy: number,
  isRight: boolean,
): THREE.Group {
  const shoe = new THREE.Group();

  const canvasTex = makeCanvasTexture(
    128,
    128,
    (ctx, w, h) => {
      ctx.fillStyle = '#D96B43';
      ctx.fillRect(0, 0, w, h);
      ctx.strokeStyle = 'rgba(255,255,255,0.08)';
      ctx.lineWidth = 1;
      for (let i = 0; i < w; i += 4) {
        ctx.beginPath();
        ctx.moveTo(i, 0);
        ctx.lineTo(i, h);
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(0, i);
        ctx.lineTo(w, i);
        ctx.stroke();
      }
    },
    maxAnisotropy,
    true,
  );

  const rubberMat = new THREE.MeshStandardMaterial({
    color: 0xf4efe6,
    roughness: 0.72,
    metalness: 0.02,
  });

  const trimStripeMat = new THREE.MeshStandardMaterial({
    color: 0x26211d,
    roughness: 0.55,
    metalness: 0.05,
  });

  const upperMat = new THREE.MeshStandardMaterial({
    map: canvasTex,
    roughness: 0.88,
    metalness: 0.02,
  });

  const laceMat = new THREE.MeshStandardMaterial({
    color: 0xfaf7f2,
    roughness: 0.8,
  });

  const eyeletMat = new THREE.MeshStandardMaterial({
    color: 0xd0ccc5,
    roughness: 0.25,
    metalness: 0.85,
  });

  // 1. Vulcanized sole profile
  const soleShape = new THREE.Shape();
  soleShape.moveTo(-0.22, -0.58);
  soleShape.quadraticCurveTo(0.24, -0.62, 0.24, -0.35);
  soleShape.lineTo(0.26, 0.35);
  soleShape.quadraticCurveTo(0.24, 0.68, 0, 0.7);
  soleShape.quadraticCurveTo(-0.24, 0.68, -0.25, 0.35);
  soleShape.lineTo(-0.22, -0.58);

  const soleGeo = new THREE.ExtrudeGeometry(soleShape, {
    depth: 0.14,
    bevelEnabled: true,
    bevelThickness: 0.02,
    bevelSize: 0.015,
    bevelSegments: 2,
  });
  soleGeo.rotateX(Math.PI / 2);
  const sole = new THREE.Mesh(soleGeo, rubberMat);
  sole.position.set(0, 0.16, 0);
  sole.castShadow = true;
  sole.receiveShadow = true;
  shoe.add(sole);

  // 2. Foxing black stripe
  const stripe = new THREE.Mesh(
    new THREE.BoxGeometry(0.51, 0.025, 1.24),
    trimStripeMat,
  );
  stripe.position.set(0, 0.1, 0.02);
  shoe.add(stripe);

  // 3. Canvas upper main heel/side body
  const upperGeo = new THREE.BoxGeometry(0.44, 0.36, 0.86);
  const upper = new THREE.Mesh(upperGeo, upperMat);
  upper.position.set(0, 0.34, -0.14);
  upper.castShadow = true;
  shoe.add(upper);

  // 4. Rounded rubber toe cap
  const toeCap = new THREE.Mesh(
    new THREE.SphereGeometry(0.24, 18, 12, 0, Math.PI * 2, 0, Math.PI / 2),
    rubberMat,
  );
  toeCap.scale.set(1.0, 0.72, 1.35);
  toeCap.position.set(0, 0.16, 0.38);
  toeCap.castShadow = true;
  shoe.add(toeCap);

  // 5. Tongue angled forward
  const tongue = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.36, 0.05), upperMat);
  tongue.position.set(0, 0.42, 0.08);
  tongue.rotation.x = 0.55;
  shoe.add(tongue);

  // 6. Criss-cross laces + metal eyelets
  for (let i = 0; i < 4; i++) {
    const z = -0.05 + i * 0.1;
    const y = 0.47 - i * 0.06;

    const lace = new THREE.Mesh(
      new THREE.CylinderGeometry(0.016, 0.016, 0.28, 8),
      laceMat,
    );
    lace.rotation.z = Math.PI / 2;
    lace.position.set(0, y, z);
    shoe.add(lace);

    for (const side of [-1, 1]) {
      const eyelet = new THREE.Mesh(
        new THREE.TorusGeometry(0.02, 0.006, 6, 12),
        eyeletMat,
      );
      eyelet.rotation.y = Math.PI / 2;
      eyelet.position.set(side * 0.14, y, z);
      shoe.add(eyelet);
    }
  }

  if (isRight) {
    shoe.scale.x = -1;
  }

  return shoe;
}

function buildSneakersModel(maxAnisotropy: number): THREE.Group {
  const group = new THREE.Group();

  const left = buildSingleSneaker(maxAnisotropy, false);
  left.position.set(-0.36, 0, 0.04);
  left.rotation.y = 0.18;
  group.add(left);

  const right = buildSingleSneaker(maxAnisotropy, true);
  right.position.set(0.36, 0, -0.06);
  right.rotation.y = -0.22;
  group.add(right);

  return group;
}

function buildAvocadoModel(maxAnisotropy: number): THREE.Group {
  const group = new THREE.Group();

  const speckledCeramicTex = makeCanvasTexture(
    256,
    256,
    (ctx, w, h) => {
      ctx.fillStyle = '#7F9A65';
      ctx.fillRect(0, 0, w, h);
      for (let i = 0; i < 650; i++) {
        const x = Math.abs((Math.sin(i * 19.31) * 43758.54) % 1) * w;
        const y = Math.abs((Math.sin(i * 41.17) * 43758.54) % 1) * h;
        ctx.fillStyle = i % 3 === 0 ? '#4B5E39' : '#A9BF91';
        ctx.beginPath();
        ctx.arc(x, y, (i % 3) + 0.8, 0, Math.PI * 2);
        ctx.fill();
      }
    },
    maxAnisotropy,
    true,
  );

  const walnutTex = makeCanvasTexture(
    256,
    256,
    (ctx, w, h) => {
      ctx.fillStyle = '#74482D';
      ctx.fillRect(0, 0, w, h);
      ctx.strokeStyle = 'rgba(42, 22, 10, 0.32)';
      ctx.lineWidth = 3;
      for (let y = 0; y < h; y += 8) {
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.bezierCurveTo(w * 0.33, y + 6, w * 0.66, y - 6, w, y);
        ctx.stroke();
      }
    },
    maxAnisotropy,
    true,
  );

  const outerMat = new THREE.MeshStandardMaterial({
    map: speckledCeramicTex,
    roughness: 0.62,
    metalness: 0.04,
  });

  const innerFleshMat = new THREE.MeshStandardMaterial({
    color: 0xc8d9a6,
    roughness: 0.48,
    metalness: 0.02,
  });

  const woodPitMat = new THREE.MeshStandardMaterial({
    map: walnutTex,
    roughness: 0.34,
    metalness: 0.05,
  });

  const leafMat = new THREE.MeshStandardMaterial({
    color: 0x455834,
    roughness: 0.25,
    metalness: 0.08,
  });

  // 1. Sculpted pear-like outer avocado silhouette via LatheGeometry
  const points: THREE.Vector2[] = [];
  for (let i = 0; i <= 20; i++) {
    const t = i / 20; // 0 bottom -> 1 top
    const y = t * 1.48;
    const radius =
      Math.sin(t * Math.PI) * (0.62 * (1 - t * 0.45) + 0.08);
    points.push(new THREE.Vector2(Math.max(0.01, radius), y));
  }
  const outerGeo = new THREE.LatheGeometry(points, 28);
  outerGeo.scale(1.0, 1.0, 0.65);
  const outer = new THREE.Mesh(outerGeo, outerMat);
  outer.castShadow = true;
  outer.receiveShadow = true;
  group.add(outer);

  // 2. Inner sliced face
  const faceGeo = new THREE.LatheGeometry(points, 24);
  faceGeo.scale(0.84, 0.88, 0.25);
  const face = new THREE.Mesh(faceGeo, innerFleshMat);
  face.position.set(0, 0.08, 0.23);
  group.add(face);

  // 3. Smooth walnut wooden pit
  const pit = new THREE.Mesh(new THREE.SphereGeometry(0.28, 24, 18), woodPitMat);
  pit.scale.set(0.95, 1.12, 0.82);
  pit.position.set(0, 0.54, 0.3);
  pit.castShadow = true;
  group.add(pit);

  // 4. Ceramic stem
  const stem = new THREE.Mesh(
    new THREE.CylinderGeometry(0.04, 0.06, 0.18, 12),
    leafMat,
  );
  stem.position.set(0, 1.54, 0);
  stem.rotation.z = -0.18;
  group.add(stem);

  // 5. Glazed ceramic leaf
  const leafShape = new THREE.Shape();
  leafShape.moveTo(0, 0);
  leafShape.quadraticCurveTo(0.22, 0.14, 0.34, 0);
  leafShape.quadraticCurveTo(0.2, -0.14, 0, 0);
  const leafGeo = new THREE.ExtrudeGeometry(leafShape, {
    depth: 0.03,
    bevelEnabled: true,
    bevelThickness: 0.01,
    bevelSize: 0.01,
  });
  const leaf = new THREE.Mesh(leafGeo, leafMat);
  leaf.position.set(0.04, 1.52, 0);
  leaf.rotation.z = -0.38;
  group.add(leaf);

  return group;
}

function buildCustomSouvenirModel(
  item: AlbumItem,
  maxAnisotropy: number,
  coverSourceUrl: string,
): THREE.Group {
  const group = new THREE.Group();

  const travertineTex = makeCanvasTexture(
    256,
    256,
    (ctx, w, h) => {
      ctx.fillStyle = '#EAE0D2';
      ctx.fillRect(0, 0, w, h);
      for (let i = 0; i < 400; i++) {
        const x = Math.abs((Math.sin(i * 11.7) * 43758.54) % 1) * w;
        const y = Math.abs((Math.sin(i * 53.3) * 43758.54) % 1) * h;
        ctx.fillStyle = i % 2 === 0 ? 'rgba(180,164,142,0.28)' : 'rgba(255,255,255,0.35)';
        ctx.fillRect(x, y, (i % 12) + 4, 2);
      }
    },
    maxAnisotropy,
    true,
  );

  const stoneMat = new THREE.MeshStandardMaterial({
    map: travertineTex,
    roughness: 0.78,
    metalness: 0.03,
  });

  const brassMat = new THREE.MeshStandardMaterial({
    color: 0xc9965b,
    roughness: 0.24,
    metalness: 0.86,
  });

  const accentColor = item.accentHex || '#D96B43';
  const frameMat = new THREE.MeshStandardMaterial({
    color: new THREE.Color(accentColor),
    roughness: 0.58,
    metalness: 0.08,
  });

  // 1. Stepped cylindrical museum pedestal
  const baseBottom = new THREE.Mesh(
    new THREE.CylinderGeometry(0.86, 0.92, 0.14, 32),
    stoneMat,
  );
  baseBottom.position.set(0, 0.07, 0);
  baseBottom.castShadow = true;
  baseBottom.receiveShadow = true;
  group.add(baseBottom);

  const brassRing = new THREE.Mesh(
    new THREE.CylinderGeometry(0.76, 0.78, 0.04, 32),
    brassMat,
  );
  brassRing.position.set(0, 0.16, 0);
  group.add(brassRing);

  // 2. Twin brass cradle posts
  for (const side of [-0.42, 0.42]) {
    const post = new THREE.Mesh(
      new THREE.CylinderGeometry(0.03, 0.035, 0.26, 12),
      brassMat,
    );
    post.position.set(side, 0.28, -0.05);
    group.add(post);
  }

  // 3. Sculpted ceramic display slab holding the captured photo
  const tablet = new THREE.Mesh(
    new THREE.BoxGeometry(1.36, 1.04, 0.14),
    frameMat,
  );
  tablet.position.set(0, 0.82, 0);
  tablet.rotation.x = -0.14;
  tablet.castShadow = true;
  group.add(tablet);

  // 4. Inner cream matboard frame
  const matboard = new THREE.Mesh(
    new THREE.BoxGeometry(1.24, 0.92, 0.155),
    stoneMat,
  );
  matboard.position.set(0, 0.82, 0);
  matboard.rotation.x = -0.14;
  group.add(matboard);

  // 5. Captured photo texture mapped to front (and secondary frame or cover to back)
  const photoMat = new THREE.MeshStandardMaterial({
    color: 0xffffff,
    roughness: 0.35,
    metalness: 0.02,
    polygonOffset: true,
    polygonOffsetFactor: -1,
  });

  const loader = new THREE.TextureLoader();
  loader.load(coverSourceUrl, (tex) => {
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.anisotropy = Math.max(1, maxAnisotropy);
    photoMat.map = tex;
    photoMat.needsUpdate = true;
  });

  const frontPhoto = new THREE.Mesh(new THREE.PlaneGeometry(1.12, 0.82), photoMat);
  frontPhoto.position.set(0, 0.82, 0);
  frontPhoto.rotation.x = -0.14;
  frontPhoto.translateZ(0.082);
  group.add(frontPhoto);

  // Back photo (uses second frame if captured during 360° orbit)
  const backUrl =
    item.frames && item.frames.length > 1
      ? item.frames[Math.floor(item.frames.length / 2)]
      : coverSourceUrl;
  const backMat = new THREE.MeshStandardMaterial({
    color: 0xffffff,
    roughness: 0.35,
    metalness: 0.02,
    polygonOffset: true,
    polygonOffsetFactor: -1,
  });
  loader.load(backUrl, (tex) => {
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.anisotropy = Math.max(1, maxAnisotropy);
    backMat.map = tex;
    backMat.needsUpdate = true;
  });

  const backPhoto = new THREE.Mesh(new THREE.PlaneGeometry(1.12, 0.82), backMat);
  backPhoto.position.set(0, 0.82, 0);
  backPhoto.rotation.x = -0.14;
  backPhoto.rotateY(Math.PI);
  backPhoto.translateZ(0.082);
  group.add(backPhoto);

  // 6. Decorative brass corner rivets
  const rivetGeo = new THREE.SphereGeometry(0.028, 10, 8);
  for (const sx of [-0.58, 0.58]) {
    for (const sy of [-0.42, 0.42]) {
      const rivet = new THREE.Mesh(rivetGeo, brassMat);
      rivet.position.set(sx, 0.82 + sy * Math.cos(-0.14), 0.08 + sy * Math.sin(0.14));
      group.add(rivet);
    }
  }

  return group;
}

export function buildAlbumObject3D(
  item: AlbumItem,
  maxAnisotropy: number,
  resolvedCoverUrl: string,
): THREE.Group {
  switch (item.modelType) {
    case 'zenit':
      return buildZenitModel(maxAnisotropy);
    case 'sneakers':
      return buildSneakersModel(maxAnisotropy);
    case 'avocado':
      return buildAvocadoModel(maxAnisotropy);
    case 'custom':
    default:
      return buildCustomSouvenirModel(item, maxAnisotropy, resolvedCoverUrl);
  }
}

export function buildContactShadowDisc(maxAnisotropy: number): THREE.Mesh {
  const shadowTex = makeCanvasTexture(
    256,
    256,
    (ctx, w, h) => {
      const grad = ctx.createRadialGradient(
        w / 2,
        h / 2,
        w * 0.06,
        w / 2,
        h / 2,
        w * 0.5,
      );
      grad.addColorStop(0, 'rgba(35, 30, 26, 0.42)');
      grad.addColorStop(0.55, 'rgba(35, 30, 26, 0.14)');
      grad.addColorStop(1, 'rgba(35, 30, 26, 0)');
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, w, h);
    },
    maxAnisotropy,
    true,
  );

  const mat = new THREE.MeshBasicMaterial({
    map: shadowTex,
    transparent: true,
    depthWrite: false,
    opacity: 0.9,
  });

  const disc = new THREE.Mesh(new THREE.CircleGeometry(1.45, 32), mat);
  disc.rotation.x = -Math.PI / 2;
  disc.position.y = 0.006;
  return disc;
}

export function disposeObject3D(root: THREE.Object3D): void {
  const textures = new Set<THREE.Texture>();
  const materials = new Set<THREE.Material>();
  const geometries = new Set<THREE.BufferGeometry>();

  root.traverse((obj) => {
    const mesh = obj as THREE.Mesh;
    if (mesh.geometry) {
      geometries.add(mesh.geometry);
    }
    const matOrArr = mesh.material;
    if (Array.isArray(matOrArr)) {
      matOrArr.forEach((m) => m && materials.add(m));
    } else if (matOrArr) {
      materials.add(matOrArr);
    }
  });

  materials.forEach((mat) => {
    const std = mat as THREE.MeshStandardMaterial;
    if (std.map) textures.add(std.map);
    if (std.bumpMap) textures.add(std.bumpMap);
    if (std.roughnessMap) textures.add(std.roughnessMap);
    if (std.normalMap) textures.add(std.normalMap);
    if (std.alphaMap) textures.add(std.alphaMap);
    if (std.emissiveMap) textures.add(std.emissiveMap);
    mat.dispose();
  });

  textures.forEach((tex) => tex.dispose());
  geometries.forEach((geo) => geo.dispose());
  root.clear();
}
