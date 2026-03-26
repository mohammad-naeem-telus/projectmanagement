import Project from "../models/project.models.js";

// GET /api/v1/projects
export const getAllProjects = async (_req, res) => {
  try {
    const projects = await Project.find()
      .populate("owner", "-password")
      .populate("team.user", "-password");
    res.status(200).json({
      status: "success",
      count: projects.length,
      data: projects,
    });
  } catch (error) {
    res.status(500).json({ status: "error", message: error.message });
  }
};

// GET /api/v1/projects/:id
export const getProjectById = async (req, res) => {
  try {
    const project = await Project.findById(req.params.id)
      .populate("owner", "-password")
      .populate("team.user", "-password");
    if (!project) {
      return res
        .status(404)
        .json({ status: "error", message: "Project not found" });
    }
    res.status(200).json({ status: "success", data: project });
  } catch (error) {
    res.status(500).json({ status: "error", message: error.message });
  }
};

// POST /api/v1/projects
export const createProject = async (req, res) => {
  try {
    const {
      name,
      description,
      status,
      priority,
      startDate,
      endDate,
      owner,
      team,
      budget,
      tags,
      milestones,
      notes,
    } = req.body;

    const project = await Project.create({
      name,
      description,
      status,
      priority,
      startDate,
      endDate,
      owner,
      team,
      budget,
      tags,
      milestones,
      notes,
    });

    res.status(201).json({ status: "success", data: project });
  } catch (error) {
    res.status(400).json({ status: "error", message: error.message });
  }
};

// PUT /api/v1/projects/:id
export const updateProject = async (req, res) => {
  try {
    const {
      name,
      description,
      status,
      priority,
      startDate,
      endDate,
      budget,
      actualCost,
      tags,
      notes,
      isActive,
    } = req.body;

    const project = await Project.findByIdAndUpdate(
      req.params.id,
      {
        name,
        description,
        status,
        priority,
        startDate,
        endDate,
        budget,
        actualCost,
        tags,
        notes,
        isActive,
      },
      { new: true, runValidators: true }
    )
      .populate("owner", "-password")
      .populate("team.user", "-password");

    if (!project) {
      return res
        .status(404)
        .json({ status: "error", message: "Project not found" });
    }
    res.status(200).json({ status: "success", data: project });
  } catch (error) {
    res.status(400).json({ status: "error", message: error.message });
  }
};

// DELETE /api/v1/projects/:id
export const deleteProject = async (req, res) => {
  try {
    const project = await Project.findByIdAndDelete(req.params.id);
    if (!project) {
      return res
        .status(404)
        .json({ status: "error", message: "Project not found" });
    }
    res
      .status(200)
      .json({ status: "success", message: "Project deleted successfully" });
  } catch (error) {
    res.status(500).json({ status: "error", message: error.message });
  }
};
