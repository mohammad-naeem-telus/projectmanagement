import mongoose from "mongoose";

const taskSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: [true, "Task title is required"],
      trim: true,
      minlength: [3, "Task title must be at least 3 characters long"],
      maxlength: [200, "Task title cannot exceed 200 characters"]
    },
    description: {
      type: String,
      trim: true,
      maxlength: [2000, "Description cannot exceed 2000 characters"]
    },
    status: {
      type: String,
      enum: {
        values: ["todo", "in-progress", "review", "completed", "blocked"],
        message: "{VALUE} is not a valid status"
      },
      default: "todo",
      index: true
    },
    priority: {
      type: String,
      enum: {
        values: ["low", "medium", "high", "critical"],
        message: "{VALUE} is not a valid priority level"
      },
      default: "medium",
      index: true
    },
    project: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Project",
      required: [true, "Task must belong to a project"],
      index: true
    },
    assignedTo: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      index: true
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: [true, "Task creator is required"],
      index: true
    },
    dueDate: {
      type: Date,
      validate: {
        validator: function(value) {
          // Due date should be in the future or today
          if (value && this.isNew) {
            const today = new Date();
            today.setHours(0, 0, 0, 0);
            return value >= today;
          }
          return true;
        },
        message: "Due date cannot be in the past"
      }
    },
    estimatedHours: {
      type: Number,
      min: [0, "Estimated hours cannot be negative"],
      validate: {
        validator: Number.isFinite,
        message: "Estimated hours must be a valid number"
      }
    },
    actualHours: {
      type: Number,
      default: 0,
      min: [0, "Actual hours cannot be negative"]
    },
    tags: [{
      type: String,
      trim: true,
      lowercase: true
    }],
    dependencies: [{
      type: mongoose.Schema.Types.ObjectId,
      ref: "Task"
    }],
    subtasks: [{
      title: {
        type: String,
        required: true,
        trim: true
      },
      completed: {
        type: Boolean,
        default: false
      },
      completedAt: {
        type: Date
      }
    }],
    comments: [{
      user: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
        required: true
      },
      text: {
        type: String,
        required: true,
        trim: true,
        maxlength: [1000, "Comment cannot exceed 1000 characters"]
      },
      createdAt: {
        type: Date,
        default: Date.now
      }
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
      uploadedBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User"
      },
      uploadedAt: {
        type: Date,
        default: Date.now
      }
    }],
    completedAt: {
      type: Date
    },
    blockedReason: {
      type: String,
      trim: true,
      maxlength: [500, "Blocked reason cannot exceed 500 characters"]
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

// Indexes for better query performance
taskSchema.index({ project: 1, status: 1 });
taskSchema.index({ assignedTo: 1, status: 1 });
taskSchema.index({ status: 1, priority: 1 });
taskSchema.index({ dueDate: 1 });
taskSchema.index({ createdAt: -1 });
taskSchema.index({ title: "text", description: "text" });

// Virtual for checking if task is overdue
taskSchema.virtual("isOverdue").get(function() {
  if (this.dueDate && this.status !== "completed") {
    return new Date() > this.dueDate;
  }
  return false;
});

// Virtual for time variance
taskSchema.virtual("timeVariance").get(function() {
  if (this.estimatedHours && this.actualHours) {
    return this.estimatedHours - this.actualHours;
  }
  return null;
});

// Virtual for subtask completion percentage
taskSchema.virtual("subtaskCompletionPercentage").get(function() {
  if (this.subtasks && this.subtasks.length > 0) {
    const completedSubtasks = this.subtasks.filter(st => st.completed).length;
    return ((completedSubtasks / this.subtasks.length) * 100).toFixed(2);
  }
  return 0;
});

// Virtual for days until due
taskSchema.virtual("daysUntilDue").get(function() {
  if (this.dueDate) {
    const today = new Date();
    const diffTime = this.dueDate - today;
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return diffDays;
  }
  return null;
});

// Pre-save middleware
taskSchema.pre("save", function(next) {
  // Set completedAt when status changes to completed
  if (this.isModified("status") && this.status === "completed" && !this.completedAt) {
    this.completedAt = new Date();
  }
  
  // Mark subtasks as completed when completedAt is set
  if (this.isModified("subtasks")) {
    this.subtasks.forEach(subtask => {
      if (subtask.completed && !subtask.completedAt) {
        subtask.completedAt = new Date();
      }
    });
  }
  
  next();
});

// Instance method to add subtask
taskSchema.methods.addSubtask = function(title) {
  this.subtasks.push({ title, completed: false });
  return this.save();
};

// Instance method to complete subtask
taskSchema.methods.completeSubtask = function(subtaskId) {
  const subtask = this.subtasks.id(subtaskId);
  if (subtask) {
    subtask.completed = true;
    subtask.completedAt = new Date();
  }
  return this.save();
};

// Instance method to add comment
taskSchema.methods.addComment = function(userId, text) {
  this.comments.push({ user: userId, text, createdAt: new Date() });
  return this.save();
};

// Instance method to assign task
taskSchema.methods.assignTo = function(userId) {
  this.assignedTo = userId;
  return this.save();
};

// Instance method to block task
taskSchema.methods.blockTask = function(reason) {
  this.status = "blocked";
  this.blockedReason = reason;
  return this.save();
};

// Instance method to unblock task
taskSchema.methods.unblockTask = function() {
  this.status = "todo";
  this.blockedReason = undefined;
  return this.save();
};

// Static method to find tasks by project
taskSchema.statics.findByProject = function(projectId) {
  return this.find({ project: projectId, isActive: true });
};

// Static method to find tasks by assignee
taskSchema.statics.findByAssignee = function(userId) {
  return this.find({ assignedTo: userId, isActive: true });
};

// Static method to find tasks by status
taskSchema.statics.findByStatus = function(status) {
  return this.find({ status, isActive: true });
};

// Static method to find overdue tasks
taskSchema.statics.findOverdue = function() {
  return this.find({
    dueDate: { $lt: new Date() },
    status: { $ne: "completed" },
    isActive: true
  });
};

// Static method to find tasks due soon (within next 7 days)
taskSchema.statics.findDueSoon = function(days = 7) {
  const today = new Date();
  const futureDate = new Date();
  futureDate.setDate(today.getDate() + days);
  
  return this.find({
    dueDate: { $gte: today, $lte: futureDate },
    status: { $ne: "completed" },
    isActive: true
  });
};

// Static method to get task statistics by project
taskSchema.statics.getProjectStatistics = async function(projectId) {
  const stats = await this.aggregate([
    { $match: { project: mongoose.Types.ObjectId(projectId), isActive: true } },
    {
      $group: {
        _id: "$status",
        count: { $sum: 1 },
        totalEstimatedHours: { $sum: "$estimatedHours" },
        totalActualHours: { $sum: "$actualHours" }
      }
    }
  ]);
  return stats;
};

// Static method to get task statistics by assignee
taskSchema.statics.getAssigneeStatistics = async function(userId) {
  const stats = await this.aggregate([
    { $match: { assignedTo: mongoose.Types.ObjectId(userId), isActive: true } },
    {
      $group: {
        _id: "$status",
        count: { $sum: 1 },
        totalEstimatedHours: { $sum: "$estimatedHours" },
        totalActualHours: { $sum: "$actualHours" }
      }
    }
  ]);
  return stats;
};

const Task = mongoose.model("Task", taskSchema);

export default Task;
