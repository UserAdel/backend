import multer from "multer";
import {
   createLocalUploadFilename,
   ensureLocalUploadDirectory,
   getLocalUploadDirectory,
} from "../services/localUpload.service.js";

interface MulterMiddlewareOptions {
  allowedMimeTypes?: string[];
  maxFileSize?: number;
  uploadFolders?: string[];
}

const multerMiddleware = ({
   allowedMimeTypes,
   maxFileSize,
   uploadFolders = [],
}: MulterMiddlewareOptions) => {
   const storage = multer.diskStorage({
      destination: (_req, _file, cb) => {
         ensureLocalUploadDirectory(uploadFolders)
            .then(() => cb(null, getLocalUploadDirectory(uploadFolders)))
            .catch((error) => cb(error as Error, ""));
      },
      filename: (_req, file, cb) => {
         cb(null, createLocalUploadFilename(file.originalname));
      },
   });

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
