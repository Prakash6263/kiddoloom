import jwt from "jsonwebtoken";
import { ApiResponse } from "../utils/ApiResponse.js";


export const auth = (req, res, next) => {
  const token = req.headers.authorization?.split(" ")[1];
  if (!token) return res.status(401).json(new ApiResponse(401, {}, "No token provided"));

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = decoded;
    next();
  } catch {
    res.status(401).json(new ApiResponse(401, {}, "Invalid token"));
  }
};

export const isAdmin = (req, res, next) => {
  if (req.user.role !== 'admin') {
    return res.status(401).json(new ApiResponse(401, {}, "Access is forbidden"));
  }
  next();
};


export const isSuperAdmin = (req, res, next) => {
  console.log("User Role:", req.user.role);
  if (req.user.role !== 'superAdmin') {
   
     return res.status(401).json(new ApiResponse(401, {}, "Access is forbidden"));
  }
  next();
};