import axios from 'axios';

const WEBHOOK_PORT = process.env.WEBHOOK_PORT || 3080;
const url = `http://localhost:${WEBHOOK_PORT}/api/deployments/deploy`;

const payload = {
    userId: 5,
    service: "JUPYTER",
    tier: "DEFAULT",
    provider: "SPHERON",
    config: {
        repoUrl: "https://github.com/Aquanodeio/templates/tree/main/jupyter",
        branchName: "main",
        runCommand: "cd python-calculator-server",
    }
}

axios.post(url, payload)
    .then(response => {
        console.log('Jupyter Instance Created:');
        console.log('response:', response.data);
        console.log('URL:', response.data.appUrl);
        console.log('Token:', response.data.token);
        console.log('Access URL:', response.data.accessUrl);
    })
    .catch(error => {
        console.error('Error creating Jupyter instance:', error);
    });
