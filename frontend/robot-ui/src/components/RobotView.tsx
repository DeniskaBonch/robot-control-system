import React, { useRef, useState } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import {
  useGLTF,
  OrbitControls,
  Grid,
  GizmoHelper,
  GizmoViewport,
} from "@react-three/drei";
import * as THREE from "three";
import { JOINT_LIMITS } from "../logic/robotSafety";
import type { JointName } from "../logic/robotSafety";

const JOINT_AXIS: Record<JointName, "x" | "y" | "z"> = {
  joint0: "y",
  joint1: "y",
  joint2: "x",
  joint3: "x",
  joint4: "x",
};

const JOINT_LABELS: Record<JointName, string> = {
  joint0: "Основание",
  joint1: "Плечо",
  joint2: "Локоть",
  joint3: "Предплечье",
  joint4: "Запястье",
};

const FINGER_CONFIG: Record<string, { axis: "x" | "y" | "z"; angle: number }> =
  {
    finger01: { axis: "z", angle: -0.35 },
    finger02: { axis: "x", angle: -0.35 },
    finger03: { axis: "z", angle: 0.35 },
    finger04: { axis: "x", angle: 0.35 },
  };

const SPEED = 25;
const GRIPPER_SPEED = 1.5;
const ALL_JOINTS = Object.keys(JOINT_LIMITS) as JointName[];
const clamp = (v: number, min: number, max: number) =>
  Math.max(min, Math.min(max, v));

const RobotModel: React.FC<{
  joints: Partial<Record<JointName, number>>;
  gripper: number;
  onAnglesUpdate: (a: Record<JointName, number>) => void;
}> = ({ joints, gripper, onAnglesUpdate }) => {
  const group = useRef<THREE.Group>(null!);
  const gltf = useGLTF("/models/robot.glb");
  const current = useRef<Record<JointName, number>>(
    Object.fromEntries(ALL_JOINTS.map((j) => [j, 0])) as Record<
      JointName,
      number
    >,
  );
  const currentGripper = useRef(0);
  const fingerBase = useRef<
    Record<string, { x: number; y: number; z: number }>
  >({});

  useFrame((_, delta) => {
    if (!group.current) return;
    const reported = {} as Record<JointName, number>;

    // суставы — твой оригинальный код
    ALL_JOINTS.forEach((name) => {
      const obj = group.current.getObjectByName(name);
      if (!obj) return;
      const { min, max } = JOINT_LIMITS[name];
      const axis = JOINT_AXIS[name];
      const target = clamp(joints[name] ?? 0, min, max);
      const cur = current.current[name];
      const maxStep = SPEED * delta;
      const diff = target - cur;
      const next =
        Math.abs(diff) <= maxStep ? target : cur + Math.sign(diff) * maxStep;
      current.current[name] = next;
      reported[name] = Math.round(next * 10) / 10;
      obj.rotation[axis] = (next * Math.PI) / 180;
    });

    onAnglesUpdate(reported);

    // хват — интерполяция
    const gripTarget = clamp(gripper, 0, 1);
    const gripCur = currentGripper.current;
    const gripMaxStep = GRIPPER_SPEED * delta;
    const gripDiff = gripTarget - gripCur;
    const gripNext =
      Math.abs(gripDiff) <= gripMaxStep
        ? gripTarget
        : gripCur + Math.sign(gripDiff) * gripMaxStep;
    currentGripper.current = gripNext;

    Object.entries(FINGER_CONFIG).forEach(([name, cfg]) => {
      const obj = group.current.getObjectByName(name);
      if (!obj) return;
      if (!fingerBase.current[name]) {
        fingerBase.current[name] = {
          x: obj.rotation.x,
          y: obj.rotation.y,
          z: obj.rotation.z,
        };
      }
      const base = fingerBase.current[name];
      obj.rotation.x = base.x;
      obj.rotation.y = base.y;
      obj.rotation.z = base.z;
      obj.rotation[cfg.axis] = base[cfg.axis] + cfg.angle * (gripNext * 2 - 1);
    });
  });

  return <primitive ref={group} object={gltf.scene} />;
};

interface RobotViewProps {
  joints: Partial<Record<JointName, number>>;
  gripper: number;
}

export const RobotView: React.FC<RobotViewProps> = ({ joints, gripper }) => {
  const [angles, setAngles] = useState<Record<JointName, number>>(
    Object.fromEntries(ALL_JOINTS.map((j) => [j, 0])) as Record<
      JointName,
      number
    >,
  );

  return (
    <>
      <Canvas
        camera={{ position: [0, 5, 12], fov: 60 }}
        style={{ width: "100%", height: "100%", background: "#1a1a1a" }}
      >
        <ambientLight intensity={1.2} />
        <directionalLight position={[10, 20, 10]} intensity={2.0} castShadow />
        <directionalLight position={[-10, 10, -5]} intensity={1.0} />
        <directionalLight position={[0, -5, 10]} intensity={0.5} />
        <pointLight position={[0, 8, 0]} intensity={1.0} />

        <Grid
          args={[20, 20]}
          cellColor="#1e3a1e"
          sectionColor="#2a5a2a"
          fadeDistance={25}
          infiniteGrid
        />

        <RobotModel
          joints={joints}
          gripper={gripper}
          onAnglesUpdate={setAngles}
        />
        <OrbitControls makeDefault />

        <GizmoHelper alignment="bottom-right" margin={[80, 80]}>
          <GizmoViewport
            axisColors={["#ef5350", "#66bb6a", "#42a5f5"]}
            labelColor="white"
          />
        </GizmoHelper>
      </Canvas>

      <div
        style={{
          position: "fixed",
          top: 20,
          right: 20,
          width: 210,
          background: "rgba(0,0,0,0.82)",
          border: "1px solid #2a2a2a",
          color: "#e0e0e0",
          padding: "12px 14px",
          borderRadius: 8,
          fontFamily: "monospace",
          fontSize: 12,
          zIndex: 10,
        }}
      >
        <div style={{ fontWeight: "bold", marginBottom: 10, color: "#4fc3f7" }}>
          ⚙ Servo feedback
        </div>

        {ALL_JOINTS.map((name) => {
          const val = angles[name] ?? 0;
          const { min, max } = JOINT_LIMITS[name];
          const pct = ((val - min) / (max - min)) * 100;
          const nearLimit =
            Math.abs(val - min) < 15 || Math.abs(max - val) < 15;
          return (
            <div key={name} style={{ marginBottom: 10 }}>
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  marginBottom: 3,
                }}
              >
                <span style={{ color: "#888" }}>{JOINT_LABELS[name]}</span>
                <span
                  style={{
                    color: nearLimit ? "#ff9800" : "#e0e0e0",
                    fontWeight: "bold",
                  }}
                >
                  {val.toFixed(1)}°
                </span>
              </div>
              <div style={{ height: 4, background: "#222", borderRadius: 2 }}>
                <div
                  style={{
                    height: "100%",
                    width: `${Math.max(0, Math.min(100, pct))}%`,
                    background: nearLimit ? "#ff9800" : "#4fc3f7",
                    borderRadius: 2,
                    transition: "width 0.08s linear",
                  }}
                />
              </div>
            </div>
          );
        })}

        <div
          style={{
            borderTop: "1px solid #252525",
            paddingTop: 10,
            marginTop: 2,
          }}
        >
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              marginBottom: 3,
            }}
          >
            <span style={{ color: "#888" }}>Хват</span>
            <span style={{ color: "#ce93d8", fontWeight: "bold" }}>
              {(gripper * 100).toFixed(0)}%
            </span>
          </div>
          <div style={{ height: 4, background: "#222", borderRadius: 2 }}>
            <div
              style={{
                height: "100%",
                width: `${gripper * 100}%`,
                background: "#ce93d8",
                borderRadius: 2,
                transition: "width 0.08s linear",
              }}
            />
          </div>
        </div>
      </div>
    </>
  );
};
