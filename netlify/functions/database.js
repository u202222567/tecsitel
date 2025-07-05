const fetch = require('node-fetch');

// Variables de entorno que configurarás en Netlify
const GITHUB_TOKEN = process.env.GITHUB_PAT;
const GITHUB_REPO = process.env.GITHUB_REPO; // ej: "tu-usuario/tecsitel-database"
const GITHUB_USER = process.env.GITHUB_USER; // ej: "tu-usuario"
const GITHUB_EMAIL = process.env.GITHUB_EMAIL; // ej: "tu-email@example.com"

const API_URL = `https://api.github.com/repos/${GITHUB_REPO}/contents/database.json`;

exports.handler = async function(event, context) {
    const headers = {
        'Authorization': `token ${GITHUB_TOKEN}`,
        'Accept': 'application/vnd.github.v3+json',
    };

    // ====== MANEJAR SOLICITUD GET (LEER DATOS) ======
    if (event.httpMethod === 'GET') {
        try {
            const response = await fetch(API_URL, { headers });
            if (!response.ok) {
                return { statusCode: response.status, body: response.statusText };
            }
            const data = await response.json();
            const content = Buffer.from(data.content, 'base64').toString('utf-8');
            
            return {
                statusCode: 200,
                body: content,
            };
        } catch (error) {
            return { statusCode: 500, body: JSON.stringify({ error: 'Failed to fetch data' }) };
        }
    }

    // ====== MANEJAR SOLICITUD POST (ESCRIBIR DATOS) ======
    if (event.httpMethod === 'POST') {
        try {
            // 1. Obtener el SHA actual del archivo (necesario para actualizar)
            const getResponse = await fetch(API_URL, { headers });
            if (!getResponse.ok) throw new Error('Could not get current file SHA.');
            const fileData = await getResponse.json();
            const currentSha = fileData.sha;

            // 2. Preparar el nuevo contenido
            const newContentBase64 = Buffer.from(event.body).toString('base64');
            const body = JSON.stringify({
                message: `chore: update database [skip ci]`,
                content: newContentBase64,
                sha: currentSha,
                committer: {
                    name: GITHUB_USER,
                    email: GITHUB_EMAIL,
                }
            });

            // 3. Enviar la actualización a GitHub
            const updateResponse = await fetch(API_URL, {
                method: 'PUT',
                headers,
                body,
            });

            if (!updateResponse.ok) {
                const errorBody = await updateResponse.json();
                console.error("GitHub API Error:", errorBody);
                throw new Error('Failed to update data.');
            }

            return {
                statusCode: 200,
                body: JSON.stringify({ success: true, message: 'Data updated successfully' }),
            };
        } catch (error) {
            console.error(error);
            return { statusCode: 500, body: JSON.stringify({ error: error.message }) };
        }
    }

    return {
        statusCode: 405, // Method Not Allowed
        body: 'Method Not Allowed',
    };
};