import {
  CAPTURE_STEPS,
  DEMO_RESOLUTION,
  type CapturedViewFrame,
} from '../types/album';
import { SHOWCASE_CAMERA_DISTANCE, SHOWCASE_PROJ_SCALE } from './showcaseOrbit';

export type StudioObjectId =
  | 'seed-zenit'
  | 'seed-sneakers'
  | 'seed-avocado'
  | 'demo-teapot';

interface Vec3 {
  x: number;
  y: number;
  z: number;
}

interface ProjectedPt {
  u: number;
  v: number;
  cz: number;
  persp: number;
}

function makeProjector(yawDeg: number, tiltDeg: number, size: number) {
  const yawRad = (yawDeg * Math.PI) / 180;
  const tiltRad = (tiltDeg * Math.PI) / 180;
  const cosY = Math.cos(yawRad);
  const sinY = Math.sin(yawRad);
  const cosT = Math.cos(tiltRad);
  const sinT = Math.sin(tiltRad);
  const D = SHOWCASE_CAMERA_DISTANCE;

  const project = (x: number, y: number, z: number): ProjectedPt => {
    const rx = x * cosY - z * sinY;
    const rz0 = x * sinY + z * cosY;

    const cx = rx;
    const cy = y * cosT - rz0 * sinT;
    const cz = y * sinT + rz0 * cosT;

    const persp = D / Math.max(0.45, D - cz);
    const u = (0.5 + cx * persp * SHOWCASE_PROJ_SCALE) * size;
    const v = (0.52 - cy * persp * SHOWCASE_PROJ_SCALE) * size;
    return { u, v, cz, persp };
  };

  // Forward direction from object origin toward camera
  const camDir: Vec3 = {
    x: sinY * cosT,
    y: sinT,
    z: cosY * cosT,
  };

  return { project, camDir };
}

type DrawCmd = {
  depth: number;
  draw: (ctx: CanvasRenderingContext2D) => void;
};

function drawPolygon(
  ctx: CanvasRenderingContext2D,
  pts: ProjectedPt[],
  fillStyle: string | CanvasGradient,
  strokeStyle?: string,
  lineWidth = 1.5,
) {
  if (pts.length < 3) return;
  ctx.beginPath();
  ctx.moveTo(pts[0].u, pts[0].v);
  for (let i = 1; i < pts.length; i++) {
    ctx.lineTo(pts[i].u, pts[i].v);
  }
  ctx.closePath();
  ctx.fillStyle = fillStyle;
  ctx.fill();
  if (strokeStyle) {
    ctx.strokeStyle = strokeStyle;
    ctx.lineWidth = lineWidth;
    ctx.lineJoin = 'round';
    ctx.stroke();
  }
}

function addBoxCommands(
  cmds: DrawCmd[],
  project: (x: number, y: number, z: number) => ProjectedPt,
  cx: number,
  cy: number,
  cz: number,
  hx: number,
  hy: number,
  hz: number,
  colors: {
    front: string;
    back: string;
    left: string;
    right: string;
    top: string;
    bottom: string;
    stroke?: string;
  },
) {
  const v: ProjectedPt[] = [
    project(cx - hx, cy - hy, cz + hz), // 0: FBL
    project(cx + hx, cy - hy, cz + hz), // 1: FBR
    project(cx + hx, cy + hy, cz + hz), // 2: FTR
    project(cx - hx, cy + hy, cz + hz), // 3: FTL
    project(cx - hx, cy - hy, cz - hz), // 4: BBL
    project(cx + hx, cy - hy, cz - hz), // 5: BBR
    project(cx + hx, cy + hy, cz - hz), // 6: BTR
    project(cx - hx, cy + hy, cz - hz), // 7: BTL
  ];

  const faces: Array<{ idx: [number, number, number, number]; color: string }> = [
    { idx: [0, 1, 2, 3], color: colors.front },
    { idx: [5, 4, 7, 6], color: colors.back },
    { idx: [4, 0, 3, 7], color: colors.left },
    { idx: [1, 5, 6, 2], color: colors.right },
    { idx: [3, 2, 6, 7], color: colors.top },
    { idx: [4, 5, 1, 0], color: colors.bottom },
  ];

  for (const f of faces) {
    const pts = f.idx.map((i) => v[i]);
    const avgDepth = (pts[0].cz + pts[1].cz + pts[2].cz + pts[3].cz) / 4;
    cmds.push({
      depth: avgDepth,
      draw: (ctx) => drawPolygon(ctx, pts, f.color, colors.stroke, 1.5),
    });
  }
}

function addCylinderYCommands(
  cmds: DrawCmd[],
  project: (x: number, y: number, z: number) => ProjectedPt,
  cx: number,
  y0: number,
  y1: number,
  cz: number,
  r: number,
  sideColor: string,
  capColor: string,
  segments = 24,
) {
  const bottomPts: ProjectedPt[] = [];
  const topPts: ProjectedPt[] = [];
  for (let i = 0; i < segments; i++) {
    const a = (i / segments) * Math.PI * 2;
    const dx = Math.cos(a) * r;
    const dz = Math.sin(a) * r;
    bottomPts.push(project(cx + dx, y0, cz + dz));
    topPts.push(project(cx + dx, y1, cz + dz));
  }

  for (let i = 0; i < segments; i++) {
    const next = (i + 1) % segments;
    const quad = [bottomPts[i], bottomPts[next], topPts[next], topPts[i]];
    const depth = (quad[0].cz + quad[1].cz + quad[2].cz + quad[3].cz) / 4;
    cmds.push({
      depth,
      draw: (ctx) => drawPolygon(ctx, quad, sideColor, sideColor, 0.75),
    });
  }

  const topDepth = topPts.reduce((s, p) => s + p.cz, 0) / segments;
  cmds.push({
    depth: topDepth + 0.002,
    draw: (ctx) => drawPolygon(ctx, topPts, capColor, 'rgba(35,30,26,0.18)', 1.2),
  });
}

function addCylinderZCommands(
  cmds: DrawCmd[],
  project: (x: number, y: number, z: number) => ProjectedPt,
  cx: number,
  cy: number,
  z0: number,
  z1: number,
  r0: number,
  r1: number,
  sideColor: string,
  frontCapColor: string,
  segments = 28,
) {
  const backPts: ProjectedPt[] = [];
  const frontPts: ProjectedPt[] = [];
  for (let i = 0; i < segments; i++) {
    const a = (i / segments) * Math.PI * 2;
    const cosA = Math.cos(a);
    const sinA = Math.sin(a);
    backPts.push(project(cx + cosA * r0, cy + sinA * r0, z0));
    frontPts.push(project(cx + cosA * r1, cy + sinA * r1, z1));
  }

  for (let i = 0; i < segments; i++) {
    const next = (i + 1) % segments;
    const quad = [backPts[i], backPts[next], frontPts[next], frontPts[i]];
    const depth = (quad[0].cz + quad[1].cz + quad[2].cz + quad[3].cz) / 4;
    const light = 0.85 + 0.15 * Math.sin((i / segments) * Math.PI * 2);
    cmds.push({
      depth,
      draw: (ctx) => {
        ctx.save();
        ctx.globalAlpha = 1;
        drawPolygon(ctx, quad, sideColor, sideColor, 0.7);
        if (light > 0.95) {
          drawPolygon(ctx, quad, 'rgba(255,255,255,0.12)');
        }
        ctx.restore();
      },
    });
  }

  const frontDepth = frontPts.reduce((s, p) => s + p.cz, 0) / segments;
  cmds.push({
    depth: frontDepth + 0.003,
    draw: (ctx) => drawPolygon(ctx, frontPts, frontCapColor, 'rgba(20,18,16,0.35)', 1.5),
  });
}

function drawZenitCamera(
  ctx: CanvasRenderingContext2D,
  size: number,
  yawDeg: number,
  tiltDeg: number,
) {
  const { project, camDir } = makeProjector(yawDeg, tiltDeg, size);
  const cmds: DrawCmd[] = [];

  // Brushed silver bottom base plate
  addBoxCommands(cmds, project, 0, -0.34, 0, 0.64, 0.055, 0.21, {
    front: '#DFDAD2',
    back: '#CFC9BF',
    left: '#D4CEC4',
    right: '#C6BFB4',
    top: '#EAE5DD',
    bottom: '#B8B1A6',
    stroke: 'rgba(35,30,26,0.15)',
  });

  // Matte black leatherette main body
  addBoxCommands(cmds, project, 0, -0.05, 0, 0.635, 0.235, 0.205, {
    front: '#2A2522',
    back: '#231F1C',
    left: '#2E2925',
    right: '#201C1A',
    top: '#342E2A',
    bottom: '#1B1715',
    stroke: 'rgba(255,255,255,0.06)',
  });

  // Brushed silver top deck
  addBoxCommands(cmds, project, 0, 0.245, 0, 0.64, 0.065, 0.21, {
    front: '#E5E0D8',
    back: '#D2CCC2',
    left: '#DAD4CA',
    right: '#CBC4B9',
    top: '#F1EDE6',
    bottom: '#BEB7AC',
    stroke: 'rgba(35,30,26,0.15)',
  });

  // Pentaprism top dome
  addBoxCommands(cmds, project, 0.0, 0.375, -0.01, 0.2, 0.075, 0.17, {
    front: '#EAE5DD',
    back: '#D4CEC4',
    left: '#DDD7CD',
    right: '#C8C1B6',
    top: '#F4F0E9',
    bottom: '#C2BBB0',
    stroke: 'rgba(35,30,26,0.16)',
  });

  // Hot-shoe metallic plate
  addBoxCommands(cmds, project, 0.0, 0.46, -0.01, 0.095, 0.015, 0.095, {
    front: '#403934',
    back: '#352F2A',
    left: '#3B342F',
    right: '#2D2824',
    top: '#524943',
    bottom: '#2B2622',
  });

  // Left rewind knob & right shutter dial
  addCylinderYCommands(cmds, project, -0.45, 0.31, 0.42, 0.0, 0.1, '#B8B1A6', '#EAE5DD', 20);
  addCylinderYCommands(cmds, project, 0.44, 0.31, 0.41, 0.0, 0.105, '#2E2925', '#4B443E', 20);
  addCylinderYCommands(cmds, project, 0.25, 0.31, 0.37, 0.08, 0.04, '#B5ADA2', '#F2EFE9', 16);

  // Rear optical viewfinder window on -Z
  addBoxCommands(cmds, project, 0.0, 0.24, -0.215, 0.085, 0.055, 0.015, {
    front: '#31455C',
    back: '#4C739E',
    left: '#2B3540',
    right: '#2B3540',
    top: '#384654',
    bottom: '#242B33',
  });

  // Protruding Helios-44 lens barrel on +Z
  addCylinderZCommands(cmds, project, 0.02, -0.04, 0.20, 0.31, 0.31, 0.3, '#D5CFC5', '#DFDAD1', 28);
  addCylinderZCommands(cmds, project, 0.02, -0.04, 0.31, 0.45, 0.29, 0.285, '#25211E', '#302B27', 28);
  addCylinderZCommands(cmds, project, 0.02, -0.04, 0.45, 0.59, 0.275, 0.265, '#C8C1B7', '#2A2522', 28);

  // Optical glass element at front of barrel
  const glassRing: ProjectedPt[] = [];
  for (let i = 0; i < 28; i++) {
    const a = (i / 28) * Math.PI * 2;
    glassRing.push(project(0.02 + Math.cos(a) * 0.19, -0.04 + Math.sin(a) * 0.19, 0.596));
  }
  const glassDepth = glassRing.reduce((s, p) => s + p.cz, 0) / 28;
  const gCenter = project(0.02, -0.04, 0.596);
  const gEdge = project(0.02 + 0.19, -0.04, 0.596);
  const gRadius = Math.max(8, Math.hypot(gEdge.u - gCenter.u, gEdge.v - gCenter.v));

  if (camDir.z > -0.25) {
    cmds.push({
      depth: glassDepth + 0.01,
      draw: (c) => {
        const grad = c.createRadialGradient(
          gCenter.u - gRadius * 0.3,
          gCenter.v - gRadius * 0.3,
          gRadius * 0.1,
          gCenter.u,
          gCenter.v,
          gRadius,
        );
        grad.addColorStop(0, '#6298CF');
        grad.addColorStop(0.55, '#254C78');
        grad.addColorStop(1, '#12243A');
        drawPolygon(c, glassRing, grad, '#181512', 2);

        // Specular optical flare arc
        c.beginPath();
        c.ellipse(
          gCenter.u - gRadius * 0.28,
          gCenter.v - gRadius * 0.28,
          gRadius * 0.26,
          gRadius * 0.14,
          -Math.PI / 5,
          0,
          Math.PI * 2,
        );
        c.fillStyle = 'rgba(255,255,255,0.42)';
        c.fill();
      },
    });
  }

  cmds.sort((a, b) => a.depth - b.depth);
  for (const cmd of cmds) cmd.draw(ctx);
}

function drawSneakersPair(
  ctx: CanvasRenderingContext2D,
  size: number,
  yawDeg: number,
  tiltDeg: number,
) {
  const { project } = makeProjector(yawDeg, tiltDeg, size);
  const cmds: DrawCmd[] = [];

  for (const sideSign of [-1, 1]) {
    const cx = sideSign * 0.29;
    const slices = 22;
    const zMin = -0.56;
    const zMax = 0.56;

    for (let i = 0; i < slices; i++) {
      const t0 = i / slices;
      const t1 = (i + 1) / slices;
      const z0 = zMin + t0 * (zMax - zMin);
      const z1 = zMin + t1 * (zMax - zMin);

      const widthAt = (t: number) =>
        0.18 * Math.sin(Math.pow(Math.max(0.06, Math.min(0.96, t)), 0.75) * Math.PI) + 0.055;
      const upperTopAt = (t: number) => (t < 0.42 ? 0.18 - t * 0.15 : 0.12 - (t - 0.42) * 0.42);

      const hw0 = widthAt(t0);
      const hw1 = widthAt(t1);
      const hy0 = upperTopAt(t0);
      const hy1 = upperTopAt(t1);

      const isToe = t0 > 0.68;
      const upperColor = isToe ? '#F6F1E9' : '#D96B43';
      const upperDark = isToe ? '#E5DDD0' : '#B95430';

      // Rubber sole slice (-0.38 .. -0.25)
      const sPts0 = [
        project(cx - hw0, -0.38, z0),
        project(cx + hw0, -0.38, z0),
        project(cx + hw0, -0.25, z0),
        project(cx - hw0, -0.25, z0),
      ];
      const sPts1 = [
        project(cx - hw1, -0.38, z1),
        project(cx + hw1, -0.38, z1),
        project(cx + hw1, -0.25, z1),
        project(cx - hw1, -0.25, z1),
      ];

      // Upper slice (-0.25 .. hy)
      const uPts0 = [
        project(cx - hw0 * 0.94, -0.25, z0),
        project(cx + hw0 * 0.94, -0.25, z0),
        project(cx + hw0 * 0.72, hy0, z0),
        project(cx - hw0 * 0.72, hy0, z0),
      ];
      const uPts1 = [
        project(cx - hw1 * 0.94, -0.25, z1),
        project(cx + hw1 * 0.94, -0.25, z1),
        project(cx + hw1 * 0.72, hy1, z1),
        project(cx - hw1 * 0.72, hy1, z1),
      ];

      const pushSide = (a: ProjectedPt[], b: ProjectedPt[], i0: number, i1: number, col: string) => {
        const quad = [a[i0], b[i0], b[i1], a[i1]];
        const depth = (quad[0].cz + quad[1].cz + quad[2].cz + quad[3].cz) / 4;
        cmds.push({ depth, draw: (c) => drawPolygon(c, quad, col, col, 0.8) });
      };

      // Sole sides & dark foxing stripe
      pushSide(sPts0, sPts1, 1, 2, '#F3EDE3');
      pushSide(sPts0, sPts1, 3, 0, '#EDE5D8');
      pushSide(sPts0, sPts1, 0, 1, '#DCD3C5');

      // Upper sides & top vamp
      pushSide(uPts0, uPts1, 1, 2, upperColor);
      pushSide(uPts0, uPts1, 3, 0, upperDark);
      pushSide(uPts0, uPts1, 2, 3, upperColor);

      // Laces & tongue highlight
      if (t0 > 0.34 && t0 < 0.72) {
        const l0 = project(cx - hw0 * 0.45, hy0 + 0.015, z0);
        const l1 = project(cx + hw0 * 0.45, hy0 + 0.015, z1);
        const l2 = project(cx - hw0 * 0.45, hy0 + 0.015, z1);
        const l3 = project(cx + hw0 * 0.45, hy0 + 0.015, z0);
        const depth = (l0.cz + l1.cz) / 2 + 0.02;
        cmds.push({
          depth,
          draw: (c) => {
            c.strokeStyle = '#FAF7F1';
            c.lineWidth = Math.max(2.5, size * 0.008);
            c.lineCap = 'round';
            c.beginPath();
            c.moveTo(l0.u, l0.v);
            c.lineTo(l1.u, l1.v);
            c.moveTo(l2.u, l2.v);
            c.lineTo(l3.u, l3.v);
            c.stroke();
          },
        });
      }

      // Heel/Toe caps
      if (i === 0) {
        cmds.push({
          depth: sPts0[0].cz,
          draw: (c) => {
            drawPolygon(c, sPts0, '#E8DFD2');
            drawPolygon(c, uPts0, '#B95430');
          },
        });
      }
      if (i === slices - 1) {
        cmds.push({
          depth: sPts1[0].cz,
          draw: (c) => {
            drawPolygon(c, sPts1, '#F6F1E9');
            drawPolygon(c, uPts1, '#F6F1E9');
          },
        });
      }
    }
  }

  cmds.sort((a, b) => a.depth - b.depth);
  for (const cmd of cmds) cmd.draw(ctx);
}

function drawAvocadoFigurine(
  ctx: CanvasRenderingContext2D,
  size: number,
  yawDeg: number,
  tiltDeg: number,
) {
  const { project, camDir } = makeProjector(yawDeg, tiltDeg, size);
  const cmds: DrawCmd[] = [];

  // Smooth pear-shaped body via latitude rings
  const latSteps = 22;
  const lonSteps = 28;
  const ringPts: ProjectedPt[][] = [];

  for (let iy = 0; iy <= latSteps; iy++) {
    const t = iy / latSteps; // 0 bottom .. 1 top
    const y = -0.5 + t * 1.02;
    const pearProfile = Math.sin(Math.max(0.02, Math.min(0.98, t)) * Math.PI) ** 0.45 * (1.18 - 0.56 * t);
    const rx = Math.max(0.02, 0.46 * pearProfile);
    const rz = Math.max(0.02, 0.34 * pearProfile);

    const row: ProjectedPt[] = [];
    for (let ix = 0; ix < lonSteps; ix++) {
      const a = (ix / lonSteps) * Math.PI * 2;
      row.push(project(Math.cos(a) * rx, y, Math.sin(a) * rz));
    }
    ringPts.push(row);
  }

  for (let iy = 0; iy < latSteps; iy++) {
    for (let ix = 0; ix < lonSteps; ix++) {
      const nextX = (ix + 1) % lonSteps;
      const quad = [
        ringPts[iy][ix],
        ringPts[iy][nextX],
        ringPts[iy + 1][nextX],
        ringPts[iy + 1][ix],
      ];
      const depth = (quad[0].cz + quad[1].cz + quad[2].cz + quad[3].cz) / 4;
      const midAngle = ((ix + 0.5) / lonSteps) * Math.PI * 2;
      const isFrontCut = Math.sin(midAngle) > 0.45 && iy > 2 && iy < latSteps - 2;
      const shade = 0.88 + 0.14 * Math.cos(midAngle - 0.6);
      const col = isFrontCut
        ? `rgb(${Math.min(255, Math.round(212 * shade))}, ${Math.min(255, Math.round(226 * shade))}, ${Math.min(255, Math.round(176 * shade))})`
        : `rgb(${Math.min(255, Math.round(108 * shade))}, ${Math.min(255, Math.round(138 * shade))}, ${Math.min(255, Math.round(86 * shade))})`;

      cmds.push({
        depth,
        draw: (c) => drawPolygon(c, quad, col, col, 0.8),
      });
    }
  }

  // Stem & ceramic leaf on top
  addCylinderYCommands(cmds, project, 0, 0.48, 0.68, 0, 0.055, '#465D36', '#5A7546', 14);
  const leafPts = [
    project(0.04, 0.61, 0),
    project(0.22, 0.68, 0.06),
    project(0.36, 0.63, 0.02),
    project(0.2, 0.56, -0.04),
  ];
  cmds.push({
    depth: leafPts.reduce((s, p) => s + p.cz, 0) / 4 + 0.02,
    draw: (c) => drawPolygon(c, leafPts, '#5E8046', '#466133', 1.5),
  });

  // Protruding walnut wooden pit sphere centered at (0, -0.14, 0.24)
  if (camDir.z > -0.35) {
    const pitCenter = project(0, -0.14, 0.24);
    const pitRim = project(0.24, -0.14, 0.24);
    const pitR = Math.max(12, Math.hypot(pitRim.u - pitCenter.u, pitRim.v - pitCenter.v));
    cmds.push({
      depth: pitCenter.cz + 0.12,
      draw: (c) => {
        const grad = c.createRadialGradient(
          pitCenter.u - pitR * 0.3,
          pitCenter.v - pitR * 0.3,
          pitR * 0.1,
          pitCenter.u,
          pitCenter.v,
          pitR,
        );
        grad.addColorStop(0, '#A86942');
        grad.addColorStop(0.65, '#7A482A');
        grad.addColorStop(1, '#4C2B18');
        c.beginPath();
        c.arc(pitCenter.u, pitCenter.v, pitR, 0, Math.PI * 2);
        c.fillStyle = grad;
        c.fill();
      },
    });
  }

  cmds.sort((a, b) => a.depth - b.depth);
  for (const cmd of cmds) cmd.draw(ctx);
}

function drawCeramicTeapot(
  ctx: CanvasRenderingContext2D,
  size: number,
  yawDeg: number,
  tiltDeg: number,
) {
  const { project, camDir } = makeProjector(yawDeg, tiltDeg, size);
  const cmds: DrawCmd[] = [];

  const latSteps = 18;
  const lonSteps = 28;
  const rings: ProjectedPt[][] = [];

  for (let iy = 0; iy <= latSteps; iy++) {
    const t = iy / latSteps;
    const y = -0.46 + t * 0.88;
    const r = Math.max(0.05, 0.32 + 0.14 * Math.sin(t * Math.PI * 0.88) - 0.08 * t);
    const row: ProjectedPt[] = [];
    for (let ix = 0; ix < lonSteps; ix++) {
      const a = (ix / lonSteps) * Math.PI * 2;
      row.push(project(Math.cos(a) * r, y, Math.sin(a) * r));
    }
    rings.push(row);
  }

  for (let iy = 0; iy < latSteps; iy++) {
    const isCollar = iy >= latSteps - 3;
    for (let ix = 0; ix < lonSteps; ix++) {
      const next = (ix + 1) % lonSteps;
      const quad = [rings[iy][ix], rings[iy][next], rings[iy + 1][next], rings[iy + 1][ix]];
      const depth = (quad[0].cz + quad[1].cz + quad[2].cz + quad[3].cz) / 4;
      const angle = ((ix + 0.5) / lonSteps) * Math.PI * 2;
      const shade = 0.88 + 0.14 * Math.cos(angle - 0.5);
      const base = isCollar ? [232, 160, 126] : [217, 107, 67];
      const col = `rgb(${Math.min(255, Math.round(base[0] * shade))}, ${Math.min(255, Math.round(base[1] * shade))}, ${Math.min(255, Math.round(base[2] * shade))})`;
      cmds.push({ depth, draw: (c) => drawPolygon(c, quad, col, col, 0.8) });
    }
  }

  // Lid knob
  addCylinderYCommands(cmds, project, 0, 0.4, 0.51, 0, 0.11, '#58463B', '#705A4D', 18);

  // Curved Handle (+X side)
  const hPts = [
    project(0.36, 0.2, 0),
    project(0.58, 0.15, 0),
    project(0.58, -0.18, 0),
    project(0.36, -0.25, 0),
  ];
  cmds.push({
    depth: hPts.reduce((s, p) => s + p.cz, 0) / 4,
    draw: (c) => {
      c.strokeStyle = '#C45732';
      c.lineWidth = Math.max(10, size * 0.038);
      c.lineCap = 'round';
      c.lineJoin = 'round';
      c.beginPath();
      c.moveTo(hPts[0].u, hPts[0].v);
      c.bezierCurveTo(hPts[1].u, hPts[1].v, hPts[2].u, hPts[2].v, hPts[3].u, hPts[3].v);
      c.stroke();
    },
  });

  // Tapered Spout (-X side)
  const spPts = [
    project(-0.34, -0.08, 0.06),
    project(-0.62, 0.24, 0.04),
    project(-0.62, 0.24, -0.04),
    project(-0.34, 0.1, -0.06),
  ];
  cmds.push({
    depth: spPts.reduce((s, p) => s + p.cz, 0) / 4,
    draw: (c) => {
      c.strokeStyle = '#D96B43';
      c.lineWidth = Math.max(12, size * 0.044);
      c.lineCap = 'round';
      c.beginPath();
      c.moveTo((spPts[0].u + spPts[3].u) / 2, (spPts[0].v + spPts[3].v) / 2);
      c.lineTo((spPts[1].u + spPts[2].u) / 2, (spPts[1].v + spPts[2].v) / 2);
      c.stroke();
    },
  });

  // Front glazed medallion (+Z)
  if (camDir.z > 0.15) {
    const mc = project(0, -0.04, 0.44);
    const mr = project(0.15, -0.04, 0.44);
    const rad = Math.max(8, Math.hypot(mr.u - mc.u, mr.v - mc.v));
    cmds.push({
      depth: mc.cz + 0.08,
      draw: (c) => {
        c.beginPath();
        c.arc(mc.u, mc.v, rad, 0, Math.PI * 2);
        c.fillStyle = '#3A4E56';
        c.fill();
        c.beginPath();
        c.arc(mc.u, mc.v, rad * 0.52, 0, Math.PI * 2);
        c.fillStyle = '#7E9E63';
        c.fill();
      },
    });
  }

  cmds.sort((a, b) => a.depth - b.depth);
  for (const cmd of cmds) cmd.draw(ctx);
}

/**
 * Renders one crisp transparent-alpha PNG frame (`DEMO_RESOLUTION` px) for a studio object.
 */
export function renderStudioStepFrame(
  objectId: StudioObjectId,
  stepIndex: number,
  size = DEMO_RESOLUTION,
): string {
  const step = CAPTURE_STEPS[stepIndex] ?? CAPTURE_STEPS[0];
  if (typeof document === 'undefined') {
    return `data:image/png;base64,${objectId}-${stepIndex}`;
  }
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');
  if (!ctx) return '';

  // Transparent background so the cutout stands cleanly on top of the 2.5D podium
  ctx.clearRect(0, 0, size, size);

  if (objectId === 'seed-zenit') {
    drawZenitCamera(ctx, size, step.yawDeg, step.tiltDeg);
  } else if (objectId === 'seed-sneakers') {
    drawSneakersPair(ctx, size, step.yawDeg, step.tiltDeg);
  } else if (objectId === 'seed-avocado') {
    drawAvocadoFigurine(ctx, size, step.yawDeg, step.tiltDeg);
  } else {
    drawCeramicTeapot(ctx, size, step.yawDeg, step.tiltDeg);
  }

  return canvas.toDataURL('image/png');
}

/**
 * Generates all 9 high-resolution transparent studio views for preloaded demo items.
 */
export function generateSeedItemViews(
  id: 'seed-zenit' | 'seed-sneakers' | 'seed-avocado',
): CapturedViewFrame[] {
  return CAPTURE_STEPS.map((step) => ({
    stepIndex: step.index,
    shortLabel: step.shortLabel,
    yawDeg: step.yawDeg,
    tiltDeg: step.tiltDeg,
    dataUrl: renderStudioStepFrame(id, step.index, DEMO_RESOLUTION),
  }));
}

/**
 * Renders one fallback step frame for camera-unavailable demo capture.
 */
export function renderFallbackStepFrame(
  stepIndex: number,
  size = DEMO_RESOLUTION,
): string {
  return renderStudioStepFrame('demo-teapot', stepIndex, size);
}

/**
 * Generates all 9 high-resolution transparent frames for instant demo capture.
 */
export function generateAllFallbackSteps(): CapturedViewFrame[] {
  return CAPTURE_STEPS.map((step) => ({
    stepIndex: step.index,
    shortLabel: step.shortLabel,
    yawDeg: step.yawDeg,
    tiltDeg: step.tiltDeg,
    dataUrl: renderFallbackStepFrame(step.index, DEMO_RESOLUTION),
  }));
}
