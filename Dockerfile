FROM node:20-slim

WORKDIR /app

RUN apt-get update && apt-get install -y ca-certificates openssl && rm -rf /var/lib/apt/lists/*

RUN apt install -y \
  libnss3 \
  libatk1.0-0 \
  libx11-xcb1 \
  libxcomposite1 \
  libxrandr2 \
  libgbm1 \
  libasound2

COPY package*.json ./
COPY prisma ./prisma

RUN npm install

RUN npx prisma generate

COPY . .

RUN npm run build

CMD ["npm", "run", "start"]
