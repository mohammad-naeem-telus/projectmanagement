import mongoose from "mongoose";

const labelSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, "Label name is required"],
      trim: true,
      minlength: [1, "Label name must be at least 1 character long"],
      maxlength: [50, "Label name cannot exceed 50 characters"]
    },
    color: {
      type: String,
      required: [true, "Label color is required"],
      trim: true,
      match: [
        /^#([0-9A-Fa-f]{3}|[0-9A-Fa-f]{6})$/,
        "Color must be a valid hex color code (e.g. #FFF or #FFFFFF)"
      ],
      default: "#6366f1"
    },
    description: {
      type: String,
      trim: true,
      maxlength: [200, "Description cannot exceed 200 characters"]
    },
    // Labels are scoped to a project so different projects can have their own label sets
    project: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Project",
      required: [true, "Label must belong to a project"],
      index: true
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: [true, "Label creator is required"],
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

// A label name must be unique within a project
labelSchema.index({ project: 1, name: 1 }, { unique: true });
labelSchema.index({ createdAt: -1 });

// Virtual for a display-friendly label (name + color)
labelSchema.virtual("display").get(function () {
  return `${this.name} (${this.color})`;
});

// Pre-save middleware: normalise the name to lowercase for consistent uniqueness
labelSchema.pre("save", function (next) {
  if (this.isModified("name")) {
    this.name = this.name.toLowerCase();
  }
  next();
});

// Instance method to soft-delete a label
labelSchema.methods.softDelete = function () {
  this.isActive = false;
  return this.save();
};

// Instance method to restore a soft-deleted label
labelSchema.methods.restore = function () {
  this.isActive = true;
  return this.save();
};

// Static method to find all active labels for a project
labelSchema.statics.findByProject = function (projectId) {
  return this.find({ project: projectId, isActive: true })
    .sort({ name: 1 })
    .populate("createdBy", "username email");
};

// Static method to find a label by name within a project
labelSchema.statics.findByName = function (projectId, name) {
  return this.findOne({
    project: projectId,
    name: name.toLowerCase(),
    isActive: true
  });
};

// Static method to find labels created by a specific user
labelSchema.statics.findByCreator = function (userId) {
  return this.find({ createdBy: userId, isActive: true }).sort({ name: 1 });
};

// Static method to get label usage statistics across tasks for a project
labelSchema.statics.getUsageStatistics = async function (projectId) {
  const stats = await mongoose.model("Task").aggregate([
    {
      $match: {
        project: new mongoose.Types.ObjectId(projectId),
        isActive: true
      }
    },
    { $unwind: "$tags" },
    {
      $group: {
        _id: "$tags",
        taskCount: { $sum: 1 }
      }
    },
    {
      $lookup: {
        from: "labels",
        let: { labelName: "$_id" },
        pipeline: [
          {
            $match: {
              $expr: {
                $and: [
                  { $eq: ["$name", "$$labelName"] },
                  {
                    $eq: [
                      "$project",
                      new mongoose.Types.ObjectId(projectId)
                    ]
                  }
                ]
              }
            }
          }
        ],
        as: "labelDetails"
      }
    },
    {
      $project: {
        _id: 0,
        name: "$_id",
        taskCount: 1,
        color: { $arrayElemAt: ["$labelDetails.color", 0] },
        description: { $arrayElemAt: ["$labelDetails.description", 0] }
      }
    },
    { $sort: { taskCount: -1 } }
  ]);
  return stats;
};

const Label = mongoose.model("Label", labelSchema);

export default Label;
