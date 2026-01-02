import fs from 'fs';
import { Request, Response, NextFunction } from 'express';
import intelReport from './methods';

interface SessionData {
  vrToken: string;
}

interface RequestWithSession extends Request {
  session: SessionData;
}

export default function (
  req: RequestWithSession,
  res: Response,
  next: NextFunction
): void {
  // get query string (cast locally — DO NOT override Request.query)
  const queryString = req.query as {
    intel_id?: string;
    report_id?: string;
  };

  // get params from query string
  const intelId = queryString.intel_id;
  const reportId = queryString.report_id;

  // validation
  if (!intelId) {
    res.redirect('/login');
    return;
  }

  try {
    const pdfFileName = `${reportId}-full.pdf`;
    const intelPdfReport = `./tmp/${pdfFileName}`;

    fs.exists(intelPdfReport, (exists: boolean) => {
      if (exists && false) {
        fs.readFile(intelPdfReport, (err, data) => {
          if (err) {
            console.error(err);
            res.send(new Error('Unable to load PDF report'));
            return;
          }

          res.setHeader(
            'Content-Disposition',
            `attachment;filename="SaferWatch - Intel Report - ${reportId}.pdf"`
          );
          res.setHeader('Content-Type', 'application/pdf');
          res.send(data);
        });
      } else {
        intelReport
          .intelFullReport(
            req.session.vrToken,
            intelId,
            '',
            req,
            res
          )
          .then((data: boolean) => {
            if (data === true) {
              fs.readFile(intelPdfReport, (err, data) => {
                if (err) {
                  console.error(err);
                  res.send(new Error('Unable to load PDF report'));
                  return;
                }

                res.setHeader(
                  'Content-Disposition',
                  `attachment;filename="SaferWatch - Intel Report - ${reportId}.pdf"`
                );
                res.setHeader('Content-Type', 'application/pdf');
                res.send(data);
              });
            } else {
              res.send(new Error('Unable to load PDF report'));
            }
          })
          .catch((err: unknown) => {
            console.error(err);
            res.send(err);
          });
      }
    });
  } catch (err) {
    res.send(err);
  }
}
