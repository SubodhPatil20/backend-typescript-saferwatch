import { Router } from "express";
import userRoutes from "./userRoutes";
import pdfRoutes from "./pdfRoutes";

const router = Router();

router.use("/users", userRoutes);
router.use("/", pdfRoutes);

export default router;



