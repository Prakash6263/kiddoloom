import mongoose from "mongoose";

const roomSchema = new mongoose.Schema({
  roomNo: {
    type: String,
    required: true,
    unique: true
  },
  schoolId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'School',
    required: true
  },
  teacherId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Teacher',
    default: null
  },
  studentIds: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Child'
  }],
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Admin',
    required: true
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
});

export const Room = mongoose.model('Room', roomSchema);
