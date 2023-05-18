FROM node:16

WORKDIR /usr/src/app

COPY . .

COPY ["package.json","package-lock.json","./"]

RUN npm install

EXPOSE 6379

EXPOSE 5500

EXPOSE 3000

EXPOSE 3400

RUN npm run start


