import User from "../models/User.js";
import { asyncHandler, AppError, successResponse } from "../utils/helpers.js";

// @desc    Register a new user
// @route   POST /api/auth/register
// @access  Public
export const register = asyncHandler(async (req, res, next) => {
  const { username, email, password, fullName, bio } = req.body;

  // Check if user exists
  const userExists = await User.findOne({ $or: [{ email }, { username }] });
  if (userExists) {
    throw new AppError("User already exists with this email or username", 400);
  }

  // Create user
  const user = await User.create({
    username,
    email,
    password,
    fullName,
    bio,
  });

  // Generate token
  const token = user.generateToken();

  successResponse(
    res,
    201,
    {
      user: {
        id: user._id,
        username: user.username,
        email: user.email,
        fullName: user.fullName,
        bio: user.bio,
        profilePicture: user.profilePicture,
      },
      token,
    },
    "User registered successfully"
  );
});

// @desc    Login user
// @route   POST /api/auth/login
// @access  Public
export const login = asyncHandler(async (req, res, next) => {
  const { email, password } = req.body;

  // Validate input
  if (!email || !password) {
    throw new AppError("Please provide email and password", 400);
  }

  // Find user and include password
  const user = await User.findOne({ email }).select("+password");

  if (!user || !(await user.comparePassword(password))) {
    throw new AppError("Invalid credentials", 401);
  }

  // Generate token
  const token = user.generateToken();

  successResponse(
    res,
    200,
    {
      user: {
        id: user._id,
        username: user.username,
        email: user.email,
        fullName: user.fullName,
        bio: user.bio,
        profilePicture: user.profilePicture,
      },
      token,
    },
    "Login successful"
  );
});

// @desc    Get current user profile
// @route   GET /api/auth/me
// @access  Private
export const getMe = asyncHandler(async (req, res, next) => {
  const user = await User.findById(req.user.id)
    .populate("posts")
    .select("-password");

  successResponse(res, 200, { user }, "User profile retrieved");
});

// @desc    Update user profile
// @route   PUT /api/users/:id
// @access  Private
export const updateProfile = asyncHandler(async (req, res, next) => {
  const { fullName, bio, username } = req.body;

  // Check if user is updating their own profile
  if (req.params.id !== req.user.id.toString()) {
    throw new AppError("You can only update your own profile", 403);
  }

  const user = await User.findById(req.params.id);

  if (!user) {
    throw new AppError("User not found", 404);
  }

  // Update fields
  if (fullName) user.fullName = fullName;
  if (bio) user.bio = bio;
  if (username) user.username = username;

  await user.save();

  successResponse(res, 200, { user }, "Profile updated successfully");
});

// @desc    Get user profile by ID
// @route   GET /api/users/:id
// @access  Public
export const getUserProfile = asyncHandler(async (req, res, next) => {
  const user = await User.findById(req.params.id)
    .populate("posts")
    .select("-password");

  if (!user) {
    throw new AppError("User not found", 404);
  }

  successResponse(
    res,
    200,
    {
      user: {
        id: user._id,
        username: user.username,
        fullName: user.fullName,
        bio: user.bio,
        profilePicture: user.profilePicture,
        followersCount: user.followers.length,
        followingCount: user.following.length,
        postsCount: user.posts.length,
      },
    },
    "User profile retrieved"
  );
});

// @desc    Follow a user
// @route   POST /api/users/:id/follow
// @access  Private
export const followUser = asyncHandler(async (req, res, next) => {
  const userToFollow = await User.findById(req.params.id);
  const currentUser = await User.findById(req.user.id);

  if (!userToFollow) {
    throw new AppError("User not found", 404);
  }

  // Can't follow yourself
  if (req.params.id === req.user.id.toString()) {
    throw new AppError("You cannot follow yourself", 400);
  }

  // Check if already following
  if (currentUser.following.includes(req.params.id)) {
    throw new AppError("You are already following this user", 400);
  }

  // Add to following and followers
  currentUser.following.push(req.params.id);
  userToFollow.followers.push(req.user.id);

  await currentUser.save();
  await userToFollow.save();

  successResponse(res, 200, {}, "User followed successfully");
});

// @desc    Unfollow a user
// @route   DELETE /api/users/:id/follow
// @access  Private
export const unfollowUser = asyncHandler(async (req, res, next) => {
  const userToUnfollow = await User.findById(req.params.id);
  const currentUser = await User.findById(req.user.id);

  if (!userToUnfollow) {
    throw new AppError("User not found", 404);
  }

  // Check if following
  if (!currentUser.following.includes(req.params.id)) {
    throw new AppError("You are not following this user", 400);
  }

  // Remove from following and followers
  currentUser.following = currentUser.following.filter(
    (id) => id.toString() !== req.params.id
  );
  userToUnfollow.followers = userToUnfollow.followers.filter(
    (id) => id.toString() !== req.user.id.toString()
  );

  await currentUser.save();
  await userToUnfollow.save();

  successResponse(res, 200, {}, "User unfollowed successfully");
});

// @desc    Get user followers
// @route   GET /api/users/:id/followers
// @access  Public
export const getFollowers = asyncHandler(async (req, res, next) => {
  const user = await User.findById(req.params.id).populate(
    "followers",
    "username fullName profilePicture"
  );

  if (!user) {
    throw new AppError("User not found", 404);
  }

  successResponse(
    res,
    200,
    { followers: user.followers },
    "Followers retrieved"
  );
});

// @desc    Get user following
// @route   GET /api/users/:id/following
// @access  Public
export const getFollowing = asyncHandler(async (req, res, next) => {
  const user = await User.findById(req.params.id).populate(
    "following",
    "username fullName profilePicture"
  );

  if (!user) {
    throw new AppError("User not found", 404);
  }

  successResponse(
    res,
    200,
    { following: user.following },
    "Following retrieved"
  );
});
