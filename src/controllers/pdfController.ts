import { Request, Response } from "express";
import puppeteer from "puppeteer";

const escapeHtml = (value: string): string =>
  value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");

export const generatePdfFromText = async (
  req: Request,
  res: Response
): Promise<void> => {
  const {
    title = "Optional Document Title",
    text = "Your main content goes here.\nSupports multiple lines.\n\nAnd paragraphs."
  } = req.query as {
    title?: string;
    text?: string;
  };

  if (typeof text !== "string" || !text.trim()) {
    res.status(400).json({ message: "Provide non-empty 'text' in request query." });
    return;
  }

  const safeTitle =
    typeof title === "string" && title.trim().length > 0
      ? escapeHtml(title.trim())
      : "Document";

  const paragraphs = escapeHtml(text)
    .split(/\n{2,}/)
    .map((block) => `<p>${block.replace(/\n/g, "<br>")}</p>`)
    .join("");

  const html = `
    <!doctype html>
    <html>
      <head>
        <meta charset="utf-8" />
        <title>${safeTitle}</title>
        <style>
          body { font-family: Arial, sans-serif; padding: 24px; color: #222; }
          h1 { font-size: 20px; margin-bottom: 16px; }
          p { line-height: 1.6; margin: 0 0 12px; }
        </style>
      </head>
      <body>
        <h1>${safeTitle}</h1>
        ${paragraphs}
      </body>
    </html>
  `;

  try {
    const browser = await puppeteer.launch({
      headless: true,
      args: ["--no-sandbox", "--disable-setuid-sandbox"]
    });

    const page = await browser.newPage();
    await page.setContent(html, { waitUntil: "networkidle0" });

    const buffer = await page.pdf({
      format: "A4",
      margin: { top: "1cm", bottom: "1cm", left: "1cm", right: "1cm" }
    });

    await browser.close();

    const filename = `${safeTitle.replace(/\s+/g, "-").toLowerCase() || "document"}.pdf`;
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
    res.send(buffer);
  } catch (err) {
    console.error("Failed to generate PDF:", err);
    res.status(500).json({ message: "Unable to generate PDF" });
  }
};



