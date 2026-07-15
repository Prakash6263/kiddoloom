import mongoose from "mongoose";
import bcrypt from "bcrypt";

const SchoolSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
    },
    description: String,

    address: {
      street: String,
      city: String,
      state: String,
      zipCode: String,
      country: String,
    },

    location: {
      type: {
        type: String,
        enum: ["Point"],
        default: "Point",
      },
      coordinates: {
        type: [Number], // [longitude, latitude]
        required: true,
      },
    },

    contactInfo: {
      phone: String,
      email: String,
      website: String,
    },

    images: [
      {
        url: {
          type: String,
          default: null,
        },
        caption: {
          type: String,
          default: null,
        },
      },
    ],

    facilities: [String],

    ageGroups: [
      {
        name: String,
        minAge: Number,
        maxAge: Number,
      },
    ],

    fees: {
      admissionFee: Number,
      monthlyFee: Number,
      annualFee: Number,
    },

    timings: {
      openTime: String, // Format: HH:mm
      closeTime: String,
      workingDays: [String],
    },

    principalName: String,
    establishedYear: Number,
    affiliation: String,
    curriculum: [String],

    status: {
      type: Number,
      enum: [0, 1, 2],
      default: 1,
    },

    adminId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Admin",
      required: true,
    },
  },
  {
    timestamps: true,
  }
);

SchoolSchema.pre("save", async function (next) {
  if (!this.isModified("password")) return next();

  this.password = await bcrypt.hash(this.password, 10);
});

SchoolSchema.index({ location: "2dsphere" }); // Enables geospatial queries

export const School = mongoose.model("School", SchoolSchema);
