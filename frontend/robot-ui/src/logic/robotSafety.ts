export type JointName = "joint0" | "joint1" | "joint2" | "joint3" | "joint4";
export type RobotState = "OK" | "WARNING" | "CRITICAL" | "BLOCKED";

export interface JointLimits {
  min: number;
  max: number;
  label: string;
}

export interface SafetyResult {
  state: RobotState;
  warnings: string[];
  safeJoints: Record<JointName, number>;
}

export const JOINT_LIMITS: Record<JointName, JointLimits> = {
  joint0: { min: -170, max: 170, label: "Основание" },
  joint1: { min: -85, max: 85, label: "Плечо" },
  joint2: { min: -120, max: 120, label: "Локоть" },
  joint3: { min: -85, max: 85, label: "Предплечье" },
  joint4: { min: -170, max: 170, label: "Запястье" },
};

const WARNING_ZONE = 15;
const clamp = (v: number, min: number, max: number) =>
  Math.max(min, Math.min(max, v));

export function analyzeRobotState(
  joints: Record<JointName, number>,
): SafetyResult {
  const warnings: string[] = [];
  let state: RobotState = "OK";
  const safeJoints = { ...joints } as Record<JointName, number>;

  (Object.keys(JOINT_LIMITS) as JointName[]).forEach((name) => {
    const { min, max, label } = JOINT_LIMITS[name];
    const value = joints[name] ?? 0;
    safeJoints[name] = clamp(value, min, max);

    if (value < min || value > max) {
      state = "BLOCKED";
      warnings.push(`⛔ ${label} вышел за пределы`);
    } else if (
      Math.abs(value - min) <= WARNING_ZONE ||
      Math.abs(max - value) <= WARNING_ZONE
    ) {
      if (state !== "BLOCKED") state = "WARNING";
      warnings.push(`⚠ ${label} близок к пределу (${value}°)`);
    }
  });

  return { state, warnings, safeJoints };
}
