import express from "express";
import multer from "multer";
import { PDFDocument } from "pdf-lib";
import fs from "node:fs/promises";

const app = express();

const PORT = process.env.PORT || 3232;

const upload = multer({
  dest: "tmp/",
});

app.get("/health", (req, res) => {
  res.json({
    status: "ok",
  });
});

app.post("/merge", upload.array("files"), async (req, res) => {
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
