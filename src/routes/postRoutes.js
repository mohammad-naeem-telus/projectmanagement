import express from "express";
import {
  createPost,
  getFeed,
  getAllPosts,
  getPost,
  getUserPosts,
  deletePost,
  likePost,
  unlikePost,
  getPostLikes,
} from "../controllers/postController.js";
import { protect } from "../middleware/auth.js";

const router = express.Router();

// Post routes
router.route("/").get(getAllPosts).post(protect, createPost);

router.get("/feed", protect, getFeed);

router.route("/:id").get(getPost).delete(protect, deletePost);

// Like routes
router.route("/:id/like").post(protect, likePost).delete(protect, unlikePost);

router.get("/:id/likes", getPostLikes);

export default router;
