import User from "../models/user.models.js";

// GET /api/v1/users
export const getAllUsers = async (_req, res) => {
  try {
    const users = await User.find().select("-password");
    res.status(200).json({
      status: "success",
      count: users.length,
      data: users,
    });
  } catch (error) {
    res.status(500).json({ status: "error", message: error.message });
  }
};

// GET /api/v1/users/:id
export const getUserById = async (req, res) => {
  try {
    const user = await User.findById(req.params.id).select("-password");
    if (!user) {
      return res
        .status(404)
        .json({ status: "error", message: "User not found" });
    }
    res.status(200).json({ status: "success", data: user });
  } catch (error) {
    res.status(500).json({ status: "error", message: error.message });
  }
};

// POST /api/v1/users
export const createUser = async (req, res) => {
  try {
    const { username, email, password, role } = req.body;
    const user = await User.create({ username, email, password, role });
    const userObj = user.toObject();
    delete userObj.password;
    res.status(201).json({ status: "success", data: userObj });
  } catch (error) {
    res.status(400).json({ status: "error", message: error.message });
  }
};

// PUT /api/v1/users/:id
export const updateUser = async (req, res) => {
  try {
    const { username, email, role, isActive } = req.body;
    const user = await User.findByIdAndUpdate(
      req.params.id,
      { username, email, role, isActive },
      { new: true, runValidators: true }
    ).select("-password");

    if (!user) {
      return res
        .status(404)
        .json({ status: "error", message: "User not found" });
    }
    res.status(200).json({ status: "success", data: user });
  } catch (error) {
    res.status(400).json({ status: "error", message: error.message });
  }
};

// DELETE /api/v1/users/:id
export const deleteUser = async (req, res) => {
  try {
    const user = await User.findByIdAndDelete(req.params.id);
    if (!user) {
      return res
        .status(404)
        .json({ status: "error", message: "User not found" });
    }
    res
      .status(200)
      .json({ status: "success", message: "User deleted successfully" });
  } catch (error) {
    res.status(500).json({ status: "error", message: error.message });
  }
};
