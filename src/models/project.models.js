import mongoose from "mongoose";

const projectSchema = new mongoose.Schema(
  {
    name: { 
      type: String, 
      required: [true, "Project name is required"],
      trim: true,
      minlength: [3, "Project name must be at least 3 characters long"],
      maxlength: [100, "Project name cannot exceed 100 characters"]
    },
    description: { 
      type: String, 
      required: [true, "Project description is required"],
      trim: true,
      minlength: [10, "Description must be at least 10 characters long"],
      maxlength: [1000, "Description cannot exceed 1000 characters"]
    },
    status: { 
      type: String, 
      enum: {
        values: ["planning", "in-progress", "on-hold", "completed", "cancelled"],
        message: "{VALUE} is not a valid status"
      },
      default: "planning",
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
    startDate: { 
      type: Date,
      validate: {
        validator: function(value) {
          // Start date should not be in the far past (more than 10 years ago)
          if (value) {
            const tenYearsAgo = new Date();
            tenYearsAgo.setFullYear(tenYearsAgo.getFullYear() - 10);
            return value >= tenYearsAgo;
          }
          return true;
        },
        message: "Start date cannot be more than 10 years in the past"
      }
    },
    endDate: { 
      type: Date,
      validate: {
        validator: function(value) {
          // End date should be after start date
          if (value && this.startDate) {
            return value >= this.startDate;
          }
          return true;
        },
        message: "End date must be after or equal to start date"
      }
    },
    owner: { 
      type: mongoose.Schema.Types.ObjectId, 
      ref: "User", 
      required: [true, "Project owner is required"],
      index: true
    },
    team: [{ 
      user: {
        type: mongoose.Schema.Types.ObjectId, 
        ref: "User",
        required: true
      },
      role: {
        type: String,
        enum: ["developer", "designer", "tester", "manager", "analyst"],
        default: "developer"
      },
      joinedAt: {
        type: Date,
        default: Date.now
      }
    }],
    budget: { 
      type: Number, 
      default: 0,
      min: [0, "Budget cannot be negative"],
      validate: {
        validator: Number.isFinite,
        message: "Budget must be a valid number"
      }
    },
    actualCost: {
      type: Number,
      default: 0,
      min: [0, "Actual cost cannot be negative"]
    },
    tags: [{
      type: String,
      trim: true,
      lowercase: true
    }],
    milestones: [{
      title: {
        type: String,
        required: true,
        trim: true
      },
      description: {
        type: String,
        trim: true
      },
      dueDate: {
        type: Date,
        required: true
      },
      completed: {
        type: Boolean,
        default: false
      },
      completedAt: {
        type: Date
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
    isActive: { 
      type: Boolean, 
      default: true,
      index: true
    },
    completedAt: {
      type: Date
    },
    cancelledAt: {
      type: Date
    },
    notes: {
      type: String,
      maxlength: [2000, "Notes cannot exceed 2000 characters"]
    }
  },
  { 
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true }
  }
);

// Indexes for better query performance
projectSchema.index({ owner: 1, status: 1 });
projectSchema.index({ status: 1, priority: 1 });
projectSchema.index({ startDate: 1, endDate: 1 });
projectSchema.index({ createdAt: -1 });
projectSchema.index({ name: "text", description: "text" });

// Virtual for project duration in days
projectSchema.virtual("duration").get(function() {
  if (this.startDate && this.endDate) {
    const diffTime = Math.abs(this.endDate - this.startDate);
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return diffDays;
  }
  return null;
});

// Virtual for budget variance
projectSchema.virtual("budgetVariance").get(function() {
  if (this.budget > 0) {
    return this.budget - this.actualCost;
  }
  return null;
});

// Virtual for budget utilization percentage
projectSchema.virtual("budgetUtilization").get(function() {
  if (this.budget > 0) {
    return ((this.actualCost / this.budget) * 100).toFixed(2);
  }
  return null;
});

// Virtual for team size
projectSchema.virtual("teamSize").get(function() {
  return this.team ? this.team.length : 0;
});

// Virtual for completion percentage based on milestones
projectSchema.virtual("completionPercentage").get(function() {
  if (this.milestones && this.milestones.length > 0) {
    const completedMilestones = this.milestones.filter(m => m.completed).length;
    return ((completedMilestones / this.milestones.length) * 100).toFixed(2);
  }
  return 0;
});

// Virtual for checking if project is overdue
projectSchema.virtual("isOverdue").get(function() {
  if (this.endDate && this.status !== "completed" && this.status !== "cancelled") {
    return new Date() > this.endDate;
  }
  return false;
});

// Pre-save middleware to set completion/cancellation dates
projectSchema.pre("save", function(next) {
  // Set completedAt when status changes to completed
  if (this.isModified("status") && this.status === "completed" && !this.completedAt) {
    this.completedAt = new Date();
  }
  
  // Set cancelledAt when status changes to cancelled
  if (this.isModified("status") && this.status === "cancelled" && !this.cancelledAt) {
    this.cancelledAt = new Date();
  }
  
  // Mark milestones as completed when completedAt is set
  if (this.isModified("milestones")) {
    this.milestones.forEach(milestone => {
      if (milestone.completed && !milestone.completedAt) {
        milestone.completedAt = new Date();
      }
    });
  }
  
  next();
});

// Instance method to add team member
projectSchema.methods.addTeamMember = function(userId, role = "developer") {
  const exists = this.team.some(member => member.user.toString() === userId.toString());
  if (!exists) {
    this.team.push({ user: userId, role, joinedAt: new Date() });
  }
  return this.save();
};

// Instance method to remove team member
projectSchema.methods.removeTeamMember = function(userId) {
  this.team = this.team.filter(member => member.user.toString() !== userId.toString());
  return this.save();
};

// Instance method to add milestone
projectSchema.methods.addMilestone = function(milestoneData) {
  this.milestones.push(milestoneData);
  return this.save();
};

// Instance method to complete milestone
projectSchema.methods.completeMilestone = function(milestoneId) {
  const milestone = this.milestones.id(milestoneId);
  if (milestone) {
    milestone.completed = true;
    milestone.completedAt = new Date();
  }
  return this.save();
};

// Static method to find active projects
projectSchema.statics.findActive = function() {
  return this.find({ isActive: true });
};

// Static method to find projects by status
projectSchema.statics.findByStatus = function(status) {
  return this.find({ status, isActive: true });
};

// Static method to find overdue projects
projectSchema.statics.findOverdue = function() {
  return this.find({
    endDate: { $lt: new Date() },
    status: { $nin: ["completed", "cancelled"] },
    isActive: true
  });
};

// Static method to find projects by owner
projectSchema.statics.findByOwner = function(ownerId) {
  return this.find({ owner: ownerId, isActive: true });
};

// Static method to get project statistics
projectSchema.statics.getStatistics = async function() {
  const stats = await this.aggregate([
    {
      $group: {
        _id: "$status",
        count: { $sum: 1 },
        totalBudget: { $sum: "$budget" },
        totalActualCost: { $sum: "$actualCost" }
      }
    }
  ]);
  return stats;
};

const Project = mongoose.model("Project", projectSchema);

export default Project;
