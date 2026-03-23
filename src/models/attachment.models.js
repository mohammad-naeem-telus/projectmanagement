import mongoose from "mongoose";

const attachmentSchema = new mongoose.Schema(
  {
    fileName: {
      type: String,
      required: [true, "File name is required"],
      trim: true,
      maxlength: [255, "File name cannot exceed 255 characters"]
    },
    originalName: {
      type: String,
      required: [true, "Original file name is required"],
      trim: true,
      maxlength: [255, "Original file name cannot exceed 255 characters"]
    },
    fileUrl: {
      type: String,
      required: [true, "File URL is required"],
      trim: true
    },
    fileType: {
      type: String,
      trim: true,
      lowercase: true,
      maxlength: [100, "File type cannot exceed 100 characters"]
    },
    mimeType: {
      type: String,
      trim: true,
      maxlength: [100, "MIME type cannot exceed 100 characters"]
    },
    // File size in bytes
    fileSize: {
      type: Number,
      min: [0, "File size cannot be negative"],
      validate: {
        validator: Number.isFinite,
        message: "File size must be a valid number"
      }
    },
    // The entity this attachment belongs to (polymorphic reference)
    entityType: {
      type: String,
      required: [true, "Entity type is required"],
      enum: {
        values: ["project", "task", "comment", "sprint"],
        message: "{VALUE} is not a valid entity type"
      },
      index: true
    },
    entityId: {
      type: mongoose.Schema.Types.ObjectId,
      required: [true, "Entity ID is required"],
      index: true
    },
    // The project this attachment is scoped to (for easy project-level queries)
    project: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Project",
      required: [true, "Attachment must be associated with a project"],
      index: true
    },
    uploadedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: [true, "Uploader is required"],
      index: true
    },
    description: {
      type: String,
      trim: true,
      maxlength: [500, "Description cannot exceed 500 characters"]
    },
    // Storage provider (e.g. "local", "s3", "gcs", "azure")
    storageProvider: {
      type: String,
      trim: true,
      lowercase: true,
      enum: {
        values: ["local", "s3", "gcs", "azure", "cloudinary"],
        message: "{VALUE} is not a supported storage provider"
      },
      default: "local"
    },
    // Storage key / path used by the provider (e.g. S3 object key)
    storageKey: {
      type: String,
      trim: true
    },
    // Whether the file has been soft-deleted
    isActive: {
      type: Boolean,
      default: true,
      index: true
    },
    deletedAt: {
      type: Date
    },
    deletedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User"
    }
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true }
  }
);

// Compound indexes for efficient querying
attachmentSchema.index({ entityType: 1, entityId: 1 });
attachmentSchema.index({ project: 1, entityType: 1 });
attachmentSchema.index({ uploadedBy: 1, createdAt: -1 });
attachmentSchema.index({ createdAt: -1 });

// Virtual for human-readable file size (e.g. "2.4 MB")
attachmentSchema.virtual("fileSizeFormatted").get(function () {
  if (this.fileSize == null) return null;
  const units = ["B", "KB", "MB", "GB", "TB"];
  let size = this.fileSize;
  let unitIndex = 0;
  while (size >= 1024 && unitIndex < units.length - 1) {
    size /= 1024;
    unitIndex++;
  }
  return `${size.toFixed(2)} ${units[unitIndex]}`;
});

// Virtual for file extension derived from the original name
attachmentSchema.virtual("extension").get(function () {
  if (!this.originalName) return null;
  const parts = this.originalName.split(".");
  return parts.length > 1 ? parts[parts.length - 1].toLowerCase() : null;
});

// Virtual to check whether the attachment is an image
attachmentSchema.virtual("isImage").get(function () {
  const imageMimeTypes = [
    "image/jpeg",
    "image/png",
    "image/gif",
    "image/webp",
    "image/svg+xml",
    "image/bmp"
  ];
  return this.mimeType ? imageMimeTypes.includes(this.mimeType.toLowerCase()) : false;
});

// Pre-save middleware: normalise mimeType to lowercase
attachmentSchema.pre("save", function (next) {
  if (this.isModified("mimeType") && this.mimeType) {
    this.mimeType = this.mimeType.toLowerCase();
  }
  next();
});

// Instance method to soft-delete an attachment
attachmentSchema.methods.softDelete = function (deletedByUserId) {
  this.isActive = false;
  this.deletedAt = new Date();
  if (deletedByUserId) {
    this.deletedBy = deletedByUserId;
  }
  return this.save();
};

// Instance method to restore a soft-deleted attachment
attachmentSchema.methods.restore = function () {
  this.isActive = true;
  this.deletedAt = undefined;
  this.deletedBy = undefined;
  return this.save();
};

// Static method to find all active attachments for a specific entity
attachmentSchema.statics.findByEntity = function (entityType, entityId) {
  return this.find({ entityType, entityId, isActive: true })
    .sort({ createdAt: -1 })
    .populate("uploadedBy", "username email avatar");
};

// Static method to find all active attachments for a project
attachmentSchema.statics.findByProject = function (projectId) {
  return this.find({ project: projectId, isActive: true })
    .sort({ createdAt: -1 })
    .populate("uploadedBy", "username email avatar");
};

// Static method to find attachments uploaded by a specific user
attachmentSchema.statics.findByUploader = function (userId) {
  return this.find({ uploadedBy: userId, isActive: true }).sort({ createdAt: -1 });
};

// Static method to find image attachments for a project
attachmentSchema.statics.findImages = function (projectId) {
  return this.find({
    project: projectId,
    mimeType: { $in: ["image/jpeg", "image/png", "image/gif", "image/webp", "image/svg+xml", "image/bmp"] },
    isActive: true
  }).sort({ createdAt: -1 });
};

// Static method to get storage usage statistics for a project (total size per entity type)
attachmentSchema.statics.getStorageStatistics = async function (projectId) {
  const stats = await this.aggregate([
    {
      $match: {
        project: new mongoose.Types.ObjectId(projectId),
        isActive: true
      }
    },
    {
      $group: {
        _id: "$entityType",
        fileCount: { $sum: 1 },
        totalSize: { $sum: "$fileSize" }
      }
    },
    {
      $project: {
        _id: 0,
        entityType: "$_id",
        fileCount: 1,
        totalSize: 1
      }
    },
    { $sort: { totalSize: -1 } }
  ]);
  return stats;
};

// Static method to get the total storage used by a project in bytes
attachmentSchema.statics.getTotalStorageUsed = async function (projectId) {
  const result = await this.aggregate([
    {
      $match: {
        project: new mongoose.Types.ObjectId(projectId),
        isActive: true
      }
    },
    {
      $group: {
        _id: null,
        totalSize: { $sum: "$fileSize" },
        fileCount: { $sum: 1 }
      }
    }
  ]);
  return result.length > 0 ? result[0] : { totalSize: 0, fileCount: 0 };
};

const Attachment = mongoose.model("Attachment", attachmentSchema);

export default Attachment;
