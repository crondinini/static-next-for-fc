const AWS = require('aws-sdk');
const dgram = require('dgram');

const servicediscovery = new AWS.ServiceDiscovery();
const ssm = new AWS.SSM();
const server = dgram.createSocket('udp4');

// Cache for active connections
const sessionMap = new Map();

server.on('message', async (msg, rinfo) => {
  const clientKey = `${rinfo.address}:${rinfo.port}`;
  
  // Check existing session
  if (sessionMap.has(clientKey)) {
    const target = sessionMap.get(clientKey);
    forwardPacket(msg, target, rinfo);
    return;
  }
  
  // Extract PR info from packet (your app-specific logic)
  const prInfo = await extractPRFromPayload(msg);
  
  if (prInfo && prInfo.prNumber) {
    // Get target service from Service Discovery
    const target = await getTargetService(prInfo.prNumber);
    if (target) {
      sessionMap.set(clientKey, target);
      forwardPacket(msg, target, rinfo);
    }
  }
});

async function getTargetService(prNumber) {
  try {
    const result = await servicediscovery.discoverInstances({
      NamespaceName: 'pr-env.local',
      ServiceName: `pr-${prNumber}-service`
    }).promise();
    
    if (result.Instances.length > 0) {
      return {
        host: result.Instances[0].Attributes.AWS_INSTANCE_IPV4,
        port: 8080
      };
    }
  } catch (error) {
    console.error('Service discovery failed:', error);
  }
  return null;
}

async function extractPRFromPayload(msg) {
  // Your application-specific logic to extract PR info
  // Could be from:
  // 1. First packet contains domain/PR info
  // 2. Protocol-specific headers
  // 3. Lookup from external mapping
  
  // Example: if your protocol includes a header
  const payload = msg.toString();
  console.log(JSON.stringify({payload, msg}));
  const match = payload.match(/pr-(\d+)/);
  
  return match ? { prNumber: match[1] } : null;
}

function forwardPacket(msg, target, originalSender) {
  const client = dgram.createSocket('udp4');
  
  client.send(msg, target.port, target.host, (err) => {
    if (err) console.error('Forward error:', err);
    client.close();
  });
  
  // Handle response forwarding back to original client
  client.on('message', (response) => {
    server.send(response, originalSender.port, originalSender.address);
  });
}

server.bind(8080);
