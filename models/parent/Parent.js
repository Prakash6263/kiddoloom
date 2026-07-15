import mongoose from "mongoose";
import bcrypt from "bcryptjs";



const ParentSchema = new mongoose.Schema(
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
        phone: {
            type: String,
            required: true,
            unique: true,
        },
        password: {
            type: String,
            required: true,
        },

        actToken:{
            type: String,
            default: null,
        },

        linkExpireAt: {
            type:Date,
            default: null,
        }

        ,
        role: {
            type: String,
            enum: ["parent", "teacher", "admin", "superAdmin"],
            default: "parent",
        }

    },
    {
        timestamps: true,
    }

);


ParentSchema.pre("save", async function (next) {
    if (!this.isModified("password")) return next();

    this.password = await bcrypt.hash(this.password, 10)

})

ParentSchema.methods.isPasswordCorrect = async function (password) {
    return await bcrypt.compare(password, this.password)

}

export const Parent = mongoose.model("Parent", ParentSchema);


