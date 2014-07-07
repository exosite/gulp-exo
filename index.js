"use strict";

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

    // if (task.cookie && task.cookie[task.host]) {
    // debug(task.cookie[task.host]);
    // opt.jar.setCookie(task.cookie[task.host], 'https://' + task.host);
    // }

    var input = reduce(joinResponse, '');

    var output = input.pipe(reduce(wrapAsJSON, '{"code":null}'))
    // .pipe(zlib.createGzip())
    .pipe(request.put(url, _opt, uploadResult)).on('error', console.error)
        .pipe(zlib.createGunzip())
        .pipe(reduce(joinResponse, '')) //.on('data', console.log)

    return es.duplex(input, output);
}

function uploadResult(err, response, body) {
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
            !err && cb(JSON.parse(result.toString()))
        })
    }
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
    return prev + data.toString()
}


/**
 *	class
 *
 *
 *
 */
exports.upload = upload;
