'use client';

import { percorso } from '@/lib/percorso';
import { useEffect, useRef } from 'react';
import type { FalcoStato } from './FalcoMascot';

/**
 * Scena three.js del falco 3D (public/brand/falco.glb, generato da
 * design/falco/build_falco.py). Caricata solo lato client e solo dove serve.
 *
 * Il falco si muove soltanto quando cambia stato: in riposo la scena si ferma
 * (nessun ciclo di rendering continuo, niente consumo di batteria).
 */
interface Posa {
  testa: [number, number, number];
  ali: number;
  coda: number;
  corpo: number;
  /** ampiezza del movimento di vita negli stati attivi */
  vita: number;
}

const POSE: Record<FalcoStato, Posa> = {
  riposo: { testa: [0, 0, 0], ali: 0, coda: 0, corpo: 0, vita: 0 },
  ascolta: { testa: [-0.12, 0.18, 0.1], ali: 0.12, coda: 0.05, corpo: 0.04, vita: 0.4 },
  pensa: { testa: [0.1, -0.22, -0.16], ali: -0.04, coda: 0, corpo: -0.03, vita: 0.6 },
  parla: { testa: [-0.05, 0.05, 0], ali: 0.06, coda: 0.03, corpo: 0.02, vita: 1 },
  attenzione: { testa: [-0.15, 0, 0], ali: 0.1, coda: 0.08, corpo: 0.05, vita: 0.3 },
  fatto: { testa: [0.12, 0, 0], ali: 0, coda: 0, corpo: 0, vita: 0.2 },
};

export interface FalcoSceneProps {
  stato: FalcoStato;
  size: number;
  ridotto: boolean;
  onReady?: () => void;
  onFail?: () => void;
}

export default function FalcoScene({ stato, size, ridotto, onReady, onFail }: FalcoSceneProps) {
  const host = useRef<HTMLDivElement>(null);
  const statoRef = useRef<FalcoStato>(stato);
  const sveglia = useRef<() => void>(() => {});

  useEffect(() => {
    statoRef.current = stato;
    sveglia.current();
  }, [stato]);

  useEffect(() => {
    let annullato = false;
    let dispose = () => {};

    (async () => {
      try {
        const THREE = await import('three');
        const { GLTFLoader } = await import('three/examples/jsm/loaders/GLTFLoader.js');
        if (annullato || !host.current) return;

        const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: 'low-power' });
        renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
        renderer.setSize(size, size);
        renderer.outputColorSpace = THREE.SRGBColorSpace;
        renderer.toneMapping = THREE.ACESFilmicToneMapping;
        renderer.toneMappingExposure = 1.3;
        host.current.appendChild(renderer.domElement);
        renderer.domElement.style.width = '100%';
        renderer.domElement.style.height = '100%';

        const scene = new THREE.Scene();
        const camera = new THREE.PerspectiveCamera(28, 1, 0.1, 50);
        camera.position.set(0.5, 1.3, 4.9);
        camera.lookAt(0, 1.0, 0);

        scene.add(new THREE.HemisphereLight(0xffffff, 0x3a4766, 2.2));
        const key = new THREE.DirectionalLight(0xffffff, 2.8);
        key.position.set(2, 3.5, 4.5);
        scene.add(key);
        const rim = new THREE.DirectionalLight(0x9db4ff, 1.4);
        rim.position.set(-3, 2.5, -2.5);
        scene.add(rim);

        const gltf = await new GLTFLoader().loadAsync(percorso('/brand/falco.glb'));
        if (annullato) {
          renderer.dispose();
          return;
        }
        const falco = gltf.scene;
        falco.rotation.y = -0.18;
        scene.add(falco);
        const nodo = (n: string) => falco.getObjectByName(n);
        const testa = nodo('Testa');
        const alaS = nodo('Ala_S');
        const alaD = nodo('Ala_D');
        const coda = nodo('Coda');
        const base = {
          testa: testa?.rotation.clone(),
          alaS: alaS?.rotation.clone(),
          alaD: alaD?.rotation.clone(),
          coda: coda?.rotation.clone(),
        };

        const cur = { tx: 0, ty: 0, tz: 0, ali: 0, coda: 0, corpo: 0, vita: 0 };
        let frame = 0;
        let t0 = performance.now();

        const applica = (t: number) => {
          const v = cur.vita * (ridotto ? 0 : 1);
          const respiro = Math.sin(t * 1.6) * 0.015 * v;
          const annuisci = statoRef.current === 'parla' ? Math.sin(t * 7) * 0.05 * v : 0;
          if (testa && base.testa) {
            testa.rotation.set(base.testa.x + cur.tx + annuisci, base.testa.y + cur.ty + Math.sin(t * 0.9) * 0.04 * v, base.testa.z + cur.tz);
          }
          if (alaS && alaD && base.alaS && base.alaD) {
            const a = cur.ali + Math.sin(t * 1.6) * 0.03 * v;
            alaS.rotation.set(base.alaS.x, base.alaS.y - a, base.alaS.z);
            alaD.rotation.set(base.alaD.x, base.alaD.y + a, base.alaD.z);
          }
          if (coda && base.coda) coda.rotation.x = base.coda.x + cur.coda;
          falco.position.y = respiro;
          falco.rotation.x = cur.corpo;
          renderer.render(scene, camera);
        };

        const passo = () => {
          frame = 0;
          const p = POSE[statoRef.current];
          const k = ridotto ? 1 : 0.08;
          const lerp = (a: number, b: number) => a + (b - a) * k;
          cur.tx = lerp(cur.tx, p.testa[0]);
          cur.ty = lerp(cur.ty, p.testa[1]);
          cur.tz = lerp(cur.tz, p.testa[2]);
          cur.ali = lerp(cur.ali, p.ali);
          cur.coda = lerp(cur.coda, p.coda);
          cur.corpo = lerp(cur.corpo, p.corpo);
          cur.vita = lerp(cur.vita, p.vita);
          const t = (performance.now() - t0) / 1000;
          applica(t);
          const fermo =
            statoRef.current === 'riposo' &&
            Math.abs(cur.tx) + Math.abs(cur.ty) + Math.abs(cur.tz) + Math.abs(cur.ali) + Math.abs(cur.vita) < 0.002;
          if (!fermo && !ridotto) frame = requestAnimationFrame(passo);
        };

        sveglia.current = () => {
          if (!frame) {
            t0 = performance.now();
            frame = requestAnimationFrame(passo);
          }
        };
        applica(0);
        sveglia.current();
        onReady?.();

        dispose = () => {
          cancelAnimationFrame(frame);
          sveglia.current = () => {};
          falco.traverse((o) => {
            const m = o as unknown as { geometry?: { dispose(): void }; material?: { dispose(): void } };
            m.geometry?.dispose();
            m.material?.dispose();
          });
          renderer.dispose();
          renderer.domElement.remove();
        };
      } catch {
        if (!annullato) onFail?.();
      }
    })();

    return () => {
      annullato = true;
      dispose();
    };
    // La scena si crea una volta per dimensione; lo stato passa da statoRef.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [size, ridotto]);

  return <div ref={host} aria-hidden className="absolute inset-0" />;
}
