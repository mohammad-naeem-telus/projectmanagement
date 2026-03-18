import mongoose from "mongoose";

const sprintSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, "Sprint name is required"],
      trim: true,
      minlength: [3, "Sprint name must be at least 3 characters long"],
      maxlength: [100, "Sprint name cannot exceed 100 characters"]
    },
    goal: {
      type: String,
      trim: true,
      maxlength: [500, "Sprint goal cannot exceed 500 characters"]
    },
    project: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Project",
      required: [true, "Sprint must belong to a project"],
      index: true
    },
    status: {
      type: String,
      enum: {
        values: ["planned", "active", "completed", "cancelled"],
        message: "{VALUE} is not a valid sprint status"
      },
      default: "planned",
      index: true
    },
    startDate: {
      type: Date,
      required: [true, "Sprint start date is required"]
    },
    endDate: {
      type: Date,
      required: [true, "Sprint end date is required"],
      validate: {
        validator: function (value) {
          if (value && this.startDate) {
            return value > this.startDate;
          }
          return true;
        },
        message: "End date must be after start date"
      }
    },
    // Tasks included in this sprint
    tasks: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Task"
      }
    ],
    // The user who created / owns the sprint (usually the project manager)
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: [true, "Sprint creator is required"],
      index: true
    },
    // Capacity in story points or hours agreed for this sprint
    capacity: {
      type: Number,
      default: 0,
      min: [0, "Capacity cannot be negative"],
      validate: {
        validator: Number.isFinite,
        message: "Capacity must be a valid number"
      }
    },
    // Velocity — story points / hours actually completed
    velocity: {
      type: Number,
      default: 0,
      min: [0, "Velocity cannot be negative"]
    },
    // Sprint number within the project (e.g., Sprint 1, Sprint 2 …)
    sprintNumber: {
      type: Number,
      required: [true, "Sprint number is required"],
      min: [1, "Sprint number must be at least 1"]
    },
    // Retrospective notes added at the end of the sprint
    retrospective: {
      wentWell: {
        type: String,
        trim: true,
        maxlength: [1000, "Retrospective notes cannot exceed 1000 characters"]
      },
      improvements: {
        type: String,
        trim: true,
        maxlength: [1000, "Retrospective notes cannot exceed 1000 characters"]
      },
      actionItems: {
        type: String,
        trim: true,
        maxlength: [1000, "Action items cannot exceed 1000 characters"]
      }
    },
    completedAt: {
      type: Date
    },
    cancelledAt: {
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
sprintSchema.index({ project: 1, status: 1 });
sprintSchema.index({ project: 1, sprintNumber: 1 }, { unique: true });
sprintSchema.index({ startDate: 1, endDate: 1 });
sprintSchema.index({ createdAt: -1 });

// Virtual for sprint duration in days
sprintSchema.virtual("durationInDays").get(function () {
  if (this.startDate && this.endDate) {
    const diffMs = Math.abs(this.endDate - this.startDate);
    return Math.ceil(diffMs / (1000 * 60 * 60 * 24));
  }
  return null;
});

// Virtual for days remaining in the sprint
sprintSchema.virtual("daysRemaining").get(function () {
  if (this.endDate && this.status === "active") {
    const diffMs = this.endDate - new Date();
    const days = Math.ceil(diffMs / (1000 * 60 * 60 * 24));
    return days > 0 ? days : 0;
  }
  return null;
});

// Virtual for total number of tasks in the sprint
sprintSchema.virtual("taskCount").get(function () {
  return this.tasks ? this.tasks.length : 0;
});

// Virtual for capacity utilization percentage
sprintSchema.virtual("capacityUtilization").get(function () {
  if (this.capacity > 0) {
    return ((this.velocity / this.capacity) * 100).toFixed(2);
  }
  return null;
});

// Virtual to check if the sprint is overdue
sprintSchema.virtual("isOverdue").get(function () {
  if (this.endDate && this.status === "active") {
    return new Date() > this.endDate;
  }
  return false;
});

// Pre-save middleware to set completion / cancellation timestamps
sprintSchema.pre("save", function (next) {
  if (this.isModified("status") && this.status === "completed" && !this.completedAt) {
    this.completedAt = new Date();
  }
  if (this.isModified("status") && this.status === "cancelled" && !this.cancelledAt) {
    this.cancelledAt = new Date();
  }
  next();
});

// Instance method to add a task to the sprint
sprintSchema.methods.addTask = function (taskId) {
  const alreadyAdded = this.tasks.some(
    (t) => t.toString() === taskId.toString()
  );
  if (!alreadyAdded) {
    this.tasks.push(taskId);
  }
  return this.save();
};

// Instance method to remove a task from the sprint
sprintSchema.methods.removeTask = function (taskId) {
  this.tasks = this.tasks.filter((t) => t.toString() !== taskId.toString());
  return this.save();
};

// Instance method to start the sprint
sprintSchema.methods.start = function () {
  if (this.status !== "planned") {
    return Promise.reject(new Error("Only planned sprints can be started"));
  }
  this.status = "active";
  return this.save();
};

// Instance method to complete the sprint
sprintSchema.methods.complete = function (velocity = 0) {
  if (this.status !== "active") {
    return Promise.reject(new Error("Only active sprints can be completed"));
  }
  this.status = "completed";
  this.velocity = velocity;
  return this.save();
};

// Instance method to soft delete
sprintSchema.methods.softDelete = function () {
  this.isActive = false;
  return this.save();
};

// Static method to find all sprints for a project
sprintSchema.statics.findByProject = function (projectId) {
  return this.find({ project: projectId, isActive: true }).sort({ sprintNumber: 1 });
};

// Static method to find the currently active sprint for a project
sprintSchema.statics.findActiveSprint = function (projectId) {
  return this.findOne({ project: projectId, status: "active", isActive: true })
    .populate("tasks", "title status priority assignedTo")
    .populate("createdBy", "username email");
};

// Static method to find sprints by status
sprintSchema.statics.findByStatus = function (projectId, status) {
  return this.find({ project: projectId, status, isActive: true }).sort({
    sprintNumber: 1
  });
};

// Static method to get sprint statistics for a project
sprintSchema.statics.getProjectStatistics = async function (projectId) {
  const stats = await this.aggregate([
    {
      $match: {
        project: new mongoose.Types.ObjectId(projectId),
        isActive: true
      }
    },
    {
      $group: {
        _id: "$status",
        count: { $sum: 1 },
        totalCapacity: { $sum: "$capacity" },
        totalVelocity: { $sum: "$velocity" },
        avgVelocity: { $avg: "$velocity" }
      }
    },
    {
      $project: {
        _id: 0,
        status: "$_id",
        count: 1,
        totalCapacity: 1,
        totalVelocity: 1,
        avgVelocity: { $round: ["$avgVelocity", 2] }
      }
    }
  ]);
  return stats;
};

// Static method to get the next sprint number for a project
sprintSchema.statics.getNextSprintNumber = async function (projectId) {
  const lastSprint = await this.findOne({ project: projectId })
    .sort({ sprintNumber: -1 })
    .select("sprintNumber");
  return lastSprint ? lastSprint.sprintNumber + 1 : 1;
};

const Sprint = mongoose.model("Sprint", sprintSchema);

export default Sprint;
