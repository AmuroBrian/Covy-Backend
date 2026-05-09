# Base image
FROM node:20-alpine AS builder

# Create app directory
WORKDIR /app

# A wildcard is used to ensure both package.json AND package-lock.json are copied
COPY package*.json ./
COPY prisma ./prisma/

# Install app dependencies
RUN npm ci

# Generate Prisma Client
RUN npx prisma generate

# Copy application files
COPY . .

# Build the app
RUN npm run build

# ---

# Production image
FROM node:20-alpine

WORKDIR /app

# Copy the bundled code from the builder stage
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package*.json ./
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/prisma ./prisma

# Expose port
EXPOSE 3000

# Start the server using the production build
CMD [ "npm", "run", "start:prod" ]
