/**
 * CLSI Proxy for the Cloud9 IDE
 *
 * @copyright 2010, Ajax.org B.V.
 * @license GPLv3 <http://www.gnu.org/licenses/gpl.txt>
 */
var Plugin = require("cloud9/plugin");
var sys    = require("sys");
var url    = require("url");
var http   = require("http");

var ShellGitPlugin = module.exports = function(ide) {
    this.ide       = ide;
    this.hooks     = [];
    this.name      = "clsi-proxy"
    this.clsiUrl   = ide.options.clsiUrl;
    this.clsiToken = ide.options.clsiToken;

    this.establishProxy();
};

sys.inherits(ShellGitPlugin, Plugin);

(function() {
    this.establishProxy = function() {

        var self = this;
        
        this.ide.httpServer.use(function(req, res, next) {
            var proxyUrl = self.ide.options.urlNamespace + "/clsi"
            if (req.url.match("^" + proxyUrl)) {
                // Remove proxyUrl from beginning of url
                req.url = req.url.slice(proxyUrl.length, req.url.length);
                self.$interceptJSON(req, res, next);
            } else {
                next();
            }
        });
    };

    // Grab the incoming request and modify the JSON if it is a
    // compile request.
    this.$interceptJSON = function(req, res, next) {
        var self = this;

        var body = "";
        req.on("data", interceptDataListener = function(chunk) {
            body += chunk;
        });

        req.on("end", interceptEndListener = function() {
            if (req.url.match("^/clsi/compile")) {
                body = self.$insertToken(body);
            }
            self.$sendRequest(body, req, res, next);
        });
    };

    // Read the JSON compile request and insert the CLSI token
    // and user identification credentials after each resource URL
    this.$insertToken = function(body) {
        // If it isn't valid JSON just return it as it is.
        try {
            var object = JSON.parse(body);
        }
        catch(e) {
            return body;
        }
        object.compile = (object.compile || {})
        object.compile["token"] = this.clsiToken;
        return JSON.stringify(object);
    };

    // Send the incoming request to the CLSI server. Return any response
    // from the CLSI server. The body may have been updated with modified
    // JSON so we grab that separately.
    this.$sendRequest = function(body, req, res, next) {
        var backendUrl = url.parse(this.clsiUrl + req.url + "?format=json");
        
        var port = backendUrl.port;
        if (!port) {
            if (backendUrl.protocol == "http:") port = 80;
            else if (backendUrl.protocol == "https:") port = 443;
            else port = 80;
        }
        
        var client = http.createClient(port, backendUrl.hostname);
        client.on("error", function(e) {
            res.statusCode = 500;
            res.write(JSON.stringify({
                error: e.message
            }));
            res.end();
        });

        // Since we may have updated the body, we need to reset Content-Length
        var headers = req.headers;
        headers["content-length"] = body.length;

        var backendReq = client.request(
                                    req.method,
                                    backendUrl.pathname + (backendUrl.search || ""),
                                    headers
                                );

        backendReq.on("response", function(backendRes) {
            backendRes.on("data", function(chunk) {
                res.write(chunk, "binary");
            });
            backendRes.on("end", function() {
                res.end();
            });
            res.writeHead(backendRes.statusCode, backendRes.headers);
        });

        backendReq.write(body);
        backendReq.end();
    };
}).call(ShellGitPlugin.prototype);
