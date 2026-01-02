import fs from 'fs';
import { Request, Response, NextFunction } from 'express';
import intelReport from './methods';

interface QueryParams {
  intel_id?: string;
  include_media?: string | number;
  include_casenotes?: string | number;
  report_id?: string;
}

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
  // get query string
  const queryString = req.query as {
  intel_id?: string;
  include_media?: string | number;
  include_casenotes?: string | number;
  report_id?: string;
};

  // get params from query
  const intelId = queryString.intel_id;
  const includeMedia = queryString.include_media;

  let includeCaseNotes = 0;
  if (
    queryString.include_casenotes !== undefined &&
    Number(queryString.include_casenotes) > 0
  ) {
    includeCaseNotes = Number(queryString.include_casenotes);
  }

  const reportId = queryString.report_id;

  // validation
  if (!intelId) {
    res.redirect('/login');
    return;
  }

  try {
    const pdfFileName = `${reportId}-summary.pdf`;
    const intelPdfReport = `./tmp/${pdfFileName}`;

    fs.exists(intelPdfReport, (exists: boolean) => {
      if (exists && false) {
        // export pdf
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
        // else call pdf function
        intelReport
          .intelSummaryReport(
            req.session.vrToken,
            intelId,
            includeMedia,
            '',
            includeCaseNotes,
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
