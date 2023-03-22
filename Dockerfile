FROM node:16

WORKDIR /usr/src/app

COPY . .

COPY ["package.json","package-lock.json","./"]

RUN npm install

EXPOSE 6379

EXPOSE 3300

RUN npm run start


