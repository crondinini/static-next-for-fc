const dgram = require('dgram');
const net = require('net');
const AWS = require('aws-sdk');

// Initialize AWS Service Discovery client
const servicediscovery = new AWS.ServiceDiscovery({
  region: process.env.AWS_REGION || 'us-east-1'
});

// UDP server for actual traffic on port 8080
const server = dgram.createSocket('udp4');
const sessionMap = new Map();
const serviceCache = new Map(); // Cache service lookups

// TCP server for health checks on port 8081
const healthServer = net.createServer((socket) => {
  socket.end('OK\n');
});

server.on('message', async (msg, rinfo) => {
  const clientKey = `${rinfo.address}:${rinfo.port}`;
  console.log({msg, rinfo});

  // Check existing session
  if (sessionMap.has(clientKey)) {
    const target = sessionMap.get(clientKey);
    forwardToTarget(msg, target, rinfo);
    return;
  }

  // Extract PR info from first packet
  const prInfo = extractPRFromPayload(msg);

  if (prInfo && prInfo.prNumber) {
    try {
      // Get target service from AWS Service Discovery
      const target = await getServiceInstance(prInfo.prNumber);

      if (target) {
        sessionMap.set(clientKey, target);
        forwardToTarget(msg, target, rinfo);
        console.log(`New session: ${clientKey} -> pr-${prInfo.prNumber} at ${target.host}:${target.port}`);
      } else {
        console.error(`No healthy instances found for pr-${prInfo.prNumber}`);
      }
    } catch (error) {
      console.error(`Failed to discover service for pr-${prInfo.prNumber}:`, error);
    }
  }
});

async function getServiceInstance(prNumber) {
  const cacheKey = `pr-${prNumber}`;

  // Check cache first (cache for 30 seconds)
  if (serviceCache.has(cacheKey)) {
    const cached = serviceCache.get(cacheKey);
    if (Date.now() - cached.timestamp < 30000) {
      return cached.target;
    }
  }

  try {
    // Discover instances using AWS Service Discovery
    const params = {
      NamespaceName: process.env.SERVICE_DISCOVERY_NAMESPACE || 'pr-env.local',
      ServiceName: `pr-${prNumber}-service`,
      MaxResults: 1,
      HealthStatus: 'HEALTHY'
    };

    const result = await servicediscovery.discoverInstances(params).promise();
    console.log(JSON.stringify({result, params}));
    if (result.Instances && result.Instances.length > 0) {
      const instance = result.Instances[0];
      const target = {
        host: instance.Attributes.AWS_INSTANCE_IPV4 || instance.Attributes.AWS_INSTANCE_IP,
        port: parseInt(instance.Attributes.AWS_INSTANCE_PORT) || 8080
      };

      // Cache the result
      serviceCache.set(cacheKey, {
        target: target,
        timestamp: Date.now()
      });

      return target;
    }
  } catch (error) {
    console.error(`Service discovery error for pr-${prNumber}:`, error);
  }

  return null;
}

function forwardToTarget(msg, target, originalSender) {
  const client = dgram.createSocket('udp4');

  client.send(msg, target.port, target.host, (err) => {
    if (err) console.error('Forward error:', err);
    console.log('Forwarded to target');
  });

  // Handle response back to original client
  client.on('message', (response) => {
    console.log('Received response from target');
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
