import React, { useRef, useState } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { useGLTF, OrbitControls } from "@react-three/drei";
import * as THREE from "three";

/* ===== Типы ===== */

type JointName = "joint1" | "joint2" | "joint3";

interface RobotViewProps {
  joints: Partial<Record<JointName, number>>;
}

/* ===== Ограничения ===== */

const JOINT_LIMITS: Record<
  JointName,
  { min: number; max: number; axis: "x" | "y" | "z" }
> = {
  joint1: { min: -90, max: 90, axis: "y" },
  joint2: { min: -60, max: 60, axis: "x" },
  joint3: { min: -45, max: 45, axis: "z" },
};

const DANGER_ZONE = 5;
const NEAR_ZONE = 10;

const clamp = (v: number, min: number, max: number) =>
  Math.max(min, Math.min(max, v));

/* ===== 3D модель ===== */

const RobotModel: React.FC<{
  joints: Partial<Record<JointName, number>>;
  onStateUpdate: (
    angles: Record<JointName, number>,
    dangers: Record<JointName, boolean>
  ) => void;
}> = ({ joints, onStateUpdate }) => {
  const group = useRef<THREE.Group>(null!);
  const gltf = useGLTF("/models/robot.glb");

  useFrame(() => {
    if (!group.current) return;

    const realAngles = {} as Record<JointName, number>;
    const dangerState = {} as Record<JointName, boolean>;

    (Object.keys(JOINT_LIMITS) as JointName[]).forEach((name) => {
      const cfg = JOINT_LIMITS[name];
      const joint = group.current.getObjectByName(name);
      if (!joint) return;

      const input = joints[name] ?? 0;
      const safe = clamp(input, cfg.min, cfg.max);
      const rad = (safe * Math.PI) / 180;

      joint.rotation[cfg.axis] = rad;
      realAngles[name] = safe;

      const danger =
        safe >= cfg.max - DANGER_ZONE ||
        safe <= cfg.min + DANGER_ZONE;

      dangerState[name] = danger;

      const near =
        !danger &&
        (safe >= cfg.max - NEAR_ZONE ||
          safe <= cfg.min + NEAR_ZONE);

      /* ===== Визуальный индикатор ===== */

      const indName = `${name}_indicator`;
      let indicator = joint.getObjectByName(indName) as THREE.Mesh;

      if (!indicator) {
        indicator = new THREE.Mesh(
          new THREE.SphereGeometry(0.25, 16, 16),
          new THREE.MeshBasicMaterial({
            transparent: true,
            opacity: 0.9,
          })
        );
        indicator.name = indName;
        indicator.position.set(0, 0.8, 0);
        joint.add(indicator);
      }

      const mat = indicator.material as THREE.MeshBasicMaterial;

      if (danger) {
        mat.color.set("red");
        indicator.visible = true;
      } else if (near) {
        mat.color.set("yellow");
        indicator.visible = true;
      } else {
        indicator.visible = false;
      }
    });

    onStateUpdate(realAngles, dangerState);
  });

  return <primitive ref={group} object={gltf.scene} />;
};

/* ===== Основной компонент ===== */

export const RobotView: React.FC<RobotViewProps> = ({ joints }) => {
  const [angles, setAngles] = useState<Record<JointName, number>>({
    joint1: 0,
    joint2: 0,
    joint3: 0,
  });

  const [danger, setDanger] = useState<Record<JointName, boolean>>({
    joint1: false,
    joint2: false,
    joint3: false,
  });

  const isSafe = (Object.keys(danger) as JointName[]).every(
    (j) => !danger[j]
  );

  return (
    <>
      <Canvas
        style={{ width: "100vw", height: "100vh" }}
        camera={{ position: [0, 5, 12], fov: 75 }}
      >
        <ambientLight intensity={0.6} />
        <directionalLight position={[10, 10, 5]} intensity={1} />

        <RobotModel
          joints={joints}
          onStateUpdate={(a, d) => {
            setAngles(a);
            setDanger(d);
          }}
        />

        <OrbitControls />
      </Canvas>

      {/* ===== AI панель ===== */}
      <div
        style={{
          position: "fixed",
          top: 20,
          right: 20,
          width: 320,
          background: "rgba(0,0,0,0.85)",
          color: "white",
          padding: 12,
          borderRadius: 8,
          fontFamily: "monospace",
        }}
      >
        <strong>🤖 AI Monitor</strong>

        {isSafe && (
          <div style={{ marginTop: 8, color: "#7f7" }}>
            🟢 Безопасная зона
          </div>
        )}

        {(Object.keys(danger) as JointName[]).map(
          (j) =>
            danger[j] && (
              <div
                key={j}
                style={{
                  marginTop: 8,
                  padding: 6,
                  background: "#ff4444",
                  borderRadius: 4,
                }}
              >
                ⚠ {j} близок к пределу ({angles[j]}°)
              </div>
            )
        )}

        <hr />

        <div>joint1 (real): {angles.joint1}°</div>
        <div>joint2 (real): {angles.joint2}°</div>
        <div>joint3 (real): {angles.joint3}°</div>
      </div>
    </>
  );
};
