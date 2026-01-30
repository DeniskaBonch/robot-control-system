import React, { useRef } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { useGLTF, OrbitControls } from "@react-three/drei";
import * as THREE from "three";

/* =======================
   ОПИСАНИЕ СУСТАВОВ
======================= */

type AIWarning = {
  joint: string;
  message: string;
};

// УБРАТЬ useState отсюда - он должен быть внутри компонента
// const [aiWarnings, setAiWarnings] = React.useState<string[]>([]);


const JOINT_LIMITS = {
  joint1: { min: -90, max: 90, axis: "y" as const },
  joint2: { min: -60, max: 60, axis: "x" as const },
  joint3: { min: -45, max: 45, axis: "z" as const },
} as const;

type JointName = keyof typeof JOINT_LIMITS;

interface RobotViewProps {
  joints: Partial<Record<JointName, number>>;
}

interface RobotModelProps extends RobotViewProps {
  onAIWarning?: (msg: string) => void;
}

/* =======================
   ВСПОМОГАТЕЛЬНОЕ
======================= */

const clamp = (v: number, min: number, max: number) =>
  Math.max(min, Math.min(max, v));

const isInsideSafeZone = (pos: THREE.Vector3) => {
  const r = Math.sqrt(pos.x * pos.x + pos.z * pos.z);

  return (
    r <= SAFE_ZONE.radius &&
    pos.y >= SAFE_ZONE.minY &&
    pos.y <= SAFE_ZONE.maxY
  );
};


const SAFE_ZONE = {
  radius: 1,     // радиус рабочей зоны
  minY: -1,       // нижняя граница
  maxY: 10,       // верхняя граница
};

/* =======================
   МОДЕЛЬ РОБОТА
======================= */

const RobotModel: React.FC<RobotModelProps> = ({ joints, onAIWarning }) => {
  const group = useRef<THREE.Group>(null!);
  const gltf = useGLTF("/models/robot.glb");
  const lastWarnings = useRef<Record<string, boolean>>({});
  const analyzeTrajectory = (
    joint: THREE.Object3D,
    axis: "x" | "y" | "z",
    nextAngleRad: number
  ): string | null => {
    const prev = joint.rotation[axis];
    joint.rotation[axis] = nextAngleRad;

    const pos = new THREE.Vector3();
    joint.getWorldPosition(pos);

    joint.rotation[axis] = prev;

    const r = Math.sqrt(pos.x * pos.x + pos.z * pos.z);

    if (
      r > SAFE_ZONE.radius * 0.9 ||
      pos.y < SAFE_ZONE.minY + 0.2 ||
      pos.y > SAFE_ZONE.maxY - 0.2
    ) {
      return "Опасная траектория: приближение к границе безопасной зоны";
    }

    return null;
  };


  // Текущие углы (в градусах)
  const currentAngles = useRef<Record<JointName, number>>({
    joint1: 0,
    joint2: 0,
    joint3: 0,
  });

  useFrame((_, delta) => {
    if (!group.current) return;

    (Object.keys(JOINT_LIMITS) as JointName[]).forEach((name) => {
      const joint = group.current.getObjectByName(name);
      if (!joint) return;

      const cfg = JOINT_LIMITS[name];

      const targetDeg = clamp(joints[name] ?? 0, cfg.min, cfg.max);
      const predictedRad = THREE.MathUtils.degToRad(targetDeg);
      const warning = analyzeTrajectory(joint, cfg.axis, predictedRad);

      if (warning && !lastWarnings.current[name]) {
        console.warn(`AI WARNING [${name}]:`, warning);
        if (onAIWarning) {
          onAIWarning(warning);
        }
        lastWarnings.current[name] = true;
      }

      if (!warning) {
        lastWarnings.current[name] = false;
      }

      const currentDeg = currentAngles.current[name];

      // ПЛАВНОЕ СБЛИЖЕНИЕ
      const smoothDeg = THREE.MathUtils.lerp(
        currentDeg,
        targetDeg,
        1 - Math.exp(-6 * delta) // скорость реакции
      );

      currentAngles.current[name] = smoothDeg;

            // пробуем применить вращение
      const prevRotation = joint.rotation[cfg.axis];
      joint.rotation[cfg.axis] = THREE.MathUtils.degToRad(smoothDeg);

      // проверяем позицию после вращения
      const worldPos = new THREE.Vector3();
      joint.getWorldPosition(worldPos);

      if (!isInsideSafeZone(worldPos)) {
        // откатываем вращение
        joint.rotation[cfg.axis] = prevRotation;
      } else {
        currentAngles.current[name] = smoothDeg;
      }

    });
  });

  return <primitive ref={group} object={gltf.scene} />;
};

/* =======================
   VIEW
======================= */

export const RobotView: React.FC<RobotViewProps> = ({ joints }) => {
  // useState должен быть ВНУТРИ компонента
  const [aiWarnings, setAiWarnings] = React.useState<string[]>([]);

  const handleAIWarning = (msg: string) => {
    setAiWarnings((prev) =>
      prev.includes(msg) ? prev : [...prev, msg]
    );
  };

  return (
    <>
      {/* Опционально: можно добавить отображение предупреждений */}
      {/* {aiWarnings.length > 0 && (
        <div style={{ position: 'absolute', top: 10, left: 10, background: 'red', color: 'white', padding: 10 }}>
          {aiWarnings.map((w, i) => <div key={i}>{w}</div>)}
        </div>
      )} */}
      
      <Canvas
        style={{ width: "100vw", height: "100vh" }}
        camera={{
          position: [0, 5, 12],
          fov: 75,
          near: 0.01,
          far: 5000,
        }}
      >
        <ambientLight intensity={0.6} />
        <directionalLight position={[10, 10, 5]} intensity={1} />

        <RobotModel
          joints={joints}
          onAIWarning={handleAIWarning}
        />

        <OrbitControls />
            <mesh position={[0, (SAFE_ZONE.minY + SAFE_ZONE.maxY) / 2, 0]}>
        <cylinderGeometry
          args={[
            SAFE_ZONE.radius,
            SAFE_ZONE.radius,
            SAFE_ZONE.maxY - SAFE_ZONE.minY,
            32,
          ]}
        />
        <meshStandardMaterial
          color="lime"
          transparent
          opacity={0.15}
        />
      </mesh>

      </Canvas>
    </>
  );
};