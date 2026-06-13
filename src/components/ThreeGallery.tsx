import React, { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { Memory } from '../db';

interface ThreeGalleryProps {
  memories: Memory[];
  onSelectMemory: (memory: Memory) => void;
  selectedMemoryId: string | null;
  layoutMode: 'spiral' | 'globe' | 'grid';
}

const disposeGroup = (group: THREE.Group) => {
  group.traverse((object) => {
    if (object instanceof THREE.Mesh || object instanceof THREE.Line) {
      if (object.geometry) {
        object.geometry.dispose();
      }
      if (object.material) {
        if (Array.isArray(object.material)) {
          object.material.forEach((mat) => {
            if (mat.map) mat.map.dispose();
            mat.dispose();
          });
        } else {
          if (object.material.map) object.material.map.dispose();
          object.material.dispose();
        }
      }
    }
  });
  if (group.userData && group.userData.textures) {
    group.userData.textures.forEach((tex: THREE.Texture) => {
      tex.dispose();
    });
  }
};

export const ThreeGallery: React.FC<ThreeGalleryProps> = ({
  memories,
  onSelectMemory,
  selectedMemoryId,
  layoutMode
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const sceneRef = useRef<THREE.Scene | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const framesGroupRef = useRef<THREE.Group | null>(null);
  const starFieldRef = useRef<THREE.Points | null>(null);

  // Keep track of created meshes to animate and clean up
  const meshesMapRef = useRef<Map<string, {
    group: THREE.Group;
    targetY: number;
    floatOffset: number;
    videoElement?: HTMLVideoElement;
  }>>(new Map());

  // Raycasting / Hover states
  const mouseRef = useRef<THREE.Vector2>(new THREE.Vector2(-9999, -9999));
  const raycasterRef = useRef<THREE.Raycaster>(new THREE.Raycaster());
  const hoveredIdRef = useRef<string | null>(null);

  // Camera Target States (for zoom animations)
  const targetCamPos = useRef<THREE.Vector3>(new THREE.Vector3(0, 0, 8));
  const targetLookAt = useRef<THREE.Vector3>(new THREE.Vector3(0, 0.5, 0));
  const currentLookAt = useRef<THREE.Vector3>(new THREE.Vector3(0, 0.5, 0));

  // Drag controls
  const isDragging = useRef<boolean>(false);
  const dragStart = useRef<{ x: number, y: number }>({ x: 0, y: 0 });
  const rotationTarget = useRef<{ x: number, y: number }>({ x: 0, y: 0 });
  const rotationCurrent = useRef<{ x: number, y: number }>({ x: 0, y: 0 });
  const autoRotateTimer = useRef<number>(0);
  const clickStartPos = useRef<{ x: number, y: number }>({ x: 0, y: 0 });
  const hasDragged = useRef<boolean>(false);
  const gridScrollY = useRef<number>(0);
  const targetGridScrollY = useRef<number>(0);

  // Loading state for assets
  const [loadingText, setLoadingText] = useState<string>('Creating 3D Universe...');

  const layoutModeRef = useRef(layoutMode);
  useEffect(() => {
    layoutModeRef.current = layoutMode;
  }, [layoutMode]);

  useEffect(() => {
    if (!containerRef.current) return;

    // --- 1. SETUP THREE.JS SCENE ---
    const width = containerRef.current.clientWidth;
    const height = containerRef.current.clientHeight;

    const scene = new THREE.Scene();
    sceneRef.current = scene;
    scene.fog = new THREE.FogExp2(0x07090e, 0.04);

    const camera = new THREE.PerspectiveCamera(60, width / height, 0.1, 100);
    camera.position.set(0, 0, 8);
    cameraRef.current = camera;

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setClearColor(scene.fog.color);
    containerRef.current.appendChild(renderer.domElement);
    rendererRef.current = renderer;

    // --- 2. LIGHTING ---
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.6);
    scene.add(ambientLight);

    const dirLight1 = new THREE.DirectionalLight(0xffffff, 0.8);
    dirLight1.position.set(5, 10, 7);
    scene.add(dirLight1);

    const dirLight2 = new THREE.DirectionalLight(0x8b5cf6, 0.4); // soft purple fill
    dirLight2.position.set(-5, -5, -5);
    scene.add(dirLight2);

    // --- 3. STARRY FIELD ---
    const starCount = 2000;
    const starGeometry = new THREE.BufferGeometry();
    const starPositions = new Float32Array(starCount * 3);
    const starSizes = new Float32Array(starCount);

    for (let i = 0; i < starCount; i++) {
      const radius = 25 + Math.random() * 25;
      const u = Math.random();
      const v = Math.random();
      const theta = u * 2.0 * Math.PI;
      const phi = Math.acos(2.0 * v - 1.0);
      
      starPositions[i * 3] = radius * Math.sin(phi) * Math.cos(theta);
      starPositions[i * 3 + 1] = radius * Math.sin(phi) * Math.sin(theta);
      starPositions[i * 3 + 2] = radius * Math.cos(phi);

      starSizes[i] = 0.5 + Math.random() * 2.0;
    }

    starGeometry.setAttribute('position', new THREE.BufferAttribute(starPositions, 3));

    const starMaterial = new THREE.PointsMaterial({
      color: 0xffffff,
      size: 0.18,
      transparent: true,
      opacity: 0.8,
      blending: THREE.AdditiveBlending
    });

    const starField = new THREE.Points(starGeometry, starMaterial);
    scene.add(starField);
    starFieldRef.current = starField;

    // --- 4. FLOATING DUST PARTICLES (Glow effect) ---
    const dustCount = 150;
    const dustGeometry = new THREE.BufferGeometry();
    const dustPositions = new Float32Array(dustCount * 3);

    for (let i = 0; i < dustCount; i++) {
      dustPositions[i * 3] = (Math.random() - 0.5) * 20;
      dustPositions[i * 3 + 1] = (Math.random() - 0.5) * 15;
      dustPositions[i * 3 + 2] = (Math.random() - 0.5) * 20;
    }
    dustGeometry.setAttribute('position', new THREE.BufferAttribute(dustPositions, 3));
    const dustMaterial = new THREE.PointsMaterial({
      color: 0xd4af37, // Gold glow
      size: 0.12,
      transparent: true,
      opacity: 0.4,
      blending: THREE.AdditiveBlending
    });
    const dustField = new THREE.Points(dustGeometry, dustMaterial);
    scene.add(dustField);

    // --- 5. FLOATING WHITE/GOLD FLOWER PETALS (Funeral Flowers / Blossoms) ---
    const petalsGroup = new THREE.Group();
    scene.add(petalsGroup);

    const petalCount = 80;
    const petals: {
      mesh: THREE.Mesh;
      speedY: number;
      speedX: number;
      speedZ: number;
      rotSpeedX: number;
      rotSpeedY: number;
      rotSpeedZ: number;
      wobbleSpeed: number;
      wobbleOffset: number;
    }[] = [];

    // Create a curved flower petal shape
    const petalShape = new THREE.Shape();
    petalShape.moveTo(0, 0);
    petalShape.quadraticCurveTo(0.06, 0.12, 0.04, 0.22);
    petalShape.quadraticCurveTo(0, 0.32, -0.04, 0.22);
    petalShape.quadraticCurveTo(-0.06, 0.12, 0, 0);

    const petalGeo = new THREE.ShapeGeometry(petalShape);
    petalGeo.center();

    const petalMat = new THREE.MeshPhysicalMaterial({
      color: 0xffffff,
      emissive: 0xd4af37,
      emissiveIntensity: 0.15,
      roughness: 0.6,
      metalness: 0.1,
      clearcoat: 0.5,
      side: THREE.DoubleSide,
      transparent: true,
      opacity: 0.75
    });

    for (let i = 0; i < petalCount; i++) {
      const mesh = new THREE.Mesh(petalGeo, petalMat);
      const scale = 0.35 + Math.random() * 0.5;
      mesh.scale.set(scale, scale, scale);

      // Distribute in a large volume around the camera view
      mesh.position.set(
        (Math.random() - 0.5) * 20,
        Math.random() * 15 - 5,
        (Math.random() - 0.5) * 16 - 2
      );

      mesh.rotation.set(
        Math.random() * Math.PI,
        Math.random() * Math.PI,
        Math.random() * Math.PI
      );

      petalsGroup.add(mesh);

      petals.push({
        mesh,
        speedY: 0.012 + Math.random() * 0.02,
        speedX: (Math.random() - 0.5) * 0.008,
        speedZ: (Math.random() - 0.5) * 0.008,
        rotSpeedX: (Math.random() - 0.5) * 0.015,
        rotSpeedY: (Math.random() - 0.5) * 0.015,
        rotSpeedZ: (Math.random() - 0.5) * 0.015,
        wobbleSpeed: 0.8 + Math.random() * 1.5,
        wobbleOffset: Math.random() * Math.PI * 2
      });
    }

    // --- 6. SHOOTING STARS ---
    const shootingStarCount = 2;
    const shootingStars: {
      line: THREE.Line;
      active: boolean;
      startX: number;
      startY: number;
      startZ: number;
      progress: number;
      speed: number;
      dx: number;
      dy: number;
      length: number;
    }[] = [];

    const shootingStarMat = new THREE.LineBasicMaterial({
      color: 0xffffff,
      transparent: true,
      opacity: 0,
      blending: THREE.AdditiveBlending
    });

    for (let i = 0; i < shootingStarCount; i++) {
      const geom = new THREE.BufferGeometry();
      const pts = new Float32Array([0, 0, 0, 0, 0, 0]);
      geom.setAttribute('position', new THREE.BufferAttribute(pts, 3));
      
      const line = new THREE.Line(geom, shootingStarMat);
      scene.add(line);

      shootingStars.push({
        line,
        active: false,
        startX: 0,
        startY: 0,
        startZ: 0,
        progress: 0,
        speed: 0.08 + Math.random() * 0.08,
        dx: -1.5 - Math.random() * 1.5,
        dy: -0.8 - Math.random() * 0.8,
        length: 2 + Math.random() * 2
      });
    }

    const spawnShootingStar = (star: typeof shootingStars[0]) => {
      star.startX = 5 + Math.random() * 15;
      star.startY = 5 + Math.random() * 5;
      star.startZ = -15 - Math.random() * 10;
      star.progress = 0;
      star.active = true;
      star.speed = 0.03 + Math.random() * 0.05;
      star.dx = -2.5 - Math.random() * 2.5;
      star.dy = -1.2 - Math.random() * 1.2;
      star.length = 3.0 + Math.random() * 3.0;
    };

    // --- 7. GROUP FOR MEMORIES ---
    const framesGroup = new THREE.Group();
    scene.add(framesGroup);
    framesGroupRef.current = framesGroup;

    setLoadingText('');

    // --- 8. DRAG EVENTS & MOUSE MOVEMENT ---
    const onMouseDown = (e: MouseEvent) => {
      isDragging.current = true;
      hasDragged.current = false;
      clickStartPos.current = { x: e.clientX, y: e.clientY };
      dragStart.current = { x: e.clientX, y: e.clientY };
      autoRotateTimer.current = Date.now() + 8000; // Suspend auto rotate
    };

    const onMouseMove = (e: MouseEvent) => {
      const rect = renderer.domElement.getBoundingClientRect();
      mouseRef.current.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
      mouseRef.current.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;

      if (!isDragging.current) return;
      
      const dx = e.clientX - clickStartPos.current.x;
      const dy = e.clientY - clickStartPos.current.y;
      if (dx * dx + dy * dy > 36) {
        hasDragged.current = true;
      }
      
      const deltaX = e.clientX - dragStart.current.x;
      const deltaY = e.clientY - dragStart.current.y;
      
      if (layoutModeRef.current === 'grid') {
        targetGridScrollY.current -= deltaY * 0.015;
        rotationTarget.current.x = Math.max(-0.25, Math.min(0.25, rotationTarget.current.x + deltaX * 0.0015));
      } else {
        rotationTarget.current.x += deltaX * 0.005;
        rotationTarget.current.y = Math.max(-Math.PI / 4, Math.min(Math.PI / 4, rotationTarget.current.y + deltaY * 0.005));
      }

      dragStart.current = { x: e.clientX, y: e.clientY };
      autoRotateTimer.current = Date.now() + 8000;
    };

    const onMouseUp = () => {
      isDragging.current = false;
    };

    const onTouchStart = (e: TouchEvent) => {
      if (e.touches.length !== 1) return;
      isDragging.current = true;
      hasDragged.current = false;
      clickStartPos.current = { x: e.touches[0].clientX, y: e.touches[0].clientY };
      dragStart.current = { x: e.touches[0].clientX, y: e.touches[0].clientY };
      autoRotateTimer.current = Date.now() + 8000;
    };

    const onTouchMove = (e: TouchEvent) => {
      const rect = renderer.domElement.getBoundingClientRect();
      mouseRef.current.x = ((e.touches[0].clientX - rect.left) / rect.width) * 2 - 1;
      mouseRef.current.y = -((e.touches[0].clientY - rect.top) / rect.height) * 2 + 1;

      if (!isDragging.current) return;
      
      const dx = e.touches[0].clientX - clickStartPos.current.x;
      const dy = e.touches[0].clientY - clickStartPos.current.y;
      if (dx * dx + dy * dy > 36) {
        hasDragged.current = true;
      }
      
      const deltaX = e.touches[0].clientX - dragStart.current.x;
      const deltaY = e.touches[0].clientY - dragStart.current.y;

      if (layoutModeRef.current === 'grid') {
        targetGridScrollY.current -= deltaY * 0.018;
        rotationTarget.current.x = Math.max(-0.25, Math.min(0.25, rotationTarget.current.x + deltaX * 0.002));
      } else {
        rotationTarget.current.x += deltaX * 0.007;
        rotationTarget.current.y = Math.max(-Math.PI / 4, Math.min(Math.PI / 4, rotationTarget.current.y + deltaY * 0.007));
      }

      dragStart.current = { x: e.touches[0].clientX, y: e.touches[0].clientY };
      autoRotateTimer.current = Date.now() + 8000;
    };

    const onTouchEnd = () => {
      isDragging.current = false;
    };

    const onWheel = (e: WheelEvent) => {
      if (layoutModeRef.current === 'grid') {
        e.preventDefault();
        targetGridScrollY.current += e.deltaY * 0.005;
      }
    };

    const onClick = () => {
      if (hasDragged.current) {
        hasDragged.current = false;
        return;
      }

      raycasterRef.current.setFromCamera(mouseRef.current, camera);
      if (!framesGroupRef.current) return;

      const intersects = raycasterRef.current.intersectObjects(framesGroupRef.current.children, true);
      if (intersects.length > 0) {
        let obj: THREE.Object3D | null = intersects[0].object;
        while (obj && obj.parent !== framesGroupRef.current) {
          obj = obj.parent;
        }

        if (obj && obj.userData && obj.userData.id) {
          const selected = memories.find(m => m.id === obj.userData.id);
          if (selected) {
            onSelectMemory(selected);
          }
        }
      }
    };

    const dom = renderer.domElement;
    dom.addEventListener('mousedown', onMouseDown);
    dom.addEventListener('mousemove', onMouseMove);
    dom.addEventListener('mouseup', onMouseUp);
    dom.addEventListener('click', onClick);
    dom.addEventListener('touchstart', onTouchStart, { passive: true });
    dom.addEventListener('touchmove', onTouchMove, { passive: true });
    dom.addEventListener('touchend', onTouchEnd);
    dom.addEventListener('wheel', onWheel, { passive: false });

    // --- 9. ANIMATION LOOP ---
    const clock = new THREE.Clock();
    let animationFrameId: number;

    const animate = () => {
      animationFrameId = requestAnimationFrame(animate);
      const elapsed = clock.getElapsedTime();

      // Twinkle Stars
      if (starFieldRef.current) {
        starMaterial.opacity = 0.5 + Math.sin(elapsed * 1.5) * 0.3;
      }

      // Animate falling petals
      petals.forEach(p => {
        p.mesh.position.y -= p.speedY;
        p.mesh.position.x += p.speedX + Math.sin(elapsed * p.wobbleSpeed + p.wobbleOffset) * 0.003;
        p.mesh.position.z += p.speedZ;

        p.mesh.rotation.x += p.rotSpeedX;
        p.mesh.rotation.y += p.rotSpeedY;
        p.mesh.rotation.z += p.rotSpeedZ;

        if (p.mesh.position.y < -7) {
          p.mesh.position.y = 8;
          p.mesh.position.x = (Math.random() - 0.5) * 20;
          p.mesh.position.z = (Math.random() - 0.5) * 16 - 2;
        }
      });

      // Cycle textures for cards with slideshows (Autoplay texture slideshow)
      meshesMapRef.current.forEach((frameObj, id) => {
        const memory = memories.find(m => m.id === id);
        if (!memory || !memory.media || memory.media.length <= 1) return;
        
        const group = frameObj.group;
        const textures = group.userData.textures;
        if (!textures || textures.length <= 1) return;

        // Change texture every 4 seconds
        if (elapsed - group.userData.lastTextureChangeTime > 4.0) {
          group.userData.lastTextureChangeTime = elapsed;
          const nextIndex = (group.userData.activeTextureIndex + 1) % textures.length;
          group.userData.activeTextureIndex = nextIndex;

          // Find the media mesh and update its material texture
          const mediaMesh = group.children.find(child => child.type === 'Mesh' && (child as THREE.Mesh).material instanceof THREE.MeshBasicMaterial && child.position.z === 0.01) as THREE.Mesh;
          if (mediaMesh && mediaMesh.material) {
            (mediaMesh.material as THREE.MeshBasicMaterial).map = textures[nextIndex];
            (mediaMesh.material as THREE.MeshBasicMaterial).needsUpdate = true;
          }
        }
      });

      // Animate shooting stars
      shootingStars.forEach(star => {
        if (!star.active) {
          if (Math.random() < 0.0025) {
            spawnShootingStar(star);
          }
          return;
        }

        star.progress += star.speed;
        const curX = star.startX + star.dx * star.progress;
        const curY = star.startY + star.dy * star.progress;
        const curZ = star.startZ;

        const tailX = curX - (star.dx * star.length * 0.1);
        const tailY = curY - (star.dy * star.length * 0.1);
        const tailZ = curZ;

        const positions = star.line.geometry.attributes.position.array as Float32Array;
        positions[0] = curX;
        positions[1] = curY;
        positions[2] = curZ;
        positions[3] = tailX;
        positions[4] = tailY;
        positions[5] = tailZ;
        star.line.geometry.attributes.position.needsUpdate = true;

        let opacity = 0;
        if (star.progress < 0.2) {
          opacity = star.progress / 0.2;
        } else if (star.progress > 0.8) {
          opacity = (1.0 - star.progress) / 0.2;
        } else {
          opacity = 1.0;
        }
        
        (star.line.material as THREE.LineBasicMaterial).opacity = Math.max(0, opacity) * 0.9;

        if (star.progress >= 1.0) {
          star.active = false;
          (star.line.material as THREE.LineBasicMaterial).opacity = 0;
        }
      });

      // Auto-rotation yaw (only in spiral/globe layouts)
      const now = Date.now();
      if (layoutModeRef.current !== 'grid' && now > autoRotateTimer.current && !isDragging.current && !selectedMemoryId) {
        rotationTarget.current.x += 0.0006;
      }

      rotationCurrent.current.x += (rotationTarget.current.x - rotationCurrent.current.x) * 0.08;
      rotationCurrent.current.y += (rotationTarget.current.y - rotationCurrent.current.y) * 0.08;

      if (framesGroupRef.current) {
        if (layoutModeRef.current === 'grid') {
          // Scroll limit bounding and smooth lerping
          const cols = window.innerWidth > 768 ? 3 : 2;
          const spacingY = 2.4;
          const rowsCount = Math.ceil(memories.length / cols);
          const maxScroll = Math.max(0, (rowsCount - 1) * spacingY - 1.0);
          
          targetGridScrollY.current = Math.max(0, Math.min(maxScroll, targetGridScrollY.current));
          gridScrollY.current += (targetGridScrollY.current - gridScrollY.current) * 0.1;
          
          framesGroupRef.current.position.y = gridScrollY.current;
          framesGroupRef.current.position.x = 0;
          framesGroupRef.current.position.z = 0;

          // Parallax yaw tilt only, no vertical tilt
          framesGroupRef.current.rotation.y = rotationCurrent.current.x;
          framesGroupRef.current.rotation.x = 0;
          framesGroupRef.current.rotation.z = 0;
        } else {
          framesGroupRef.current.position.set(0, 0, 0);
          framesGroupRef.current.rotation.y = rotationCurrent.current.x;
          framesGroupRef.current.rotation.x = rotationCurrent.current.y;
          framesGroupRef.current.rotation.z = 0;
        }
      }

      // Animate floating and rolls dynamically based on current layout mode
      meshesMapRef.current.forEach((frameObj) => {
        const { group, floatOffset } = frameObj;
        const u = group.userData;
        if (u.baseX === undefined) return; // safeguard

        const floatAmt = Math.sin(elapsed * 0.8 + floatOffset) * 0.1;
        const rollAmt = Math.sin(elapsed * 0.3 + floatOffset) * 0.02;

        if (layoutModeRef.current === 'globe') {
          const bx = u.baseX;
          const by = u.baseY;
          const bz = u.baseZ;
          const len = Math.sqrt(bx * bx + by * by + bz * bz);
          if (len > 0) {
            const nx = bx / len;
            const ny = by / len;
            const nz = bz / len;
            group.position.set(bx + nx * floatAmt, by + ny * floatAmt, bz + nz * floatAmt);
          } else {
            group.position.set(bx, by + floatAmt, bz);
          }
        } else if (layoutModeRef.current === 'grid') {
          group.position.set(u.baseX, u.baseY, u.baseZ + floatAmt * 0.5);
        } else {
          group.position.set(u.baseX, u.baseY + floatAmt * 1.5, u.baseZ);
        }

        group.rotation.set(
          u.baseRotX,
          u.baseRotY,
          u.baseRotZ + rollAmt
        );
      });

      // Raycast Hover effects
      if (!isDragging.current) {
        raycasterRef.current.setFromCamera(mouseRef.current, camera);
        const intersects = raycasterRef.current.intersectObjects(framesGroup.children, true);
        
        let foundId: string | null = null;
        if (intersects.length > 0) {
          let obj: THREE.Object3D | null = intersects[0].object;
          while (obj && obj.parent !== framesGroup) {
            obj = obj.parent;
          }
          if (obj && obj.userData && obj.userData.id) {
            foundId = obj.userData.id;
          }
        }

        if (foundId !== hoveredIdRef.current) {
          if (hoveredIdRef.current) {
            const prev = meshesMapRef.current.get(hoveredIdRef.current);
            if (prev) {
              prev.group.userData.hoverScale = 1.0;
              const borderMesh = prev.group.getObjectByName('border') as THREE.Mesh;
              if (borderMesh && borderMesh.material) {
                (borderMesh.material as THREE.MeshBasicMaterial).color.setHex(0xd4af37);
              }
            }
          }

          if (foundId) {
            const next = meshesMapRef.current.get(foundId);
            if (next) {
              next.group.userData.hoverScale = 1.15;
              const borderMesh = next.group.getObjectByName('border') as THREE.Mesh;
              if (borderMesh && borderMesh.material) {
                (borderMesh.material as THREE.MeshBasicMaterial).color.setHex(0xffffff);
              }
            }
          }
          hoveredIdRef.current = foundId;
        }
      }

      meshesMapRef.current.forEach((frameObj) => {
        const group = frameObj.group;
        const targetScale = group.userData.hoverScale || 1.0;
        group.scale.x += (targetScale - group.scale.x) * 0.15;
        group.scale.y += (targetScale - group.scale.y) * 0.15;
        group.scale.z += (targetScale - group.scale.z) * 0.15;
      });

      // Camera zooming/focusing
      if (selectedMemoryId) {
        const activeFrame = meshesMapRef.current.get(selectedMemoryId);
        if (activeFrame) {
          const frameWorldPos = new THREE.Vector3();
          activeFrame.group.getWorldPosition(frameWorldPos);
          
          if (layoutModeRef.current === 'grid') {
            targetCamPos.current.set(
              frameWorldPos.x,
              frameWorldPos.y,
              frameWorldPos.z + 3.2
            );
            targetLookAt.current.copy(frameWorldPos);
          } else if (layoutModeRef.current === 'globe') {
            // Find direction from origin to frame position
            const normal = frameWorldPos.clone().normalize();
            targetCamPos.current.copy(frameWorldPos).addScaledVector(normal, 3.2);
            targetLookAt.current.copy(frameWorldPos);
          } else {
            // Spiral layout
            const angleY = activeFrame.group.userData.origRotationY + rotationCurrent.current.x;
            const dist = 3.5;
            targetCamPos.current.set(
              frameWorldPos.x + Math.sin(angleY) * dist,
              frameWorldPos.y + 0.2,
              frameWorldPos.z + Math.cos(angleY) * dist
            );
            targetLookAt.current.copy(frameWorldPos);
          }
        }
      } else {
        targetCamPos.current.set(0, 0, 8);
        targetLookAt.current.set(0, 0.5, 0);
      }

      camera.position.lerp(targetCamPos.current, 0.05);
      currentLookAt.current.lerp(targetLookAt.current, 0.05);
      camera.lookAt(currentLookAt.current);

      renderer.render(scene, camera);
    };

    animate();

    const handleResize = () => {
      if (!containerRef.current || !rendererRef.current || !cameraRef.current) return;
      const w = containerRef.current.clientWidth;
      const h = containerRef.current.clientHeight;
      cameraRef.current.aspect = w / h;
      cameraRef.current.updateProjectionMatrix();
      rendererRef.current.setSize(w, h);
    };

    window.addEventListener('resize', handleResize);

    return () => {
      cancelAnimationFrame(animationFrameId);

      window.removeEventListener('resize', handleResize);
      dom.removeEventListener('mousedown', onMouseDown);
      dom.removeEventListener('mousemove', onMouseMove);
      dom.removeEventListener('mouseup', onMouseUp);
      dom.removeEventListener('click', onClick);
      dom.removeEventListener('touchstart', onTouchStart);
      dom.removeEventListener('touchmove', onTouchMove);
      dom.removeEventListener('touchend', onTouchEnd);
      dom.removeEventListener('wheel', onWheel);

      if (rendererRef.current && dom.parentNode) {
        dom.parentNode.removeChild(dom);
      }

      meshesMapRef.current.forEach((val) => {
        if (val.videoElement) {
          val.videoElement.pause();
          val.videoElement.src = '';
          val.videoElement.load();
        }
        disposeGroup(val.group);
      });
      meshesMapRef.current.clear();

      starGeometry.dispose();
      starMaterial.dispose();
      dustGeometry.dispose();
      dustMaterial.dispose();
      petalGeo.dispose();
      petalMat.dispose();
      shootingStarMat.dispose();
      shootingStars.forEach(star => {
        star.line.geometry.dispose();
      });

      if (rendererRef.current) {
        rendererRef.current.dispose();
      }
    };
  }, [memories]);

  // Reconcile 3D meshes (Dynamic layout modes)
  useEffect(() => {
    const framesGroup = framesGroupRef.current;
    if (!framesGroup || !sceneRef.current) return;

    // Reset rotations and scroll states when changing layouts
    rotationTarget.current = { x: 0, y: 0 };
    rotationCurrent.current = { x: 0, y: 0 };
    if (framesGroupRef.current) {
      framesGroupRef.current.rotation.set(0, 0, 0);
      framesGroupRef.current.position.set(0, 0, 0);
    }
    gridScrollY.current = 0;
    targetGridScrollY.current = 0;

    const textureLoader = new THREE.TextureLoader();

    // Clean up old meshes
    meshesMapRef.current.forEach((val, id) => {
      const exists = memories.some(m => m.id === id);
      if (!exists) {
        framesGroup.remove(val.group);
        if (val.videoElement) {
          val.videoElement.pause();
          val.videoElement.src = '';
          val.videoElement.load();
        }
        disposeGroup(val.group);
        meshesMapRef.current.delete(id);
      }
    });

    // Render cards using dynamic layout formulas
    memories.forEach((memory, index) => {
      let x = 0;
      let y = 0;
      let z = 0;
      let rotX = 0;
      let rotY = 0;
      let rotZ = 0;

      if (layoutMode === 'spiral') {
        const cardsPerRow = 6;
        const row = Math.floor(index / cardsPerRow);
        const col = index % cardsPerRow;
        const radius = 6.0 + (row * 1.5);
        const angle = (col / cardsPerRow) * Math.PI * 2 + (row * 0.4);
        
        y = 1.0 - (row * 1.8) + (Math.sin(col) * 0.25);
        x = radius * Math.sin(angle);
        z = -radius * Math.cos(angle);
        rotY = -angle;
      } else if (layoutMode === 'globe') {
        const N = memories.length;
        const R = 6.0 + Math.max(0, (N - 10) * 0.1);
        
        const phi = Math.acos(1 - 2 * (index + 0.5) / N);
        const theta = Math.PI * (1 + Math.sqrt(5)) * (index + 0.5);
        
        x = R * Math.sin(phi) * Math.cos(theta);
        y = R * Math.cos(phi);
        z = R * Math.sin(phi) * Math.sin(theta);
        
        // Face outwards from center
        const target = new THREE.Vector3(2 * x, 2 * y, 2 * z);
        const tempObj = new THREE.Object3D();
        tempObj.position.set(x, y, z);
        tempObj.lookAt(target);
        rotX = tempObj.rotation.x;
        rotY = tempObj.rotation.y;
        rotZ = tempObj.rotation.z;
      } else if (layoutMode === 'grid') {
        const cols = window.innerWidth > 768 ? 3 : 2;
        const spacingX = 3.2;
        const spacingY = 2.4;
        const startX = -((cols - 1) * spacingX) / 2;
        
        const col = index % cols;
        const row = Math.floor(index / cols);
        
        x = startX + col * spacingX;
        y = 2.0 - row * spacingY;
        z = (Math.sin(col * 2.0) + Math.cos(row * 1.5)) * 0.2;
        
        rotX = Math.sin(index * 0.5) * 0.08;
        rotY = Math.cos(index * 0.7) * 0.08;
        rotZ = Math.sin(index * 1.2) * 0.03;
      }

      if (meshesMapRef.current.has(memory.id)) {
        const entry = meshesMapRef.current.get(memory.id)!;
        entry.targetY = y;
        entry.group.position.set(x, y, z);
        entry.group.rotation.set(rotX, rotY, rotZ);
        entry.group.userData.baseX = x;
        entry.group.userData.baseY = y;
        entry.group.userData.baseZ = z;
        entry.group.userData.baseRotX = rotX;
        entry.group.userData.baseRotY = rotY;
        entry.group.userData.baseRotZ = rotZ;
        entry.group.userData.origRotationY = rotY;
        return;
      }

      const frameGroup = new THREE.Group();
      frameGroup.position.set(x, y, z);
      frameGroup.rotation.set(rotX, rotY, rotZ);
      frameGroup.userData = { 
        id: memory.id, 
        origRotationY: rotY, 
        hoverScale: 1.0,
        baseX: x,
        baseY: y,
        baseZ: z,
        baseRotX: rotX,
        baseRotY: rotY,
        baseRotZ: rotZ
      };

      const aspect = 1.33;
      const height = 1.8;
      const width = height * aspect;

      // 1. Backing panel
      const backingGeo = new THREE.PlaneGeometry(width + 0.15, height + 0.15);
      const backingMat = new THREE.MeshPhysicalMaterial({
        color: 0x0a0c16,
        roughness: 0.2,
        metalness: 0.1,
        clearcoat: 1.0,
        side: THREE.DoubleSide
      });
      const backingMesh = new THREE.Mesh(backingGeo, backingMat);
      backingMesh.position.z = -0.01;
      frameGroup.add(backingMesh);

      // 2. Glowing border
      const borderGeo = new THREE.BufferGeometry();
      const hw = (width + 0.15) / 2;
      const hh = (height + 0.15) / 2;
      const vertices = new Float32Array([
        -hw, -hh, 0,
         hw, -hh, 0,
         hw,  hh, 0,
        -hw,  hh, 0,
        -hw, -hh, 0,
      ]);
      borderGeo.setAttribute('position', new THREE.BufferAttribute(vertices, 3));
      const borderMat = new THREE.LineBasicMaterial({ color: 0xd4af37, linewidth: 2 });
      const borderLine = new THREE.Line(borderGeo, borderMat);
      borderLine.name = 'border';
      borderLine.position.z = 0.005;
      frameGroup.add(borderLine);

      // 3. Media Panel - Extract first media item
      const mediaGeo = new THREE.PlaneGeometry(width, height);
      let mediaTexture: THREE.Texture | undefined;
      let videoEl: HTMLVideoElement | undefined;

      const firstMedia = memory.media && memory.media[0];
      const isVideo = firstMedia ? firstMedia.type === 'video' : false;
      const mediaUrl = firstMedia ? firstMedia.url : '';

      const mediaMat = new THREE.MeshBasicMaterial({
        side: THREE.DoubleSide,
        transparent: !isVideo,
        opacity: isVideo ? 1 : 0
      });

      if (isVideo && mediaUrl) {
        videoEl = document.createElement('video');
        videoEl.src = mediaUrl;
        videoEl.loop = true;
        videoEl.muted = true;
        videoEl.playsInline = true;
        videoEl.crossOrigin = 'anonymous';
        videoEl.play().catch(err => console.log('Autoplay blocked initially', err));

        mediaTexture = new THREE.VideoTexture(videoEl);
        mediaTexture.minFilter = THREE.LinearFilter;
        mediaTexture.magFilter = THREE.LinearFilter;
        mediaTexture.format = THREE.RGBAFormat;
        mediaMat.map = mediaTexture;
      } else if (mediaUrl) {
        mediaTexture = textureLoader.load(mediaUrl, () => {
          let op = 0;
          const tick = () => {
            op += 0.08;
            if (op > 1) op = 1;
            mediaMat.opacity = op;
            if (op < 1) {
              requestAnimationFrame(tick);
            }
          };
          tick();
        });
        mediaTexture.minFilter = THREE.LinearFilter;
        mediaMat.map = mediaTexture;
      }

      const mediaMesh = new THREE.Mesh(mediaGeo, mediaMat);
      mediaMesh.position.z = 0.01;
      frameGroup.add(mediaMesh);

      // Preload all image textures for sliding slideshow directly on the 3D card
      const slideTextures: THREE.Texture[] = [];
      if (memory.media && memory.media.length > 1) {
        memory.media.forEach((item) => {
          if (item.type === 'image' && item.url) {
            const tex = textureLoader.load(item.url);
            tex.minFilter = THREE.LinearFilter;
            slideTextures.push(tex);
          }
        });
      }
      frameGroup.userData.textures = slideTextures;
      frameGroup.userData.activeTextureIndex = 0;
      frameGroup.userData.lastTextureChangeTime = 0;

      // 4. Little gold pin at top
      const pinGeo = new THREE.OctahedronGeometry(0.06);
      const pinMat = new THREE.MeshBasicMaterial({ color: 0xd4af37 });
      const pinMesh = new THREE.Mesh(pinGeo, pinMat);
      pinMesh.position.set(0, hh + 0.05, 0.02);
      frameGroup.add(pinMesh);

      framesGroup.add(frameGroup);

      meshesMapRef.current.set(memory.id, {
        group: frameGroup,
        targetY: y,
        floatOffset: Math.random() * Math.PI * 2,
        videoElement: videoEl
      });
    });
  }, [memories, layoutMode]);

  // Handle video playback on selection
  useEffect(() => {
    meshesMapRef.current.forEach((frameObj, id) => {
      if (frameObj.videoElement) {
        if (id === selectedMemoryId) {
          frameObj.videoElement.muted = false;
          frameObj.videoElement.play().catch(() => {});
        } else {
          frameObj.videoElement.muted = true;
          frameObj.videoElement.play().catch(() => {});
        }
      }
    });
  }, [selectedMemoryId]);

  return (
    <div style={{ position: 'relative', width: '100%', height: '100%' }}>
      <div
        ref={containerRef}
        style={{ width: '100%', height: '100%', cursor: isDragging.current ? 'grabbing' : 'grab' }}
      />
      {loadingText && (
        <div style={{
          position: 'absolute',
          top: 0, left: 0, right: 0, bottom: 0,
          display: 'flex', justifyContent: 'center', alignItems: 'center',
          background: '#07090e', color: '#f5f6f9', zIndex: 10,
          fontFamily: 'var(--font-serif)', fontSize: '1.5rem'
        }}>
          <div style={{ textAlign: 'center' }}>
            <p className="animate-pulse">{loadingText}</p>
            <div style={{
              width: '100px', height: '2px', background: 'var(--color-gold)',
              margin: '20px auto 0', opacity: 0.6
            }} />
          </div>
        </div>
      )}
      
      <div style={{
        position: 'absolute',
        bottom: '24px',
        left: '50%',
        transform: 'translateX(-50%)',
        background: 'rgba(7, 9, 14, 0.75)',
        backdropFilter: 'blur(8px)',
        border: '1px solid rgba(255, 255, 255, 0.1)',
        padding: '8px 16px',
        borderRadius: '20px',
        fontSize: '0.8rem',
        color: 'var(--color-secondary)',
        pointerEvents: 'none',
        textAlign: 'center',
        zIndex: 5
      }}>
        Drag to orbit sky • Scroll to zoom • Click a memory frame
      </div>
    </div>
  );
};
export default ThreeGallery;
