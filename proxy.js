const net = require('net');

class CPULoadGenerator {
    constructor() {
        this.loadSessions = new Map();
        this.basePort = process.env.PORT || 3000;
    }

    // Generate CPU load that increases over time
    generateLoad(sessionId, startTime) {
        const elapsedMs = Date.now() - startTime;
        const elapsedMinutes = elapsedMs / (1000 * 60);
        
        // Stop after 5 minutes
        if (elapsedMinutes >= 5) {
            console.log(`Session ${sessionId}: Load generation complete after 5 minutes`);
            this.loadSessions.delete(sessionId);
            return;
        }

        // Calculate load intensity (0 to 1) that increases linearly over 5 minutes
        const loadIntensity = Math.min(elapsedMinutes / 5, 1);
        
        // Base work amount that scales with time
        const workAmount = Math.floor(100000 * (1 + loadIntensity * 10));
        
        // CPU-intensive work: prime number calculation
        let primes = [];
        let num = 2;
        
        while (primes.length < workAmount) {
            let isPrime = true;
            for (let i = 2; i <= Math.sqrt(num); i++) {
                if (num % i === 0) {
                    isPrime = false;
                    break;
                }
            }
            if (isPrime) {
                primes.push(num);
            }
            num++;
        }

        console.log(`Session ${sessionId}: Generated ${primes.length} primes, Load: ${(loadIntensity * 100).toFixed(1)}%, Elapsed: ${elapsedMinutes.toFixed(1)}min`);

        // Continue the load generation
        if (this.loadSessions.has(sessionId)) {
            // Vary delay inversely with load (more load = less delay between iterations)
            const delay = Math.max(50, 500 - (loadIntensity * 400));
            setTimeout(() => this.generateLoad(sessionId, startTime), delay);
        }
    }

    createTCPServer() {
        const server = net.createServer((socket) => {
            const sessionId = `${socket.remoteAddress}:${socket.remotePort}-${Date.now()}`;
            const startTime = Date.now();
            
            console.log(`New TCP connection from ${socket.remoteAddress}:${socket.remotePort}`);
            console.log(`Starting CPU load generation for session ${sessionId}`);

            // Store session info
            this.loadSessions.set(sessionId, {
                socket: socket,
                startTime: startTime
            });

            // Send welcome message
            socket.write(`CPU Load Test Started - Session: ${sessionId}\n`);
            socket.write(`Load will increase gradually over 5 minutes\n`);
            socket.write(`Monitor your CPU usage and ECS scaling\n\n`);

            // Start CPU load generation
            this.generateLoad(sessionId, startTime);

            // Send periodic updates to client
            const updateInterval = setInterval(() => {
                if (this.loadSessions.has(sessionId)) {
                    const elapsed = (Date.now() - startTime) / (1000 * 60);
                    const loadPercent = Math.min((elapsed / 5) * 100, 100);
                    socket.write(`Status: ${elapsed.toFixed(1)}min elapsed, ${loadPercent.toFixed(1)}% load intensity\n`);
                } else {
                    clearInterval(updateInterval);
                }
            }, 10000); // Update every 10 seconds

            socket.on('close', () => {
                console.log(`TCP connection closed for session ${sessionId}`);
                this.loadSessions.delete(sessionId);
                clearInterval(updateInterval);
            });

            socket.on('error', (err) => {
                console.error(`Socket error for session ${sessionId}:`, err);
                this.loadSessions.delete(sessionId);
                clearInterval(updateInterval);
            });

            // End session after 5 minutes
            setTimeout(() => {
                if (this.loadSessions.has(sessionId)) {
                    socket.write('Load test complete! CPU generation finished.\n');
                    socket.end();
                    this.loadSessions.delete(sessionId);
                    clearInterval(updateInterval);
                }
            }, 5 * 60 * 1000); // 5 minutes
        });

        return server;
    }

    start() {
        const server = this.createTCPServer();
        
        server.listen(this.basePort, '0.0.0.0', () => {
            console.log(`CPU Load Generator TCP Server listening on port ${this.basePort}`);
            console.log(`Connect with: telnet <host> ${this.basePort}`);
            console.log('Each connection will generate increasing CPU load over 5 minutes');
        });

        server.on('error', (err) => {
            console.error('Server error:', err);
        });

        // Graceful shutdown
        process.on('SIGTERM', () => {
            console.log('Received SIGTERM, shutting down gracefully');
            server.close(() => {
                console.log('Server closed');
                process.exit(0);
            });
        });

        process.on('SIGINT', () => {
            console.log('Received SIGINT, shutting down gracefully');
            server.close(() => {
                console.log('Server closed');
                process.exit(0);
            });
        });
    }
}

// Start the server
const loadGenerator = new CPULoadGenerator();
loadGenerator.start();
