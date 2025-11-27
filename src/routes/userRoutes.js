import express from "express";
import {
  register,
  login,
  getMe,
  updateProfile,
  getUserProfile,
  followUser,
  unfollowUser,
  getFollowers,
  getFollowing,
} from "../controllers/userController.js";
import { protect } from "../middleware/auth.js";

const router = express.Router();

// Auth routes
router.post("/register", register);
router.post("/login", login);
router.get("/me", protect, getMe);

// User profile routes
router.route("/:id").get(getUserProfile).put(protect, updateProfile);

// Follow routes
router
  .route("/:id/follow")
  .post(protect, followUser)
  .delete(protect, unfollowUser);

// Followers/Following routes
router.get("/:id/followers", getFollowers);
router.get("/:id/following", getFollowing);

export default router;
