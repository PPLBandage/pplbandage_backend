FROM node:20-alpine

RUN apk add --no-cache openssl

WORKDIR /app

COPY . .

RUN npm i

RUN npx prisma generate
RUN npx prisma db push

RUN npm run build

CMD [ "npm", "run", "start" ]
