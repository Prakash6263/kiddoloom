import mongoose from "mongoose";

const DailyReportSchema = new mongoose.Schema(
  {
    childId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "ChildForm",
      required: true,
    },
    roomId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Room",
      required: true,
    },
    teacherId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Teacher",
      required: true,
    },
    date: {
      type: Date,
      default: new Date().toISOString().split("T")[0],
    },
    // Activities
    activities: [
      {
        content: {
          type: String,
          trim: true,
        },
        image: {
          type: String,
          default: "",
        },
        time: {
          type: String,
          default: null,
        },
        customField: {
          type: String,
          default: "",
        },
        createdAt: {
          type: Date,
          default: Date.now,
        },
      },
    ],

    image: {
      type: String,
      default: "",
    },

    // Health
    health: [
      {
        content: {
          type: String,
          trim: true,
        },
        customField: {
          type: String,
          default: "",
        },
        time: {
          type: String,
          default: null,
        },
        createdAt: {
          type: Date,
          default: Date.now,
        },
      },
    ],

    // Temperature
    temperature: [
      {
        value: {
          type: Number,
        },
        customField: {
          type: String,
          default: "",
        },
        unit: {
          type: String,
          enum: ["C", "F"],
          default: "C",
        },
        time: {
          type: String,
          default: null,
        },
        createdAt: {
          type: Date,
          default: Date.now,
        },
      },
    ],

    // Mood
    mood: [
      {
        content: {
          type: String,
          enum: ["Happy", "Sad", "Angry", "Excited", "Calm", "Neutral"],
        },
        time: {
          type: String,
          default: null,
        },
        customField: {
          type: String,
          default: "",
        },
        createdAt: {
          type: Date,
          default: Date.now,
        },
      },
    ],

    // Supplies
    supplies: [
      {
        content: {
          type: String,
          trim: true,
        },
        customField: {
          type: String,
          default: "",
        },
        time: {
          type: String,
          default: null,
        },
        createdAt: {
          type: Date,
          default: Date.now,
        },
      },
    ],

    // Naps
    naps: [
      {
        content: {
          type: String,
          trim: true,
        },
        customField: {
          type: String,
          default: "",
        },
        time: {
          type: String,
          default: null,
        },
        createdAt: {
          type: Date,
          default: Date.now,
        },
      },
    ],

    // Notes
    notes: [
      {
        content: {
          type: String,
          trim: true,
        },
        customField: {
          type: String,
          default: "",
        },
        time: {
          type: String,
          default: null,
        },
        createdAt: {
          type: Date,
          default: Date.now,
        },
      },
    ],

    // Name to face
    nameToFace: [
      {
        content: {
          type: String,
          trim: true,
        },
        time: {
          type: String,
          default: null,
        },
        customField: {
          type: String,
          default: "",
        },
        createdAt: {
          type: Date,
          default: Date.now,
        },
      },
    ],

    // Move rooms
    moveRooms: [
      {
        content: {
          type: String,
          trim: true,
        },
        customField: {
          type: String,
          default: "",
        },
        time: {
          type: String,
          default: null,
        },
        createdAt: {
          type: Date,
          default: Date.now,
        },
      },
    ],

    isSubmitted: {
      type: Boolean,
      default: false,
    },
  },
  {
    timestamps: true,
  }
);

// Index for faster queries
DailyReportSchema.index({ childId: 1, date: 1 });
DailyReportSchema.index({ roomId: 1, date: 1 });
DailyReportSchema.index({ teacherId: 1, date: 1 });

export const DailyReport = mongoose.model("DailyReport", DailyReportSchema);
