var Q = require('q');
var buildStaticDistributable = require("./build_static_dist"),
	copyStaticDistributable = require("./copy_static_dist"),
	buildTemplates = require("./build_templates"),
	getRenderer = require('./get_renderer'),
	getPartials = require('./get_partials'),
	makeDocMap = require('../doc_map/make'),
	addHelpers = require("./add_helpers"),
	generateStatic = require("./static"),
	writeDoc = require("../doc_object/write"),
	fs = require("fs-extra"),
	mkdirs = Q.denodeify(fs.mkdirs);
	



module.exports = function(files, options){
	
	// 1. Copies everything from site/default/static to site/static/build
	// 2. Overwrites site/static/build with content in `options.static`
	// 3. Runs site/static/build/build.js
	//    A. Builds itself and copies everything to site/static/dist
	var builtPromise = buildStaticDistributable(options).then(function(){
		return copyStaticDistributable(options)
	}).catch(function(e){
		console.log(e, e.stack);
	});
	
	// 1. Copies site/default/templates to site/templates
	// 2. Copies `options.templates` to site/templates
	var builtTemplatesAndRendererPromise = buildTemplates(options).then(function(){
		// Creates a renderer function and adds partials to mustache
		return Q.all([
			getRenderer(),
			getPartials()
		]).then(function(results){
			// returns the renderer
			return results[0];
		});
	}).catch(function(e){
		console.log(e, e.stack);
	});
	
	// Read all documentation files and put them in a docMap
	Q.all([
		makeDocMap(files, options),
		builtTemplatesAndRendererPromise,
		mkdirs(options.out)
	]).then(function(results){
		// Once all docObjects are ready and the template is rendered ...
		var docMap = results[0],
			renderer = results[1],
			currentDocObject,
			promises = [];
		
		// Check that parent is in docMap
		if(!docMap[options.parent]){
			throw "The parent DocObject ("+options.parent+") was not found!";
		}
		
		// Setup mustache helpers
		addHelpers(docMap, options, function(){
			return currentDocObject;
		});
		
		// Go through each object and write it out.
		for(var name in docMap){
			currentDocObject = docMap[name];
			promises.push(writeDoc(currentDocObject, renderer, options));
		}
		return Q.all(promises);
	}).catch(function(e){
		console.log("ERROR:",e+"\n", e.stack || "");
	});

	builtTemplatesAndRendererPromise.then(function(renderer){
		return generateStatic(options, renderer);
	}).catch(function(e){
		console.log(e, e.stack);
	});

};