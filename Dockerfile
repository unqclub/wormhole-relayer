FROM node:16

WORKDIR /usr/src/app

COPY ["package.json","package-lock.json","./"]

RUN npm install

RUN npm run build

EXPOSE 3003

RUN npm run start:prod


