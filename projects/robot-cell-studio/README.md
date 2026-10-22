# Robot Cell Studio

Build a factory robot in 3D, check what it can do, then program it in a work cell.

- **Build:**
  - Start from a 6-axis industrial arm, 7-axis cobot, SCARA, 5-axis palletizer or Cartesian gantry.
  - Edit each joint: yaw, pitch, roll or slide, its link direction and length, its motor size (S to XXL) and its travel limits.
  - Add or remove joints and reorder them.
  - Change the pedestal height and colour, and pick an end effector: two-finger gripper, vacuum cup, MIG torch or screwdriver.
- **Specs:**
  - Live forward kinematics, horizontal reach and working height.
  - Rated payload, worked out from static joint torques across the whole workspace.
  - Arm mass, illustrative cost and per-joint load bars.
  - A point cloud of the reachable workspace.
- **Program:**
  - Task templates (palletize boxes, weld a seam, drive screws) lay out the cell around the robot you built, searching for reachable positions.
  - You can also teach your own points by jogging joints or dragging the TCP, which uses damped-least-squares IK.
  - MoveJ, MoveL, tool and wait steps are checked for reach, floor collisions and joint speed limits, and timed for the cycle.
- **Simulate:** the robot runs the program in a fenced cell: boxes ride the conveyor and stack on the pallet, the weld bead grows with sparks, and screws appear as they are driven.
- **Export:** a URDF of the robot (for ROS 2, MoveIt, Gazebo or Isaac Sim), a vendor-neutral program script, and the project as JSON or a share link.

```bash
python3 -m http.server 8000      # from this folder
# open http://localhost:8000/#p=scara&task=palletize
```

Masses, inertias and costs are estimates for illustration.

Docs: `docs/projects/robot-cell-studio/`.
