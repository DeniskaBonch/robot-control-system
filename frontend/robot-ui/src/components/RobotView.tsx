import React, { useRef, useState } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { useGLTF, OrbitControls } from "@react-three/drei";
import * as THREE from "three";

/* ===== Типы ===== */

type JointName = "joint1" | "joint2" | "joint3";

interface RobotViewProps {
  joints: Partial<Record<JointName, number>>;
}

interface RobotModelProps extends RobotViewProps {
  onAIWarning: (msg: string) => void;
}

/* ===== Ограничения суставов ===== */

const JOINT_LIMITS: Record<
  JointName,
  { min: number; max: number; axis: "x" | "y" | "z" }
> = {
  joint1: { min: -90, max: 90, axis: "y" },
  joint2: { min: -60, max: 60, axis: "x" },
  joint3: { min: -45, max: 45, axis: "z" },
};

const clamp = (v: number, min: number, max: number) =>
  Math.max(min, Math.min(max, v));

/* ===== 3D модель робота ===== */

const RobotModel: React.FC<RobotModelProps> = ({ joints, onAIWarning }) => {
  const group = useRef<THREE.Group>(null!);
  const gltf = useGLTF("/models/robot.glb");

  const lastWarnings = useRef<Record<string, boolean>>({});

  useFrame(() => {
    if (!group.current) return;

    (Object.keys(JOINT_LIMITS) as JointName[]).forEach((name) => {
      const cfg = JOINT_LIMITS[name];
      const joint = group.current.getObjectByName(name);
      if (!joint) return;

      const angleDeg = joints[name] ?? 0;
      const safeAngle = clamp(angleDeg, cfg.min, cfg.max);
      const angleRad = (safeAngle * Math.PI) / 180;

      joint.rotation[cfg.axis] = angleRad;

      const nearLimit =
        Math.abs(safeAngle - cfg.min) < 5 ||
        Math.abs(cfg.max - safeAngle) < 5;

      if (nearLimit && !lastWarnings.current[name]) {
        onAIWarning(
          `Сустав ${name} близок к пределу (${safeAngle.toFixed(1)}°)`
        );
        lastWarnings.current[name] = true;
      }

      if (!nearLimit) {
        lastWarnings.current[name] = false;
      }
    });
  });

  return <primitive ref={group} object={gltf.scene} />;
};

/* ===== Основной компонент ===== */

export const RobotView: React.FC<RobotViewProps> = ({ joints }) => {
  const [aiWarnings, setAiWarnings] = useState<string[]>([]);

  return (
    <>
      <Canvas
        style={{ width: "100vw", height: "100vh" }}
        camera={{ position: [0, 5, 12], fov: 75, near: 0.01, far: 5000 }}
      >
        <ambientLight intensity={0.6} />
        <directionalLight position={[10, 10, 5]} intensity={1} />

        <RobotModel
          joints={joints}
          onAIWarning={(msg) =>
            setAiWarnings((prev) =>
              prev.includes(msg) ? prev : [...prev, msg]
            )
          }
        />

        <OrbitControls />
      </Canvas>

      {/* ===== AI Панель ===== */}
      <div
        style={{
          position: "fixed",
          top: 20,
          right: 20,
          width: 320,
          background: "rgba(0,0,0,0.75)",
          color: "white",
          padding: "12px",
          borderRadius: "8px",
          fontFamily: "monospace",
          zIndex: 1000,
        }}
      >
        <strong>🤖 AI Monitor</strong>

        {aiWarnings.length === 0 && (
          <div style={{ marginTop: 8, color: "#8f8" }}>
            Безопасная траектория
          </div>
        )}

        {aiWarnings.map((w, i) => (
          <div
            key={i}
            style={{
              marginTop: 8,
              padding: "6px",
              background: "#ff4444",
              borderRadius: "4px",
            }}
          >
            ⚠ {w}
          </div>
        ))}
      </div>
    </>
  );
};
