FROM node:20-alpine

WORKDIR /app

COPY . .

RUN npm install

RUN npx prisma generate
RUN npx prisma db push

RUN npm run build

EXPOSE 8082

CMD [ "npm", "run", "start:prod" ]