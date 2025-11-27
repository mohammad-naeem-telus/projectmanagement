import Post from "../models/Post.js";
import User from "../models/User.js";
import Comment from "../models/Comment.js";
import { asyncHandler, AppError, successResponse } from "../utils/helpers.js";
import {
  uploadToCloudinary,
  deleteFromCloudinary,
} from "../utils/cloudinaryHelper.js";

// @desc    Create a new post
// @route   POST /api/posts
// @access  Private
export const createPost = asyncHandler(async (req, res, next) => {
  const { imageUrl, caption } = req.body;

  if (!imageUrl) {
    throw new AppError("Image is required", 400);
  }

  // If using base64 image, upload to Cloudinary
  let uploadedImage = { url: imageUrl, publicId: null };
  if (imageUrl.startsWith("data:image")) {
    uploadedImage = await uploadToCloudinary(imageUrl, "instagram-posts");
  }

  // Create post
  const post = await Post.create({
    user: req.user.id,
    imageUrl: uploadedImage.url,
    imagePublicId: uploadedImage.publicId,
    caption,
  });

  // Add post to user's posts array
  await User.findByIdAndUpdate(req.user.id, {
    $push: { posts: post._id },
  });

  const populatedPost = await Post.findById(post._id).populate(
    "user",
    "username fullName profilePicture"
  );

  successResponse(
    res,
    201,
    { post: populatedPost },
    "Post created successfully"
  );
});

// @desc    Get feed (posts from following users)
// @route   GET /api/posts/feed
// @access  Private
export const getFeed = asyncHandler(async (req, res, next) => {
  const currentUser = await User.findById(req.user.id);

  // Get posts from users that current user follows + own posts
  const posts = await Post.find({
    user: { $in: [...currentUser.following, req.user.id] },
  })
    .populate("user", "username fullName profilePicture")
    .populate({
      path: "comments",
      populate: { path: "user", select: "username profilePicture" },
      options: { limit: 2, sort: { createdAt: -1 } },
    })
    .sort({ createdAt: -1 })
    .limit(50);

  successResponse(res, 200, { posts }, "Feed retrieved successfully");
});

// @desc    Get all posts (explore page)
// @route   GET /api/posts
// @access  Public
export const getAllPosts = asyncHandler(async (req, res, next) => {
  const posts = await Post.find()
    .populate("user", "username fullName profilePicture")
    .sort({ createdAt: -1 })
    .limit(100);

  successResponse(res, 200, { posts }, "Posts retrieved successfully");
});

// @desc    Get a single post
// @route   GET /api/posts/:id
// @access  Public
export const getPost = asyncHandler(async (req, res, next) => {
  const post = await Post.findById(req.params.id)
    .populate("user", "username fullName profilePicture")
    .populate({
      path: "comments",
      populate: { path: "user", select: "username profilePicture" },
      options: { sort: { createdAt: -1 } },
    });

  if (!post) {
    throw new AppError("Post not found", 404);
  }

  successResponse(res, 200, { post }, "Post retrieved successfully");
});

// @desc    Get user's posts
// @route   GET /api/users/:userId/posts
// @access  Public
export const getUserPosts = asyncHandler(async (req, res, next) => {
  const posts = await Post.find({ user: req.params.userId })
    .populate("user", "username fullName profilePicture")
    .sort({ createdAt: -1 });

  successResponse(res, 200, { posts }, "User posts retrieved successfully");
});

// @desc    Delete a post
// @route   DELETE /api/posts/:id
// @access  Private
export const deletePost = asyncHandler(async (req, res, next) => {
  const post = await Post.findById(req.params.id);

  if (!post) {
    throw new AppError("Post not found", 404);
  }

  // Check if user owns the post
  if (post.user.toString() !== req.user.id.toString()) {
    throw new AppError("You can only delete your own posts", 403);
  }

  // Delete image from Cloudinary if exists
  if (post.imagePublicId) {
    await deleteFromCloudinary(post.imagePublicId);
  }

  // Delete all comments associated with the post
  await Comment.deleteMany({ post: post._id });

  // Remove post from user's posts array
  await User.findByIdAndUpdate(req.user.id, {
    $pull: { posts: post._id },
  });

  await post.deleteOne();

  successResponse(res, 200, {}, "Post deleted successfully");
});

// @desc    Like a post
// @route   POST /api/posts/:id/like
// @access  Private
export const likePost = asyncHandler(async (req, res, next) => {
  const post = await Post.findById(req.params.id);

  if (!post) {
    throw new AppError("Post not found", 404);
  }

  // Check if already liked
  if (post.likes.includes(req.user.id)) {
    throw new AppError("Post already liked", 400);
  }

  post.likes.push(req.user.id);
  await post.save();

  successResponse(
    res,
    200,
    { likesCount: post.likes.length },
    "Post liked successfully"
  );
});

// @desc    Unlike a post
// @route   DELETE /api/posts/:id/like
// @access  Private
export const unlikePost = asyncHandler(async (req, res, next) => {
  const post = await Post.findById(req.params.id);

  if (!post) {
    throw new AppError("Post not found", 404);
  }

  // Check if not liked
  if (!post.likes.includes(req.user.id)) {
    throw new AppError("Post not liked yet", 400);
  }

  post.likes = post.likes.filter(
    (id) => id.toString() !== req.user.id.toString()
  );
  await post.save();

  successResponse(
    res,
    200,
    { likesCount: post.likes.length },
    "Post unliked successfully"
  );
});

// @desc    Get post likes
// @route   GET /api/posts/:id/likes
// @access  Public
export const getPostLikes = asyncHandler(async (req, res, next) => {
  const post = await Post.findById(req.params.id).populate(
    "likes",
    "username fullName profilePicture"
  );

  if (!post) {
    throw new AppError("Post not found", 404);
  }

  successResponse(
    res,
    200,
    { likes: post.likes },
    "Likes retrieved successfully"
  );
});
