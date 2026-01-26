FROM node:20-bookworm

WORKDIR /app

# Chromium + зависимости для WebGL (Debian 12)
RUN apt update && apt install -y \
  chromium \
  libnss3 \
  libatk1.0-0 \
  libatk-bridge2.0-0 \
  libx11-xcb1 \
  libxcomposite1 \
  libxrandr2 \
  libgbm1 \
  libasound2 \
  libxdamage1 \
  libxfixes3 \
  libdrm2 \
  ca-certificates \
  fonts-liberation \
  && rm -rf /var/lib/apt/lists/*

ENV PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium

COPY package*.json ./
COPY prisma ./prisma

RUN npm install
RUN npx prisma generate

COPY . .
RUN npm run build

CMD ["npm", "run", "start"]
