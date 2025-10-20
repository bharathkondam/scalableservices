FROM node:20-alpine AS base

ENV NODE_ENV=production
ENV PORT=3000

WORKDIR /usr/src/app

COPY package.json package.json

RUN npm install --production

COPY src ./src

EXPOSE 3000

CMD ["node", "src/index.js"]
