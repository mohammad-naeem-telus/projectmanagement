import { Router } from "express";
import {
  getAllProjects,
  getProjectById,
  createProject,
  updateProject,
  deleteProject,
} from "../controllers/project.controllers.js";

const router = Router();

router.route("/").get(getAllProjects).post(createProject);
router.route("/:id").get(getProjectById).put(updateProject).delete(deleteProject);

export default router;
