import mongoose from "mongoose";

const projectSchema = new mongoose.Schema(
  {
    name: { type: String, required: true },
    description: { type: String, required: true },
    status: { 
      type: String, 
      enum: ["planning", "in-progress", "on-hold", "completed", "cancelled"], 
      default: "planning" 
    },
    priority: { 
      type: String, 
      enum: ["low", "medium", "high", "critical"], 
      default: "medium" 
    },
    startDate: { type: Date },
    endDate: { type: Date },
    owner: { 
      type: mongoose.Schema.Types.ObjectId, 
      ref: "User", 
      required: true 
    },
    team: [{ 
      type: mongoose.Schema.Types.ObjectId, 
      ref: "User" 
    }],
    budget: { type: Number, default: 0 },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true }
);

const Project = mongoose.model("Project", projectSchema);

export default Project;
