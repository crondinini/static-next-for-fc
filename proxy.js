const dgram = require('dgram');
const net = require('net');
const dns = require('dns').promises;

// UDP server for actual traffic on port 8080
const server = dgram.createSocket('udp4');
const sessionMap = new Map();

// TCP server for health checks on port 8081
const healthServer = net.createServer((socket) => {
  socket.end('OK\n');
});

server.on('message', async (msg, rinfo) => {
  const clientKey = `${rinfo.address}:${rinfo.port}`;
  // Extract PR info from first packet
  const prInfo = extractPRFromPayload(msg);
  console.log({msg: msg.toString(), rinfo, prInfo});

  // Check existing session
  if (sessionMap.has(clientKey)) {
    const target = sessionMap.get(clientKey);
    forwardToTarget(msg, target, rinfo);
    return;
  }


  if (prInfo && prInfo.prNumber) {
    try {
      // Resolve target service via Service Connect DNS
      const serviceDns = `pr-${prInfo.prNumber}.local`;
      const addresses = await dns.resolve4(serviceDns);

      if (addresses.length > 0) {
        const target = {
          host: addresses[0],
          port: 8080
        };

        sessionMap.set(clientKey, target);
        forwardToTarget(msg, target, rinfo);
        console.log(`New session: ${clientKey} -> pr-${prInfo.prNumber} at ${target.host}:${target.port}`);
      } else {
        console.error(`No IP addresses resolved for ${serviceDns}`);
      }
    } catch (error) {
      console.error(`Failed to resolve pr-${prInfo.prNumber}:`, error);
    }
  }
});

function forwardToTarget(msg, target, originalSender) {
  const client = dgram.createSocket('udp4');

  client.send(msg, target.port, target.host, (err) => {
    if (err) console.error('Forward error:', err);
  });

  // Handle response back to original client
  client.on('message', (response) => {
    server.send(response, originalSender.port, originalSender.address);
    client.close();
  });
}

function extractPRFromPayload(msg) {
  try {
    const payload = JSON.parse(msg.toString());
    console.log(JSON.stringify({payload, msg}));
    if (payload.domain) {
      const match = payload.domain.match(/pr-(\d+)/);
      return match ? { prNumber: match[1] } : null;
    }
  } catch (e) {
    const payload = msg.toString();
    const match = payload.match(/pr-(\d+)/);
    if (match) {
      return { prNumber: match[1] };
    }
  }
  return null;
}

// Start servers
server.bind(8080, '0.0.0.0', () => {
  console.log('UDP Proxy listening on port 8080');
});

healthServer.listen(8081, '0.0.0.0', () => {
  console.log('TCP Health Check listening on port 8081');
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('Shutting down...');
  server.close();
  healthServer.close();
  process.exit(0);
});
