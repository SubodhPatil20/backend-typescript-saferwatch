import { Router } from "express";
import { generatePdfFromText } from "../controllers/pdfController";
import { generatePdf } from "../controllers/userController";

const router = Router();

// POST /api/pdf
// Body: { "text": string, "title"?: string }
router.post("/pdf", generatePdfFromText);
router.post("/generate-pdf",generatePdf);
export default router;



