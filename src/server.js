import express from "express";
import multer from "multer";
import { PDFDocument } from "pdf-lib";
import fs from "node:fs/promises";

const app = express();

const PORT = process.env.PORT || 3232;

const upload = multer({
  dest: "tmp/",
  limits: {
    files: 20,
    fileSize: 25 * 1024 * 1024,
  },
});

app.get("/health", (req, res) => {
  res.json({
    status: "ok",
  });
});

app.post("/merge", handleUpload, async (req, res) => {
  if (!req.files || req.files.length < 2) {
    return res.status(400).json({
      error: "Please upload atleast 2 pdf files",
    });
  }

  try {
    const mergedPdf = await PDFDocument.create();

    for (const file of req.files) {
      const fileBuffer = await fs.readFile(file.path);

      const sourcePdf = await PDFDocument.load(fileBuffer, {
        ignoreEncryption: true,
      });

      const pages = await mergedPdf.copyPages(
        sourcePdf,
        sourcePdf.getPageIndices(),
      );

      for (const page of pages) {
        mergedPdf.addPage(page);
      }
    }

    const mergedBytes = await mergedPdf.save();
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", "attachment; filename=merged.pdf");

    res.send(Buffer.from(mergedBytes));
  } catch (err) {
    console.error("X Error:", err);
    return res.status(500).json({
      error: "Failed to merge PDF files",
    });
  } finally {
    for (const file of req.files) {
      await fs.unlink(file.path).catch(() => {});
    }
  }
});

app.listen(PORT, () => {
  console.log(`PDF Merge service is running on port ${PORT}`);
});

/**
 * @param {express.Request} req
 * @param {express.Response} res
 * @param {express.NextFunction} next
 */
function handleUpload(req, res, next) {
  upload.array("files")(req, res, (err) => {
    if (!err) {
      next();
    }

    if (err instanceof multer.MulterError) {
      if (err.code === "LIMIT_FILE_SIZE") {
        return res.status(413).json({
          error: "File is too large. Maximum file size is 25MB",
        });
      }

      if (err.code === "LIMIT_FILE_COUNT") {
        return res.status(413).json({
          error: "Too many files. Maximum number of files is 20",
        });
      }
    }
    console.error("Upload error:", err);

    return res.status(500).json({
      error: "Failed to upload files",
    });
  });
}
