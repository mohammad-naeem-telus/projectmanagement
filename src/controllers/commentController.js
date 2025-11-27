import Comment from "../models/Comment.js";
import Post from "../models/Post.js";
import { asyncHandler, AppError, successResponse } from "../utils/helpers.js";

// @desc    Add a comment to a post
// @route   POST /api/posts/:postId/comments
// @access  Private
export const addComment = asyncHandler(async (req, res, next) => {
  const { text } = req.body;

  if (!text) {
    throw new AppError("Comment text is required", 400);
  }

  const post = await Post.findById(req.params.postId);

  if (!post) {
    throw new AppError("Post not found", 404);
  }

  // Create comment
  const comment = await Comment.create({
    user: req.user.id,
    post: req.params.postId,
    text,
  });

  // Add comment to post's comments array
  post.comments.push(comment._id);
  await post.save();

  const populatedComment = await Comment.findById(comment._id).populate(
    "user",
    "username profilePicture"
  );

  successResponse(
    res,
    201,
    { comment: populatedComment },
    "Comment added successfully"
  );
});

// @desc    Get comments for a post
// @route   GET /api/posts/:postId/comments
// @access  Public
export const getComments = asyncHandler(async (req, res, next) => {
  const comments = await Comment.find({ post: req.params.postId })
    .populate("user", "username profilePicture")
    .sort({ createdAt: -1 });

  successResponse(
    res,
    200,
    { comments, count: comments.length },
    "Comments retrieved successfully"
  );
});

// @desc    Delete a comment
// @route   DELETE /api/comments/:id
// @access  Private
export const deleteComment = asyncHandler(async (req, res, next) => {
  const comment = await Comment.findById(req.params.id);

  if (!comment) {
    throw new AppError("Comment not found", 404);
  }

  // Check if user owns the comment
  if (comment.user.toString() !== req.user.id.toString()) {
    throw new AppError("You can only delete your own comments", 403);
  }

  // Remove comment from post's comments array
  await Post.findByIdAndUpdate(comment.post, {
    $pull: { comments: comment._id },
  });

  await comment.deleteOne();

  successResponse(res, 200, {}, "Comment deleted successfully");
});
