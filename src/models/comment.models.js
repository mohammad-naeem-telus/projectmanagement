import mongoose from "mongoose";

const commentSchema = new mongoose.Schema(
  {
    content: {
      type: String,
      required: [true, "Comment content is required"],
      trim: true,
      minlength: [1, "Comment cannot be empty"],
      maxlength: [2000, "Comment cannot exceed 2000 characters"]
    },
    author: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: [true, "Comment author is required"],
      index: true
    },
    // Polymorphic reference — comment can belong to a Project or a Task
    entityType: {
      type: String,
      enum: {
        values: ["Project", "Task"],
        message: "{VALUE} is not a valid entity type"
      },
      required: [true, "Entity type is required"],
      index: true
    },
    entityId: {
      type: mongoose.Schema.Types.ObjectId,
      required: [true, "Entity ID is required"],
      index: true
    },
    // Optional: support threaded replies
    parentComment: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Comment",
      default: null,
      index: true
    },
    mentions: [{
      type: mongoose.Schema.Types.ObjectId,
      ref: "User"
    }],
    attachments: [{
      fileName: {
        type: String,
        required: true
      },
      fileUrl: {
        type: String,
        required: true
      },
      fileType: {
        type: String
      },
      uploadedAt: {
        type: Date,
        default: Date.now
      }
    }],
    reactions: [{
      user: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
        required: true
      },
      emoji: {
        type: String,
        required: true,
        enum: ["👍", "👎", "❤️", "🎉", "😄", "😕", "🚀", "👀"],
        trim: true
      },
      reactedAt: {
        type: Date,
        default: Date.now
      }
    }],
    isEdited: {
      type: Boolean,
      default: false
    },
    editedAt: {
      type: Date
    },
    isActive: {
      type: Boolean,
      default: true,
      index: true
    }
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true }
  }
);

// Compound indexes for efficient querying
commentSchema.index({ entityType: 1, entityId: 1, createdAt: -1 });
commentSchema.index({ author: 1, createdAt: -1 });
commentSchema.index({ parentComment: 1 });
commentSchema.index({ content: "text" });

// Virtual for reply count (requires population or aggregation)
commentSchema.virtual("isReply").get(function () {
  return this.parentComment !== null;
});

// Virtual for total reactions count
commentSchema.virtual("reactionCount").get(function () {
  return this.reactions ? this.reactions.length : 0;
});

// Pre-save middleware to track edits
commentSchema.pre("save", function (next) {
  if (!this.isNew && this.isModified("content")) {
    this.isEdited = true;
    this.editedAt = new Date();
  }
  next();
});

// Instance method to add a reaction
commentSchema.methods.addReaction = function (userId, emoji) {
  // Remove existing reaction from this user first (one reaction per user)
  this.reactions = this.reactions.filter(
    (r) => r.user.toString() !== userId.toString()
  );
  this.reactions.push({ user: userId, emoji, reactedAt: new Date() });
  return this.save();
};

// Instance method to remove a reaction
commentSchema.methods.removeReaction = function (userId) {
  this.reactions = this.reactions.filter(
    (r) => r.user.toString() !== userId.toString()
  );
  return this.save();
};

// Instance method to soft delete a comment
commentSchema.methods.softDelete = function () {
  this.isActive = false;
  return this.save();
};

// Static method to find comments for a specific entity (project or task)
commentSchema.statics.findByEntity = function (entityType, entityId) {
  return this.find({ entityType, entityId, isActive: true, parentComment: null })
    .sort({ createdAt: 1 })
    .populate("author", "username email")
    .populate("mentions", "username email");
};

// Static method to find replies to a comment
commentSchema.statics.findReplies = function (parentCommentId) {
  return this.find({ parentComment: parentCommentId, isActive: true })
    .sort({ createdAt: 1 })
    .populate("author", "username email")
    .populate("mentions", "username email");
};

// Static method to find comments by author
commentSchema.statics.findByAuthor = function (userId) {
  return this.find({ author: userId, isActive: true }).sort({ createdAt: -1 });
};

// Static method to get comment statistics for an entity
commentSchema.statics.getEntityStatistics = async function (entityType, entityId) {
  const stats = await this.aggregate([
    {
      $match: {
        entityType,
        entityId: new mongoose.Types.ObjectId(entityId),
        isActive: true
      }
    },
    {
      $group: {
        _id: null,
        totalComments: { $sum: 1 },
        totalReplies: {
          $sum: {
            $cond: [{ $ne: ["$parentComment", null] }, 1, 0]
          }
        },
        uniqueAuthors: { $addToSet: "$author" }
      }
    },
    {
      $project: {
        _id: 0,
        totalComments: 1,
        totalReplies: 1,
        uniqueAuthorCount: { $size: "$uniqueAuthors" }
      }
    }
  ]);
  return stats[0] || { totalComments: 0, totalReplies: 0, uniqueAuthorCount: 0 };
};

const Comment = mongoose.model("Comment", commentSchema);

export default Comment;
