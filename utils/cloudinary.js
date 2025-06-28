 // utils/cloudinary.js
const cloudinary = require("cloudinary").v2;
const { CloudinaryStorage } = require("multer-storage-cloudinary");

// ✅ Configure Cloudinary
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME || "djubg3xoc", // your cloud name
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

// ✅ Set up storage to upload directly to Cloudinary
const storage = new CloudinaryStorage({
  cloudinary,
  params: {
    folder: "barbers", // all images will go under this folder in Cloudinary
    allowed_formats: ["jpg", "jpeg", "png"],
    public_id: (req, file) => `${Date.now()}-${file.originalname}`,
  },
});

module.exports = { cloudinary, storage };
