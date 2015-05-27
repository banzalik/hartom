module.exports = {
    /*global page:false, phantom:false, fs:false */

    config: {
        pathHAR: './har/',
        pathScreen: false
    },

    initPage: function () {
        if (!Date.prototype.toISOString) {
            Date.prototype.toISOString = this.toISOString;
        }
        page.resources = [];
        this.initPageHARLog();
    },

    initPageHARLog: function () {

        var self = this;
        page.onLoadStarted = function () {
            page.startTime = new Date();
        };
        page.onLoadFinished = function () {
            page.endTime = new Date();
        };
        page.onInitialized = function () {
            page.initializedTime = new Date();
        };

        page.onResourceRequested = function (req) {
            var cookies = self.filterCookies(req.url, phantom.cookies);

            if (cookies[0].length) {
                req.cookies = cookies[0];
            }

            if (cookies[1].length) {
                req.headers.push({
                    'name': 'Cookie',
                    'value': cookies[1]
                });
            }

            page.resources[req.id] = {
                request: req,
                startReply: null,
                endReply: null
            };
        };

        page.onResourceReceived = function (res) {
            if (res.stage === 'start') {
                page.resources[res.id].startReply = res;
            }
            if (res.stage === 'end') {
                page.resources[res.id].endReply = res;
            }
        };
    },

    toISOString: function () {
        function pad(n) {
            return n < 10 ? '0' + n : n;
        }

        function ms(n) {
            return n < 10 ? '00' + n : n < 100 ? '0' + n : n;
        }

        return this.getFullYear() + '-' +
            pad(this.getMonth() + 1) + '-' +
            pad(this.getDate()) + 'T' +
            pad(this.getHours()) + ':' +
            pad(this.getMinutes()) + ':' +
            pad(this.getSeconds()) + '.' +
            ms(this.getMilliseconds()) + 'Z';
    },

    parseUri: function parseUri(str) {
        var o = this.parseUriOptions,
            m = o.parser[o.strictMode ? 'strict' : 'loose'].exec(str),
            uri = {},
            i = 14;

        while (i--) {
            uri[o.key[i]] = m[i] || '';
        }

        uri[o.q.name] = {};
        uri[o.key[12]].replace(o.q.parser, function ($0, $1, $2) {
            if ($1) {
                uri[o.q.name][$1] = $2;
            }
        });

        return uri;
    },

    parseUriOptions: {
        strictMode: false,
        key: [
            'source',
            'protocol',
            'authority',
            'userInfo',
            'user',
            'password',
            'host',
            'port',
            'relative',
            'path',
            'directory',
            'file',
            'query',
            'anchor'],
        q: {
            name: 'queryKey',
            parser: /(?:^|&)([^&=]*)=?([^&]*)/g
        },
        parser: {
            strict: /^(?:([^:\/?#]+):)?(?:\/\/((?:(([^:@]*)(?::([^:@]*))?)?@)?([^:\/?#]*)(?::(\d*))?))?((((?:[^?#\/]*\/)*)([^?#]*))(?:\?([^#]*))?(?:#(.*))?)/, // jshint ignore:line
            loose: /^(?:(?![^:@]+:[^:@\/]*@)([^:\/?#.]+):)?(?:\/\/)?((?:(([^:@]*)(?::([^:@]*))?)?@)?([^:\/?#]*)(?::(\d*))?)(((\/(?:[^?#](?![^?#\/]*\.[^?#\/.]+(?:[?#]|$)))*\/?)?([^?#\/]*))(?:\?([^#]*))?(?:#(.*))?)/ // jshint ignore:line
        }
    },

    filterCookies: function (host, cookies) {
        var parsedUrl = this.parseUri(host),
            realHost = parsedUrl.host.replace('www.', ''),
            toReturnStr = '', toReturn = [];

        for (var i = 0, cSize = cookies.length; i < cSize; i++) {
            var current = cookies[i];

            if (realHost.indexOf(current.domain) >= 0) {
                toReturn.push({
                    'name': current.name,
                    'value': current.value,
                    'expires': current.expires,
                    'httpOnly': current.httponly,
                    'secure': current.secure
                });
                toReturnStr += current.name + '=' + current.value + '; ';
            }
        }

        return [toReturn, toReturnStr];
    },

    saveHAR: function (path) {
        var system = require('system'),
            har = this.createHAR(page.url, system.pid, '', page.startTime, page.resources);
        console.log('Write HAR file: ', this.config.pathHAR + path);
        fs.write(this.config.pathHAR + path, JSON.stringify(har, undefined, 2), 'w');
        if (this.config.pathScreen && this.config.pathScreen.length) {
            var screenURl = (this.config.pathScreen + path + '.png').replace('.json', '');
            page.render(screenURl);  // jshint ignore:line
        }
    },

    resetHAR: function () {
        page.resources = [];
        console.log('Reset HAR log!');
        return true;
    },

    createHAR: function (address, id, title, startTime, resources) {
        var entries = [];

        resources.forEach(function (resource) {
            var request = resource.request,
                startReply = resource.startReply,
                endReply = resource.endReply;

            if (!request || !startReply || !endReply) {
                return;
            }

            // Exclude Data URI from HAR file because
            // they aren't included in specification
            if (request.url.match(/(^data:image\/.*)/i)) {
                return;
            }

            entries.push({
                startedDateTime: request.time.toISOString(),
                time: endReply.time - request.time,
                _id: request.id,
                request: {
                    method: request.method,
                    postData: request.postData ? {text: request.postData} : null,
                    url: request.url,
                    httpVersion: 'HTTP/1.1',
                    cookies: request.cookies,
                    headers: request.headers,
                    queryString: [],
                    headersSize: -1,
                    bodySize: -1
                },
                response: {
                    status: endReply.status,
                    statusText: endReply.statusText,
                    httpVersion: 'HTTP/1.1',
                    cookies: [],
                    headers: endReply.headers,
                    redirectURL: '',
                    headersSize: -1,
                    bodySize: startReply.bodySize,
                    content: {
                        size: startReply.bodySize,
                        mimeType: endReply.contentType
                    }
                },
                cache: {},
                timings: {
                    blocked: 0,
                    dns: -1,
                    connect: -1,
                    send: 0,
                    wait: startReply.time - request.time,
                    receive: endReply.time - startReply.time,
                    ssl: -1
                },
                pageref: address
            });
        });

        return {
            log: {
                version: '1.2',
                creator: {
                    name: 'PhantomJS',
                    version: phantom.version.major + '.' + phantom.version.minor +
                    '.' + phantom.version.patch
                },
                pages: [{
                    startedDateTime: startTime.toISOString(),
                    id: 'page_' + id,
                    title: address,
                    pageTimings: {
                        onContentLoad: page.initializedTime - page.startTime,
                        onLoad: page.endTime - page.startTime
                    }
                }],
                entries: entries
            }
        };
    }
};
