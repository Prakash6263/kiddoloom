import mongoose from "mongoose";


const AttendanceSchema = new mongoose.Schema(
  {
    studentId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Child",
      required: true,
    },
    schoolId:{
      type: mongoose.Schema.Types.ObjectId,
      ref: "School",
      required: true,
    },
    roomId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Room",
      required: true,
    },
    date: {
      type: String, // Using string in 'YYYY-MM-DD' format for easy indexing and filtering
      required: true,
    },
    entryTime: {
      type: Date,
      default: null,
    },
    exitTime: {
      type: Date,
      default: null,
    },
    scannedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Teacher",
    },
  },
  {
    timestamps: true, // Automatically adds createdAt and updatedAt
  }
);

// 🚫 Ensure one unique record per (student, room, date)
AttendanceSchema.index(
  { studentId: 1, roomId: 1, date: 1 },
  { unique: true }
);

export const Attendance = mongoose.model("Attendance", AttendanceSchema);