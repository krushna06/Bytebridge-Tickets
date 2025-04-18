const fs = require('fs/promises');
const path = require('path');

module.exports.get = () => ({
    handler: async (req, res) => {
        const ticketId = req.params.id;
        const outputDir = process.env.TRANSCRIPT_OUTPUT_DIR;
        const outputPath = path.join(outputDir, `${ticketId}.html`);

        try {
            const html = await fs.readFile(outputPath, 'utf8');
            res.header('Content-Type', 'text/html');
            return res.send(html);
        } catch (err) {
            return res.code(404).send({
                error: 'Not Found',
                message: 'Transcript not found',
                statusCode: 404
            });
        }
    }
}); 