# syntax=docker/dockerfile:1
FROM node:22-alpine
WORKDIR /app
ENV NODE_ENV=production

COPY ["package.json", "yarn.lock", "./"]

RUN yarn install --production=true

COPY . /app

CMD ["yarn", "start"]