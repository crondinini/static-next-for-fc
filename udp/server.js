const dgram = require("dgram");
const server = dgram.createSocket("udp4");

const PORT = 8080;
const HOST = "localhost";

// Handle incoming messages
server.on("message", (msg, rinfo) => {
  console.log(`Received message from ${rinfo.address}:${rinfo.port} - ${msg}`);

  // Echo the message back to the sender
  const response = `Echo: ${msg}`;
  server.send(response, rinfo.port, rinfo.address, (err) => {
    if (err) {
      console.error("Error sending response:", err);
    } else {
      console.log(`Sent response to ${rinfo.address}:${rinfo.port}`);
    }
  });
});

// Handle server errors
server.on("error", (err) => {
  console.error("Server error:", err);
  server.close();
});

// Start listening
server.on("listening", () => {
  const address = server.address();
  console.log(`UDP Server listening on ${address.address}:${address.port}`);
});

// Bind to port and host
server.bind(PORT, HOST);

// Graceful shutdown
process.on("SIGINT", () => {
  console.log("\nShutting down server...");
  server.close(() => {
    console.log("Server closed");
    process.exit(0);
  });
});
