# polling-server



# Installation

```
npm install
```

# Launch Server
```
npm run start
```
server start on http://localhost:4000

# API Documentation

## POST /feeds

Add news feeds

POST an array of urls with the following command 

```
  curl -H "Content-Type: application/json" -X  POST -d '{"urls":[URL_1, URL_2...]}' http://localhost:4000/feeds
```

Replace URL_1, URL_2 with the urls you want to poll
