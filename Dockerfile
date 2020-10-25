FROM node:alpine

WORKDIR /app

EXPOSE 8080/tcp

CMD ["npm", "start"]

RUN mkdir templates static controller
COPY package.json index.js ./
COPY templates templates/
COPY static static/
COPY controller controller/

RUN apk update && apk add git && npm install