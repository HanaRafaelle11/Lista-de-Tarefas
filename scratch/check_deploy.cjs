const https = require('https');

const options = {
  hostname: 'api.github.com',
  path: '/repos/HanaRafaelle11/Lista-de-Tarefas/deployments',
  headers: { 'User-Agent': 'NodeJS' }
};

https.get(options, (res) => {
  let data = '';
  res.on('data', chunk => data += chunk);
  res.on('end', () => {
    try {
      if (res.statusCode !== 200) {
        console.log(`API returned ${res.statusCode}: ${data}`);
        return;
      }
      const deployments = JSON.parse(data);
      if (deployments.length > 0) {
        const latest = deployments[0];
        console.log(`Latest deploy ID: ${latest.id}`);
        console.log(`Created at: ${latest.created_at}`);
        console.log(`Updated at: ${latest.updated_at}`);
        console.log(`Environment: ${latest.environment}`);
        
        // Fetch statuses for this deployment
        https.get({
          hostname: 'api.github.com',
          path: `/repos/HanaRafaelle11/Lista-de-Tarefas/deployments/${latest.id}/statuses`,
          headers: { 'User-Agent': 'NodeJS' }
        }, (res2) => {
          let data2 = '';
          res2.on('data', chunk => data2 += chunk);
          res2.on('end', () => {
            const statuses = JSON.parse(data2);
            if (statuses.length > 0) {
              const latestStatus = statuses[0];
              console.log(`Status: ${latestStatus.state}`);
              console.log(`URL: ${latestStatus.environment_url || latestStatus.target_url}`);
              console.log(`Timestamp: ${latestStatus.created_at}`);
            } else {
              console.log('No statuses found for latest deploy.');
            }
          });
        });
      } else {
        console.log('No deployments found.');
      }
    } catch (e) { console.error('Parse error', e); }
  });
}).on('error', err => console.error(err));
