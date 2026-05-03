import asyncio
import json
import time
import threading

from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware

from ws.manager import WebSocketManager
from robot.simulator import RobotSimulator
from robot.trajectory import TrajectoryRecorder
from safety.checker import SafetyException
from ai.analyzer import AIAnalyzer

from std_msgs.msg import String, Float64MultiArray

# ROS2
try:
    import rclpy
    from rclpy.node import Node
    from std_msgs.msg import String, Float64MultiArray
    ROS2_AVAILABLE = True
except ImportError:
    ROS2_AVAILABLE = False
    print("[WARNING] rclpy not available, ROS2 disabled")

app = FastAPI(title="Robot Control System")

manager   = WebSocketManager()
robot     = RobotSimulator()
recorder  = TrajectoryRecorder()
ai        = AIAnalyzer()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ── ROS2 ─────────────────────────────────────────────────────────────────────

ros2_node = None
ros2_publisher = None

# Главный event loop FastAPI — для отправки из ROS2 потока
_main_loop: asyncio.AbstractEventLoop = None

@app.on_event("startup")
async def startup():
    global _main_loop
    _main_loop = asyncio.get_event_loop()

def ros2_state_callback(msg: Float64MultiArray):
    """Получаем состояние от ROS2 ноды и обновляем симулятор."""
    try:
        data = list(msg.data)
        if len(data) < 6:
            return

        joints = {
            'joint0': data[0],
            'joint1': data[1],
            'joint2': data[2],
            'joint3': data[3],
            'joint4': data[4],
        }
        gripper = data[5]

        # Обновляем состояние симулятора
        for joint, angle in joints.items():
            robot.state.joints[joint] = round(angle, 2)
        robot.state.gripper = round(gripper, 2)

        # Рассылаем всем клиентам через WebSocket
        if _main_loop and not _main_loop.is_closed():
            asyncio.run_coroutine_threadsafe(
                _broadcast_state(),
                _main_loop
            )
    except Exception as e:
        print(f"[ROS2] State callback error: {e}")

def ros2_thread():
    global ros2_node, ros2_publisher
    if not ROS2_AVAILABLE:
        return
    try:
        rclpy.init()
        ros2_node = rclpy.create_node('robot_backend')
        ros2_publisher = ros2_node.create_publisher(String, '/robot/command', 10)

        # Подписка на состояние от robot_node
        ros2_node.create_subscription(
            Float64MultiArray,
            '/robot/joint_states',
            ros2_state_callback,
            10
        )

        ros2_node.get_logger().info('ROS2 backend node started')
        rclpy.spin(ros2_node)
    except Exception as e:
        print(f"[ROS2] Error: {e}")

if ROS2_AVAILABLE:
    t = threading.Thread(target=ros2_thread, daemon=True)
    t.start()

def publish_to_ros2(cmd: dict):
    if ros2_publisher is None:
        return
    try:
        msg = String()
        msg.data = json.dumps(cmd)
        ros2_publisher.publish(msg)
    except Exception as e:
        print(f"[ROS2] Publish error: {e}")

# ── helpers ───────────────────────────────────────────────────────────────────

async def _broadcast_state():
    state = robot.get_state()
    await manager.broadcast(state.json())

async def _broadcast_error(msg: str):
    await manager.broadcast(json.dumps({"type": "ERROR", "message": msg}))

async def _broadcast_info(msg: str):
    await manager.broadcast(json.dumps({"type": "INFO", "message": msg}))

# ── playback ──────────────────────────────────────────────────────────────────

async def _play_trajectory(name: str):
    traj = recorder.get(name)
    if not traj or not traj.frames:
        await _broadcast_error(f"Trajectory '{name}' not found or empty")
        return

    await _broadcast_info(f"▶ Playing trajectory '{name}' ({len(traj.frames)} frames)")

    prev_t = 0.0
    for frame in traj.frames:
        delay = frame.timestamp - prev_t
        if delay > 0:
            await asyncio.sleep(delay)
        prev_t = frame.timestamp

        for joint, angle in frame.joints.items():
            try:
                robot.set_joint(joint, angle)
                publish_to_ros2({"type": "set_joint", "joint": joint, "angle": angle})
            except (ValueError, SafetyException):
                pass

        robot.set_gripper(frame.gripper)
        publish_to_ros2({"type": "set_gripper", "value": frame.gripper})
        await _broadcast_state()

    robot.state.status = "IDLE"
    await _broadcast_state()
    await _broadcast_info(f"✅ Trajectory '{name}' finished")

# ── WebSocket ─────────────────────────────────────────────────────────────────

@app.get("/")
def root():
    return {"status": "Backend is running", "ros2": ROS2_AVAILABLE}

@app.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket):
    await manager.connect(websocket)
    await manager.send_personal(robot.get_state().json(), websocket)
    await manager.send_personal(
        json.dumps({"type": "TRAJECTORY_LIST", "names": recorder.list_names()}),
        websocket,
    )

    try:
        while True:
            data = await websocket.receive_text()
            command = json.loads(data)
            cmd_type = command.get("type")

            if cmd_type == "move":
                try:
                    robot.move_joint(joint=command["joint"], delta=command["delta"])
                    publish_to_ros2({"type": "set_joint", "joint": command["joint"], "angle": robot.state.joints[command["joint"]]})
                except SafetyException as e:
                    await manager.broadcast(json.dumps({"type": "SAFETY_ALERT", "message": str(e)}))
                    continue
                except ValueError as e:
                    await manager.send_personal(json.dumps({"type": "ERROR", "message": str(e)}), websocket)
                    continue

            elif cmd_type == "set_joint":
                try:
                    robot.set_joint(joint=command["joint"], angle=command["angle"])
                    publish_to_ros2(command)
                except (SafetyException, ValueError) as e:
                    await manager.send_personal(json.dumps({"type": "ERROR", "message": str(e)}), websocket)
                    continue

            elif cmd_type == "set_gripper":
                robot.set_gripper(command.get("value", 0.5))
                publish_to_ros2(command)

            elif cmd_type == "home":
                robot.home()
                publish_to_ros2({"type": "home"})
                await _broadcast_info("🏠 Robot moved to home position")

            elif cmd_type == "record_start":
                name = command.get("name", f"traj_{int(time.time())}")
                recorder.start(name)
                await _broadcast_info(f"⏺ Recording started: '{name}'")

            elif cmd_type == "record_stop":
                traj = recorder.stop()
                if traj:
                    await manager.broadcast(json.dumps({
                        "type": "TRAJECTORY_SAVED",
                        "name": traj.name,
                        "frames": len(traj.frames),
                        "names": recorder.list_names(),
                    }))
                else:
                    await _broadcast_error("Not recording")
                continue

            elif cmd_type == "play":
                asyncio.create_task(_play_trajectory(command.get("name", "")))
                continue

            elif cmd_type == "delete_trajectory":
                if recorder.delete(command.get("name", "")):
                    await manager.broadcast(json.dumps({"type": "TRAJECTORY_LIST", "names": recorder.list_names()}))
                continue

            warnings = ai.analyze(command, robot.get_state())
            if warnings:
                await manager.broadcast(json.dumps({"type": "AI_WARNING", "messages": warnings}))

            state = robot.get_state()
            recorder.record_frame(state.joints, state.gripper)
            await _broadcast_state()

    except WebSocketDisconnect:
        manager.disconnect(websocket)
        await manager.broadcast(json.dumps({"type": "INFO", "message": "Client disconnected"}))