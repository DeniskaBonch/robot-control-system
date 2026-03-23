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
  joint3: { min: -45, max: 45, axis: "x" },
};

/* ===== Скорости (°/s) ===== */

const MAX_SPEED: Record<JointName, number> = {
  joint1: 10,
  joint2: 10,
  joint3: 10,
};

const clamp = (v: number, min: number, max: number) =>
  Math.max(min, Math.min(max, v));

/* ===== 3D модель ===== */

const RobotModel: React.FC<{
  joints: Partial<Record<JointName, number>>;
  onStateUpdate: (angles: Record<JointName, number>) => void;
}> = ({ joints, onStateUpdate }) => {
  const group = useRef<THREE.Group>(null!);
  const gltf = useGLTF("/models/robot.glb");

  const currentAngles = useRef<Record<JointName, number>>({
    joint1: 0,
    joint2: 0,
    joint3: 0,
  });

  useFrame((_, delta) => {
    if (!group.current) return;

    const reported = {} as Record<JointName, number>;

    (Object.keys(JOINT_LIMITS) as JointName[]).forEach((name) => {
      const cfg = JOINT_LIMITS[name];
      const joint = group.current.getObjectByName(name);
      if (!joint) return;

      const target = clamp(joints[name] ?? 0, cfg.min, cfg.max);

      const current = currentAngles.current[name];
      const maxStep = MAX_SPEED[name] * delta;

      let next = current;

      if (Math.abs(target - current) <= maxStep) {
        next = target;
      } else {
        next += Math.sign(target - current) * maxStep;
      }

      currentAngles.current[name] = next;
      reported[name] = Math.round(next);

      joint.rotation[cfg.axis] = (next * Math.PI) / 180;
    });

    onStateUpdate(reported);
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

  return (
    <>
      <Canvas
        style={{ width: "100vw", height: "100vh", background: "#aca9a9" }}
        camera={{ position: [0, 5, 12], fov: 75 }}
      >
        <ambientLight intensity={10} />
        <directionalLight position={[10, 100, 500]} intensity={1} />

        <RobotModel joints={joints} onStateUpdate={setAngles} />

        <OrbitControls />
      </Canvas>

      {/* ===== Панель ===== */}
      <div
        style={{
          position: "fixed",
          top: 20,
          right: 20,
          width: 300,
          background: "rgba(0,0,0,0.85)",
          color: "white",
          padding: 12,
          borderRadius: 8,
          fontFamily: "monospace",
        }}
      >
        <strong>⚙ Servo feedback</strong>
        <hr />
        <div>joint1: {angles.joint1}°</div>
        <div>joint2: {angles.joint2}°</div>
        <div>joint3: {angles.joint3}°</div>
      </div>
    </>
  );
};
