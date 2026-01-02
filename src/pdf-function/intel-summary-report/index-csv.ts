import CSVHelper from './csv';

const csvRouteHandler = async (req: any, res: any, next: any): Promise<void> => {
    try {
        const objHelper = new CSVHelper();
        const csvContent = await objHelper.generateCsv(req);
        res.send({ intelObjects: csvContent, status_code: 200 });
    } catch (err) {
        console.error(err);
        res.status(500).send({ status_code: 500, message: 'Error generating CSV' });
    }
};

export default csvRouteHandler;


