import mongoose from "mongoose";

const timelogSchema = new mongoose.Schema(
  {
    task: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Task",
      required: [true, "TimeLog must be associated with a task"],
      index: true
    },
    project: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Project",
      required: [true, "TimeLog must be associated with a project"],
      index: true
    },
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: [true, "TimeLog must have a user"],
      index: true
    },
    description: {
      type: String,
      trim: true,
      maxlength: [500, "Description cannot exceed 500 characters"]
    },
    startTime: {
      type: Date,
      required: [true, "Start time is required"]
    },
    endTime: {
      type: Date,
      validate: {
        validator: function (value) {
          if (value && this.startTime) {
            return value > this.startTime;
          }
          return true;
        },
        message: "End time must be after start time"
      }
    },
    // Duration in minutes — auto-calculated if startTime & endTime are provided
    duration: {
      type: Number,
      min: [1, "Duration must be at least 1 minute"],
      validate: {
        validator: Number.isFinite,
        message: "Duration must be a valid number"
      }
    },
    // Whether the timer is currently running (no endTime yet)
    isRunning: {
      type: Boolean,
      default: false,
      index: true
    },
    logType: {
      type: String,
      enum: {
        values: ["manual", "timer"],
        message: "{VALUE} is not a valid log type"
      },
      default: "manual"
    },
    billable: {
      type: Boolean,
      default: false,
      index: true
    },
    tags: [
      {
        type: String,
        trim: true,
        lowercase: true
      }
    ],
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
timelogSchema.index({ task: 1, user: 1, createdAt: -1 });
timelogSchema.index({ project: 1, user: 1, createdAt: -1 });
timelogSchema.index({ user: 1, startTime: -1 });
timelogSchema.index({ project: 1, billable: 1 });
timelogSchema.index({ startTime: 1, endTime: 1 });

// Virtual for duration in hours (rounded to 2 decimal places)
timelogSchema.virtual("durationInHours").get(function () {
  if (this.duration) {
    return parseFloat((this.duration / 60).toFixed(2));
  }
  return null;
});

// Virtual for formatted duration (e.g., "2h 30m")
timelogSchema.virtual("formattedDuration").get(function () {
  if (!this.duration) return null;
  const hours = Math.floor(this.duration / 60);
  const minutes = this.duration % 60;
  if (hours === 0) return `${minutes}m`;
  if (minutes === 0) return `${hours}h`;
  return `${hours}h ${minutes}m`;
});

// Virtual to check if the log is currently active (timer running)
timelogSchema.virtual("elapsedMinutes").get(function () {
  if (this.isRunning && this.startTime) {
    const diffMs = new Date() - this.startTime;
    return Math.floor(diffMs / (1000 * 60));
  }
  return null;
});

// Pre-save middleware — auto-calculate duration from startTime & endTime
timelogSchema.pre("save", function (next) {
  if (this.startTime && this.endTime) {
    const diffMs = this.endTime - this.startTime;
    this.duration = Math.round(diffMs / (1000 * 60)); // convert ms to minutes
    this.isRunning = false;
  }
  next();
});

// Instance method to stop the timer
timelogSchema.methods.stopTimer = function () {
  if (!this.isRunning) {
    return Promise.reject(new Error("Timer is not running"));
  }
  this.endTime = new Date();
  // duration will be auto-calculated by pre-save middleware
  return this.save();
};

// Instance method to soft delete
timelogSchema.methods.softDelete = function () {
  this.isActive = false;
  return this.save();
};

// Static method to start a timer for a user on a task
timelogSchema.statics.startTimer = function ({ taskId, projectId, userId, description, billable = false, tags = [] }) {
  return this.create({
    task: taskId,
    project: projectId,
    user: userId,
    description,
    startTime: new Date(),
    isRunning: true,
    logType: "timer",
    billable,
    tags
  });
};

// Static method to find the currently running timer for a user
timelogSchema.statics.findRunningTimer = function (userId) {
  return this.findOne({ user: userId, isRunning: true, isActive: true })
    .populate("task", "title status")
    .populate("project", "name status");
};

// Static method to find all time logs for a task
timelogSchema.statics.findByTask = function (taskId) {
  return this.find({ task: taskId, isActive: true })
    .sort({ startTime: -1 })
    .populate("user", "username email");
};

// Static method to find all time logs for a project
timelogSchema.statics.findByProject = function (projectId) {
  return this.find({ project: projectId, isActive: true })
    .sort({ startTime: -1 })
    .populate("user", "username email")
    .populate("task", "title status");
};

// Static method to find all time logs for a user
timelogSchema.statics.findByUser = function (userId, page = 1, limit = 20) {
  const skip = (page - 1) * limit;
  return this.find({ user: userId, isActive: true })
    .sort({ startTime: -1 })
    .skip(skip)
    .limit(limit)
    .populate("task", "title status")
    .populate("project", "name status");
};

// Static method to get total hours logged for a task
timelogSchema.statics.getTotalHoursForTask = async function (taskId) {
  const result = await this.aggregate([
    {
      $match: {
        task: new mongoose.Types.ObjectId(taskId),
        isActive: true,
        isRunning: false
      }
    },
    {
      $group: {
        _id: null,
        totalMinutes: { $sum: "$duration" },
        totalLogs: { $sum: 1 }
      }
    },
    {
      $project: {
        _id: 0,
        totalMinutes: 1,
        totalHours: { $round: [{ $divide: ["$totalMinutes", 60] }, 2] },
        totalLogs: 1
      }
    }
  ]);
  return result[0] || { totalMinutes: 0, totalHours: 0, totalLogs: 0 };
};

// Static method to get time log statistics for a project
timelogSchema.statics.getProjectStatistics = async function (projectId) {
  const stats = await this.aggregate([
    {
      $match: {
        project: new mongoose.Types.ObjectId(projectId),
        isActive: true,
        isRunning: false
      }
    },
    {
      $group: {
        _id: "$user",
        totalMinutes: { $sum: "$duration" },
        totalLogs: { $sum: 1 },
        billableMinutes: {
          $sum: { $cond: ["$billable", "$duration", 0] }
        }
      }
    },
    {
      $project: {
        _id: 0,
        user: "$_id",
        totalMinutes: 1,
        totalHours: { $round: [{ $divide: ["$totalMinutes", 60] }, 2] },
        billableHours: { $round: [{ $divide: ["$billableMinutes", 60] }, 2] },
        totalLogs: 1
      }
    },
    { $sort: { totalMinutes: -1 } }
  ]);
  return stats;
};

// Static method to get time logs within a date range for a user
timelogSchema.statics.findByUserAndDateRange = function (userId, startDate, endDate) {
  return this.find({
    user: userId,
    startTime: { $gte: startDate, $lte: endDate },
    isActive: true,
    isRunning: false
  })
    .sort({ startTime: -1 })
    .populate("task", "title status")
    .populate("project", "name status");
};

// Static method to get daily summary for a user
timelogSchema.statics.getDailySummary = async function (userId, date) {
  const startOfDay = new Date(date);
  startOfDay.setHours(0, 0, 0, 0);
  const endOfDay = new Date(date);
  endOfDay.setHours(23, 59, 59, 999);

  const summary = await this.aggregate([
    {
      $match: {
        user: new mongoose.Types.ObjectId(userId),
        startTime: { $gte: startOfDay, $lte: endOfDay },
        isActive: true,
        isRunning: false
      }
    },
    {
      $group: {
        _id: "$project",
        totalMinutes: { $sum: "$duration" },
        totalLogs: { $sum: 1 }
      }
    },
    {
      $project: {
        _id: 0,
        project: "$_id",
        totalMinutes: 1,
        totalHours: { $round: [{ $divide: ["$totalMinutes", 60] }, 2] },
        totalLogs: 1
      }
    }
  ]);
  return summary;
};

const TimeLog = mongoose.model("TimeLog", timelogSchema);

export default TimeLog;
