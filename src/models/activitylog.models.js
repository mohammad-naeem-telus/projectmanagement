import mongoose from "mongoose";

const activityLogSchema = new mongoose.Schema(
  {
    // The user who performed the action
    performedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: [true, "Activity must have a performer"],
      index: true
    },
    // The action that was performed
    action: {
      type: String,
      required: [true, "Action is required"],
      enum: {
        values: [
          // Project actions
          "project.created",
          "project.updated",
          "project.deleted",
          "project.status_changed",
          "project.member_added",
          "project.member_removed",
          "project.milestone_added",
          "project.milestone_completed",
          // Task actions
          "task.created",
          "task.updated",
          "task.deleted",
          "task.status_changed",
          "task.assigned",
          "task.unassigned",
          "task.subtask_added",
          "task.subtask_completed",
          "task.blocked",
          "task.unblocked",
          "task.comment_added",
          // Comment actions
          "comment.created",
          "comment.updated",
          "comment.deleted",
          // TimeLog actions
          "timelog.created",
          "timelog.updated",
          "timelog.deleted",
          "timelog.timer_started",
          "timelog.timer_stopped",
          // User actions
          "user.registered",
          "user.updated",
          "user.password_changed",
          "user.login",
          "user.logout",
          // Notification actions
          "notification.sent",
          "notification.read"
        ],
        message: "{VALUE} is not a valid action"
      },
      index: true
    },
    // The entity type that was affected
    entityType: {
      type: String,
      required: [true, "Entity type is required"],
      enum: {
        values: ["Project", "Task", "Comment", "TimeLog", "User", "Notification"],
        message: "{VALUE} is not a valid entity type"
      },
      index: true
    },
    // The ID of the affected entity
    entityId: {
      type: mongoose.Schema.Types.ObjectId,
      required: [true, "Entity ID is required"],
      index: true
    },
    // Optional: the project this activity belongs to (for project-scoped queries)
    project: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Project",
      index: true
    },
    // Human-readable description of the activity
    description: {
      type: String,
      required: [true, "Activity description is required"],
      trim: true,
      maxlength: [500, "Description cannot exceed 500 characters"]
    },
    // Snapshot of changes: what changed (before/after)
    changes: {
      before: {
        type: mongoose.Schema.Types.Mixed,
        default: null
      },
      after: {
        type: mongoose.Schema.Types.Mixed,
        default: null
      }
    },
    // Fields that were modified (for update actions)
    modifiedFields: [
      {
        type: String,
        trim: true
      }
    ],
    // IP address of the request (for security auditing)
    ipAddress: {
      type: String,
      trim: true,
      validate: {
        validator: function (value) {
          if (!value) return true;
          // Basic IPv4 and IPv6 validation
          const ipv4 = /^(\d{1,3}\.){3}\d{1,3}$/;
          const ipv6 = /^([0-9a-fA-F]{1,4}:){7}[0-9a-fA-F]{1,4}$/;
          return ipv4.test(value) || ipv6.test(value) || value === "::1" || value === "localhost";
        },
        message: "Invalid IP address format"
      }
    },
    // User agent / device info
    userAgent: {
      type: String,
      trim: true,
      maxlength: [500, "User agent cannot exceed 500 characters"]
    },
    // Severity level of the activity
    severity: {
      type: String,
      enum: {
        values: ["info", "warning", "critical"],
        message: "{VALUE} is not a valid severity level"
      },
      default: "info",
      index: true
    },
    // Additional metadata (flexible key-value store)
    metadata: {
      type: mongoose.Schema.Types.Mixed,
      default: {}
    },
    // Soft delete flag
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
activityLogSchema.index({ performedBy: 1, createdAt: -1 });
activityLogSchema.index({ entityType: 1, entityId: 1, createdAt: -1 });
activityLogSchema.index({ project: 1, createdAt: -1 });
activityLogSchema.index({ action: 1, createdAt: -1 });
activityLogSchema.index({ severity: 1, createdAt: -1 });
activityLogSchema.index({ createdAt: -1 }); // for global timeline queries

// Virtual for a short summary of the activity
activityLogSchema.virtual("summary").get(function () {
  return `[${this.severity.toUpperCase()}] ${this.action} on ${this.entityType} by user ${this.performedBy}`;
});

// Virtual for time elapsed since the activity
activityLogSchema.virtual("timeAgo").get(function () {
  const now = new Date();
  const diffMs = now - this.createdAt;
  const diffSeconds = Math.floor(diffMs / 1000);
  const diffMinutes = Math.floor(diffSeconds / 60);
  const diffHours = Math.floor(diffMinutes / 60);
  const diffDays = Math.floor(diffHours / 24);

  if (diffDays > 0) return `${diffDays}d ago`;
  if (diffHours > 0) return `${diffHours}h ago`;
  if (diffMinutes > 0) return `${diffMinutes}m ago`;
  return `${diffSeconds}s ago`;
});

// Static method to log an activity
activityLogSchema.statics.log = function ({
  performedBy,
  action,
  entityType,
  entityId,
  project = null,
  description,
  changes = { before: null, after: null },
  modifiedFields = [],
  ipAddress = null,
  userAgent = null,
  severity = "info",
  metadata = {}
}) {
  return this.create({
    performedBy,
    action,
    entityType,
    entityId,
    project,
    description,
    changes,
    modifiedFields,
    ipAddress,
    userAgent,
    severity,
    metadata
  });
};

// Static method to get activity feed for a project
activityLogSchema.statics.getProjectFeed = function (projectId, page = 1, limit = 20) {
  const skip = (page - 1) * limit;
  return this.find({ project: projectId, isActive: true })
    .sort({ createdAt: -1 })
    .skip(skip)
    .limit(limit)
    .populate("performedBy", "username email avatar");
};

// Static method to get activity feed for a specific entity
activityLogSchema.statics.getEntityHistory = function (entityType, entityId, page = 1, limit = 20) {
  const skip = (page - 1) * limit;
  return this.find({ entityType, entityId, isActive: true })
    .sort({ createdAt: -1 })
    .skip(skip)
    .limit(limit)
    .populate("performedBy", "username email avatar");
};

// Static method to get activity feed for a user
activityLogSchema.statics.getUserActivity = function (userId, page = 1, limit = 20) {
  const skip = (page - 1) * limit;
  return this.find({ performedBy: userId, isActive: true })
    .sort({ createdAt: -1 })
    .skip(skip)
    .limit(limit);
};

// Static method to get critical/warning activities (for security review)
activityLogSchema.statics.getAlerts = function (severity = "critical", page = 1, limit = 20) {
  const skip = (page - 1) * limit;
  return this.find({ severity, isActive: true })
    .sort({ createdAt: -1 })
    .skip(skip)
    .limit(limit)
    .populate("performedBy", "username email");
};

// Static method to get activity statistics for a project
activityLogSchema.statics.getProjectStatistics = async function (projectId) {
  const stats = await this.aggregate([
    {
      $match: {
        project: new mongoose.Types.ObjectId(projectId),
        isActive: true
      }
    },
    {
      $group: {
        _id: "$action",
        count: { $sum: 1 },
        lastOccurred: { $max: "$createdAt" }
      }
    },
    {
      $project: {
        _id: 0,
        action: "$_id",
        count: 1,
        lastOccurred: 1
      }
    },
    { $sort: { count: -1 } }
  ]);
  return stats;
};

// Static method to get activity timeline (grouped by date)
activityLogSchema.statics.getTimeline = async function (projectId, days = 7) {
  const since = new Date();
  since.setDate(since.getDate() - days);

  const timeline = await this.aggregate([
    {
      $match: {
        project: new mongoose.Types.ObjectId(projectId),
        createdAt: { $gte: since },
        isActive: true
      }
    },
    {
      $group: {
        _id: {
          $dateToString: { format: "%Y-%m-%d", date: "$createdAt" }
        },
        count: { $sum: 1 },
        actions: { $push: "$action" }
      }
    },
    {
      $project: {
        _id: 0,
        date: "$_id",
        count: 1,
        actions: 1
      }
    },
    { $sort: { date: -1 } }
  ]);
  return timeline;
};

// Static method to find activities within a date range
activityLogSchema.statics.findByDateRange = function (startDate, endDate, filters = {}) {
  return this.find({
    createdAt: { $gte: startDate, $lte: endDate },
    isActive: true,
    ...filters
  })
    .sort({ createdAt: -1 })
    .populate("performedBy", "username email");
};

// Instance method to soft delete
activityLogSchema.methods.softDelete = function () {
  this.isActive = false;
  return this.save();
};

const ActivityLog = mongoose.model("ActivityLog", activityLogSchema);

export default ActivityLog;
