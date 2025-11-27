import express from "express";
import {
  addComment,
  getComments,
  deleteComment,
} from "../controllers/commentController.js";
import { protect } from "../middleware/auth.js";

const router = express.Router();

// Comment routes (postId routes)
router
  .route("/posts/:postId/comments")
  .post(protect, addComment)
  .get(getComments);

// Individual comment routes
router.delete("/:id", protect, deleteComment);

export default router;
