/**
 * Code Editor for the Cloud9 IDE
 *
 * @copyright 2010, Ajax.org B.V.
 * @license GPLv3 <http://www.gnu.org/licenses/gpl.txt>
 */
 
 
define(function(require, exports, module) {

var ide = require("core/ide");
var ext = require("core/ext");
var EditSession = require("ace/edit_session").EditSession;
var HashHandler = require("ace/keyboard/hash_handler").HashHandler;
var useragent = require("ace/lib/useragent");
var Document = require("ace/document").Document;
var ProxyDocument = require("ext/code/proxydocument");
var CommandManager = require("ace/commands/command_manager").CommandManager;
var defaultCommands = require("ace/commands/default_commands").commands;
var markup = require("text!ext/code/code.xml");
var settings = require("ext/settings/settings");
var markupSettings = require("text!ext/code/settings.xml");
var editors = require("ext/editors/editors");

apf.actiontracker.actions.aceupdate = function(undoObj, undo){
    var q = undoObj.args;
    
    if (!undoObj.initial) {
        undoObj.initial = true;
        return;
    }
    
    if (undo)
        q[1].undoChanges(q[0]);
    else
        q[1].redoChanges(q[0]);
};

var SupportedModes = {
    "application/x-tex"    : "latex",
    "application/x-bibtex" : "latex",
    "style"                : "latex",
    "class"                : "latex"
};

var contentTypes = {
    "tex"  : "application/x-tex",
    "bib"  : "application/x-bibtex",
    "sty"  : "style",
    "cls"  : "class"
};

module.exports = ext.register("ext/code/code", {
    name    : "Code Editor",
    dev     : "Ajax.org",
    type    : ext.EDITOR,
    contentTypes : Object.keys(SupportedModes),
    markup  : markup,
    deps    : [editors],
    
    nodes : [],
    commandManager: new CommandManager(useragent.isMac ? "mac" : "win", defaultCommands),
    
    getState : function(doc){
        doc = doc ? doc.acesession : this.getDocument();
        if (!doc || typeof doc.getSelection != "function") 
            return;
        
        var sel = doc.getSelection();
        return {
            scrolltop  : ceEditor.$editor.renderer.getScrollTop(),
            scrollleft : ceEditor.$editor.renderer.getScrollLeft(),
            selection  : sel.getRange()
        };
    },
    
    setState : function(doc, state){
        var aceDoc = doc ? doc.acesession : this.getDocument();
        if (!aceDoc || !state || typeof aceDoc.getSelection != "function") 
            return;
        
        var sel = aceDoc.getSelection();
        
        //are those 3 lines set the values in per document base or are global for editor
        sel.setSelectionRange(state.selection, false);
        ceEditor.$editor.renderer.scrollToY(state.scrolltop);
        ceEditor.$editor.renderer.scrollToX(state.scrollleft);
    },

    getSyntax : function(node) {
        if (!node)
            return "";
        
        var mime = node.getAttribute("customtype");
        
        if (!mime) {
            var fileName = node.getAttribute("name");

            if (fileName.lastIndexOf(".") != -1)
                mime = contentTypes[fileName.split(".").pop()];
            else
                mime = contentTypes["*" + fileName];
        }

        if (mime) {
            mime = mime.split(";")[0];
            return (SupportedModes[mime] || "text");
        }
        
        return "text";
    },
    
    getSelection : function(){
        if (typeof ceEditor == "undefined")
            return null;
        return ceEditor.getSelection();
    },

    getDocument : function(){
        if (typeof ceEditor == "undefined")
            return null;
        return ceEditor.getSession();
    },
    
    setDocument : function(doc, actiontracker){
        if (!doc.acesession) {
            var _self = this;

            doc.isInited = doc.hasValue();
            doc.acedoc = doc.acedoc || new ProxyDocument(new Document(doc.getValue() || ""));
            doc.acesession = new EditSession(doc.acedoc);
            doc.acedoc = doc.acesession.getDocument();
            
            doc.acesession.setUndoManager(actiontracker);
            
            doc.addEventListener("prop.value", function(e) {
                doc.acesession.setValue(e.value || "");
                ceEditor.$editor.moveCursorTo(0, 0);
                doc.isInited = true;
            });
            
            doc.addEventListener("retrievevalue", function(e) {
                if (!doc.isInited) 
                    return e.value;
                else 
                    return doc.acesession.getValue();
            });
            
            doc.addEventListener("close", function(){
                //??? destroy doc.acesession
            });
        }

        ceEditor.setProperty("value", doc.acesession);
        
        // When editing TeX documents we want lines to wrap
        doc.acesession.setUseWrapMode(true);
        doc.acesession.setWrapLimitRange(0,0);
        ceEditor.$editor.setShowPrintMargin(false);
    },

    hook: function() {
        var _self      = this;
        var commitFunc = this.onCommit.bind(this);
        var name       = this.name;
        
        //Settings Support
        ide.addEventListener("init.ext/settings/settings", function(e) {
            e.ext.addSection("code", name, "editors", commitFunc);
            barSettings.insertMarkup(markupSettings);
        });
        
        ide.addEventListener("loadsettings", function(e) {
            // pre load theme
            var theme = e.model.queryValue("editors/code/@theme");
            if (theme) 
                require([theme], function() {});
            // pre load custom mime types
            _self.getCustomTypes(e.model);
        });
        
        ide.addEventListener("afteropenfile", function(e) {
            if(!e.editor)
                return;

            e.editor.setState && e.editor.setState(e.doc, e.doc.state);
        });
        
        // preload common language modes
        require(["ace/mode/javascript", "ace/mode/html", "ace/mode/css"], function() {});
    },

    init: function(amlPage) {
        amlPage.appendChild(ceEditor);
        ceEditor.show();

        this.ceEditor = this.amlEditor = ceEditor;
        ceEditor.$editor.commands = this.commandManager;

        var _self = this;

        this.nodes.push(
            //Add a panel to the statusbar showing whether the insert button is pressed
            sbMain.appendChild(new apf.section({
                caption : "{ceEditor.insert}"
            })),

            //Add a panel to the statusbar showing the length of the document
            sbMain.appendChild(new apf.section({
                caption : "Length: {ceEditor.value.length}"
            }))

            /*
            mnuView.appendChild(new apf.item({
                caption : "Syntax Highlighting",
                submenu : "mnuSyntax"
            })),

            mnuView.appendChild(new apf.divider()),

            mnuView.appendChild(new apf.item({
                type    : "check",
                caption : "Show Invisibles",
                checked : "[{require('ext/settings/settings').model}::editors/code/@showinvisibles]"
            })),

            mnuView.appendChild(new apf.item({
                type    : "check",
                caption : "Wrap Lines",
                checked : "[{require('ext/settings/settings').model}::editors/code/@wrapmode]"
            }))
            */
        );
        
        mnuSyntax.onitemclick = function(e) {
            var file = ide.getActivePageModel();
            
            if (file) {
                var value = e.relatedNode.value;
                
                if (value == "auto")
                    apf.xmldb.removeAttribute(file, "customtype", "");
                else
                    apf.xmldb.setAttribute(file, "customtype", value);
                
                if (file.getAttribute("customtype")) {
                    var fileName = file.getAttribute("name");
                    
                    if (contentTypes["*" + fileName])
                        delete contentTypes["*" + fileName];
                    
                    var mime = value.split(";")[0];
                    var fileExt = (fileName.lastIndexOf(".") != -1) ?
                        fileName.split(".").pop() : null;
                    
                    if (fileExt && contentTypes[fileExt] !== mime)
                        delete contentTypes[fileExt];
                        
                    var customType = fileExt ?
                        contentTypes[fileExt] : contentTypes["*" + fileName];
                    
                    if (!customType)
                        _self.setCustomType(fileExt ? fileExt : file, mime);
                }
            }
        };

        ide.addEventListener("keybindingschange", function(e){
            if (typeof ceEditor == "undefined")
                return;
                
            var bindings = e.keybindings.code;
            ceEditor.$editor.setKeyboardHandler(new HashHandler(bindings));
        });
    },
    
    /**
     * Saves custom syntax for extension type in settings.xml
     * 
     * @param {String|xmlNode} ext Contains the extension type shorthand
     * @param {String} mime Mime type string the extension will be related to
     */
    setCustomType: function(ext, mime) {
        var node;
        
        if (typeof ext === "string") {
            node = settings.model.queryNode('auto/customtypes/mime[@ext="' + ext + '"]');
            if (!node)
                settings.model.appendXml('<mime name="' + mime + '" ext="' + ext + '" />', "auto/customtypes");
        } else {
            var name = ext.getAttribute("name") || "";
            node = settings.model.queryNode('auto/customtypes/mime[@filename="' + name + '"]');
            if (node)
                apf.xmldb.removeAttribute(node, "ext");
            else
                settings.model.appendXml('<mime name="' + mime + '" filename="' + name + '" />', "auto/customtypes");
        }
        
        apf.xmldb.setAttribute(node, "name", mime);
        settings.save();
    },
    
    /**
     * Retrieves custom syntax for extensions saved in settings.xml
     * 
     * @param {Object} model Settings' model
     */
    getCustomTypes: function(model) {
        var customTypes = model.queryNode("auto/customtypes");
        if (!customTypes)
            customTypes = apf.createNodeFromXpath(model.data, "auto/customtypes");
        
        var mimes = customTypes.selectNodes("mime");
        mimes.forEach(function(n) {
            if (n.getAttribute("filename"))
                contentTypes["*" + n.getAttribute("filename")] = n.getAttribute("name");
            else
                contentTypes[n.getAttribute("ext")] = n.getAttribute("name");
        });
    },

    onCommit: function() {
        //console.log("commit func called!")
        //todo
    },

    enable : function() {
        this.nodes.each(function(item){
            item.show();
        });
    },

    disable : function() {
        this.nodes.each(function(item){
            item.hide();
        });
    },

    destroy : function(){
        this.nodes.each(function(item){
            item.destroy(true, true);
        });

        if (self.ceEditor) {
            ceEditor.destroy(true, true);
            mnuSyntax.destroy(true, true);
        }

        this.nodes = [];
    }
});

});
