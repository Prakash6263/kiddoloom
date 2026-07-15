import mongoose from "mongoose";

const ChildSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
    },
    age: {
      type: String,
      required: true,
    },
    parentName: {
      type: String,
      required: true,

    },
    email: {
      type: String,
      required: true,
    },

    phone: {
      type: String,
      required: true,
    },
    emergencyContact: {
      type: String,
      required: true,
    },
    address: {
      type: String,
      required: true,
    },

    notes: {
      type: String,
      required: false,
    },

    image: {
      type: String,
      required: false,
      default: null,
    },

    status:{
      type: Number,
      enum: [0, 1, 2], 
      default: 1,
    },

    parentId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Parent",
      required: true,
    },
    schoolId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "School",
      required: false, 
    },
     roomId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Room",
      default: null,
    },
  },
  {
    timestamps: true,
  }
);

export const Child = mongoose.model("Child", ChildSchema);