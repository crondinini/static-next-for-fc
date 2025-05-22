const dgram = require("dgram");
const net = require("net");

const UDP_PORT = 8081;
const TCP_PORT = 8080;
const HOST = '0.0.0.0';

// UDP Server
const udpServer = dgram.createSocket("udp4");

// Handle incoming UDP messages
udpServer.on("message", (msg, rinfo) => {
  console.log(`UDP: Received message from ${rinfo.address}:${rinfo.port} - ${msg}`);
  // Echo the message back to the sender
  const response = `UDP Echo: ${msg}`;
  udpServer.send(response, rinfo.port, rinfo.address, (err) => {
    if (err) {
      console.error("UDP: Error sending response:", err);
    } else {
      console.log(`UDP: Sent response to ${rinfo.address}:${rinfo.port}`);
    }
  });
});

// Handle UDP server errors
udpServer.on("error", (err) => {
  console.error("UDP Server error:", err);
  udpServer.close();
});

// UDP server listening event
udpServer.on("listening", () => {
  const address = udpServer.address();
  console.log(`UDP Server listening on ${address.address}:${address.port}`);
});

// Bind UDP server
udpServer.bind(UDP_PORT, HOST);

// TCP Server
const tcpServer = net.createServer((socket) => {
  console.log(`TCP: Client connected from ${socket.remoteAddress}:${socket.remotePort}`);
  
  socket.on("data", (data) => {
    const message = data.toString().trim();
    console.log(`TCP: Received message from ${socket.remoteAddress}:${socket.remotePort} - ${message}`);
    
    // Echo the message back to the client
    const response = `TCP Echo: ${message}\n`;
    socket.write(response);
    console.log(`TCP: Sent response to ${socket.remoteAddress}:${socket.remotePort}`);
  });
  
  socket.on("end", () => {
    console.log(`TCP: Client ${socket.remoteAddress}:${socket.remotePort} disconnected`);
  });
  
  socket.on("error", (err) => {
    console.error(`TCP: Socket error for ${socket.remoteAddress}:${socket.remotePort}:`, err);
  });
});

// Handle TCP server errors
tcpServer.on("error", (err) => {
  console.error("TCP Server error:", err);
});

// Start TCP server
tcpServer.listen(TCP_PORT, HOST, () => {
  console.log(`TCP Server listening on ${HOST}:${TCP_PORT}`);
});

// Graceful shutdown
process.on("SIGINT", () => {
  console.log("\nShutting down servers...");
  
  udpServer.close(() => {
    console.log("UDP Server closed");
  });
  
  tcpServer.close(() => {
    console.log("TCP Server closed");
    process.exit(0);
  });
});

console.log("Starting UDP and TCP servers...");
console.log(`UDP Server will listen on port ${UDP_PORT}`);
console.log(`TCP Server will listen on port ${TCP_PORT}`);
