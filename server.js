let express = require('express');
let request = require('request')
const addedDiff = require("deep-object-diff").addedDiff;
let bodyParser = require('body-parser');
let FeedParser = require('feedparser');
var CronJob = require('cron').CronJob;

const NodeCache = require( "node-cache" );
const myCache = new NodeCache();

const verboseMode = false;

let app = express();
const port = process.env.PORT || 4000;

app.use(bodyParser.json()); // support json encoded bodies
app.use(bodyParser.urlencoded({ extended: true })); // support encoded bodies

const server = require('http').Server(app);
const io = require('socket.io')(server);


io.sockets.on('connection', function (socket) {
    console.log('Un client est connecté !');
});


/*
==================
GET /feeds
==================
*/

app.get('/feeds', function (req, res) {
  res.send(JSON.stringify(myCache));
});


/*
==================
POST /feed
==================
*/

app.post('/feeds', function (req, res) {

  let urls = req.body.urls;
  if(verboseMode) { console.log("urls", req.body) }

  res.setHeader('Content-Type', 'application/json');

  if (urls) {
    let promises = []
    for (let url of urls) {

      let promise = new Promise((resolve, reject) => {

        if(verboseMode) { console.log("current url", url) }
        let read = readFlux(url)

        read.then((items) => {

          myCache.set( url, items, function( err, success ) {
            if ( !err && success ){
              if(verboseMode) { console.log( success ) }
            }
          });

          if(verboseMode) { console.log("Length ", items.length) }

          let job = new CronJob('1 * * * * *', _ => {
            // faire une difference avec les flux precedent et utiliser les websockets uniquement pour envoyer les nouveaux articles
            let newsFeed = readFlux(url)
            newsFeed.then((itemsCron) => {
              let newFeeds = diff(myCache.get(url), itemsCron);
              // there is new feeds

              if(verboseMode) { console.log("Length ", itemsCron.length) }
              if ( newFeeds ) {
                // via les websockets envoyer le tableau newFeeds
                if(verboseMode) { console.log("Nouveaux Feed pour : "+ url +" !!!   il y a en "+ newFeeds.length + " en plus") }
                if(verboseMode) { console.log(newFeeds.map((el) => { return el.title })) }
                let feeds = newFeeds.concat(myCache.get(url));
                myCache.set(url, feeds);
                io.sockets.emit('feeds', newFeeds)
              } else {
                if(verboseMode) { console.log("Pas De Nouveaux Feed !!!") }
              }
            }).catch((err) => {
              if(verboseMode) { console.log("Err Job", err) }
            });
            if(verboseMode) { console.log('You will see this message every second') }
          }, null, true, 'Europe/Paris');
          job.start();
          resolve({url, items})
        }).catch((err) => {
          if(verboseMode) { console.log("Err", err) }
          reject(err)
        });

      })
      promises.push(promise);
    }

    Promise.all(promises).then((feeds) => {
      res.send(JSON.stringify(feeds))
    }).catch((err) => {
      res.send(JSON.stringify({error: {url: url, message: err.message}}))
    })
  }
})

function readFlux(url) {

  return new Promise((resolve, reject) => {

    var feedparser = new FeedParser([]);
    let items = [];
    // ping le site
    if(verboseMode) { console.log("Ping url - ", url) }
    request.get(url).on('error', function(err) {
      reject(err);
    }).pipe(feedparser)

    feedparser.on('error', function () {
      // This is called, but it does not *catch* the error.
      // if(verboseMode) { console.log('feedParser error') }
      reject(new Error('Feed parser error - no feed'))
    });

    feedparser.on('readable', function () {
      // This is where the action is!
      var stream = this; // `this` is `feedparser`, which is a stream
      var meta = this.meta; // **NOTE** the "meta" is always available in the context of the feedparser instance
      var item;

      // if(verboseMode) { console.log("stream", stream) }
      if (stream) {
        while (item = stream.read()) {
          items.push(item)
        }
      }
    });

    feedparser.on('finish', function(){
      resolve(items);
    });

  })
  // si oui
  //
}


function diff(previous, current) {
  let diff = addedDiff(previous, current);
  let formatDiff = [];

  for ( index in diff ) {
    formatDiff.push(diff[index]);
  }

  return formatDiff.length !== 0 ? formatDiff : undefined;
}


app.listen(port);
console.log('Server started! At http://localhost:' + port)
