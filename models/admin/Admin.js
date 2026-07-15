import mongoose from "mongoose";
import bcrypt from "bcryptjs";


const adminSchema = new mongoose.Schema(
    {
        name: {
            type: String,
            required: true,
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
            required: true,
            unique: true,
        },

        role: {
            type: String,
            enum: ["admin", "superAdmin"],
            default: "admin",
        },
        actToken: {
            type: String,
            default: null,
        },

        linkExpireAt: {
            type: Date,
            default: null,
        }

    },
    {
        timestamps: true,
    }

);


adminSchema.pre("save", async function (next) {
    if (!this.isModified("password")) return next();

    this.password = await bcrypt.hash(this.password, 10)

})

adminSchema.methods.isPasswordCorrect = async function (password) {
    return await bcrypt.compare(password, this.password)

}

export const Admin = mongoose.model("Admin", adminSchema);


