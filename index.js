let express = require('express');
let app = express();
const port = process.env.PORT || 3000;
let request = require('request')


const addedDiff = require("deep-object-diff").addedDiff;

let bodyParser = require('body-parser');
app.use(bodyParser.json()); // support json encoded bodies
app.use(bodyParser.urlencoded({ extended: true })); // support encoded bodies


let FeedParser = require('feedparser');


var CronJob = require('cron').CronJob;



const NodeCache = require( "node-cache" );
const myCache = new NodeCache();
// routes will go here

// start the server
app.get('/feeds', function (req, res) {

  res.send('Hello World');
})

app.post('/feed', function (req, res) {
	// recuperer une url

	let urls = req.body.urls;
	console.log("urls", req.body);

	res.setHeader('Content-Type', 'application/json');

	if (urls) {
		let promises = []
		for (let url of urls) {

			let promise = new Promise((resolve, reject) => {

				console.log("current url", url);
				let read = readFlux(url)

				read.then((items) => {

					myCache.set( url, items, function( err, success ) {
					  if ( !err && success ){
					    console.log( success );
					  }
					});

					console.log("Length ", items.length);

					let job = new CronJob('1 * * * * *', _ => {
						// faire une difference avec les flux precedent et utiliser les websockets uniquement pour envoyer les nouveaux articles
						let newsFeed = readFlux(url)
						newsFeed.then((itemsCron) => {
							let newFeeds = diff(myCache.get(url), itemsCron);
							// there is new feeds

							console.log("Length ", itemsCron.length);
							if ( newFeeds ) {
								// via les websockets envoyer le tableau newFeeds
								console.log("Nouveaux Feed pour : "+ url +" !!!   il y a en "+ newFeeds.length + " en plus");
								console.log(newFeeds.map((el) => { return el.title }));
								let feeds = newFeeds.concat(myCache.get(url));
								myCache.set(url, feeds);
							} else {
								console.log("Pas De Nouveaux Feed !!!");
							}
						}).catch((err) => {
							console.log("Err Job", err);
						})
					  	// console.log('You will see this message every second');
					}, null, true, 'Europe/Paris');
					job.start();
					resolve({url, items})
				}).catch((err) => {
					console.log("Err", err);
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
		// console.log("Ping url - ", url);
		request.get(url).on('error', function(err) {
	    reject(err);
	  }).pipe(feedparser)

		feedparser.on('error', function () {
		    // This is called, but it does not *catch* the error.
		    // console.log('feedParser error');
		    reject(new Error('Feed parser error - no feed'))
		});

	  feedparser.on('readable', function () {
		  // This is where the action is!
		  var stream = this; // `this` is `feedparser`, which is a stream
		  var meta = this.meta; // **NOTE** the "meta" is always available in the context of the feedparser instance
		  var item;

		  // console.log("stream", stream);
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
console.log('Server started! At http://localhost:' + port);
