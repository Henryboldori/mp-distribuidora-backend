FROM node:20-alpine
WORKDIR /app

# O Prisma precisa do OpenSSL para funcionar no Alpine Linux
RUN apk add --no-cache openssl

COPY package*.json ./
RUN npm install
COPY . .
RUN npx prisma generate
EXPOSE 3001
CMD ["sh", "-c", "npx prisma migrate deploy && node src/server.js"]