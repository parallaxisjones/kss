var http = require('http'),
   https = require('https'),
      qs = require('querystring'),
   redis = require('redis'),
  openid = require('openid'),
     url = require('url'),
 express = require('express');

var app = express.createServer();
var client = redis.createClient();

var extensions = [new openid.UserInterface(),
                  new openid.AttributeExchange({
                    "http://axschema.org/contact/email": "required",
                    "http://axschema.org/namePerson/friendly": "required"
                 })];

var relyingParty = new openid.RelyingParty(
  'http://yuze.no-ip.org:8081/oid_callback.html', // callback url
  null,  // Realm
  false, // Stateless
  false, // strict mode
  extensions);

function addUser(id, email) {
  client.sadd('users', id);
  if (email) {
    client.hset('user ' + id, 'email', email);
  }
}

// Stores entries in redis db
function storeEntries(multi, email, website, keystrokes) {
  var listKey = email + ' ' + website;

  for (var i = 0; i < keystrokes.length; ++i) {
    var ks = keystrokes[i];
    multi.rpush(listKey, ks.timestamp + " " + ks.pressLength);
  }
}

// Gets the single key of a JSON object
function getSingletonJSON(obj) {
  return Object.keys(obj)[0];
}

app.configure(function() {
  app.use(express.static(__dirname + '/static'));
  app.use(express.errorHandler({ dumpExceptions: true, showStack: true }));
});

// OpenId initiate url
app.get('/auth', function(req, res) {
  var parsedUrl = url.parse(req.url);
  var query = qs.parse(parsedUrl.query);
  var identifier = query.openid_identifier;
  if (!identifier) {
    res.writeHead(200);
    res.end('No identifier given!');
  } else {
    relyingParty.authenticate(identifier, false, function(err, authUrl) {
      if (err) {
        res.writeHead(200);
        res.end('Authentication failed: ' + err);
      } else if (!authUrl) {
        res.writeHead(200);
        res.end('Authentication failed');
      } else {
        res.writeHead(302, { Location: authUrl });
        res.end();
      }
    });
  }
});

// OpenId verify url
app.get('/verify', function(req, res) {
  relyingParty.verifyAssertion(req, function(err, result) {
    res.writeHead(200);
    if (err) {
      res.end('{ error: 1 }');
    } else {
      // TODO: Store data returned into the server
      if (result.authenticated) {
        var userId = result.claimedIdentifier;
        var email = result.email;
        client.sismember('users', userId, function (err, res) {
          if (!res) { // Add user
            addUser(userId, email);
          }
        });
      }
      result.error = 0;
      res.end(JSON.stringify(result, null, 2));
    }
  });
});

app.post('/', function (req, res) {
  var body = '';
  req.on('data', function (data) {
    body += data;
  });

  req.on('end', function () {
    var POST = qs.parse(body);
    var post = JSON.parse(getSingletonJSON(POST));
    var email = post.email;
    var payload = post.payload;

    // If we haven't seen email before, add it to the list
    if (email) {
      client.sadd("emails", email.toLowerCase());
    }
    
    var multi = client.multi();

    // add all of the keystroke data
    for (var i = 0; i < payload.length; ++i) {
      var website = payload[i].location;
      storeEntries(multi, email, website, payload[i].keystrokes);
    }

    multi.exec();

    // console.log(JSON.stringify(post, null, 2));
  });

  res.writeHead(200, {'Content-Type': 'text/plain'});
  res.end('Yay!\n');
});

app.listen(8081);

console.log('Server running at http://yuze.no-ip.org:8081');
