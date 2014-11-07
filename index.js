"use strict";

// core
var fs = require('fs'),
    util = require('util'),
    path = require('path'),
    zlib = require('zlib')

// 3rd party
var Q = require('q'),
    extend = require('extend'),
    request = require('request'),
    es = require('event-stream'),
    reduce = require('stream-reduce'),
    gutil = require('gulp-util'),
    // progress = require('request-progress'),
    debug = require('debug')('gulp-exo')

var jar = request.jar()

var _opt = {
    encoding: null,
    headers: {
        'User-Agent': 'WidgetUploader/0.5'
    },
    strictSSL: false,
    followRedirect: true,
    jar: jar
}

function upload(opt) {
    debug(opt)
    console.log(opt)
    if( ! opt.viewId ) {
        return uploadDomainWidget(opt)
    } else {
        return uploadCustomWidget(opt)
    }
}

function uploadDomainWidget(opt) {
    var url = 'https://' + opt.host + '/api/portals/v1/widget-scripts/' + opt.widgetId
    console.log('uploading to: ', url)

    var uploadOpt = extend(true, {},_opt,{
        auth: opt.auth,
        headers: {
            'Content-Type': 'application/json',
        }
    })

    var input = reduce(joinResponse, '')

    var output = input.pipe(reduce(wrapAsJSON, '{"code":null}'))
        .pipe(request.put(url, uploadOpt, uploadResult)).on('error', console.error)
        .pipe(reduce(joinResponse, '')) //.on('data', console.log)

    return es.duplex(input, output)
}

function uploadCustomWidget(opt) {

    var deferred = Q.defer()

    var preprocess = authenticate(opt)
                        .then(getViewUpdateToken.bind(this,opt))

    var streamOutDeferred = Q.defer()

    var streamOut = es.through(function() {
        var self = this
        streamOutDeferred.promise.then(function() {
            self.emit('data','success')
        },function(err) {
            self.emit('data','failed')
        })
    })

    var uploadWidget = es.through(function(script) {
        var self = this

        Q.when(preprocess)
            .then(function(token) {

                var deferred = Q.defer()

                var form = {
                    formname: 'editwidget',
                    postid: token,
                    'form[title]': opt.title,
                    'form[viewid]': opt.viewId,
                    'form[widgetkey]': opt.widgetKey,
                    'form[widgettypeid]': '0000000032',
                    'form[widgettypename]': 'Custom Widget',
                    'form[order]': 0,
                    // 'form[rids]': opt.rids || [],
                    'form[script]': script.toString(),
                    'form[limit][unit]': 'minute',
                    'form[limit][type]': 'count',
                    'form[limit][value]': 1
                }

                console.log(form)

                postCustomWidgetUpdateForm(opt, form, function(err, url) {
                    console.log(url)
                    if(err) {
                        deferred.reject(err)
                    } else {
                        deferred.resolve(url)
                    }
                })

                return deferred.promise
            })
            .then(function(url) {
                streamOutDeferred.resolve(url)
            })
            .fail(function(err) {
                streamOutDeferred.reject(url)
            })
    })
    
    return es.duplex(uploadWidget,streamOut)
}

function postCustomWidgetUpdateForm(opt, form, cb) {
    var signinRequest = 'https://' + opt.host + '/views/process'

    var requestOpt = extend(true, {}, _opt, {
        followRedirect: true,
        followAllRedirects: true,
        headers: {
            Origin: 'https://' + opt.host,
            Refer: 'https://' + opt.host + '/views/'+opt.portalId+'/'+opt.viewId+'/load?widgetkey='+opt.widgetKey+'&mode=1'
        }
    })

    // requestOpt.auth = null

    console.log('posting custom widget')

    return request.post(signinRequest, requestOpt, function(err, response, body) {
        body = body.toString()
        console.log(body)
        // debug(response.statusCode)
        console.log(response.statusCode)
        debug('posting custom widget result: ' + response.request.href)
        // console.log(err)

        if (err || !response.request.href.match('/views')) {
            debug('widget update failed')
            console.log('widget update failed')
            cb && cb('widget update failed')
        } else {
            debug('widget update success')
            console.log('widget update success')
            cb && cb(err,response.request.href)
        }

    }).form(form)
}

function getViewUpdateToken(opt) {
    console.log('getting update token')
    var deferred = Q.defer()

    var widgetPage = 'https://' + opt.host + '/views/'+opt.portalId+'/'+opt.viewId+'/load?widgetkey='+opt.widgetKey+'&mode=1'

    var requestOpt = extend(true, {}, _opt)

    request.get(widgetPage, requestOpt, function(err, response, body) {
        body = body.toString()

        if (err || response.statusCode != 200) {
            deferred.reject(err || response.statusCode)
            return
        }

        if ( response.request.href.match(widgetPage)) {
            deferred.reject('redirected to '+response.request.href)
        }

        var matches = body.match(/<input type="hidden" name="postid" value="([a-z0-9]{32})" \/>/);
        
        if (!matches) {
            debug('widget post id not found')
            deferred.reject('fatal error: widget postid not found')
            return
        }

        deferred.resolve(matches[1])

    });

    return deferred.promise
}

function authenticate(opt) {
    var deferred = Q.defer()

    var signinPage = 'https://' + opt.host + '/login'

    // setup request option
    var requestOpt = extend(true, {}, _opt, {
        followRedirect: true,
        followAllRedirects: true
    })

    request.get(signinPage, requestOpt, function(err, response, body) {
        body = body.toString()

        if (err) {
            deferred.reject(err)
            return
        }

        // you are at home
        if (response.request.href.match('/views')) {
            deferred.resolve(true)
            return
        }
        console.log(response.request.href.match('/login'))
        // need authentication

        if (response.request.href.match('/login')) {
            var matches = body.match(/<input type="hidden" name="formname" value="accountlogin" \/><input type="hidden" name="postid" value="([a-z0-9]{32})" \/>/);
            
            if (!matches) {
                debug('post id not found')
                deferred.reject('fatal error: signin page unavailable')
                return
            }

            var form = {
                formname: 'accountlogin',
                postid: matches[1],
                'form[user]': opt.auth.username,
                'form[pass]': opt.auth.password
            }

            // recurrent on promting Password by count
            postSigninForm(opt, form, function(err, url) {
                if (err) {
                    deferred.reject(err)
                    return
                }
                console.log(url)
                deferred.resolve(url)
            })
        }

    });

    return deferred.promise
}

function postSigninForm(opt, form, cb) {

    var signinRequest = 'https://' + opt.host + '/process'

    var requestOpt = extend(true, {}, _opt, {
        followRedirect: true,
        followAllRedirects: true,
        headers: {
            Origin: 'https://' + opt.host,
            Refer: 'https://' + opt.host + '/login'
        }
    })

    // requestOpt.auth = null

    console.log('posting signin form')

    return request.post(signinRequest, requestOpt, function(err, response, body) {
        debug(response.statusCode)
        console.log(response.statusCode)
        debug('formpost result: ' + response.request.href)
        console.log(err)

        if (err || !response.request.href.match('/views')) {
            debug('failed to sign in')
            console.log('failed to sign in')
            cb && cb('failed to sign in')
        } else {
            debug('signed in')
            console.log('signed in')
            cb && cb(err,response.request.href)
        }

        
    }).form(form)

}

function uploadResult(err, response, body) {
    if (err) return console.error(err)

    function cb(body) {
        if (response.statusCode == 200) {
            try {
                body = JSON.parse(body);
                if( body.code ) {
                    console.log('upload success')
                } else {
                    throw 'FAILED! --> Malformed JSON <--'
                }
            } catch(e) {
                console.log(e+'\nresponse: '+body)
            }
        } else if(response.statusCode == 301){
            var link = body.match(/<a href="(.*)">/)

            console.log('FAILED! -->','The widget has moved to',link[1],'<--')
        } else {
            console.log('ERROR (%s)', response.statusCode)
        }
    }
    if (response.headers['content-encoding'] == 'gzip') {
        zlib.gunzip(body, function(err, result) {
            !err && cb(result.toString())
        })
    } else {
        cb(body.toString())
    }
}

// a reduce call back
function wrapAsJSON(prev, data) {
    return data ? JSON.stringify({
        code: data.toString()
    }) : prev
}

// a reduce call back
function joinResponse(prev, data) {
    return prev + data.toString()
}


/**
*   class
*
*
*
*/
exports.upload = upload;
