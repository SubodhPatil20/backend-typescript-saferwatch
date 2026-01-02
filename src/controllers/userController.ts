import { Request, Response } from "express";
import { ApiError } from "../middleware/errorHandler";
import { User } from "../models/User";
import fs from 'fs';
import path from 'path';
import PDFDocument from 'pdfkit';

export const getUsers = async (_req: Request, res: Response): Promise<void> => {
  const users = await User.find().lean();
  res.status(200).json(users);
};

export const createUser = async (req: Request, res: Response): Promise<void> => {
  const { name, email, role } = req.body;

  if (!name || !email) {
    const error: ApiError = new Error("name and email are required");
    error.statusCode = 400;
    throw error;
  }

  const existing = await User.findOne({ email }).lean();
  if (existing) {
    const error: ApiError = new Error("email already exists");
    error.statusCode = 409;
    throw error;
  }

  const user = await User.create({ name, email, role });
  res.status(201).json(user);
};

export const updateUser = async (
  req: Request,
  res: Response,
): Promise<void> => {
  const { id } = req.params;
  const { name, email, role } = req.body;

  const updated = await User.findByIdAndUpdate(
    id,
    { name, email, role },
    { new: true, runValidators: true },
  ).lean();

  if (!updated) {
    const error: ApiError = new Error("user not found");
    error.statusCode = 404;
    throw error;
  }

  res.status(200).json(updated);
};

export const deleteUser = async (
  req: Request,
  res: Response,
): Promise<void> => {
  const { id } = req.params;
  const deleted = await User.findByIdAndDelete(id).lean();

  if (!deleted) {
    const error: ApiError = new Error("user not found");
    error.statusCode = 404;
    throw error;
  }

  res.status(204).send();
};



export const generatePdf  = async (req: Request, res: Response) => {
  const { text } = req.body;

  if (!text) {
    return res.status(400).json({ error: 'Text is required' });
  }

  // Create PDF document
  const doc = new PDFDocument();
  const fileName = `output_${Date.now()}.pdf`;
  const filePath = path.join(__dirname, fileName);

  doc.pipe(fs.createWriteStream(filePath));
  doc.text(text, { align: 'left' });
  doc.end();

  // When PDF generation is finished, send the file
  doc.on('finish', () => {
    res.download(filePath, fileName, (err) => {
      if (err) {
        console.error(err);
        res.status(500).send('Error downloading file');
      }
      // Optional: Delete the file after sending
      fs.unlink(filePath, (err) => {
        if (err) console.error('Error deleting file:', err);
      });
    });
  })}





