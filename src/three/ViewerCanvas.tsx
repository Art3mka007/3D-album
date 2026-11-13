import React, { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import type { AlbumItem } from '../types/album';
import { resolveCoverUrl } from '../utils/demoCovers';
import {
  buildAlbumObject3D,
  buildContactShadowDisc,
  disposeObject3D,
} from './proceduralModels';

interface ViewerCanvasProps {
  item: AlbumItem;
  gyroEnabled: boolean;
  vrMode: boolean;
}

function detectSoftwareGl(): boolean {
  try {
    const canvas = document.createElement('canvas');
    const gl = canvas.getContext('webgl2') || canvas.getContext('webgl');
    if (!gl) return true;
    const ext = gl.getExtension('WEBGL_debug_renderer_info');
    const param = ext ? ext.UNMASKED_RENDERER_WEBGL : gl.RENDERER;
    const gpu = String(gl.getParameter(param));
    gl.getExtension('WEBGL_lose_context')?.loseContext();
    return /SwiftShader|llvmpipe|softpipe|Software|Basic Render/i.test(gpu);
  } catch {
    return true;
  }
}

export const ViewerCanvas: React.FC<ViewerCanvasProps> = ({
  item,
  gyroEnabled,
  vrMode,
}) => {
  const mountRef = useRef<HTMLDivElement | null>(null);
  const gyroEnabledRef = useRef(gyroEnabled);
  const vrModeRef = useRef(vrMode);
  const [contextLost, setContextLost] = useState(false);

  const requestRenderFnRef = useRef<(() => void) | null>(null);
  const gyroBaselineRef = useRef<{ beta: number; gamma: number } | null>(null);
  const gyroOffsetRef = useRef<{ azimuth: number; polar: number }>({
    azimuth: 0,
    polar: 0,
  });

  useEffect(() => {
    gyroEnabledRef.current = gyroEnabled;
    if (!gyroEnabled) {
      gyroBaselineRef.current = null;
      gyroOffsetRef.current.azimuth = 0;
      gyroOffsetRef.current.polar = 0;
    }
    requestRenderFnRef.current?.();
  }, [gyroEnabled]);

  useEffect(() => {
    vrModeRef.current = vrMode;
    requestRenderFnRef.current?.();
  }, [vrMode]);

  useEffect(() => {
    const container = mountRef.current;
    if (!container) return;

    const isSoftwareGl = detectSoftwareGl();

    const width = container.clientWidth || window.innerWidth;
    const height = container.clientHeight || window.innerHeight;

    const renderer = new THREE.WebGLRenderer({
      antialias: !isSoftwareGl,
      powerPreference: 'high-performance',
    });
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.08;
    // Strictly cap pixelRatio to max 2 on mobile GPUs, 1 on software WebGL
    renderer.setPixelRatio(
      isSoftwareGl ? 1 : Math.min(window.devicePixelRatio || 1, 2),
    );
    renderer.setSize(width, height);
    renderer.shadowMap.enabled = !isSoftwareGl;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;

    const canvas = renderer.domElement;
    canvas.style.display = 'block';
    canvas.style.width = '100%';
    canvas.style.height = '100%';
    canvas.style.touchAction = 'none';
    container.appendChild(canvas);

    const onContextLost = (e: Event) => {
      e.preventDefault();
      setContextLost(true);
    };
    const onContextRestored = () => {
      setContextLost(false);
    };
    canvas.addEventListener('webglcontextlost', onContextLost);
    canvas.addEventListener('webglcontextrestored', onContextRestored);

    const scene = new THREE.Scene();
    scene.background = new THREE.Color('#F3EDE4');
    scene.fog = new THREE.Fog('#F3EDE4', 9, 22);

    // Mandatory studio environment map via RoomEnvironment
    const pmremGenerator = new THREE.PMREMGenerator(renderer);
    const roomEnv = new RoomEnvironment();
    const envTarget = pmremGenerator.fromScene(roomEnv, 0.04);
    scene.environment = envTarget.texture;
    roomEnv.dispose();
    pmremGenerator.dispose();

    const camera = new THREE.PerspectiveCamera(42, width / height, 0.1, 40);

    function computeIdealDistance(viewW: number, viewH: number, isVr: boolean): number {
      const aspect = Math.max(0.2, (isVr ? viewW / 2 : viewW) / Math.max(1, viewH));
      const fovRad = THREE.MathUtils.degToRad(isVr ? 54 : 42);
      const tanHalfV = Math.tan(fovRad / 2);
      const tanHalfH = tanHalfV * aspect;
      const distForWidth = 0.92 / Math.max(0.08, tanHalfH);
      const distForHeight = 0.95 / Math.max(0.1, tanHalfV);
      return THREE.MathUtils.clamp(Math.max(distForWidth, distForHeight, 3.1), 3.1, 8.2);
    }

    const initialDist = computeIdealDistance(width, height, vrModeRef.current);
    const initialDir = new THREE.Vector3(0.54, 0.34, 0.77).normalize();
    const targetY = width < height ? 0.12 : 0.48;
    camera.position.copy(initialDir.multiplyScalar(initialDist)).add(new THREE.Vector3(0, targetY, 0));

    const stereoCamera = new THREE.StereoCamera();
    stereoCamera.eyeSep = 0.064;

    // 3-point warm/cool studio lighting
    const hemiLight = new THREE.HemisphereLight(0xeef3fa, 0xcab9a4, 0.9);
    scene.add(hemiLight);

    const keyLight = new THREE.DirectionalLight(0xfff4e4, 2.1);
    keyLight.position.set(3.2, 5.2, 3.6);
    keyLight.castShadow = !isSoftwareGl;
    keyLight.shadow.mapSize.set(1024, 1024);
    keyLight.shadow.camera.near = 0.5;
    keyLight.shadow.camera.far = 14;
    keyLight.shadow.camera.left = -2.2;
    keyLight.shadow.camera.right = 2.2;
    keyLight.shadow.camera.top = 2.2;
    keyLight.shadow.camera.bottom = -2.2;
    keyLight.shadow.bias = -0.0005;
    keyLight.shadow.normalBias = 0.02;
    scene.add(keyLight);

    const rimLight = new THREE.DirectionalLight(0xffdec8, 0.85);
    rimLight.position.set(-3.0, 2.5, -3.2);
    scene.add(rimLight);

    const maxAnisotropy = renderer.capabilities.getMaxAnisotropy();

    // Soft radial contact shadow disc grounded at y = 0.006
    const shadowDisc = buildContactShadowDisc(maxAnisotropy);
    scene.add(shadowDisc);

    // Subject group
    const modelGroup = buildAlbumObject3D(
      item,
      maxAnisotropy,
      resolveCoverUrl(item.coverUrl),
    );
    scene.add(modelGroup);

    const controls = new OrbitControls(camera, canvas);
    controls.target.set(0, targetY, 0);
    controls.enableDamping = !isSoftwareGl;
    controls.dampingFactor = 0.06;
    controls.enablePan = false;
    controls.minDistance = 1.8;
    controls.maxDistance = 10.5;
    controls.minPolarAngle = 0.15;
    controls.maxPolarAngle = Math.PI * 0.56;
    controls.touches = {
      ONE: THREE.TOUCH.ROTATE,
      TWO: THREE.TOUCH.DOLLY_PAN,
    };
    controls.update();

    if (!isSoftwareGl) {
      renderer.compile(scene, camera);
    }

    let disposed = false;
    let frameId = 0;
    let renderBusy = false;
    let renderDirty = false;
    let lastTime = performance.now();

    // Pre-allocated scratch helpers (zero GC in loop)
    const _spherical = new THREE.Spherical();
    const _offset = new THREE.Vector3();
    let currentAzimuthTilt = 0;
    let currentPolarTilt = 0;

    function afterDraw(cb: () => void) {
      const gl = renderer.getContext() as WebGL2RenderingContext;
      if (!gl || typeof gl.fenceSync !== 'function') {
        frameId = window.setTimeout(cb, 80);
        return;
      }
      const sync = gl.fenceSync(gl.SYNC_GPU_COMMANDS_COMPLETE, 0);
      gl.flush();
      const poll = () => {
        if (disposed) {
          if (sync) gl.deleteSync(sync);
          return;
        }
        const state = sync && gl.getSyncParameter(sync, gl.SYNC_STATUS);
        if (state === gl.UNSIGNALED) {
          frameId = window.setTimeout(poll, 5);
        } else {
          if (sync) gl.deleteSync(sync);
          frameId = window.setTimeout(cb, 80);
        }
      };
      frameId = window.setTimeout(poll, 5);
    }

    function drawFrame() {
      const w = container?.clientWidth || window.innerWidth;
      const h = container?.clientHeight || window.innerHeight;

      if (vrModeRef.current) {
        const vrFov = w < h ? 66 : 48;
        if (camera.fov !== vrFov) {
          camera.fov = vrFov;
        }
        camera.aspect = (w / 2) / h;
        camera.updateProjectionMatrix();
        stereoCamera.aspect = 0.5;
        stereoCamera.update(camera);

        renderer.setScissorTest(true);

        // Left eye
        renderer.setScissor(0, 0, Math.floor(w / 2), h);
        renderer.setViewport(0, 0, Math.floor(w / 2), h);
        renderer.render(scene, stereoCamera.cameraL);

        // Right eye
        renderer.setScissor(Math.floor(w / 2), 0, Math.ceil(w / 2), h);
        renderer.setViewport(Math.floor(w / 2), 0, Math.ceil(w / 2), h);
        renderer.render(scene, stereoCamera.cameraR);

        renderer.setScissorTest(false);
      } else {
        if (camera.fov !== 42) {
          camera.fov = 42;
          camera.updateProjectionMatrix();
        }
        const expectedAspect = w / Math.max(1, h);
        if (Math.abs(camera.aspect - expectedAspect) > 0.001) {
          camera.aspect = expectedAspect;
          camera.updateProjectionMatrix();
        }
        renderer.setViewport(0, 0, w, h);
        renderer.render(scene, camera);
      }
    }

    function requestRender() {
      if (disposed) return;
      if (renderBusy) {
        renderDirty = true;
        return;
      }
      renderBusy = true;
      frameId = requestAnimationFrame((now) => {
        if (disposed) return;
        const dt = Math.min(0.05, Math.max(0.001, (now - lastTime) / 1000));
        lastTime = now;
        renderDirty = false;

        controls.update();

        // Apply subtle gyroscope tilt when active
        if (gyroEnabledRef.current) {
          currentAzimuthTilt = THREE.MathUtils.damp(
            currentAzimuthTilt,
            gyroOffsetRef.current.azimuth,
            7,
            dt,
          );
          currentPolarTilt = THREE.MathUtils.damp(
            currentPolarTilt,
            gyroOffsetRef.current.polar,
            7,
            dt,
          );
          _offset.copy(camera.position).sub(controls.target);
          _spherical.setFromVector3(_offset);
          const baseRadius = _spherical.radius;
          // Gently nudge model rotation instead of fighting OrbitControls state
          modelGroup.rotation.y = THREE.MathUtils.damp(
            modelGroup.rotation.y,
            currentAzimuthTilt,
            6,
            dt,
          );
          modelGroup.rotation.x = THREE.MathUtils.damp(
            modelGroup.rotation.x,
            currentPolarTilt,
            6,
            dt,
          );
          _spherical.radius = baseRadius;
        } else if (
          Math.abs(modelGroup.rotation.y) > 0.001 ||
          Math.abs(modelGroup.rotation.x) > 0.001
        ) {
          modelGroup.rotation.y = THREE.MathUtils.damp(modelGroup.rotation.y, 0, 8, dt);
          modelGroup.rotation.x = THREE.MathUtils.damp(modelGroup.rotation.x, 0, 8, dt);
          renderDirty = true;
        }

        drawFrame();

        const done = () => {
          renderBusy = false;
          if (disposed) return;
          if (renderDirty || gyroEnabledRef.current) {
            requestRender();
          }
        };

        if (isSoftwareGl) {
          afterDraw(done);
        } else {
          done();
        }
      });
    }

    requestRenderFnRef.current = requestRender;

    // On GPU with damping, keep animation loop smooth during damping settling
    let gpuIdleTimer = 0;
    const onControlsChange = () => {
      requestRender();
      if (!isSoftwareGl) {
        window.clearTimeout(gpuIdleTimer);
        // Trigger a brief damping settle window
        const settleEnd = performance.now() + 500;
        const pump = () => {
          if (disposed) return;
          if (performance.now() < settleEnd) {
            requestRender();
            gpuIdleTimer = window.setTimeout(pump, 16);
          }
        };
        gpuIdleTimer = window.setTimeout(pump, 16);
      }
    };
    controls.addEventListener('change', onControlsChange);

    const onResize = () => {
      if (disposed || !container) return;
      const w = container.clientWidth || window.innerWidth;
      const h = container.clientHeight || window.innerHeight;
      camera.aspect = w / Math.max(1, h);
      camera.updateProjectionMatrix();
      renderer.setPixelRatio(
        isSoftwareGl ? 1 : Math.min(window.devicePixelRatio || 1, 2),
      );
      renderer.setSize(w, h);
      requestRender();
    };
    window.addEventListener('resize', onResize);

    const onDeviceOrientation = (e: DeviceOrientationEvent) => {
      if (!gyroEnabledRef.current) return;
      if (e.beta == null || e.gamma == null) return;
      if (!gyroBaselineRef.current) {
        gyroBaselineRef.current = { beta: e.beta, gamma: e.gamma };
      }
      const dGamma = THREE.MathUtils.clamp(
        (e.gamma - gyroBaselineRef.current.gamma) * (Math.PI / 180),
        -0.9,
        0.9,
      );
      const dBeta = THREE.MathUtils.clamp(
        (e.beta - gyroBaselineRef.current.beta) * (Math.PI / 180),
        -0.55,
        0.55,
      );
      gyroOffsetRef.current.azimuth = dGamma * 1.4;
      gyroOffsetRef.current.polar = dBeta * 0.6;
      requestRender();
    };
    window.addEventListener('deviceorientation', onDeviceOrientation);

    // Initial render
    requestRender();

    // Ensure custom photo texture triggers a re-render once loaded
    const textureRefreshTimer = window.setTimeout(() => {
      if (!disposed) requestRender();
    }, 250);

    return () => {
      disposed = true;
      requestRenderFnRef.current = null;
      cancelAnimationFrame(frameId);
      window.clearTimeout(frameId);
      window.clearTimeout(gpuIdleTimer);
      window.clearTimeout(textureRefreshTimer);

      controls.removeEventListener('change', onControlsChange);
      window.removeEventListener('resize', onResize);
      window.removeEventListener('deviceorientation', onDeviceOrientation);
      canvas.removeEventListener('webglcontextlost', onContextLost);
      canvas.removeEventListener('webglcontextrestored', onContextRestored);

      controls.dispose();
      disposeObject3D(scene);
      envTarget.dispose();
      renderer.dispose();
      if (canvas.parentNode === container) {
        container.removeChild(canvas);
      }
    };
  }, [item]);

  return (
    <div className="relative h-full w-full bg-[#F3EDE4]" data-testid="three-viewer-root">
      <div ref={mountRef} className="h-full w-full" />
      {contextLost && (
        <div className="absolute inset-0 flex items-center justify-center bg-[#FAF8F5] p-6 text-center">
          <div className="max-w-xs space-y-2">
            <p className="text-base font-semibold text-[#231E1A]">
              Графический контекст приостановлен
            </p>
            <p className="text-sm text-[#6E645B]">
              Браузер освободил ресурсы 3D-сцены. Вернитесь назад и откройте вещь снова.
            </p>
          </div>
        </div>
      )}
    </div>
  );
};
