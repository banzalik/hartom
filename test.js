/*global phantom:false */
var fs = require('fs'),
    utils = require('./hartom.js'),
    page = require('webpage').create();

utils.config.pathScreen = './png/'
utils.initPage();

console.log('Open page: ', 'http://google.com');
page.open('http://google.com', function () {
    utils.saveHAR('register.json');
    phantom.exit();
});
