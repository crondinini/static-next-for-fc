# Use the official Node.js runtime as base image
FROM node:18-alpine

# Set the working directory inside the container
WORKDIR /app

# Copy the server file to the container
COPY server.js .

# Expose the ports
EXPOSE 8080 8081

# Command to run the application
CMD ["node", "proxy.js"]
