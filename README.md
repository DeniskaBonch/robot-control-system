ws://127.0.0.1:8000/ws
http://127.0.0.1:8000/
http://127.0.0.1:8000/docs#/ сваггер
http://localhost:5173/ ui

Запуск сервера вместе с нодой:
cd C:\pixi_ws
pixi shell
call C:\pixi_ws\ros2-windows\local_setup.bat
call C:\pixi_ws\install\local_setup.bat

start ros2 run robot_controller robot_node

cd C:\Users\Denis\Desktop\DIPLOM\robot-control-system\backend
C:\pixi_ws\.pixi\envs\default\Scripts\uvicorn.exe main:app --reload

---

Ребилд
cd C:\pixi_ws
pixi shell
call C:\pixi_ws\ros2-windows\local_setup.bat
call C:\pixi_ws\install\local_setup.bat
pixi run colcon build --packages-select robot_controller --packages-ignore ament_lint ament_flake8 ament_pep257 ament_copyright

---

фронт с cmd
cd C:\Users\Denis\Desktop\DIPLOM\robot-control-system\frontend\robot-ui
npm run dev

---

получение инфы с топика
ros2 topic echo /robot/joint_states

---
