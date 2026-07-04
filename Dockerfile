FROM node:20-alpine

WORKDIR /app

# OpenSSL e libs necessarias pro motor do Prisma funcionar no Alpine
RUN apk add --no-cache openssl libc6-compat

COPY package*.json ./
RUN npm install
COPY . .
RUN npx prisma generate
EXPOSE 3001
CMD ["sh", "-c", "npx prisma migrate deploy && node src/server.js"]