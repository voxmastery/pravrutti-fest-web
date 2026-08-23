"use client";

/**
 * Depth-displaced 3D gate.
 *
 * `public/gate-temple.png` is a flat 2D painting. `public/gate-temple-depth.png`
 * is its monocular depth map, generated offline by Depth Anything V2 via
 * huggingface.js (see `scripts/generate-depth-map.mjs`).
 *
 * Here the colour image is mapped onto a densely subdivided plane whose vertices
 * are pushed toward the camera by the depth texture, so the temple, the skyline
 * towers and the three moons all separate in Z. The plane is split down the
 * middle into two hinged panels that swing open like doors while the camera
 * dollies through the doorway.
 */

import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { Suspense, useEffect, useMemo, useRef, type RefObject } from "react";
import * as THREE from "three";

export type GatePhase = "hold" | "beam" | "open" | "reveal" | "done";

const COLOR_MAP_URL = "/gate-temple.png";
const DEPTH_MAP_URL = "/gate-temple-depth.png";

/** Native pixel dimensions of the source art, used for the cover-fit maths. */
const IMAGE_ASPECT = 1838 / 1101;

const FOV = 42;
const CAMERA_START_Z = 3.4;
/** Where the camera has pushed to by the time the gate is fully open. */
const CAMERA_END_Z = 2.15;
/**
 * Plane is built slightly larger than the viewport so neither pointer sway nor
 * the magnification of near-camera displacement can reveal its edge.
 */
const OVERSCAN = 1.08;

/** Vertex grid per panel. ~29k verts each — cheap, and fine on mobile. */
const SEGMENTS_X = 160;
const SEGMENTS_Y = 180;

/**
 * Total Z spread between the nearest and furthest pixel, in world units.
 * Displacement is centred on the mid-depth plane so near geometry moves toward
 * the camera and far geometry away, keeping the framing close to the original.
 */
const DEPTH_SCALE = 0.62;
/**
 * Depth delta across a single quad above which the quad is discarded, killing
 * the worst "rubber sheet" triangles at depth cliffs.
 *
 * Deliberately permissive. There is only one layer here, so a discarded quad
 * leaves a hole with nothing behind it — a hard black notch. Letting moderate
 * cliffs stretch instead smears a few pixels of edge colour, which is far less
 * noticeable on artwork this dark than a hole would be.
 */
const EDGE_THRESHOLD = 0.3;

/** Matches the `filter: brightness(0.85) saturate(1.1)` the flat version used. */
const BRIGHTNESS = 0.85;
const SATURATION = 1.1;

/** Must match the 1.4s cubic-bezier(0.77, 0, 0.175, 1) of the DOM overlay panels. */
const OPEN_DURATION_MS = 1400;
const MAX_SWING_RAD = THREE.MathUtils.degToRad(46);
const POINTER_SWAY = 0.06;

const vertexShader = /* glsl */ `
  uniform sampler2D uDepth;
  uniform float uDepthScale;
  uniform float uUvOffset;
  uniform float uPlaneAspect;
  uniform float uImageAspect;
  uniform vec2  uSegments;

  varying vec2  vUv;
  varying float vStretch;

  // CSS "background-size: cover" expressed as a UV scale about the centre.
  vec2 coverScale(float planeAspect, float imageAspect) {
    return planeAspect > imageAspect
      ? vec2(1.0, imageAspect / planeAspect)
      : vec2(planeAspect / imageAspect, 1.0);
  }

  void main() {
    // This panel covers half the image horizontally; lift its local UV into
    // full-image space before cover-fitting.
    vec2 globalUv = vec2(uUvOffset + uv.x * 0.5, uv.y);
    vec2 s = coverScale(uPlaneAspect, uImageAspect);
    vec2 cUv = (globalUv - 0.5) * s + 0.5;

    float d = texture2D(uDepth, cUv).r;

    // Sample one geometry-quad away in each direction so the fragment stage can
    // reject quads that straddle a depth cliff.
    // Named quadStep because step() is a GLSL built-in, and shadowing it is
    // rejected by some stricter mobile drivers.
    vec2 quadStep = vec2(0.5 / uSegments.x, 1.0 / uSegments.y) * s;
    float dxp = texture2D(uDepth, cUv + vec2(quadStep.x, 0.0)).r;
    float dxn = texture2D(uDepth, cUv - vec2(quadStep.x, 0.0)).r;
    float dyp = texture2D(uDepth, cUv + vec2(0.0, quadStep.y)).r;
    float dyn = texture2D(uDepth, cUv - vec2(0.0, quadStep.y)).r;

    vStretch = max(max(abs(d - dxp), abs(d - dxn)), max(abs(d - dyp), abs(d - dyn)));
    vUv = cUv;

    vec3 displaced = position;
    displaced.z += (d - 0.5) * uDepthScale;

    gl_Position = projectionMatrix * modelViewMatrix * vec4(displaced, 1.0);
  }
`;

const fragmentShader = /* glsl */ `
  uniform sampler2D uMap;
  uniform float uEdgeThreshold;
  uniform float uBrightness;
  uniform float uSaturation;

  varying vec2  vUv;
  varying float vStretch;

  void main() {
    if (vStretch > uEdgeThreshold) discard;

    vec3 c = texture2D(uMap, vUv).rgb;
    c *= uBrightness;
    float luma = dot(c, vec3(0.2126, 0.7152, 0.0722));
    c = mix(vec3(luma), c, uSaturation);

    gl_FragColor = vec4(c, 1.0);
  }
`;

/** cubic-bezier(0.77, 0, 0.175, 1), close enough for a visual match. */
function easeInOutQuart(t: number): number {
  return t < 0.5 ? 8 * t * t * t * t : 1 - Math.pow(-2 * t + 2, 4) / 2;
}

interface GatePanelProps {
  side: "left" | "right";
  width: number;
  height: number;
  planeAspect: number;
  colorMap: THREE.Texture;
  depthMap: THREE.Texture;
  openRef: RefObject<number>;
}

function GatePanel({
  side,
  width,
  height,
  planeAspect,
  colorMap,
  depthMap,
  openRef,
}: GatePanelProps) {
  const hingeRef = useRef<THREE.Group>(null);
  const isLeft = side === "left";

  // Hinge sits on the panel's outer edge so it swings like a real door leaf.
  const hingeX = isLeft ? -width : width;
  const meshX = isLeft ? width / 2 : -width / 2;
  const swingSign = isLeft ? -1 : 1;

  const uniforms = useMemo(
    () => ({
      uMap: { value: colorMap },
      uDepth: { value: depthMap },
      uDepthScale: { value: DEPTH_SCALE },
      uUvOffset: { value: isLeft ? 0 : 0.5 },
      uPlaneAspect: { value: planeAspect },
      uImageAspect: { value: IMAGE_ASPECT },
      uSegments: { value: new THREE.Vector2(SEGMENTS_X, SEGMENTS_Y) },
      uEdgeThreshold: { value: EDGE_THRESHOLD },
      uBrightness: { value: BRIGHTNESS },
      uSaturation: { value: SATURATION },
    }),
    [colorMap, depthMap, isLeft, planeAspect],
  );

  // Plane aspect changes on resize; keep the cover-fit uniform in step.
  uniforms.uPlaneAspect.value = planeAspect;

  useFrame(() => {
    const hinge = hingeRef.current;
    if (!hinge) return;

    const open = openRef.current ?? 0;
    hinge.rotation.y = swingSign * MAX_SWING_RAD * open;
    // Ease the leaf outward as it swings so it clears the frame by the end of
    // the 1.4s window — in step with the DOM chrome, not ahead of it.
    hinge.position.x = hingeX + swingSign * width * 0.18 * open;
  });

  return (
    <group ref={hingeRef} position={[hingeX, 0, 0]}>
      <mesh position={[meshX, 0, 0]}>
        <planeGeometry args={[width, height, SEGMENTS_X, SEGMENTS_Y]} />
        <shaderMaterial
          vertexShader={vertexShader}
          fragmentShader={fragmentShader}
          uniforms={uniforms}
          side={THREE.DoubleSide}
        />
      </mesh>
    </group>
  );
}

interface GateSceneProps {
  phase: GatePhase;
  openStartedAt: number | null;
  /** Fired once the textures are decoded *and* the first frame has been drawn. */
  onReady?: () => void;
}

/**
 * The intro overlay is `pointer-events-none`, so R3F's canvas-bound pointer
 * never fires. Track it on `window` instead.
 */
function useWindowPointer() {
  const pointer = useRef({ x: 0, y: 0 });

  useEffect(() => {
    const onMove = (event: PointerEvent) => {
      pointer.current.x = (event.clientX / window.innerWidth) * 2 - 1;
      pointer.current.y = -((event.clientY / window.innerHeight) * 2 - 1);
    };
    window.addEventListener("pointermove", onMove, { passive: true });
    return () => window.removeEventListener("pointermove", onMove);
  }, []);

  return pointer;
}

function GateScene({ phase, openStartedAt, onReady }: GateSceneProps) {
  const size = useThree((state) => state.size);
  const camera = useThree((state) => state.camera);
  const openRef = useRef(0);
  const hasSignalledReady = useRef(false);
  const pointer = useWindowPointer();

  const [colorMap, depthMap] = useTextures();

  const { panelWidth, planeHeight, planeAspect } = useMemo(() => {
    const aspect = size.width / Math.max(size.height, 1);
    const height =
      2 * Math.tan(THREE.MathUtils.degToRad(FOV) / 2) * CAMERA_START_Z * OVERSCAN;
    const width = height * aspect;
    return { panelWidth: width / 2, planeHeight: height, planeAspect: width / height };
  }, [size.width, size.height]);

  useFrame((_state, delta) => {
    // Reaching a frame at all means both textures decoded and the gate is painted.
    if (!hasSignalledReady.current) {
      hasSignalledReady.current = true;
      onReady?.();
    }

    const open =
      openStartedAt === null
        ? 0
        : easeInOutQuart(
            THREE.MathUtils.clamp((performance.now() - openStartedAt) / OPEN_DURATION_MS, 0, 1),
          );
    openRef.current = open;

    // Camera creeps in during the hold, then pushes through as the gate parts.
    const dollyTarget = THREE.MathUtils.lerp(
      CAMERA_START_Z,
      CAMERA_END_Z,
      phase === "hold" ? 0.06 : Math.max(open, phase === "beam" ? 0.14 : 0),
    );
    camera.position.z = THREE.MathUtils.damp(camera.position.z, dollyTarget, 3.2, delta);

    // Subtle pointer parallax — the cheapest possible proof that this is real depth.
    const sway = 1 - open;
    camera.position.x = THREE.MathUtils.damp(
      camera.position.x,
      pointer.current.x * POINTER_SWAY * sway,
      3,
      delta,
    );
    camera.position.y = THREE.MathUtils.damp(
      camera.position.y,
      pointer.current.y * POINTER_SWAY * 0.6 * sway,
      3,
      delta,
    );
    camera.lookAt(0, 0, 0);
  });

  return (
    <>
      <GatePanel
        side="left"
        width={panelWidth}
        height={planeHeight}
        planeAspect={planeAspect}
        colorMap={colorMap}
        depthMap={depthMap}
        openRef={openRef}
      />
      <GatePanel
        side="right"
        width={panelWidth}
        height={planeHeight}
        planeAspect={planeAspect}
        colorMap={colorMap}
        depthMap={depthMap}
        openRef={openRef}
      />
    </>
  );
}

/**
 * Loads both textures via Suspense. The depth map must stay in linear space with
 * mipmaps off — it is read in the vertex shader, where mip selection is undefined.
 */
function useTextures(): [THREE.Texture, THREE.Texture] {
  const loader = useMemo(() => new THREE.TextureLoader(), []);
  // Both are tagged NoColorSpace on purpose. This material is an unlit blit of a
  // pre-lit painting, and it writes gl_FragColor directly — a raw ShaderMaterial
  // gets no linear->sRGB output encoding. Decoding to linear here would land
  // linear values in an sRGB framebuffer and crush the image dark. Passing the
  // sRGB texels through untouched reproduces the original CSS rendering exactly.
  const colorMap = useSuspenseTexture(loader, COLOR_MAP_URL, THREE.NoColorSpace, true);
  const depthMap = useSuspenseTexture(loader, DEPTH_MAP_URL, THREE.NoColorSpace, false);
  return [colorMap, depthMap];
}

const textureCache = new Map<string, THREE.Texture | Promise<THREE.Texture> | Error>();

function useSuspenseTexture(
  loader: THREE.TextureLoader,
  url: string,
  colorSpace: THREE.ColorSpace,
  mipmaps: boolean,
): THREE.Texture {
  const cached = textureCache.get(url);

  if (cached instanceof Error) throw cached;
  if (cached instanceof THREE.Texture) return cached;
  if (cached) throw cached;

  const promise = loader
    .loadAsync(url)
    .then((texture) => {
      texture.colorSpace = colorSpace;
      texture.generateMipmaps = mipmaps;
      texture.minFilter = mipmaps ? THREE.LinearMipmapLinearFilter : THREE.LinearFilter;
      texture.magFilter = THREE.LinearFilter;
      texture.wrapS = THREE.ClampToEdgeWrapping;
      texture.wrapT = THREE.ClampToEdgeWrapping;
      texture.needsUpdate = true;
      textureCache.set(url, texture);
      return texture;
    })
    .catch((error: unknown) => {
      const wrapped =
        error instanceof Error ? error : new Error(`Failed to load texture: ${url}`);
      textureCache.set(url, wrapped);
      throw wrapped;
    });

  textureCache.set(url, promise);
  throw promise;
}

export function Gate3DScene({ phase, openStartedAt, onReady }: GateSceneProps) {
  return (
    <Canvas
      className="absolute inset-0"
      dpr={[1, 2]}
      gl={{ antialias: true, alpha: true }}
      camera={{ fov: FOV, position: [0, 0, CAMERA_START_Z], near: 0.1, far: 100 }}
    >
      <Suspense fallback={null}>
        <GateScene phase={phase} openStartedAt={openStartedAt} onReady={onReady} />
      </Suspense>
    </Canvas>
  );
}
