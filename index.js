// "use strict";

// core
var fs = require('fs'),
    util = require('util'),
    path = require('path'),
    zlib = require('zlib');

// 3rd party
var extend = require('extend'),
    request = require('request'),
    es = require('event-stream'),
    reduce = require('stream-reduce'),
    gutil = require('gulp-util'),
    // progress = require('request-progress'),
    debug = require('debug')('widget-uploader');

// basic auth
var _opt = {
    headers: {
        'User-Agent': 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/35.0.1916.114 Safari/537.36',
        'Accept-Encoding': 'gzip'
    },
    strictSSL: false
};

// function checkSession(task) {

//     debug('check session');
//     var deferred = Q.defer();

//     var signinPage = 'https://' + task.host + '/login';
//     var signinRequest = 'https://' + task.host + '/process';

//     // setup request option
//     var opt = extend({}, _opt);
//     opt.followRedirect = true;
//     opt.followAllRedirects = true;
//     opt.headers.Origin = 'https://' + task.host;
//     opt.headers.Refer = 'https://' + task.host + '/login';
//     opt.jar = request.jar();

//     if (task.cookie && task.cookie[task.host]) {
//         // debug(task.cookie[task.host]);
//         opt.jar.setCookie(task.cookie[task.host], 'http://' + task.host);
//     }

//     request.get(signinPage, opt, function(err, response, body) {

//         if (err) {
//             return deferred.reject(err);
//         }

//         // you are at home
//         if (response.request.href.match('/views')) {
//             return deferred.resolve(task);
//         }

//         // need authentication
//         if (response.request.href.match('/login')) {
//             var getBody = null;

//             if (response.headers['content-encoding'] == 'gzip') {
//                 getBody = gunzip(body);
//             } else {
//                 getBody = Q(body);
//             }

//             getBody
//                 .then(findCSRF)
//                 .then(function(csrf) {
//                     var form = {
//                         formname: 'accountlogin',
//                         postid: matches[1],
//                         'form[user]': task.auth.username,
//                         'form[pass]': task.auth.password
//                     };

//                     // recurrent on promting Password by count
//                     return authenticate(3, form);
//                 })
//                 .then(function(cookie) {
//                     task.cookie = (task.cookie || {});
//                     task.cookie[task.host] = cookie;
//                     deferred.resolve(task);
//                 })
//                 .fail(function(err) {
//                     console.error(err);
//                     deferred.reject(err);
//                 })
//                 .done();
//         }

//     });

//     function authenticate(count, form) {

//         var deferred = Q.proise();
//         var prepare = Q(form);

//         if (!form['form[pass]']) {
//             prepare = prepare.then(promptPassword).spread(function(pwd) {
//                 form['form[pass]'] = pwd;
//                 return form;
//             });
//         }

//         prepare
//             .then(postForm)
//             .fail(function() {
//                 // failed, retry
//                 if (count-- > 0) {

//                     form['form[pass]'] = '';

//                     // try to get csrf token
//                     request.get(signinPage, opt, function(err, response, body) {
//                         if (err || !matches) {
//                             if (err) debug(err);
//                             if (!matches) debug('post id not found');
//                             console.error('post id not found');
//                             deferred.reject('fatal error: signin page unavailable');
//                             return;
//                         }

//                         getBody
//                             .then(findCSRF)
//                             .then(function(csrf) {
//                                 form.postid = csrf;
//                                 // recurrent on promting Password by count
//                                 authenticate(count, form);
//                             })
//                             .fail(function(err) {
//                                 console.error(err);
//                                 deferred.reject(err);
//                             })
//                             .done(); // end
//                     });
//                 } else {
//                     console.error('authentication failed');
//                     deferred.reject('authentication failed');
//                 }
//             })
//             .done(); // end

//     }

//     function postForm(form) {

//         var deferred = Q.defer();

//         request.post(signinRequest, opt, function(err, response, body) {

//             debug(response.statusCode);
//             debug('formpost result: ' + response.request.href);

//             if (err) {
//                 deferred.reject(err);
//                 return;
//             }

//             // success
//             if (response.request.href.match('/views')) {
//                 deferred.resolve(opt.jar.getCookieString('https://' + task.host));
//                 return;
//             }

//         }).form(form);

//     }


//     return deferred.promise;
// }

// function gunzip(chunk) {
//     return Q.nfcall(zlib.gunzip, new Buffer(chunk));
// }

// function findCSRF(body) {
//     var matches = body.match(/<input type="hidden" name="formname" value="accountlogin"\/><input type="hidden" name="postid" value="([a-z0-9]+)"\/>/);

//     if (!matches) {
//         debug('post id not found');
//         return Q.reject('post id not found');
//         // deferred.reject('fatal error: signin page unavailable');
//         // return;
//     }

//     return Q(matches[1]);
// }

/**
 *	upload file based on the task body
 *
 */
// function uploadWidget(task) {
//     debug('uploadWidget');
//     // debug(task);

//     var body = JSON.stringify({
//         code: task.widgetContent
//     });
//     // var body = {
//     //     code: task.widgetContent
//     // };
//     // debug(body);
//     var deferred = Q.defer();

//     var url = 'https://' + task.host + '/api/portals/v1/widget-scripts/' + task.widgetId;

//     var opt = extend({
//         body: body,
//         jar: request.jar(),
//         encoding: null
//     }, _opt);

//     opt.headers['Content-Type'] = 'application/json';

//     opt.followRedirect = false;

//     if (task.cookie && task.cookie[task.host]) {
//         // debug(task.cookie[task.host]);
//         opt.jar.setCookie(task.cookie[task.host], 'https://' + task.host);
//     }

//     // if (task.auth && task.auth.username && task.auth.password) {
//     //     opt.auth = task.auth;
//     // }

//     var uploadRequest = request.put(url, opt, function(err, response, body) {

//         if (err) {
//             debug(err);
//             deferred.reject(err);
//             return;
//         }

//         // zlib.gunzip(body, console.log);

//         // process.exit();

//         var getBody = null;

//         if (response.headers['content-encoding'] == 'gzip') {
//             getBody = gunzip(body);
//         } else {
//             getBody = Q(body.toString());
//         }

//         debug('status: ' + response.headers.status);

//         if (response.statusCode == 200) {
//             getBody.then(function(body) {
//                 body = JSON.parse(body);
//                 if (body.code) {
//                     debug('upload success');
//                     deferred.resolve(task);
//                 } else {
//                     deferred.reject('upload format error');
//                 }
//             }).done();
//         } else if (response.statusCode == 403) {
//             deferred.reject('you can not modify this widget');
//         } else {
//             deferred.reject('upload failed');
//         }

//     });

//     return deferred.promise;
// }

// function promptPassword() {

//     var read = require('read');

//     return Q.nfcall(read, {
//         prompt: 'Password: ',
//         silent: true
//     });
// }

// function setGlobal(opt) {

// if (opt.jar) {
//     opt.jar = option.jar;
// }

// if (option.auth) {
//     opt.auth = option.auth;
// }

// request = request.defaults(opt);
// }

function upload(opt) {

    var url = 'https://' + opt.host + '/api/portals/v1/widget-scripts/' + opt.widgetId;
    console.log('uploading to: ', url);

    var _opt = {
        encoding: null,
        headers: {
            'Content-Type': 'application/json',
            'User-Agent': 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/35.0.1916.114 Safari/537.36',
            'Accept-Encoding': 'gzip'
        },
        auth: opt.auth,
        strictSSL: false,
        followRedirect: true
    };

    // console.log(url);
    // console.log(_opt);

    // if (task.cookie && task.cookie[task.host]) {
    // debug(task.cookie[task.host]);
    // opt.jar.setCookie(task.cookie[task.host], 'https://' + task.host);
    // }

    var input = reduce(joinResponse, '');

    var output = input.pipe(reduce(wrapAsJSON, '{"code":null}'))
    // .pipe(gutil.buffer(logg))
    // .pipe(zlib.createGzip())
    .pipe(request.put(url, _opt, uploadResult)).on('error', console.error)
        .pipe(zlib.createGunzip())
        .pipe(reduce(joinResponse, '')).on('data', console.log)

    return es.duplex(input, output);
}

function uploadResult(eerr, response, body) {
    // console.log(response.statusCode)
    // console.log(response.headers)

    function cb(body) {
        if (response.statusCode == 200 && body.code) {
            console.log('upload success')
        } else {
            console.log('ERROR (%s)', response.statusCode)
        }
    }

    if (response.headers['content-encoding'] != 'gzip') {
        cb(JSON.parse(body.toString()))
    } else {
        zlib.gunzip(body, function(err, result) {
            cb(JSON.parse(result.toString()))
        })
    }
}

function logg(err, text) {
    console.log(text)
}

// a reduce call back
function wrapAsJSON(prev, data) {
    // console.log('wrapAsJSON');
    // console.log(data);
    return data ? JSON.stringify({
        code: data.toString()
    }) : prev;
}

// a reduce call back
function joinResponse(prev, data) {
    console.log(data);
    return prev + data.toString()
}


/**
 *	class
 *
 *
 *
 */
exports.upload = upload;
