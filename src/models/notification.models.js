import mongoose from "mongoose";

const notificationSchema = new mongoose.Schema(
  {
    recipient: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: [true, "Notification recipient is required"],
      index: true
    },
    sender: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null // null means system-generated notification
    },
    type: {
      type: String,
      enum: {
        values: [
          "task_assigned",
          "task_completed",
          "task_overdue",
          "task_commented",
          "task_status_changed",
          "project_invitation",
          "project_updated",
          "project_completed",
          "project_deadline",
          "mention",
          "milestone_completed",
          "system"
        ],
        message: "{VALUE} is not a valid notification type"
      },
      required: [true, "Notification type is required"],
      index: true
    },
    title: {
      type: String,
      required: [true, "Notification title is required"],
      trim: true,
      maxlength: [200, "Title cannot exceed 200 characters"]
    },
    message: {
      type: String,
      required: [true, "Notification message is required"],
      trim: true,
      maxlength: [1000, "Message cannot exceed 1000 characters"]
    },
    // Polymorphic reference to the related entity
    entityType: {
      type: String,
      enum: {
        values: ["Task", "Project", "Comment", "User"],
        message: "{VALUE} is not a valid entity type"
      },
      default: null
    },
    entityId: {
      type: mongoose.Schema.Types.ObjectId,
      default: null
    },
    // Deep link / action URL for the notification
    actionUrl: {
      type: String,
      trim: true,
      maxlength: [500, "Action URL cannot exceed 500 characters"]
    },
    isRead: {
      type: Boolean,
      default: false,
      index: true
    },
    readAt: {
      type: Date,
      default: null
    },
    priority: {
      type: String,
      enum: {
        values: ["low", "medium", "high"],
        message: "{VALUE} is not a valid priority"
      },
      default: "medium"
    },
    // Optional expiry — notification auto-expires after this date
    expiresAt: {
      type: Date,
      default: null,
      index: true
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
notificationSchema.index({ recipient: 1, isRead: 1, createdAt: -1 });
notificationSchema.index({ recipient: 1, type: 1 });
notificationSchema.index({ createdAt: -1 });
notificationSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 }); // TTL index for auto-expiry

// Virtual to check if notification has expired
notificationSchema.virtual("isExpired").get(function () {
  if (this.expiresAt) {
    return new Date() > this.expiresAt;
  }
  return false;
});

// Virtual for time since notification was created
notificationSchema.virtual("timeAgo").get(function () {
  const now = new Date();
  const diffMs = now - this.createdAt;
  const diffMins = Math.floor(diffMs / (1000 * 60));
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  if (diffMins < 1) return "just now";
  if (diffMins < 60) return `${diffMins} minute${diffMins > 1 ? "s" : ""} ago`;
  if (diffHours < 24) return `${diffHours} hour${diffHours > 1 ? "s" : ""} ago`;
  return `${diffDays} day${diffDays > 1 ? "s" : ""} ago`;
});

// Instance method to mark as read
notificationSchema.methods.markAsRead = function () {
  if (!this.isRead) {
    this.isRead = true;
    this.readAt = new Date();
    return this.save();
  }
  return Promise.resolve(this);
};

// Instance method to soft delete
notificationSchema.methods.softDelete = function () {
  this.isActive = false;
  return this.save();
};

// Static method to find unread notifications for a user
notificationSchema.statics.findUnread = function (userId) {
  return this.find({ recipient: userId, isRead: false, isActive: true })
    .sort({ createdAt: -1 })
    .populate("sender", "username email");
};

// Static method to find all notifications for a user (paginated)
notificationSchema.statics.findForUser = function (userId, page = 1, limit = 20) {
  const skip = (page - 1) * limit;
  return this.find({ recipient: userId, isActive: true })
    .sort({ createdAt: -1 })
    .skip(skip)
    .limit(limit)
    .populate("sender", "username email");
};

// Static method to mark all notifications as read for a user
notificationSchema.statics.markAllAsRead = function (userId) {
  return this.updateMany(
    { recipient: userId, isRead: false, isActive: true },
    { $set: { isRead: true, readAt: new Date() } }
  );
};

// Static method to get unread count for a user
notificationSchema.statics.getUnreadCount = function (userId) {
  return this.countDocuments({ recipient: userId, isRead: false, isActive: true });
};

// Static method to create a notification (helper)
notificationSchema.statics.createNotification = function ({
  recipient,
  sender = null,
  type,
  title,
  message,
  entityType = null,
  entityId = null,
  actionUrl = null,
  priority = "medium",
  expiresAt = null
}) {
  return this.create({
    recipient,
    sender,
    type,
    title,
    message,
    entityType,
    entityId,
    actionUrl,
    priority,
    expiresAt
  });
};

// Static method to delete old read notifications (cleanup utility)
notificationSchema.statics.deleteOldRead = function (daysOld = 30) {
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - daysOld);
  return this.deleteMany({ isRead: true, readAt: { $lt: cutoffDate } });
};

// Static method to get notification statistics for a user
notificationSchema.statics.getUserStatistics = async function (userId) {
  const stats = await this.aggregate([
    {
      $match: {
        recipient: new mongoose.Types.ObjectId(userId),
        isActive: true
      }
    },
    {
      $group: {
        _id: "$type",
        total: { $sum: 1 },
        unread: {
          $sum: { $cond: [{ $eq: ["$isRead", false] }, 1, 0] }
        }
      }
    },
    {
      $project: {
        _id: 0,
        type: "$_id",
        total: 1,
        unread: 1
      }
    }
  ]);
  return stats;
};

const Notification = mongoose.model("Notification", notificationSchema);

export default Notification;
