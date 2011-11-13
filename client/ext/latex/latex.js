/**
 * Node Runner Module for the Cloud9 IDE
 *
 * @copyright 2010, Ajax.org B.V.
 * @license GPLv3 <http://www.gnu.org/licenses/gpl.txt>
 */

define(function(require, exports, module) {

var ide = require("core/ide");
var ext = require("core/ext");
var util = require("core/util");
var settings = require("ext/settings/settings");
var markup = require("text!ext/latex/latex.xml");
var skin = require("text!ext/latex/skin.xml");
var settingsMarkup = require("text!ext/latex/settings.xml");
var filesystem = require("ext/filesystem/filesystem");
var pdf = require("ext/latex/elements/pdf");
var logEntry = require("ext/latex/elements/log_entry");
var pdfView = require("ext/latex/view");

return ext.register("ext/latex/latex", {
    name    : "LaTeX Compilation",
    dev     : "ScribTeX.com",
    type    : ext.GENERAL,
    alone   : true,
    offline : false,
    skin    : skin,
    markup  : markup,
    deps    : [],
    commands : {
        "compile"  : {hint: "process the current document through LaTeX and show the output"}
    },
    hotitems: {},

    nodes : [],
    
    clsi : {
        proxiedUrl   : cloud9config.urlNamespace + "/clsi"
    },
    
    hook : function() {
        var self = this;
        ide.addEventListener("extload", function() {
            ext.initExtension(self);
        });
    },

    init : function() {        
        ide.addEventListener("loadsettings", function(e) {
            settings.addSection("compiler", "LaTeX", "latex");
        });
        
        ide.addEventListener("init.ext/settings/settings", function(e) {
            barSettings.insertMarkup(settingsMarkup);
        });
        
        while(tbLatexCompile.childNodes.length) {
            var button = tbLatexCompile.firstChild;
            ide.barTools.appendChild(button);
            
            if (button.nodeType == 1)
                this.nodes.push(button);
        }
        
        this.hotitems["compile"] = [btnCompile];
        
        
        mnuCtxTree.insertBefore(new apf.item({
            caption : "Set as main file",
            match   : "[file]",
            onclick : function() {
                var path = apf.activeElement.selected.getAttribute("path");
                path = path.slice(ide.davPrefix.length + 1, path.length);
                settings.model.queryNode("latex/compiler").setAttribute("main_path", path);
            }
        }), mnuCtxTree.childNodes[1]);
        
        var updateModifiedDate = function(e) {
            var node = e.node;
            var date = new Date();
            node.setAttribute("modifieddate", 
                date.toString("ddd, dd MMM yyyy HH:mm:ss") + " " + date.getUTCOffset()
            );
        }
        
        ide.addEventListener("afterfilesave", updateModifiedDate);

        this.pdfView = new pdfView(this);
        this.pdfView.init();
        
        this.setState("idle");
    },
    
    jumpToFileAndLineNumber: function(path, lineNo) {
        var name;
        // This is ok if there is no / because then lastIndexOf returns -1
        // so we get the whole string.
        name = path.slice(path.lastIndexOf("/") + 1)

        // Remove any leading /s and prepend the davPrefix.
        var fullPath = path;
        fullPath = fullPath.replace(/^(\/)*/, "");
        fullPath = ide.davPrefix + "/" + fullPath;

        var node = apf.n("<file />")
            .attr("name", name)
            .attr("contenttype", util.getContentType(name))
            .attr("path", fullPath)
            .node();

        ide.addEventListener("afteropenfile", function(e) {
            ceEditor.$editor.gotoLine(lineNo);
            ide.removeEventListener("afteropenfile", arguments.callee);
        })

        ide.dispatchEvent("openfile", { doc: ide.createDocument(node) });
    },

    /* 
     * Called when the user clicks the compile button or issues the compile 
     * command. First a list of files are built, then these are converted into
     * a request to the CLSI.
     */
    compile : function() {
        var self = this;
        this.$readDirectories(function() {
            self.sendCompileToCLSI();
        });
    },
    
    sendCompileToCLSI: function() {
        this.setState("compiling");
        
        request = {
            options : {}
        };
        
        var compiler = settings.model.queryNode("latex/compiler").getAttribute("compiler");
        if (!compiler)
            compiler = "pdflatex";
        request.options.compiler = compiler;

        // Any files which are open in the editor are sent directly with
        // their content.
        var openFiles = {};
        var openPages = tabEditors.getPages();
        for (var i = 0; i < openPages.length; i++) {
            var openPage = openPages[i];
            var path     = openPage.id;
            path = path.slice(ide.davPrefix.length + 1, path.length);
            var content = openPage.$doc.getValue();
            
            openFiles[path] = content;
                
            // Determine the root resource path. If the open and focussed 
            // document is a top level LaTeX file we use this. 
            // If not and there is a top level LaTeX file which is open 
            // but not focused then we use this. 
            // Otherwise we fall back to the manual setting. If this is not
            // present we alert the user and don't go ahead with the compile.
            if (content.match(/\\documentclass/) || content.match(/\\documentstyle/)) {
                if (!request.rootResourcePath || openPage == tabEditors.getPage()) {
                    request.rootResourcePath = path;
                }
            }
        }
        
        if (!request.rootResourcePath) {
            request.rootResourcePath = settings.model.queryNode("latex/compiler").getAttribute("main_path");
        }
        
        if (!request.rootResourcePath) {
            winNoRootResource.show();
            this.setState("done");
            return;
        }
        
        request.resources = [];
        for (i = 0; i < this.files.length; i++) {
            var file = this.files[i];
            if (openFiles[file.path]) {
                var content = openFiles[file.path];
                request.resources[i] = {
                    path    : file.path,
                    content : content
                };
            } else {
                request.resources[i] = {
                    path     : file.path,
                    modified : file.modifieddate,
                    url      : document.location.protocol + "//" + document.location.host + ide.davPrefix + "/" + file.path
                };
            }
        }
                        
        request = { compile: request };
        
        var self = this;
        apf.ajax(this.clsi.proxiedUrl + "/clsi/compile", {
            method      : "POST",
            contentType : "application/json",
            data        : apf.serialize(request),
            callback    : function(data, state, extra) {
                try {
                    var json = JSON.parse(data);
                }
                catch (e) {
                    var json = {};
                }
                
                if (extra.status == 200) {
                    self.handleCLSIResponse(json);
                } else {
                    self.handleCLSIError(json, extra.status)
                } 
            }
        });
    },
    
    handleCLSIResponse: function(data) {
        if (data.compile) {
            var compile = data.compile;
        } else {
            this.handleCLSIError(json, 200);
            return;
        }
        
        var outputProduced = false;
        
        if (compile.output_files && compile.output_files.length > 0) {
            outputProduced = true;
            this.pdf = compile.output_files[0];
            this.pdfView.setPdf(this.pdf.url);
            this.pdfView.showPdf();
        } else {
            this.pdfView.setPdf(null);
        }
        
        if (compile.logs && compile.logs.length > 0) {
            this.log = compile.logs[0];
            this.setState("parsingLog");
            this.fetchAndParseLog();
        } else {
            this.setState("done");
        }
        
        if (!outputProduced) {
            this.pdfView.showLog();
        }
    },

    handleCLSIError: function(data, statusCode) {
        winCLSIError.show();
        this.setState("error");
    },
    
    fetchAndParseLog: function() {
        var self = this;
       
        var pathRegex = /(?:https?:\/\/)?[^\/]*(.*)/;
        if (m = this.log.url.match(pathRegex)) {
            var proxiedLogUrl = this.clsi.proxiedUrl + m[1];
            apf.ajax(proxiedLogUrl, {
                method   : "GET",
                callback : function(data, state, extra) {
                    self.log.content = data;
                    self.pdfView.setLog(self.log.content);
                    self.setState("done");
                }
            });
        } else {
            self.setLogTabToLog("");
            self.setState("done");
        }
    },
    
    setState: function(state) {
        this.state = state;
        
        switch(this.state) {
        case "idle":
            btnCompile.enable();
            break;
        case "compiling":
            btnCompile.disable();
            break;
        case "parsingLog":
            btnCompile.disable();
            break;
        case "done":
            btnCompile.enable();
            break;
        case "error":
            btnCompile.enable();
            break;
        }
    },
    
    /* 
     * Iteratively fetches a list of the files in each directory of the project,
     * starting with the root directory. Afterwards, this.files will hold an
     * array of all files in the project, in the form
     *   {
     *     path: "path",
     *     modifieddate: "1 Jan 2010"
     *   }
     * 
     */
    $readDirectories : function(callback) {
        this.files = [];
        this.unprocessedDirectories = [];
        var self = this;
        
        function loadDirectoryIfNotLoaded(node, loadCallback) {
            // We delve deep into the apf private methods here so this is fragile.
            // The code is based on databindings.js in the apf framework.
            var loaded = node.getAttribute("a_loaded");
            if (!loaded || !loaded.match(/loaded/)) {
                var rule = trFiles.$getBindRule("insert", node);
                trFiles.getModel().$insertFrom(rule.getAttribute("get"), { 
                    xmlNode     : node,
                    insertPoint : node,
                    amlNode     : trFiles,
                    callback    : function() {
                        loadCallback();
                    }
                });
            } else {
                loadCallback();
            }
        }
        
        // We dig into the apf tree used to display files and make sure all
        // directories are loaded. We then traverse this tree to get all the
        // files in the project.
        function processNextDirectory(pndCallback) {
            var node = self.unprocessedDirectories.shift();
            loadDirectoryIfNotLoaded(node, function() {
                for (var i = 0; i < node.childNodes.length; i++) {
                    var childNode = node.childNodes[i];
                    var type = childNode.getAttribute("type")
                    if (type == "folder") {
                        self.unprocessedDirectories.push(childNode);
                    } else if (type == "file") {
                        var path = childNode.getAttribute("path");
                        path = path.slice(ide.davPrefix.length + 1, path.length);
                        self.files.push({
                            path : path,
                            modifieddate : childNode.getAttribute("modifieddate")
                        });
                    }
                }
                
                if (pndCallback)
                    pndCallback();
            });
        }
        
        var rootDir = trFiles.xmlRoot.childNodes[0];
        this.unprocessedDirectories.push(rootDir);
        
        processNextDirectory(function() {
            if (self.unprocessedDirectories.length > 0) {
                processNextDirectory(arguments.callee);
            } else {
                callback();
            }
        });
    },

    duplicate : function() {
        var config = lstRunCfg.selected;
        if (!config)
            return;

        var duplicate = config.cloneNode(true);
        apf.b(config).after(duplicate);
        lstRunCfg.select(duplicate);
        winRunCfgNew.show();
    },

    enable : function(){
        if (!this.disabled) return;
        
        this.nodes.each(function(item){
            item.setProperty("disabled", item.$lastDisabled !== undefined
                ? item.$lastDisabled
                : true);
            delete item.$lastDisabled;
        });
        this.disabled = false;
    },

    disable : function(){
        if (this.disabled) return;
        
        this.nodes.each(function(item){
            if (!item.$lastDisabled)
                item.$lastDisabled = item.disabled;
            item.disable();
        });
        this.disabled = true;
    },

    destroy : function(){
        this.nodes.each(function(item){
            item.destroy(true, true);
        });
        this.nodes = [];
    }
});

});
