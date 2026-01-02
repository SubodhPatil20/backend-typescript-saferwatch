import cors from "cors";
import express, { Request, Response } from "express";
import helmet from "helmet";
import morgan from "morgan";
import { errorHandler } from "./middleware/errorHandler";
import router from "./routes";
import { generatePdfFromText } from "./controllers/pdfController";
import mainFunction  from "./pdf-function/intel-summary-report";

const app = express();

app.use(helmet());
app.use(cors());
app.use(express.json());
app.use(morgan("dev"));

app.use("/api", router); 

app.get("/health", (_req: Request, res: Response) => {
  res.status(200).json({ status: "ok" });
});
app.get('/',(req: Request,res: Response)=>{
    return res.status(200).send("<h1>Hello , Welcome to our Backend Typescript project</h1>")
})
app.get("/pdf-down",generatePdfFromText)
app.get("/pdf-new",mainFunction);
app.use(errorHandler);

export default app;



