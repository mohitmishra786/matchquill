'use client';

/**
 * ThreeCanvas — homepage-only decorative layer.
 *
 * Renders the glossy ceramic ribbon (Sculpture) behind the hero copy.
 * Always mounted via next/dynamic with ssr:false so it never blocks
 * first paint or hydration; capped DPR keeps it cheap on high-DPI
 * mobile screens.
 */

import { Suspense, useEffect, useRef, useState } from 'react';
import { Canvas, useThree } from '@react-three/fiber';
import { SoftShadows } from '@react-three/drei';
import Sculpture from './Sculpture';

interface ThreeCanvasProps {
  isDark: boolean;
  /** When true (prefers-reduced-motion), the ribbon renders a single static frame. */
  reduceMotion?: boolean;
}

/** Points the default camera at the helix's visual center once on mount. */
function CameraRig() {
  const { camera } = useThree();
  const done = useRef(false);
  useEffect(() => {
    if (done.current) return;
    camera.lookAt(4, -1.5, 0);
    done.current = true;
  }, [camera]);
  return null;
}

export default function ThreeCanvas({ isDark, reduceMotion = false }: ThreeCanvasProps) {
  // Pause the render loop once the hero scrolls out of view — the fixed canvas
  // is then fully covered by page content, so animating it just wastes GPU.
  const [heroVisible, setHeroVisible] = useState(true);
  useEffect(() => {
    let raf = 0;
    const check = () => {
      const next = window.scrollY < window.innerHeight * 1.2;
      setHeroVisible((prev) => (prev !== next ? next : prev));
    };
    const onScroll = () => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(check);
    };
    check();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => {
      window.removeEventListener('scroll', onScroll);
      cancelAnimationFrame(raf);
    };
  }, []);

  // 'always' animates; 'never' still renders one frame on mount / prop change
  // (so a static ribbon is shown), then stops — used when offscreen or when the
  // visitor prefers reduced motion.
  const animate = heroVisible && !reduceMotion;

  return (
    <div className="fixed inset-0 -z-0 pointer-events-none" aria-hidden="true">
      <Canvas
        shadows
        dpr={[1, 2]}
        frameloop={animate ? 'always' : 'never'}
        gl={{ antialias: true, alpha: true }}
        camera={{ position: [11, 3.5, 13], fov: 42, near: 0.1, far: 60 }}
      >
        <CameraRig />
        <SoftShadows size={20} samples={10} focus={0.4} />

        <ambientLight intensity={isDark ? 0.35 : 0.55} />

        {/* Key light */}
        <directionalLight
          castShadow
          position={[8, 16, 6]}
          intensity={isDark ? 1.4 : 1.8}
          shadow-mapSize={[2048, 2048]}
          shadow-camera-near={1}
          shadow-camera-far={40}
          shadow-camera-left={-15}
          shadow-camera-right={15}
          shadow-camera-top={15}
          shadow-camera-bottom={-15}
        />

        {/* Fill lights */}
        <directionalLight position={[-9, 2, -4]} intensity={isDark ? 0.5 : 0.35} color={isDark ? '#5b8dff' : '#ffffff'} />
        <directionalLight position={[2, -8, 6]} intensity={0.25} color={isDark ? '#8fb4ff' : '#ffffff'} />

        <Suspense fallback={null}>
          <Sculpture isDark={isDark} />
        </Suspense>
      </Canvas>
    </div>
  );
}
