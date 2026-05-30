import multer from "multer";

interface MulterMiddlewareOptions {
  allowedMimeTypes?: string[];
  maxFileSize?: number;
}

const multerMiddleware = ({ allowedMimeTypes, maxFileSize }: MulterMiddlewareOptions) => {
   const storage = multer.memoryStorage();

   return multer({
      storage,
      limits: maxFileSize ? { fileSize: maxFileSize } : undefined,
      fileFilter: (req, file, cb) => {
         if (allowedMimeTypes && !allowedMimeTypes.includes(file.mimetype)) {
            cb(new Error("Unsupported file type"));
            return;
         }

         cb(null, true);
      },
   });
};

export default multerMiddleware;
