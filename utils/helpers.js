import fs from "fs";
import path from "path";
import { nanoid } from 'nanoid';
import QRCode from 'qrcode'




export const deleteOldImages = (folderName, oldPath) => {
  try {
    if (!oldPath) return; 
    const oldImagePath = path.join(__dirname, '..', 'public', folderName, oldPath);
    console.log("Deleting old file →", oldImagePath);

    if (fs.existsSync(oldImagePath)) {
      fs.unlinkSync(oldImagePath);
      console.log("File deleted successfully.");
    } else {
      console.log("File does not exist.");
    }
  } catch (err) {
    console.error("Failed to delete image:", err.message);
  }
};



export const generateRandomString = async(num)=>{
    console.log(`nano code -------------->`, nanoid(num).toUpperCase());
    return  nanoid(num).toUpperCase()
    
}

export const getExpirationTime = () => {
    return new Date(Date.now() + 5 * 60 * 1000); // Current time + 5 minutes
};

export  const generateQR = async data => {
  try {
    const parsedData = JSON.stringify(data)
    const QR = await QRCode.toDataURL(parsedData)
    return QR 
  } catch (err) {
    console.error(err)
    
  }
}





