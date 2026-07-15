import mongoose from "mongoose";
import { Teacher } from "../models/teacher/Teacher.js";
import { Child } from "../models/parent/ChildForm.js";

export async function assertTeacherParentLink({ teacherId, parentId }) {
  if (!mongoose.Types.ObjectId.isValid(teacherId) || !mongoose.Types.ObjectId.isValid(parentId)) {
    return { ok: false, reason: "Invalid ids" };
  }

  const teacher = await Teacher.findById(teacherId).select("schoolId");
  if (!teacher) return { ok: false, reason: "Teacher not found" };

  const exists = await Child.exists({ parentId, schoolId: teacher.schoolId });
  if (!exists) return { ok: false, reason: "No child link in this school" };

  return { ok: true, teacherSchoolId: teacher.schoolId };
}
