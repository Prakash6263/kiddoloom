import mongoose from "mongoose";
import bcrypt from "bcryptjs";
import { type } from "os";

const teacherSchema = new mongoose.Schema(
    {
        name: {
            type: String,
            required: true
        },

        email: {
            type: String,
            required: true,
            unique: true,

        },

        password: {
            type: String,
            required: true,
        },

        phone: {
            type: String,
            required: true
        },

        education: {
            type: String,
            required: true,
        },
        city: {
            type: String,
            required: true,
        },
        address: {
            type: String,
            required: true,
        },
        gender: {
            type: String,
            enum: ["Male", "Female"],
            required: true,
        },


        schoolId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "School",
            required: true,
        },



        actToken: {
            type: String,
            default: null,
        },

        linkExpireAt: {
            type: Date,
            default: null,
        },

        status: {
            type: Number,
            enum: [0, 1, 2],
            default: 1
        },

        defaultRoomId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Room",
            default: null,
        },
        skills: {
            type: [String],
            default: []
        },
        profileImage: {
            type: String,
            default: null,
        },
        role: {
            type: String,
            enum: ["teacher", "parent", "admin", "superAdmin"],
            default: "teacher",
        },

    },
    {
        timestamps: true,
    }
);


teacherSchema.pre("save", async function (next) {
    if (!this.isModified("password")) return next();

    this.password = await bcrypt.hash(this.password, 10)

})

teacherSchema.methods.isPasswordCorrect = async function (password) {
    return await bcrypt.compare(password, this.password)

}


export const Teacher = mongoose.model("Teacher", teacherSchema);